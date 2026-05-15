# SALT-NLP/SWE-chat — Dataset Notes

Source: <https://huggingface.co/datasets/SALT-NLP/SWE-chat> (gated; auth via HF_TOKEN).
Cache: `/data/with-user/data_cache/hf/datasets--SALT-NLP--SWE-chat/...`
Explored on 2026-05-15.

## What it is

Real-world AI coding sessions captured via the **Entire.io CLI**, wrapping agents like Claude Code, Codex, Gemini CLI, OpenCode, Cursor, GitHub Copilot CLI. Each session is a full transcript: user prompts, assistant responses, assistant thinking, tool calls, tool results, plus metadata events (file snapshots, queue ops, progress). PII redacted via Presidio + TruffleHog.

## Splits / Tables

There is **no train/val/test split** — only `split="train"`. The dataset is six parquet tables plus per-session JSONL transcripts:

| Table                 | Rows      | Primary Key   |
|-----------------------|-----------|---------------|
| `conversations`       | 2,692,480 | `turn_id`     |
| `sessions`            | 5,851     | `session_id`  |
| `session_logs`        | 5,851     | `session_id`  |
| `checkpoints`         | 13,406    | `checkpoint_pk` |
| `commits`             | 14,459    | `commit_sha`  |
| `repositories`        | 205       | `repo_id`     |

Plus `transcripts/<session_id>.jsonl` files (one per session).

## Schema — `conversations.parquet`

35 columns. Confirmed via pyarrow:

| field                          | type                  |
|--------------------------------|-----------------------|
| `turn_id`                      | string                |
| `session_id`                   | string                |
| `checkpoint_pk`                | string                |
| `repo_id`                      | string                |
| `user_id`                      | string  ← **the user identifier** |
| `turn_number`                  | int64                 |
| `conversation_turn_number`     | double (NaN on non-conv rows) |
| `role`                         | string (`user`/`assistant`/`tool_use`/`tool_result`/`metadata`) |
| `turn_type`                    | string (`user_prompt`, `assistant_response`, `assistant_thinking`, `system_injected`, `tool_use`, `tool_result`, `queue_operation`, `progress`, `file_snapshot`, …) |
| `is_conversational`            | bool (filter for clean dialog) |
| `content`                      | string (truncated to 10KB for tool results) |
| `model`                        | string                |
| `timestamp`                    | timestamp[us, UTC]    |
| `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` | int64 |
| `is_continuation`, `is_first_turn` | bool              |
| `word_count`, `char_count`     | int64                 |
| `tool_name`, `tool_call_id`, `file_path`, `command`, `pattern`, `tool_input_json` | string |
| `category`, `bash_category`, `queue_op_subtype` | string |
| `agent`, `strategy`, `language` | string               |
| `prompt_intent`                | LLM annotation (`create new code`, `debug`, `refactor`, `understand`, `git`, `test`, `connect`, `other`) |
| `prompt_pushback`              | LLM annotation (`correction`, `rejection`, `failure_report`, …) |

### Trimmed example row (<300 chars after trim)

```json
{"turn_id":"f76a52b4-...#11","session_id":"f76a52b4-...","user_id":"marcus-sa",
 "role":"user","turn_type":"user_prompt","is_conversational":true,
 "content":"<system_instruction>You are working inside Conductor...",
 "prompt_intent":"create new code","input_tokens":0,"word_count":186}
```

### Role/turn_type distribution (full conversations table)

- `metadata` 1.80M rows (mostly `progress`/`queue_operation`/`file_snapshot` — **not conversational, drop these**)
- `tool_use` 356K / `tool_result` 409K
- `user` 78K (`user_prompt` 62K + `system_injected` 15K)
- `assistant` 54K (`assistant_response` 42K + `assistant_thinking` 12K)
- `is_conversational=True`: 104,166 rows — the clean dialog signal.

## User identifier

Yes — `user_id` is present in both `sessions` and `conversations` tables. It is the GitHub username if the commit author resolved, else email/name. **Caveat: 1,943 of 5,851 sessions (33%) have null/empty `user_id`** — those are not attributable.

### Top users by session count

| user_id          | sessions | repos | agents                              |
|------------------|----------|-------|-------------------------------------|
| **marcus-sa**    | **450**  | 2     | Claude Code (only)                  |
| dayhaysoos       | 415      | 1     | OpenCode (only)                     |
| cyyeh            | 265      | 3     | Claude Code                         |
| KeKs0r           | 206      | 1     | Claude Code                         |
| Soph             | 167      | 1     | mostly Claude Code + a few others   |
| zchee            | 96       | …     |                                     |
| khaong           | 94       | …     |                                     |
| cteyton          | 93       | …     |                                     |

