"""Run static replay across all parsed terminus-2 trials.

Output: /data/swebench-verified/trial_patches.jsonl  (one row per trial)
Schema per row:
  trial_id, task_name, model, agent
  steps_total, steps_applied, steps_failed
  unsupported_step_ops:  list of op names we skipped (python_run etc.)
  files_in_diff:         list of file paths that have non-empty diff
  diff:                  the unified diff (string)
  has_python_run:        bool — at least one python_run step was skipped
  has_patch_op:          bool — at least one `patch` step was skipped
  reliability:           one of 'high' | 'low' | 'partial'
                         high   — all steps applied, no skip; diff non-empty
                         partial- skipped some steps (esp. python_run / patch)
                         low    — diff empty or all steps failed
"""
import json, re, sys, time, os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
try:
    from dotenv import load_dotenv
    for env_path in (
        Path('/data/harbor-adapters-experiments/.env'),
        SCRIPT_DIR.parent.parent / '.env',
    ):
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass
import replay_engine
from replay_engine import VFS, replay_trial, make_diff


META = {json.loads(l)['instance_id']: json.loads(l)
        for l in open('/data/swebench-verified/task_metadata.jsonl')}

EDITS = os.environ.get('EDITS_FILE', '/data/swebench-verified/terminus2_edits.jsonl')
OUT = os.environ.get('PATCHES_FILE', '/data/swebench-verified/trial_patches.jsonl')


UNSUPPORTED_OPS = {'python_run', 'sed_other', 'awk_inplace', 'patch'}


def classify(trial, n_ok, n_fail, diff, unsupported):
    if not diff.strip():
        return 'low'
    if unsupported or n_fail > 0:
        return 'partial'
    return 'high'


def process_one(trial):
    task_id = trial['task_name']
    task = META.get(task_id)
    if not task:
        return {'trial_id': trial['trial_id'], 'task_name': task_id, 'error': 'no task metadata'}
    vfs = VFS(task['repo'], task['base_commit'])
    n_ok, n_fail = replay_trial(trial, vfs)
    diff = make_diff(vfs)
    # Identify files that ended up changed
    files = re.findall(r'^diff --git a/(\S+) ', diff, re.MULTILINE)
    unsupported = [s['op'] for s in trial.get('edit_steps', []) if s.get('op') in UNSUPPORTED_OPS]
    rec = {
        'trial_id': trial['trial_id'],
        'task_name': task_id,
        'model': trial['model'],
        'agent': trial['agent'],
        'steps_total': len(trial.get('edit_steps', [])),
        'steps_applied': n_ok,
        'steps_failed': n_fail,
        'unsupported_step_ops': sorted(set(unsupported)),
        'has_python_run': 'python_run' in unsupported,
        'has_patch_op': 'patch' in unsupported,
        'files_in_diff': files,
        'diff': diff,
    }
    rec['reliability'] = classify(trial, n_ok, n_fail, diff, unsupported)
    return rec


def main():
    # Include any trial that has at least one parseable file or python step.
    trials = []
    for l in open(EDITS):
        r = json.loads(l)
        if r.get('n_files', 0) > 0 or any(
            s.get('op') in ('python_c', 'python_script', 'edit_literal', 'write')
            for s in r.get('edit_steps', [])):
            # Ensure model/agent are present (they're stamped by the extractor)
            if 'model' not in r or 'agent' not in r:
                # claude-code extractor stamps these; terminus may not when
                # processing arbitrary jsonl. Fall back to trials.jsonl lookup.
                pass
            trials.append(r)
    # Resume support: if OUT already exists, skip trials already processed.
    done = set()
    if Path(OUT).exists():
        for l in open(OUT):
            try:
                done.add(json.loads(l)['trial_id'])
            except Exception: pass
    if done:
        before = len(trials)
        trials = [t for t in trials if t['trial_id'] not in done]
        print(f'resuming: skipping {before - len(trials)} trials already in {OUT}', flush=True)
    print(f'replaying {len(trials)} trials (sequential, with SIGALRM timeout)', flush=True)
    out_f = open(OUT, 'a')  # append for resume
    stats = {'high': 0, 'partial': 0, 'low': 0}
    t0 = time.time()
    for n, t in enumerate(trials, 1):
        rec = process_one(t)
        out_f.write(json.dumps(rec) + '\n')
        stats[rec.get('reliability', 'low')] = stats.get(rec.get('reliability', 'low'), 0) + 1
        if n % 100 == 0 or n == len(trials):
            out_f.flush()
            rate = n / max(time.time() - t0, 0.001)
            print(f'  {n}/{len(trials)}  {stats}  ({rate:.1f}/s)', flush=True)
    out_f.close()
    print(f'\nDone. {stats}')


if __name__ == '__main__':
    main()
