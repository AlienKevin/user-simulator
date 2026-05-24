"""Extract per-trial edit signatures from terminus-2 trials.

Since Harbor doesn't persist `git diff HEAD` for the agent, we approximate the
"submitted patch" from the bash commands the agent ran.

For each trial we track:
  - cwd (updated by `cd` commands so relative paths resolve)
  - files_modified: set[str] of resolved paths the agent edited
  - edit_steps: ordered list of {op, target, payload}
      sed_subst   {target, find, replace}
      sed_delete  {target, range}
      sed_insert  {target, line, text}
      write       {target, body}        (`cat > file <<EOF ... EOF`)
      append      {target, body}        (`cat >> file <<EOF ...` or `echo … >> file`)
      cat_concat  {target, sources}     (`cat a b c > target`)
      cp/mv/rm/patch/python  raw command
  - literals: list[str] of string-substance: every find/replace, every heredoc body,
              and the path of the file modified. Two trials that produced the same
              patch will have heavy literal overlap regardless of HOW they applied
              it (sed-pattern vs cat-heredoc, in any order, with intermediate undos).
"""
import json, tarfile, pickle, re, shlex, os
from pathlib import Path

CELLS_PKL = Path('/tmp/all_pass_terminus2.pkl')
OUT_PATH = Path('/data/swebench-verified/terminus2_edits.jsonl')
TARBALLS = Path('/data/swebench-verified/tarballs')

DEFAULT_CWD = '/testbed'

# A path-looking token: starts with / or has a known code suffix
FILE_SUFFIXES = ('.py', '.txt', '.diff', '.patch', '.sh', '.cfg', '.toml',
                 '.yaml', '.yml', '.json', '.md', '.rst', '.ini', '.cfg',
                 '.bak', '.in', '.c', '.cpp', '.h', '.hpp', '.js', '.ts',
                 '.tsx', '.jsx', '.html', '.css', '.scss', '.xml', '.csv')


def resolve(path, cwd):
    if path.startswith('/'):
        return os.path.normpath(path)
    return os.path.normpath(os.path.join(cwd, path))


def looks_like_path(tok):
    if not tok or tok.startswith('-'): return False
    if tok.startswith('/'): return True
    if any(tok.endswith(s) for s in FILE_SUFFIXES): return True
    if '/' in tok and not tok.startswith('|') and not tok.startswith('('): return True
    return False


def parse_sed_inline(body):
    """Parse the sed script body (the -i/-e arg). Return list of dicts."""
    out = []
    # Range delete: 697,698d  or  10d
    m = re.match(r"^(\d+(?:,\d+)?)d\s*$", body.strip())
    if m:
        out.append({'op': 'sed_delete', 'range': m.group(1)})
        return out
    # Insert: 697i\<text>     or 697a\<text>
    m = re.match(r"^(\d+)([ia])\\?(.*)$", body, re.DOTALL)
    if m:
        line, op, text = m.groups()
        # Real sed insert text uses \ for newlines; normalize
        out.append({'op': 'sed_insert' if op == 'i' else 'sed_append',
                    'line': int(line),
                    'text': text.replace('\\\n', '\n')})
        return out
    # Substitution: optional address, s<sep>X<sep>Y<sep>flags
    # addresses include: '1', '1,5', '/pat/'
    m = re.match(r"^(?:(\d+(?:,\d+)?|/[^/]*/))?s([/|@#~%!])(.*)$", body, re.DOTALL)
    if m:
        addr, sep, rest = m.group(1), m.group(2), m.group(3)
        # rest is X<sep>Y<sep>flags
        parts = rest.split(sep)
        if len(parts) >= 2:
            find, replace = parts[0], parts[1]
            flags = parts[2] if len(parts) > 2 else ''
            out.append({'op': 'sed_subst', 'addr': addr, 'find': find, 'replace': replace, 'flags': flags})
            return out
    out.append({'op': 'sed_other', 'body': body[:200]})
    return out


def split_sub_commands(cmd):
    """Split on top-level && / ; / |  ignoring inside quotes/heredocs.
    Very lightweight; doesn't try to handle every edge case.
    """
    if '<<' in cmd:  # don't split heredocs
        return [cmd]
    # Use shlex to split safely on operators
    pieces = re.split(r'(?<!\\)(?:\s+&&\s+|\s+\|\|\s+|\s*;\s*)', cmd)
    return [p.strip() for p in pieces if p.strip()]


