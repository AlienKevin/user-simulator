"""Extract edit signatures from claude-code trials.

Source: agent/trajectory.json — each step may have `tool_calls` (a list of
function-call records). The mutating tools are:

  Edit       arguments: {file_path, old_string, new_string, replace_all?}
             → emit `edit_literal` (plain string replace, not regex)
  MultiEdit  arguments: {file_path, edits: [{old_string, new_string, ...}, ...]}
             → emit one `edit_literal` per inner edit
  Write      arguments: {file_path, content}
             → emit `write`
  NotebookEdit  arguments: {notebook_path, ...}
             → emit `notebook_edit` (skip in replay for now — Jupyter format)
  Bash       arguments: {command}
             → recursively parse via terminus shell parser, which already
               handles sed/cat/python_c/etc.

Read-only tools (Read, Glob, Grep, LS) are ignored. cwd is tracked from
step.extra.cwd when present (claude-code records it) and otherwise from
preceding cd commands inside Bash invocations.

Output: /data/swebench-verified/claude_code_edits.jsonl
Schema matches terminus2_edits.jsonl — both feed the same replay engine.
"""
import json, re, tarfile, os, shlex
from collections import defaultdict
from pathlib import Path

# Reuse the shell parser from the terminus extractor — we only need parse_one,
# the file-suffix table, and resolve(). They live in extract_terminus_edits.
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_terminus_edits import (
    parse_one as shell_parse_one,
    DEFAULT_CWD,
    resolve,
)

OUT = Path('/data/swebench-verified/claude_code_edits.jsonl')
TRIALS_META = Path('/data/swebench-verified/trials.jsonl')
TARBALLS = Path('/data/swebench-verified/tarballs')


def normalize_args(args):
    """Coerce arguments dict into a regular dict (some traces use JSON strings)."""
    if isinstance(args, dict): return args
    if isinstance(args, str):
        try: return json.loads(args)
        except Exception: return {}
    return {}


def process_trial(trial_id, trajectory_path):
    """Build the edit signature for one claude-code trial."""
    state = {
        'cwd': DEFAULT_CWD,
        'files': set(),
        'steps': [],
        'literals': [],
        'raw_current': '',
        'n_commands_total': 0,
    }
    try:
        traj = json.loads(Path(trajectory_path).read_text())
    except Exception:
        return None

    for step in traj.get('steps', []):
        # Update cwd from claude-code metadata when present
        cwd_meta = (step.get('extra') or {}).get('cwd')
        if cwd_meta and isinstance(cwd_meta, str) and cwd_meta.startswith('/'):
            state['cwd'] = cwd_meta

        for tc in (step.get('tool_calls') or []):
            fn = tc.get('function_name')
            args = normalize_args(tc.get('arguments'))
            state['n_commands_total'] += 1

            if fn == 'Edit':
                fp = args.get('file_path')
                if not fp: continue
                target = resolve(fp, state['cwd'])
                state['files'].add(target)
                state['steps'].append({
                    'op': 'edit_literal',
                    'target': target,
                    'old': args.get('old_string', ''),
                    'new': args.get('new_string', ''),
                    'replace_all': bool(args.get('replace_all', False)),
                })
                state['literals'].extend([args.get('old_string', ''),
                                          args.get('new_string', '')])
                continue

            if fn == 'MultiEdit':
                fp = args.get('file_path')
                if not fp: continue
                target = resolve(fp, state['cwd'])
                for inner in args.get('edits', []):
                    if not isinstance(inner, dict): continue
                    state['files'].add(target)
                    state['steps'].append({
                        'op': 'edit_literal',
                        'target': target,
                        'old': inner.get('old_string', ''),
                        'new': inner.get('new_string', ''),
                        'replace_all': bool(inner.get('replace_all', False)),
                    })
                    state['literals'].extend([inner.get('old_string', ''),
                                              inner.get('new_string', '')])
                continue

            if fn == 'Write':
                fp = args.get('file_path')
                if not fp: continue
                target = resolve(fp, state['cwd'])
                body = args.get('content', '') or ''
                state['files'].add(target)
                state['steps'].append({
                    'op': 'write', 'target': target, 'body': body,
                })
                state['literals'].append(body)
                continue

            if fn == 'NotebookEdit':
                # We don't currently replay Jupyter cell edits
                state['steps'].append({'op': 'notebook_edit',
                                       'target': args.get('notebook_path')})
                continue

            if (fn or '').lower() == 'bash':
                cmd = (args.get('command') or '').strip()
                if not cmd: continue
                state['raw_current'] = cmd
                # split on && / ; — but heredoc-aware (split_sub_commands in terminus)
                from extract_terminus_edits import split_sub_commands
                for sub in split_sub_commands(cmd):
                    state['raw_current'] = sub
                    shell_parse_one(sub, state)
                continue

            # Read / Glob / Grep / LS / TodoWrite / etc. — read-only, skip

    return {
        'trial_id': trial_id,
        'files_modified': sorted(state['files']),
        'n_files': len(state['files']),
        'edit_steps': state['steps'],
        'literals': state['literals'],
        'n_commands_total': state['n_commands_total'],
        'final_cwd': state['cwd'],
    }


def main():
    trials = [json.loads(l) for l in open(TRIALS_META) if json.loads(l)['agent'] == 'claude-code']
    print(f'claude-code trials available: {len(trials)}')

    # Restrict to all-pass cells (variance=0 with reward=1.0) sampled with the same seed
    import random
    random.seed(42)
    from collections import defaultdict
    cells = defaultdict(list)
    have = set()
    for l in open('/data/swebench-verified/.download_state.jsonl'):
        r = json.loads(l)
        if r['status'] in ('ok', 'cached'):
            have.add(r['trial_id'])
    for l in open(TRIALS_META):
        r = json.loads(l)
        if r['agent'] != 'claude-code': continue
        if r['trial_id'] not in have: continue
        reward = r.get('reward')
        if reward is None: reward = 0.0
        cells[(r['task_name'], r['model'], r['agent'])].append((r['trial_id'], float(reward)))

    all_pass = {}
    for k, lst in cells.items():
        if len(lst) < 5: continue
        samp = random.sample(lst, 5)
        if all(rw == 1.0 for _, rw in samp):
            all_pass[k] = [tid for tid, _ in samp]
    print(f'all-pass cells (claude-code): {len(all_pass)}')
    import pickle
    pickle.dump(all_pass, open('/tmp/all_pass_claude_code.pkl', 'wb'))

    out_f = OUT.open('w')
    done = 0; ok = 0
    for (task, model, agent), tids in all_pass.items():
        for tid in tids:
            tar = TARBALLS / f'{tid}.tar.gz'
            if not tar.exists(): continue
            traj_path = None
            try:
                with tarfile.open(tar, 'r:gz') as tf:
                    for m in tf.getmembers():
                        if m.name.endswith('trajectory.json'):
                            traj_path = f'/tmp/_traj_{tid}.json'
                            with open(traj_path, 'wb') as f:
                                f.write(tf.extractfile(m).read())
                            break
                if traj_path is None: continue
                sig = process_trial(tid, traj_path)
                os.unlink(traj_path)
                if sig is None: continue
                sig.update({'task_name': task, 'model': model, 'agent': agent})
                out_f.write(json.dumps(sig) + '\n')
                done += 1
                if sig['n_files'] > 0: ok += 1
            except Exception as e:
                pass
            if done % 200 == 0 and done:
                print(f'  processed {done}, n_files>0: {ok}', flush=True)
    out_f.close()
    print(f'Done. {done} trials, {ok} with at least one extracted file → {OUT}')


if __name__ == '__main__':
    main()
