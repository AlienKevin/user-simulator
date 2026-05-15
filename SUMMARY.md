# User Simulator for `with-user` — Deliverables

End-to-end pipeline to train a Qwen2.5-7B-Instruct user simulator (LoRA SFT)
on one SWE-chat user's data, served on Modal as an OpenAI-compatible endpoint
that drops into [`akhatua2/with-user`](https://github.com/akhatua2/with-user).

## What was built

### 1. Research (`notes/`)
- **literature.md** — survey of recent user-simulator training (UserLM-8b
  Microsoft 2025, DAUS, USS, DIAL) and the recipe choice.
- **dataset.md** — SWE-chat schema, user picks (chose `marcus-sa`: 450 raw
  sessions → 261 usable after filtering Conductor wrappers, slash-command
  stubs, and short conversations).
- **integration.md** — the *exact* integration spec for with-user.
- **with-user-prompts.md** — verbatim system / initial / step Jinja2 templates
  with the JSON output schema.

### 2. Pipeline (`modal_app/`)
All heavy state lives on Modal Volume V2 `user-sim-vol`; local workdir is
~150 KB of scripts.

| File | What it does |
|---|---|
| `common.py` | Shared Modal app, volume, and 3 images (data / train / serve). |
| `data_prep.py` | Loads `SALT-NLP/SWE-chat`, filters to one user, splits long sessions into 10-step chunks, builds `(system, initial, step, decision)` SFT examples. Saves JSONL to `/vol/data/<user_id>/`. |
| `train.py` | Qwen2.5-7B-Instruct + LoRA r=64 SFT on A100-80GB. Merges and saves to `/vol/ckpt/<run>/merged/`. |
| `serve.py` | vLLM OpenAI-compatible web server (L40S GPU, scales to 0). |
| `smoke_test.py` | Hits the deployed endpoint with two real with-user-style messages and parses the JSON. |
| `eval.py` | Loads the merged checkpoint and reports decision-accuracy on val. |
| `inspect_data.py` | Spot-check a prepared training example. |

### 3. Drop-in artifact (`configs/`)
`configs/user-sim-marcus-sa.yaml` — copy into `with-user/` to override the
user-sim model and point at the Modal endpoint.

## Quickstart

```bash
# 0. Auth (one-time)
modal token set --token-id ... --token-secret ...
modal profile activate marl
modal secret create huggingface HF_TOKEN=hf_xxx

# 1. Prepare data (~2 min)
cd modal_app && modal run data_prep.py --user-id marcus-sa

# 2. Train (~2.5h on A100-80GB, ~$6 of credits)
modal run --detach train.py --user-id marcus-sa

# 3. Serve
modal deploy serve.py
# → URL: https://<workspace>--user-sim-marcus-sa-serve.modal.run

# 4. Smoke test
python smoke_test.py --base-url https://<workspace>--user-sim-marcus-sa-serve.modal.run/v1
```

## Drop into with-user

```bash
git clone https://github.com/akhatua2/with-user
cp ../with-user-pkg/configs/user-sim-marcus-sa.yaml configs/

export OPENAI_API_BASE="https://<workspace>--user-sim-marcus-sa-serve.modal.run/v1"
export OPENAI_API_KEY="user-sim-dev-key"

with-user run \
  --benchmark swebench --harness mini-swe-agent \
  --subset verified --split test --slice 0:5 \
  --model openai/gpt-5 \
  -c configs/user-sim-marcus-sa.yaml \
  -w 5 -o runs/usersim-marcus-sa
```

## Key design choices

1. **Base model = Qwen2.5-7B-Instruct (not Qwen3-8B).** Qwen3 has a thinking
   mode (`<think>` blocks) that complicates pure-JSON output. Qwen2.5 has the
   same Apache-2.0 license, 32K context, strong code understanding, and is
   well-supported by vLLM. Both fit the under-8B budget.
2. **LoRA, not full FT.** r=64 on all attention + MLP projections, trainable
   params 2.08% of total (161M). Per the Thinking Machines "LoRA Without
   Regret" study, this matches full-FT quality on small datasets while
   keeping the checkpoint small and training cheap.
3. **One example per session, chunked.** Sessions have median 50+ events;
   we chunk into 10-step windows (~4K tokens each) so multi-turn context is
   preserved without truncation.
4. **Decision construction from raw data.** For each assistant action in the
   real conversation, we look ahead: if a user_prompt followed before the next
   assistant action, the target is `interject` with that prompt; otherwise
   `continue`. Final distribution: 15% interject / 85% continue, matching
   the system prompt's "prefer silent" guidance.
5. **Full-sequence loss (no assistant-only mask).** TRL 0.12.1 doesn't
   support `assistant_only_loss`, and Qwen2.5's default chat template has no
   `{% generation %}` marker. We accept slight loss-mask suboptimality; the
   model still emits well-formatted JSON because the system prompt and
   training data both reinforce it.
6. **vLLM on L40S, not A100.** L40S has 48 GB which fits Qwen2.5-7B bf16 +
   reasonable KV cache, at ~$1.95/h vs $2.50/h for A100.
7. **Volume V2 for everything heavy.** HF cache, processed datasets, model
   checkpoints all live on `user-sim-vol`. Local workdir is just scripts.
8. **Avoid `claude/anthropic/sonnet/opus/haiku` in the served name** —
   `with-user/src/withuser/user_sim.py:104` would otherwise inject Anthropic
   cache-control blocks. The endpoint serves `user-sim`, which is safe.

## Budget

| Item | $ |
|---|---|
| Data prep (CPU, ~2 min) | $0.05 |
| Training (A100-80GB, ~2.5h, includes image build) | $7 |
| Serving (L40S, ~1h smoke test) | $2 |
| **Total estimate** | **~$10** |

Well under the $30 cap.