def parse_one(cmd, state):
    """Update state in-place. cmd is a single shell pipeline (no && etc)."""
    cwd = state['cwd']
    # cd handling
    m = re.match(r'^cd\s+(\S+)\s*$', cmd)
    if m:
        target = m.group(1)
        state['cwd'] = resolve(target, cwd)
        return

    # Try shlex split (with posix=True). Failure -> use word split.
    try:
        toks = shlex.split(cmd, posix=True)
    except ValueError:
        toks = cmd.split()
    if not toks: return
    head = toks[0]

    # sed -i <script> <file>... — script may be in same arg as -i ("sed -i'<script>'")
    if head == 'sed' and any(t.startswith('-i') for t in toks[1:]):
        # Collect non-flag args
        script = None
        files = []
        i = 1
        while i < len(toks):
            t = toks[i]
            if t == '-i':
                i += 1
                continue
            if t.startswith('-'):
                # might be -i -e or -re
                if t in ('-e', '-E', '-n', '-r', '-i'):
                    # next token is the script
                    pass
                i += 1
                continue
            # script first, then files
            if script is None and not looks_like_path(t):
                script = t
            else:
                files.append(t)
            i += 1
        if script is None and files:
            # script may be at start; in our split with posix=True the quotes already gone
            script, files = files[0], files[1:]
        if script and files:
            for f in files:
                resolved = resolve(f, cwd)
                state['files'].add(resolved)
                parsed = parse_sed_inline(script)
                for p in parsed:
                    p['target'] = resolved
                    state['steps'].append(p)
                    # collect literals
                    for key in ('find', 'replace', 'text'):
                        if key in p and p[key]:
                            state['literals'].append(p[key])
        return

    # Heredoc redirection: cat > file  OR  cat >> file  with <<MARKER on same line
    # Match raw cmd (pre-shlex) since heredoc body matters
    raw = state['raw_current']
    hm = re.search(r"(cat|tee)\s+(-a\s+)?\s*(>>|>)\s*(\S+)\s+<<\s*['\"]?(\w+)['\"]?",
                   raw)
    if hm:
        target_tok, marker = hm.group(4), hm.group(5)
        target = resolve(target_tok, cwd)
        body_start = hm.end()
        # End on a line equal to marker
        endm = re.search(rf"\n\s*{re.escape(marker)}\s*(?:\n|$)", raw[body_start:])
        body = raw[body_start:body_start + endm.start()] if endm else raw[body_start:]
        body = body.lstrip('\n')
        op = 'append' if hm.group(3) == '>>' else 'write'
        state['files'].add(target)
        state['steps'].append({'op': op, 'target': target, 'body': body})
        state['literals'].append(body)
        return

    # cat a b c > target  (concat redirect, no heredoc)
    cm = re.match(r"^cat\s+([^|<>]*?)\s*(>>|>)\s*(\S+)\s*$", cmd)
    if cm:
        sources_str, redir, target_tok = cm.group(1), cm.group(2), cm.group(3)
        try:
            sources = shlex.split(sources_str)
        except ValueError:
            sources = sources_str.split()
        target = resolve(target_tok, cwd)
        op = 'append' if redir == '>>' else 'cat_concat'
        state['files'].add(target)
        state['steps'].append({'op': op, 'target': target,
                               'sources': [resolve(s, cwd) for s in sources]})
        return

    # echo ... > file
    em = re.match(r"^echo\s+(.*?)\s*(>>|>)\s*(\S+)\s*$", cmd)
    if em:
        body, redir, target_tok = em.group(1), em.group(2), em.group(3)
        target = resolve(target_tok, cwd)
        op = 'append' if redir == '>>' else 'write'
        state['files'].add(target)
        state['steps'].append({'op': op, 'target': target, 'body': body})
        state['literals'].append(body)
        return

    # cp / mv / rm / patch / touch
    if head in ('cp', 'mv'):
        if len(toks) >= 3:
            src, dst = toks[1], toks[-1]
            srcp, dstp = resolve(src, cwd), resolve(dst, cwd)
            state['files'].add(dstp)
            state['steps'].append({'op': head, 'src': srcp, 'dst': dstp})
        return
    if head == 'rm':
        for t in toks[1:]:
            if t.startswith('-'): continue
            p = resolve(t, cwd)
            state['files'].add(p)
            state['steps'].append({'op': 'rm', 'target': p})
        return
    if head == 'patch':
        # patch -p1 -i file.diff  OR  patch < file.diff
        target = None
        for i, t in enumerate(toks):
            if t == '-i' and i+1 < len(toks):
                target = resolve(toks[i+1], cwd); break
        if target is None:
            # try `patch ... < file`
            pm = re.search(r'<\s*(\S+)', cmd)
            if pm: target = resolve(pm.group(1), cwd)
        state['steps'].append({'op': 'patch', 'target': target})
        return
    if head == 'touch':
        for t in toks[1:]:
            p = resolve(t, cwd)
            state['files'].add(p)
            state['steps'].append({'op': 'touch', 'target': p})
        return

    # python -c '...'  or  python - <<EOF ... EOF  or  python script.py
    # Keep the full source so the replay engine can sandbox-exec it.
    if head in ('python', 'python3'):
        # python - <<MARKER ... MARKER  (stdin heredoc — equivalent to -c)
        raw = state['raw_current']
        hd = re.match(r"^python3?\s+-?\s*<<\s*-?\s*['\"]?(\w+)['\"]?\s*\n?",
                      raw, re.MULTILINE)
        if hd:
            marker = hd.group(1)
            body_start = hd.end()
            endm = re.search(rf"\n\s*{re.escape(marker)}\s*(?:\n|$)", raw[body_start:])
            src = raw[body_start:body_start + endm.start()] if endm else raw[body_start:]
            state['steps'].append({'op': 'python_c', 'source': src.lstrip('\n'),
                                   'cwd_at_run': cwd})
            return
        # python -c with inline source
        cm = re.match(r'^python3?\s+-c\s+', cmd)
        if cm:
            tail = cmd[cm.end():].strip()
            if len(tail) >= 2 and tail[0] == tail[-1] and tail[0] in ('"', "'"):
                src = tail[1:-1]
            else:
                src = tail
            state['steps'].append({'op': 'python_c', 'source': src,
                                   'cwd_at_run': cwd})
            return
        # python script.py — script content read from VFS at replay time.
        sm = re.match(r'^python3?\s+(\S+\.py)(\s|$)', cmd)
        if sm:
            script = sm.group(1)
            state['steps'].append({'op': 'python_script',
                                   'script': resolve(script, cwd),
                                   'cwd_at_run': cwd})
            return
        # python -m pytest etc — irrelevant for edits
        state['steps'].append({'op': 'python_run', 'cmd': cmd[:200]})
        return

    # awk -i inplace
    if head == 'awk' and ('-i' in toks and 'inplace' in cmd):
        files = [t for t in toks[1:] if looks_like_path(t)]
        for f in files:
            p = resolve(f, cwd)
            state['files'].add(p)
            state['steps'].append({'op': 'awk_inplace', 'target': p})
        return


