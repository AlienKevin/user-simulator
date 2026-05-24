"""Extract claude-code edit signatures for MIXED-OUTCOME cells.

Mixed cell = same (task, model, agent='claude-code') where the random-5 sample
contains both passing (reward=1.0) and failing (reward!=1.0) trials.

Output: /data/swebench-verified/claude_code_mixed_edits.jsonl
Plus pickle: /tmp/mixed_claude_code.pkl with structure
  { (task, model, agent): {'pass': [tids], 'fail': [tids]} }
"""
import json, os, sys, random, pickle, tarfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_claude_code_edits import process_trial

OUT = Path('/data/swebench-verified/claude_code_mixed_edits.jsonl')
META = Path('/data/swebench-verified/trials.jsonl')
TARBALLS = Path('/data/swebench-verified/tarballs')


def main():
    random.seed(42)
    have = set()
    for l in open('/data/swebench-verified/.download_state.jsonl'):
        r = json.loads(l)
        if r['status'] in ('ok', 'cached'):
            have.add(r['trial_id'])

    cells = defaultdict(list)
    for l in open(META):
        r = json.loads(l)
        if r['agent'] != 'claude-code': continue
        if r['trial_id'] not in have: continue
        rw = r.get('reward')
        rw = 0.0 if rw is None else float(rw)
        cells[(r['task_name'], r['model'], r['agent'])].append((r['trial_id'], rw))

    mixed = {}
    for k, lst in cells.items():
        if len(lst) < 5: continue
        samp = random.sample(lst, 5)
        n_pass = sum(1 for _, r in samp if r == 1.0)
        if 0 < n_pass < 5:
            mixed[k] = {
                'pass': [tid for tid, r in samp if r == 1.0],
                'fail': [tid for tid, r in samp if r != 1.0],
            }
    print(f'mixed cells: {len(mixed)}')
    print(f'unique trial IDs to extract: ',
          sum(len(v["pass"]) + len(v["fail"]) for v in mixed.values()))
    pickle.dump(mixed, open('/tmp/mixed_claude_code.pkl', 'wb'))

    out_f = OUT.open('w')
    done = 0
    for (task, model, agent), groups in mixed.items():
        for outcome in ('pass', 'fail'):
            for tid in groups[outcome]:
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
                    sig.update({
                        'task_name': task, 'model': model, 'agent': agent,
                        'outcome': outcome,
                    })
                    out_f.write(json.dumps(sig) + '\n')
                    done += 1
                except Exception as e:
                    pass
                if done % 100 == 0 and done:
                    print(f'  processed {done}', flush=True)
    out_f.close()
    print(f'Done. {done} trials → {OUT}')


if __name__ == '__main__':
    main()
