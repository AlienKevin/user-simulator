# User Simulator for SWE Chat Agents — Literature & Recipe Survey

Date: 2026-05-15. Budget: ~8h, $30 Modal credits.

---

## 1. Prior work on training user simulators

### The single most relevant baseline: UserLM-8b (Microsoft, Oct 2025)
- Paper: "Flipping the Dialogue: Training and Evaluating User Language Models", arXiv 2510.06552.
- HF: `microsoft/UserLM-8b` (MIT license).
- Base model: **Llama-3-8B-Base** (NOT instruct). The paper explicitly argues instruct models are *bad* user simulators because they're trained to act as assistants; SFT from a base checkpoint avoids fighting that prior.
- Data: WildChat-1M, filtered/deduped to ~384k conversations → ~1.05M training samples after expansion.
- Recipe: **full FT**, LR `2e-5`, global batch `1024`, seq len `2048`, ~227 GPU-hours on 4×A6000.
- Conditioning: A "task intent" string is generated for each conversation by few-shot-prompting GPT-4o on the full dialogue. The intent is the *only* conditioning — it sits in the system prompt; subsequent turns are generated turn-by-turn.
- Special tokens: standard Llama-3 `<|eot_id|>` plus a learned `<|endconversation|>` token so the simulator can decide to end the chat.
- Inference guardrails (Appendix D.1): filter first tokens, ban `<|endconversation|>` early via `bad_words_ids`, length thresholds, dedup against verbatim repeats. Sampling: `top_p=0.8, temperature=1.0`.
- Results: perplexity 5.60 vs 26.19 for Llama-3-8B-Instruct on held-out WildChat. Assistants score 74.6% with a prompted GPT-4o user simulator but only 57.4% with UserLM-8b — i.e., real-distribution simulators are *harder* on assistants, exposing failure modes prompted simulators hide.

**Takeaway: copy this recipe almost exactly. It is the canonical recipe.**

### SWE-chat (SALT-NLP, 2026)
- Paper: arXiv 2604.20779 ("SWE-chat: Coding Agent Interactions From Real Users in the Wild"), Baumann et al.
- Repo: `github.com/SALT-NLP/SWE-chat` (code/data "coming soon"); HF: `SALT-NLP/SWE-chat`.
- Scale: **6,000 sessions, ~63k user prompts, ~355k agent tool calls**. Real user/agent transcripts captured via Entire.io CLI checkpointing; includes line-level human-vs-agent code authorship attribution. 44% of agent-produced code is overwritten by users before commit; users push back on ~44% of agent turns. Excellent training-distribution data for a SWE user simulator.
- Paper explicitly positions the dataset as raw material for **training user simulators on real interaction trajectories**, but does not (in the abstract) release a trained simulator — that's the opportunity.

### Stateful SWE benchmark / ToM-SWE (Oct 2025)
- arXiv 2510.21903 — introduces a "Stateful SWE" benchmark where SWE agents interact with an **LLM-powered user simulator** carrying a user profile (preferences, constraints, communication style). ToM-SWE (a partner agent that models user mental state) achieves 59.7% vs 18.1% for OpenHands.
- Relevance: their simulator is GPT-4o-prompted, not fine-tuned. That's the bar to beat.

### Other useful references
- **DAUS** ("Reliable LLM-based User Simulator for TOD", arXiv 2402.13374, Sekulić et al.) — fine-tunes an LLM on TOD dialogues; shows SFT cuts simulator hallucinations and improves goal completion vs prompted baselines. Standard precedent for role-reversed SFT.
- **USimAgent** (SIGIR 2024, arXiv 2403.09142) — search-task user simulator; zero-shot prompted, not fine-tuned. Less relevant as a recipe, useful for evaluation framing (query/click/stop behaviors).
- **Consistently Simulating Human Personas with Multi-Turn RL** (arXiv 2511.00222) — multi-turn RL on top of SFT cuts persona drift >55%. Useful as a phase-2 improvement.
- **DIAL** (arXiv 2512.20773) — adversarial discriminator generates preference pairs for DPO, iteratively refining a user simulator. State-of-the-art for "realism" via DPO, but heavy.
- **`akhatua2/SWE-bench-with-user`** — could not confirm this exact repo exists. Arpandeep Khatua's public pinned repos are SWE-smith, SWE-ReX, CooperBench (cooperative-coding benchmark). If the repo is private or new, check directly. Closest public analog is SALT-NLP/SWE-chat + ToM-SWE's "Stateful SWE".