def trial_signature(trial_path):
    state = {
        'cwd': DEFAULT_CWD,
        'files': set(),
        'steps': [],
        'literals': [],
        'raw_current': '',
        'n_commands_total': 0,
    }
    with tarfile.open(trial_path, 'r:gz') as tf:
        # Sort episodes numerically
        responses = []
        for m in tf.getmembers():
            if not m.name.endswith('response.txt'): continue
            mm = re.search(r'episode-(\d+)/response.txt$', m.name)
            order = int(mm.group(1)) if mm else 0
            responses.append((order, m))
        responses.sort()
        for _, m in responses:
            try:
                j = json.loads(tf.extractfile(m).read().decode('utf-8','replace'))
            except Exception:
                continue
            for c in j.get('commands', []):
                cmd = (c.get('command') or c.get('keystrokes') or c.get('input') or '') if isinstance(c, dict) else str(c)
                if not cmd or not cmd.strip(): continue
                state['n_commands_total'] += 1
                # Strip trailing \n that terminus sends as Enter key
                cmd = cmd.rstrip('\n').strip()
                state['raw_current'] = cmd
                for sub in split_sub_commands(cmd):
                    state['raw_current'] = sub
                    parse_one(sub, state)
    return {
        'files_modified': sorted(state['files']),
        'n_files': len(state['files']),
        'edit_steps': state['steps'],
        'literals': state['literals'],
        'n_commands_total': state['n_commands_total'],
        'final_cwd': state['cwd'],
    }


def main():
    cells = pickle.load(open(CELLS_PKL, 'rb'))
    out = OUT_PATH.open('w')
    done = 0
    for (task, model, agent), tids in cells.items():
        for tid in tids:
            tar = TARBALLS / f'{tid}.tar.gz'
            if not tar.exists(): continue
            try:
                sig = trial_signature(str(tar))
            except Exception as e:
                sig = {'error': str(e)[:200]}
            sig.update({'trial_id': tid, 'task_name': task, 'model': model, 'agent': agent})
            out.write(json.dumps(sig) + '\n')
            done += 1
            if done % 200 == 0: print(f'  processed {done}')
    out.close()
    print(f'Done. {done} trials → {OUT_PATH}')


if __name__ == '__main__':
    main()
