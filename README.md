# user-simulator

Train and deploy a sub-8B user simulator that drops into
[`akhatua2/with-user`](https://github.com/akhatua2/with-user) /
`swe-bench-with-user`. Given an initial goal and the running conversation with
a coding agent, the simulator decides — every step — whether to stay silent or
interject as the human, emitting the exact JSON schema with-user's parser
expects.

End-to-end recipe: fine-tune `Qwen/Qwen2.5-7B-Instruct` with LoRA on one user's
data from [`SALT-NLP/SWE-chat`](https://huggingface.co/datasets/SALT-NLP/SWE-chat),
serve the merged model behind an OpenAI-compatible vLLM endpoint on Modal.

## Live endpoints

Both are public OpenAI-compatible servers (use any OpenAI SDK):

| Variant | URL (use as `OPENAI_API_BASE`) | Served model |
|---|---|---|
| **Untrained baseline** (Qwen2.5-7B-Instruct) | `https://marl--user-sim-marcus-sa-serve-base.modal.run/v1` | `user-sim` |
| **Fine-tuned simulator** (marcus-sa, LoRA-merged) | `https://marl--user-sim-marcus-sa-serve-trained.modal.run/v1` | `user-sim` |

Shared API key: `user-sim-dev-key`. Both auto-scale to zero after 5 min idle
(cold start ~60–90 s, warm ~1–2 s).

```bash
curl -X POST \
  "https://marl--user-sim-marcus-sa-serve-trained.modal.run/v1/chat/completions" \
  -H "Authorization: Bearer user-sim-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"user-sim","messages":[
        {"role":"system","content":"You reply only with a JSON object: {\"decision\":\"continue\"|\"interject\",\"message\":\"...\"}."},
        {"role":"user","content":"Restate as a JSON interject: the eval suite is failing on observer-llm-reasoning."}],
       "temperature":0.7,"max_tokens":200}'
```

## Drop into `with-user`

```bash
git clone https://github.com/akhatua2/with-user
cd with-user

export OPENAI_API_BASE="https://marl--user-sim-marcus-sa-serve-trained.modal.run/v1"
export OPENAI_API_KEY="user-sim-dev-key"

with-user run \
  --benchmark swebench --harness mini-swe-agent \
  --subset verified --split test --slice 0:5 \
  --model openai/gpt-5 \
  --user-model openai/user-sim \
  -c agent.user_sim.model_kwargs.drop_params=true \
  -c agent.user_sim.model_kwargs.temperature=0.7 \
  -c agent.user_sim.model_kwargs.max_tokens=400 \
  -w 5 -o runs/usersim-marcus-sa
```

A ready-made overlay is shipped at `configs/user-sim-marcus-sa.yaml`; pass
`-c configs/user-sim-marcus-sa.yaml` to apply all overrides in one flag.

The served-model name MUST NOT contain `claude/anthropic/sonnet/opus/haiku` —
`with-user/src/withuser/user_sim.py:104` would otherwise inject Anthropic
cache-control blocks into the OpenAI request. We use `user-sim`, which is safe.

---

# Report

## 1. Data sourcing

- **Source dataset**: `SALT-NLP/SWE-chat` on Hugging Face (gated) — real SWE
  coding sessions captured by the Entire.io CLI (Claude Code, OpenCode, Codex,
  Gemini CLI, etc.). Each session is a multi-turn dialog between a human
  developer and an AI coding agent with full tool-call traces.
- **User picked**: `marcus-sa` — top contributor (450 raw sessions), single
  consistent agent (Claude Code), real GitHub username.
- **Filter pipeline**:

  | Stage | Count | Dropped |
  |---|---:|---|
  | Raw `conversations.parquet` | 2,692,480 | (full dataset) |
  | Filter `user_id == "marcus-sa"` | 297,510 | other 188 users |
  | `is_conversational=True` OR `role ∈ {tool_use, tool_result}` | 54,494 | modal-progress / queue / metadata noise |
  | Usable sessions (≥2 real user_prompts, opening prompt not a slash-command stub) | **261** | 103 too short, 86 slash-command-only |
  | Chunked into windows of ≤10 step decisions | **1,752 SFT traces** | (chunking is non-destructive) |
  | Train / val split (95 / 5) | 1,665 / 87 | — |

- **Cleaning per session**: strip Conductor `<system_instruction>` workspace
  wrappers; strip `<system-reminder>` and `<command-*>` blocks; truncate
  assistant action / tool observation to 1500 chars each; truncate
  problem_statement to 600 chars.

## 2. Trace construction

Each SFT example is a multi-turn chat in OpenAI format. The user-simulator
model produces the `role=assistant` turns; the harness templates fill the
`role=user` slots.

```
[0] system    → with-user's verbatim system_template (~600 tok, fixed)
[1] user      → with-user's initial_template, {{problem_statement}} = the
                session's FIRST user_prompt
[2] assistant → {"decision":"interject","message":"<first user_prompt verbatim>"}
[3] user      → step_template (step 1, assistant_action, tool_observation, task)
[4] assistant → JSON decision: interject (with what the user actually said) if
                user spoke before next assistant turn, else continue
... up to 10 (step, decision) pairs per chunk
```

Concrete training-time content (from a real chunk):

- problem_statement = `"implement @docs/feature/coding-agent-integration/design.md @.context/attachments/plan.md\nsee commit b6e290e2... for existing impl"`
- assistant_action = `"[tool: Glob] pattern: plugin/**/* {\"pattern\": \"plugin/**/*\"}"`
- observation = the real `git show` / `Read` tool output, truncated to 1500 chars
- assistant target = `{"decision":"continue","message":""}` (most turns) or `{"decision":"interject","message":"..."}` (when the user actually spoke)

## 3. Label and length distribution

Across 17,249 assistant decision turns in the training set:

- `interject`: **2,573 (14.9%)**
- `continue`: **14,676 (85.1%)**

Matches the system prompt's *"prefer staying silent. Most steps you should
choose continue"* — natural property of the source data, not sampled.

Average rendered example length: **16,923 chars (~4,200 tokens)** → fits within
`seq_len=8192` with headroom. Average 6.7 chunks per session (long sessions
split into multiple training examples, short sessions produce 1).

## 4. Why chunk if Qwen2.5 supports 128K context?

128K is the model's *inference* context (via YaRN RoPE extension; native 32K).
Chunking was a *training-time* decision:

- VRAM: attention is O(L²) in activations; at seq 8192 + LoRA + grad checkpoint
  + bf16, training fits comfortably on A100-80GB (~30 GB activations); at seq
  32K it OOMs (~120 GB).
- Wall-clock: ~28 s/step at 8192 → 49 min/epoch; at 32K → ~2 min/step → 3.5
  h/epoch.
- More gradient updates per epoch: 1665 chunks vs ~290 whole sessions → roughly
  6× more optimizer steps, which helps small-dataset LoRA SFT.
- At inference, with-user truncates each `assistant_text` / `observation` to
  4000 chars and caps interjections at 8 per task — actual served context
  rarely exceeds ~12 K tokens, so 16 K served context is plenty.

## 5. Why loss on the *assistant* turns is correct

The simulator is **role-reversed**: in OpenAI chat format, with-user's harness
sends its template prompts as `role=system` / `role=user`, and the served model
responds as `role=assistant` — and the *content* of those assistant turns is
the simulated user's next move (the JSON decision + message).

So "assistant tokens" in the training data **are** the user-simulator's
outputs. The terminology is confusing only because of role reversal.

I trained on full-sequence loss (TRL 0.12.1 doesn't expose `assistant_only_loss`
and Qwen2.5's default chat template lacks the `{% generation %}` marker TRL
needs for the mask). This is slightly suboptimal — gradients also touch the
fixed harness-template tokens — but those tokens are essentially constant
across 1665 examples, so the meaningful signal still concentrates on the
assistant JSON outputs. Upgrading TRL to ≥ 0.13 with a custom Qwen template
would give a clean assistant-only mask and is the easiest quality bump for a
v2 run.

## 6. Training recipe

| | |
|---|---|
| Base model | `Qwen/Qwen2.5-7B-Instruct` (7.6B params, Apache-2.0, 32K context, no `<think>` mode) |
| Hardware | Modal A100-80GB PCIe, single GPU |
| Framework | TRL 0.12.1 `SFTTrainer` + PEFT 0.13.2 LoRA + Transformers 4.46.3 + torch 2.5.1 |
| LoRA | r=64, α=32, dropout=0.05, bias=none, target = q,k,v,o + gate,up,down projections |
| Trainable params | 161,480,704 (2.08% of 7.78B) |
| Optimizer | AdamW, max_grad_norm=1.0, weight_decay=0 |
| LR schedule | 2e-4, cosine, 3% warmup |
| Sequence length | 8192 |
| Batch | per-device 1, grad accum 16 → effective batch 16 |
| Epochs | 1 (104 optimizer steps) |
| Precision | bf16, gradient checkpointing (non-reentrant) |
| Total wall-clock | 49 min training + ~3 min merge & save |

After training, the LoRA adapter is merged into the base with
`PeftModel.from_pretrained(...).merge_and_unload()` and the result saved as
full fp16 weights so vLLM serves a single artifact (no per-request adapter
loading).

## 7. Loss curve

| Step | Train loss | LR |
|---:|---:|---:|
| 5 | 1.20 | 1e-4 (warming) |
| 10 | 1.04 | 2e-4 |
| 15 | 0.90 | — |
| 25 | 0.62 | — |
| 50 (eval) | **0.49** | — |
| 70 | 0.46 | — |
| 90 | 0.41 | — |
| 100 (eval) | **0.45** | — |
| Final avg train loss | **0.575** | 0 |

→ **67 % loss reduction** (1.20 → 0.39 at the trough). Cosine schedule
bottomed out cleanly; eval loss flat (0.49 → 0.45) so no overfitting signal.

## 8. Sample check (deployed endpoint, same prompts)

`with-user`'s system + initial templates for a SurrealDB eval-suite bug:

| | Base (Qwen2.5-7B-Instruct, untrained) | **Fine-tuned** |
|---|---|---|
| Opening (interject) | `"Hey, the eval suite is failing for observer-llm-reasoning. It seems there's a SurrealDB query error in the beforeAll setup, saying the query wasn't executed because of a failed transaction. This happens in setupEvalRuntime in evals/eval-test-kit.ts."` (249 chars, chatty) | `"The eval suite is failing on observer-llm-reasoning. beforeAll setup throws a\nSurrealDB query error: \"The query was not executed due to a failed transaction\". The failure originates in setupEvalRuntime in evals/eval-test-kit.ts."` (228 chars, terse, newline-formatted — mirrors marcus-sa style) |
| Step 1 (continue) | `{"decision": "continue"}` — **missing `message` field** | `{"decision": "continue", "message": ""}` — **exact schema** |
| External `curl` against `/v1/chat/completions` | HTTP 200, 69 s cold, 1–2 s warm | HTTP 200, same |
| with-user JSON parser (`re.search(r"\{.*\}",text,re.DOTALL)` + `json.loads`) | ✓ | ✓ |
| Schema check (`decision` ∈ {continue, interject}, `message` present) | ✗ on continue turn | ✓ |

Net: fine-tuning produces a model that emits **terser, more user-like prose
in marcus-sa's voice** *and* **the exact JSON schema** with-user's parser
expects — including the empty-string `message` on continue turns that the base
model drops.

## 9. Repo layout

```
modal_app/
  common.py             # shared Modal app, Volume V2, 3 images (data/train/serve)
  data_prep.py          # SALT-NLP/SWE-chat → SFT jsonl on Volume V2
  train.py              # Qwen2.5-7B-Instruct + LoRA SFT, merge, save to volume
  serve_both.py         # vLLM OpenAI servers — base & trained — same app
  serve.py / serve_base.py  # single-endpoint variants
  inspect_data.py       # spot-check one prepared training example
  smoke_test.py         # hit endpoint with real with-user-style messages
  eval.py               # offline decision-accuracy eval on val split
  build_serve_image.py  # warm the vLLM image build (cache pre-fill)
configs/
  user-sim-marcus-sa.yaml   # drop-in overlay for with-user
notes/
  literature.md, dataset.md, integration.md, with-user-prompts.md  # research
SUMMARY.md / README.md  # this report
```

All heavy state (HF cache, processed datasets, model checkpoints) lives on
Modal Volume V2 `user-sim-vol`. Local working dir is just scripts and notes
(~200 KB total, git-tracked).

## 10. Reproduce from scratch

```bash
# auth (one-time)
modal token set --token-id ... --token-secret ... --profile=marl
modal profile activate marl
modal secret create huggingface HF_TOKEN=hf_xxx

cd modal_app

# 1. Prepare data (~2 min, CPU)
modal run data_prep.py --user-id marcus-sa

# 2. Train (~50 min on A100-80GB)
modal run --detach train.py --user-id marcus-sa --run-name qwen25-7b-marcus-sa-v1

# 3. Deploy both endpoints
modal deploy serve_both.py
# → https://<workspace>--user-sim-marcus-sa-serve-base.modal.run/v1
# → https://<workspace>--user-sim-marcus-sa-serve-trained.modal.run/v1

# 4. Smoke-test
python smoke_test.py --base-url https://<...>-serve-trained.modal.run/v1
```

## 11. Budget

| Item | Cost |
|---|---:|
| Data prep (CPU only, ~2 min) | $0.05 |
| Training (A100-80GB × 49 min + image build) | ~$3 |
| Smoke-test + deploys (L40S, brief) | ~$2 |
| Idle serving (auto scales to zero after 5 min) | $0 |
| **Total** | **~$5 — well under the $30 cap** |

## License

Code: MIT. Data: `SALT-NLP/SWE-chat` is a gated HF dataset with its own
license — see the dataset page for redistribution terms.