---

## 2. Training recipe: what to actually do

### Recipe (recommended for your setup)

**Step 1 — Data construction (role-reversal):**
- Each conversation = list of `{user, assistant, user, assistant, ...}` turns.
- Build training samples as autoregressive language modeling over the **entire conversation** with the chat template applied, but with the loss **masked on assistant turns and tool outputs**. Only user turns contribute loss. (This is the UserLM-8b / DAUS pattern.)
- Prepend a **task-intent system message**. Generate intents with a strong model (Claude / GPT-4o) summarizing what the user is trying to accomplish (≤2 sentences, abstract — don't leak specifics or the simulator parrots).
- Add a learned `<|endconversation|>` token at the end of each conversation as the user's final action. This gives the simulator a clean stop signal.
- For SWE-chat data specifically: treat tool-call outputs / file diffs as part of the assistant turn (context, no loss) so the simulator learns to react to code changes.

**Step 2 — SFT (the standard recipe is fine; do not jump to RLHF/DPO with $30):**
- Plain causal-LM SFT with assistant-turn masking is what UserLM-8b, DAUS, and most 2024–2026 simulator papers use. It works.
- Skip DPO/RLHF for this run — DIAL-style adversarial DPO is the SOTA enhancement but needs a discriminator + many rollouts, blowing your budget.

**Step 3 — Optional later: persona-conditioning / multi-turn RL.** If you have time/credit left, add per-user style tokens (frustration level, expertise) à la Stateful SWE, then a short DPO pass with judge-scored rollouts.

### Why role-reversed SFT (and not just prompting)
Instruct models have a strong "be helpful, write long answers, hedge" prior that's almost the opposite of how real users behave (short, ungrammatical, impatient, sometimes wrong). Prompting cannot remove this prior; SFT from a base checkpoint (or heavy SFT from an instruct checkpoint) can. UserLM-8b's 5x perplexity gap quantifies this.

---

## 3. Base model recommendation

### Pick: **`Qwen/Qwen3-8B-Base`**

Reasoning:
- **License: Apache 2.0** — clean, commercially friendly, no Llama license restrictions.
- **Base (non-instruct) version exists** — important per UserLM-8b's finding that instruct models resist user-role training.
- **Context length: 32k native, 128k via YaRN** — comfortably above your ≥16k requirement; SWE conversations with tool calls get long.
- **vLLM ≥0.8.5 native support**, also sglang ≥0.4.6.
- **2026 instruction-following leaderboards**: Qwen3-8B beats Llama-3.1-8B on most reasoning/IF benchmarks; not directly relevant for *generating* user turns but matters for the conditioning side (understanding intent strings, prior assistant turns, code).
- **Tokenizer** is well-suited for code (BPE trained on a code-heavy corpus).

Runners-up and why not:
- **Llama-3.1-8B-Base** — solid, but Llama license is more restrictive; the UserLM-8b precedent is on this exact base, so it's the safe fallback if Qwen3 has surprises.
- **Mistral-7B-v0.3** — older, weaker IF, 32k context but no clear advantage.
- **Phi-3.5-mini (3.8B)** — too small for chat-coding context fidelity; MIT but trained on synthetic-heavy data, weaker as a user-distribution prior.
- **Gemma-2-9B** — excluded per your >8B constraint, and Gemma license has commercial-use clauses.

If `Qwen3-8B-Base` proves hard to fine-tune (rare but possible), fall back to `meta-llama/Meta-Llama-3.1-8B` (base).

---

## 4. Practical training plan for ~100s of conversations on Modal

### Data scale reality check
- ~100–500 conversations × ~10 turns each = 1k–5k user turns = very small. You will overfit fast.
- Strongly consider augmenting: (a) re-use SWE-chat's 6k sessions if accessible; (b) synthesize task-intent variants to multiply effective samples; (c) random-truncate conversations to multiple prefixes (each prefix → one training sample predicting the next user turn — this is the UserLM-8b expansion trick that takes 384k convos to 1.05M samples).

### Full FT vs LoRA
- Full FT of 8B is feasible on 1×H100 80GB with DeepSpeed ZeRO-2 + gradient checkpointing + bf16, micro-batch 1, seq 4096, grad-accum 16–32. Tight on memory but doable.
- **For your budget, do LoRA.** Per Thinking Machines' "LoRA Without Regret" (2025): with the right config, LoRA matches full FT for SFT, especially on small datasets, and saves both time and VRAM.

### LoRA hyperparameters (start here)
- `r = 64`, `alpha = 32` (alpha/rank ratio matters less than the LR multiplier; α=32 is the empirically-stable default)
- **Target modules: ALL linear layers**, including MLP up/gate/down — this is the most important LoRA-Without-Regret finding ("attention-only LoRA significantly underperforms MLP-only LoRA").
- `lora_dropout = 0.05`
- bf16, gradient checkpointing on.
- **Learning rate: `2e-4`** (≈10× the full-FT LR of `2e-5`; Thinking Machines shows this 10× rule is consistent across base models).
- LR schedule: cosine, warmup 3% of steps.
- **Batch size**: effective batch ~32 (e.g. micro-batch 1, grad-accum 32, seq 4096). LoRA is *less tolerant* of large batches than full FT — keep effective batch modest.
- **Epochs: 3** as default; with <500 convos, validate every epoch and early-stop on a held-out 10% split. Likely 1–2 epochs is enough.
- NEFTune noise α=5 — cheap regularizer, good for small SFT data.
- Add LoRA on `embed_tokens` and `lm_head` too if you add new special tokens like `<|endconversation|>`.

### Recommended Modal hardware
Modal pricing (base, before multipliers — preemptible default):
- H100: $3.95/h
- H200: $4.54/h
- A100-80GB: $2.50/h
- A100-40GB: $2.10/h
- L40S: $1.95/h (48GB)
- L4: $0.80/h (24GB — too small for 8B LoRA at long seq)

**Pick: 1×H100 80GB.** Reasons:
- 8B LoRA at seq 4096, micro-batch 1 fits comfortably in 80GB with bf16 + grad checkpoint, leaving headroom for long SWE context.
- $/throughput ratio beats A100-80GB once you factor in 2.5–3× throughput on bf16 attention (FlashAttention-2/3).
- H200 isn't worth +15% cost unless you need >80GB or longer context.

Estimated cost: For 5k samples × 3 epochs × ~3s/step on H100 ≈ 12–15 GPU-hours = **$50–60 at base pricing**. **You're over $30.**
- Mitigation: (a) shorter seq (2048), (b) 1 epoch + early stop, (c) cap samples at ~2k, (d) use A100-80GB at $2.50/h ($30–37 total).
- Honest recommendation: **use A100-80GB on Modal** for this run. Slightly slower but lands you inside $30 with margin. Keep H100 in your back pocket for the second iteration.
- Do NOT enable the non-preemptible (3×) or specific-region (1.5–1.75×) multipliers.

### Stack
- `trl` SFTTrainer (handles chat templates + completions-only loss masking via `DataCollatorForCompletionOnlyLM`).
- `peft` for LoRA.
- `accelerate` or `deepspeed` ZeRO-2. Single GPU: plain `accelerate` is simpler.
- `vllm` for eval/inference (Qwen3 supported natively).
- Optionally `unsloth` for ~2× LoRA speedup on a single GPU (supports Qwen3 and Llama 3.1).

---

## 5. Evaluation (do this before you start training, not after)
- Held-out 10% of conversations as a perplexity eval — primary metric (UserLM-8b uses this).
- Qualitative: roll out the simulator paired with a fixed assistant (Claude/GPT-4o) on 20 SWE intents; have an LLM judge or yourself rate "does this look like a real user?".
- Behavioral: rate of `<|endconversation|>` emission, average turn length, rate of pushback/correction (compare to SWE-chat's 44% pushback rate as a sanity check).

---

## Key references
- UserLM-8b: https://huggingface.co/microsoft/UserLM-8b , https://arxiv.org/abs/2510.06552
- SWE-chat: https://huggingface.co/datasets/SALT-NLP/SWE-chat , https://github.com/SALT-NLP/SWE-chat , https://arxiv.org/abs/2604.20779
- ToM-SWE / Stateful SWE: https://arxiv.org/abs/2510.21903
- DAUS: https://arxiv.org/abs/2402.13374
- USimAgent: https://arxiv.org/abs/2403.09142
- DIAL (DPO adversarial simulator): https://arxiv.org/abs/2512.20773
- Persona-consistent multi-turn RL: https://arxiv.org/abs/2511.00222
- LoRA Without Regret: https://thinkingmachines.ai/blog/lora/
- Qwen3-8B-Base: https://huggingface.co/Qwen/Qwen3-8B-Base
- SWE-Gym (reference for sample efficiency on SWE): https://arxiv.org/abs/2412.21139
- Modal pricing: https://modal.com/pricing