Total: 189 unique users (excluding null). Median 6 sessions/user, p75=16, p90 about 50.
- 76 users have ≥10 sessions
- 15 users have ≥50
- 5 users have ≥100

## Length statistics

### Across all 5,851 sessions

| metric (per session)         | median | mean   | p75    | max    |
|------------------------------|--------|--------|--------|--------|
| total rows in `conversations` | 160    | 462    | 426    | 137,991 |
| `is_conversational=True` rows | 8      | 17.9   | 18     | 881    |
| user msgs (role=user)         | -      | -      | -      | -      |
| assistant msgs (role=assistant) | -    | -      | -      | -      |
| **total input+output tokens (logged)** | 466 | 7,843 | 2,215 | 6,071,024 |

Note on tokens: many rows have `input_tokens=0` / `output_tokens=0` (Entire CLI does not always log token counts; especially for non-Claude agents). For real length use `word_count` / `char_count` — overall **mean per-session total_words = 57k** but **median = 18k** (long tail).

### Conversation **turns** (sequential `conversation_turn_number`)

Median ~8 turns per session, mean ~18, p75 ~18, top sessions over 800. A "turn" here counts every `user_prompt|assistant_response` row, not back-and-forth pairs.

## Pitfalls and caveats

1. **Gated dataset** — requires HF auth and accepting access agreement on the dataset page. Token I used: from `/data/harbor-adapters-experiments/.env`.
2. **33% of sessions have null `user_id`** — drop or treat as anonymous.
3. **`is_conversational` is only ~3.9% of rows** — most of the table is `progress`/tool noise. **Always filter** when treating it as dialog.
4. **`role=user` rows are not all real user typing**: 56% of marcus-sa's user-role rows are `turn_type=system_injected` (Conductor wrapper, hook output, file context injection). Filter to `turn_type=user_prompt` for actual user-typed content — and even then, ~15% of marcus-sa's `user_prompt` rows contain a `<system_instruction>` wrapper or stub like `"Tool loaded."` you should strip.
5. **Tool results truncated to 10KB** — content is lossy for big stdout.
6. **Token counts often zero** — not all agents log usage; use `word_count`/`char_count` for length math.

## Chosen user: `marcus-sa`

**Why pick:** most sessions (450), single consistent agent (Claude Code), real GitHub username.

**Stats for marcus-sa:**
- 450 sessions, only 2 repos (`osabiohq/osabio` 227, `marcus-sa/brain` 223)
- 297,282 raw conversation rows; 6,094 `is_conversational=True`
- 3,416 real `user_prompt` rows (mean **7.6 / session**, median 4)
- 2,678 `assistant_response` rows (mean **6.0 / session**, median 3)
- Persona LLM-tag distribution: Vague Requester 203, Expert Nitpicker 169, Other 63, Mind Changer 15
- prompt_intent mix: create-new 508, understand 501, git 472, debug 460, refactor 240, test 160, other 988
- Median session duration 810s (13.5 min); avg turn_count 13.5; avg prompt_count 7.2

**Unusual but worth flagging:**
- Sessions are run inside **Conductor** (a Mac app for parallel agents), so each `user_prompt` is prefixed with a `<system_instruction>` block describing the workspace. This is not real user prose — it must be stripped before training a user-simulator.
- About 506/3416 user prompts have the `<system_instruction>` wrapper; many remaining prompts are slash-command stubs (`Tool loaded.`, `/nw:deliver ...`) rather than free-form natural language.
- Only **309/450 sessions** have ≥2 real user_prompts AND ≥2 assistant_responses — the rest are too short or one-shot. Effective dataset for user-sim training is ~309 sessions, not 450.
- All sessions concentrated in 2 repos (marcus-sa/brain + osabiohq/osabio) → narrow domain.

**Alternative candidates** if marcus-sa's Conductor-wrapped prompts are too noisy:
- `dayhaysoos` (415 sessions, OpenCode, 1 repo) — different agent, cleaner prompts likely
- `cyyeh` (265 sessions, 3 repos, Claude Code) — more domain diversity

## How to reload

```python
import os
os.environ["HF_TOKEN"] = "<token>"
from huggingface_hub import hf_hub_download
import pandas as pd

CACHE = "/data/with-user/data_cache/hf"
sessions = pd.read_parquet(hf_hub_download(
    "SALT-NLP/SWE-chat", "sessions.parquet",
    repo_type="dataset", cache_dir=CACHE))
conv = pd.read_parquet(hf_hub_download(
    "SALT-NLP/SWE-chat", "conversations.parquet",
    repo_type="dataset", cache_dir=CACHE),
    filters=[('user_id','=','marcus-sa'),
             ('is_conversational','=',True)])
```
