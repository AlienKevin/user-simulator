# Patch reconstruction from agent trajectories

Reconstruct each trial's submitted patch without running the agent sandbox:
parse tool calls / shell commands from `trajectory.json`, replay them on a
virtual copy of the repo at `base_commit`, then emit a unified diff.

## Pipeline

```
trajectory.json (in trial tarball)
    │
    ├─ extract_claude_code_edits.py   tool_calls → edit_steps (Edit/Write/Bash…)
    ├─ extract_mixed_cc_edits.py      same, for pass/fail mixed cells
    └─ extract_terminus_edits.py      bash commands → edit_steps (terminus-2)
    │
    ▼
*_edits.jsonl  (ordered edit_steps per trial)
    │
    ▼
run_replay.py + replay_engine.py
    apply edit_steps on VFS → trial_patches.jsonl (unified diff per trial)
```

## Scripts

| File | Role |
|------|------|
| `extract_terminus_edits.py` | Parse terminus-2 bash into `edit_steps` |
| `extract_claude_code_edits.py` | Parse claude-code `tool_calls` (+ Bash via shell parser) |
| `extract_mixed_cc_edits.py` | Extract edits for mixed pass/fail claude-code cells |
| `replay_engine.py` | Apply `edit_steps` on a virtual filesystem; `make_diff()` |
| `run_replay.py` | Batch replay → `trial_patches.jsonl` |

## Data layout (defaults)

Scripts read/write under `/data/swebench-verified/` by default:

- `tarballs/{trial_id}.tar.gz` — trial archives with `agent/trajectory.json`
- `trials.jsonl`, `task_metadata.jsonl` — trial / task metadata
- `claude_code_edits.jsonl`, `terminus2_edits.jsonl` — extracted edit traces
- `trial_patches.jsonl` — output unified diffs

Set `EDITS_FILE` / `PATCHES_FILE` when running `run_replay.py` for alternate paths.
`GITHUB_TOKEN` is used when fetching base files from GitHub (cached under `.gh_cache/`).

## Example

```bash
python extract_claude_code_edits.py
python extract_mixed_cc_edits.py
EDITS_FILE=/data/swebench-verified/claude_code_edits.jsonl \
  PATCHES_FILE=/data/swebench-verified/trial_patches.jsonl \
  python run_replay.py
```
