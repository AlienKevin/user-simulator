"""Static Python replay of terminus-2 edit traces against base testbed.

Builds a virtual filesystem starting from GitHub raw content at base_commit.
Applies the parsed edit_steps (sed_subst, sed_delete, sed_insert, write,
append, cat_concat, cp, mv, rm, touch, patch) one-by-one, then emits a
unified diff against the original files.

What we DON'T model: anything that runs through `python3 -c`, `python script.py`,
`awk -i inplace`, `git apply` (with non-trivial patches), or shell pipelines
my extractor labels `python_run`. Those trials are marked unreliable.

GitHub fetch is cached on disk under /data/swebench-verified/.gh_cache/
keyed by (repo, commit, path).
"""
import os, re, json, time, hashlib
from pathlib import Path
import urllib.request, urllib.error
import threading

CACHE_DIR = Path('/data/swebench-verified/.gh_cache')
CACHE_DIR.mkdir(parents=True, exist_ok=True)
_cache_lock = threading.Lock()

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')


def _cache_path(repo, commit, path):
    key = hashlib.sha1(f'{repo}@{commit}@{path}'.encode()).hexdigest()
    return CACHE_DIR / key[:2] / (key + '.bin')


def fetch_github(repo, commit, path, retries=5):
    """Return file bytes from raw.githubusercontent.com, or b'' on 404."""
    cp = _cache_path(repo, commit, path)
    if cp.exists():
        data = cp.read_bytes()
        return None if data == b'__404__' else data
    url = f'https://raw.githubusercontent.com/{repo}/{commit}/{path}'
    headers = {'User-Agent': 'swebench-replay/1.0'}
    if GITHUB_TOKEN:
        headers['Authorization'] = f'Bearer {GITHUB_TOKEN}'
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                cp.parent.mkdir(parents=True, exist_ok=True)
                with _cache_lock:
                    cp.write_bytes(data)
                return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                cp.parent.mkdir(parents=True, exist_ok=True)
                with _cache_lock:
                    cp.write_bytes(b'__404__')
                return None
            if e.code == 403:
                # rate-limited; wait and retry
                wait = (2 ** attempt)
                time.sleep(wait)
                last_err = e
                continue
            last_err = e
        except Exception as e:
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f'github fetch failed for {repo}@{commit}/{path}: {last_err}')


def _to_repo_path(abs_path):
    """Strip /testbed/ prefix; / paths outside /testbed go through as-is."""
    if abs_path.startswith('/testbed/'):
        return abs_path[len('/testbed/'):]
    return abs_path.lstrip('/')


class VFS:
    def __init__(self, repo, base_commit):
        self.repo = repo
        self.base_commit = base_commit
        self.files = {}      # abs path → bytes (or None if deleted)
        self.original = {}   # abs path → original bytes (set on first read or write)
        self.touched = set() # abs path → at least one mutation

    def _ensure_loaded(self, abs_path):
        if abs_path in self.files:
            return
        if not abs_path.startswith('/testbed/'):
            # File outside testbed (e.g., /tmp scratch) — start empty
            self.files[abs_path] = None
            self.original[abs_path] = None
            return
        rp = _to_repo_path(abs_path)
        data = fetch_github(self.repo, self.base_commit, rp)
        self.files[abs_path] = data  # None means doesn't exist in base
        self.original[abs_path] = data

    def read(self, abs_path):
        self._ensure_loaded(abs_path)
        return self.files[abs_path]

    def write(self, abs_path, data):
        self._ensure_loaded(abs_path)
        self.files[abs_path] = data
        self.touched.add(abs_path)

    def append(self, abs_path, data):
        cur = self.read(abs_path) or b''
        if cur and not cur.endswith(b'\n'):
            cur += b'\n'
        self.write(abs_path, cur + data)

    def delete(self, abs_path):
        self._ensure_loaded(abs_path)
        self.files[abs_path] = None
        self.touched.add(abs_path)

    def copy(self, src, dst):
        data = self.read(src)
        self.write(dst, data if data is not None else b'')

    def move(self, src, dst):
        self.copy(src, dst)
        self.delete(src)

    def changes(self):
        """Yield (abs_path, before_bytes_or_None, after_bytes_or_None) for touched files."""
        for p in sorted(self.touched):
            yield p, self.original.get(p), self.files.get(p)


def _to_bytes(x):
    if x is None: return b''
    if isinstance(x, bytes): return x
    return x.encode('utf-8', 'replace')


def _to_str(x):
    if x is None: return ''
    if isinstance(x, bytes): return x.decode('utf-8', 'replace')
    return x


# ----- sed primitives -----

def bre_to_pyre(pat):
    """Convert a sed BRE pattern to a Python regex.
    In BRE: ( ) { } + ? | are literal; \( \) \{ \} \+ \? \| are metacharacters.
    Python re is the opposite.
    """
    out = []
    i = 0
    L = len(pat)
    while i < L:
        ch = pat[i]
        if ch == '\\' and i + 1 < L:
            nxt = pat[i+1]
            if nxt in '(){}+?|':
                out.append(nxt)   # \( → (   (group in py)
            else:
                out.append(ch); out.append(nxt)
            i += 2
            continue
        if ch in '(){}+?|':
            out.append('\\'); out.append(ch)  # ( → \(   (literal in py)
            i += 1
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def bre_replace_to_pyre(rep):
    """Convert sed replacement to Python re.sub replacement.

    sed replacement semantics:
      \&     -> whole match              (py: \g<0>)
      \<n>   -> backref to group n       (py: \\<n>)
      \\     -> literal backslash        (py: \\\\)
      \<other> -> literal <other>        (e.g. \* -> *)
      & alone-> whole match (we leave it literal to avoid surprising agents).
    """
    out = []
    i = 0
    L = len(rep)
    while i < L:
        ch = rep[i]
        if ch == '\\' and i + 1 < L:
            nxt = rep[i+1]
            if nxt == '&':
                out.append(r'\g<0>'); i += 2; continue
            if nxt.isdigit():
                out.append(ch); out.append(nxt); i += 2; continue
            if nxt == '\\':
                out.append('\\\\'); i += 2; continue
            # In sed, \<non-special> just yields <non-special>.
            # In py re.sub, an unrecognized escape would be a syntax error,
            # so we drop the backslash here. Also re-escape ones that would
            # be interpreted as something else in py replacement (\g, \1 etc handled above).
            out.append(re.escape(nxt))  # safe: keep literal
            i += 2; continue
        out.append(ch); i += 1
    return ''.join(out)


def sed_subst(text, find, replace, addr=None, flags=''):
    """Apply s/find/replace/[flags] with optional address.
    addr: None | int | (int,int) | '/regex/'  (None = all lines)
    flags: 'g' for global per-line, 'i' for ignore case, etc.
    Returns modified text.
    """
    pyflags = 0
    if 'i' in flags: pyflags |= re.IGNORECASE
    count = 0 if 'g' in flags else 1

    py_find = bre_to_pyre(find)
    py_replace = bre_replace_to_pyre(replace)

    try:
        rx = re.compile(py_find, pyflags)
        use_re = True
    except re.error:
        rx, use_re = None, False

    lines = text.split('\n')

    def in_addr(i, line):
        if addr is None: return True
        if isinstance(addr, int): return i == addr - 1
        if isinstance(addr, tuple): return addr[0] - 1 <= i <= addr[1] - 1
        if isinstance(addr, str) and addr.startswith('/'):
            pat = addr.strip('/')
            try: return re.search(pat, line) is not None
            except re.error: return pat in line
        return True

    new_lines = []
    for i, line in enumerate(lines):
        if in_addr(i, line):
            new = line
            if use_re:
                try:
                    new = rx.sub(py_replace, line, count=count)
                except Exception:
                    new = line
            if new == line:
                # Fallback: literal string replace of raw find
                new = line.replace(find, replace, count if count else -1)
            line = new
        new_lines.append(line)
    return '\n'.join(new_lines)


def sed_delete(text, addr):
    """Delete lines matching addr."""
    lines = text.split('\n')
    out = []
    for i, line in enumerate(lines):
        if isinstance(addr, int):
            keep = i != addr - 1
        elif isinstance(addr, tuple):
            keep = not (addr[0] - 1 <= i <= addr[1] - 1)
        elif isinstance(addr, str) and addr.startswith('/'):
            try: keep = re.search(addr.strip('/'), line) is None
            except re.error: keep = addr.strip('/') not in line
        else:
            keep = True
        if keep: out.append(line)
    return '\n'.join(out)


def sed_insert(text, line_num, ins_text, after=False):
    """Insert ins_text before (or after) line N."""
    lines = text.split('\n')
    idx = line_num - 1 + (1 if after else 0)
    idx = max(0, min(len(lines), idx))
    # ins_text may itself contain \n
    ins_lines = ins_text.split('\n')
    return '\n'.join(lines[:idx] + ins_lines + lines[idx:])


# ----- step dispatcher -----

def parse_addr(s):
    """Parse a sed address string into a comparable form."""
    if s is None or s == '': return None
    if ',' in s:
        a, b = s.split(',', 1)
        try: return (int(a), int(b))
        except ValueError: return None
    try: return int(s)
    except ValueError: pass
    if s.startswith('/') and s.endswith('/'):
        return s
    return None


# ----- Python sandbox: exec agent's `python -c` scripts against the VFS -----

import builtins as _builtins
import os.path as _ospath

# Modules the sandbox is allowed to import.
_SAFE_MODULES = {'re', 'json', 'string', 'collections', 'itertools',
                 'functools', 'math', 'textwrap', 'difflib', 'copy',
                 'os.path', 'posixpath', 'pathlib', 'sys',  # sys is restricted
                 'io', 'csv', 'unicodedata', 'string'}


def _make_safe_open(vfs, cwd):
    """Return a sandbox open() that reads/writes via VFS, with `cwd` as default."""
    def _resolve(path):
        path = str(path)
        if path.startswith('/'):
            return _ospath.normpath(path)
        return _ospath.normpath(_ospath.join(cwd, path))

    class VFSFile:
        __slots__ = ('vfs', 'path', 'mode', 'binary', '_buf', '_pos', '_closed', '_dirty')

        def __init__(self, path, mode):
            self.vfs = vfs
            self.path = path
            self.mode = mode
            self.binary = 'b' in mode
            self._closed = False
            self._dirty = False
            raw = vfs.read(path)  # None if file doesn't exist
            data = raw or b''
            if 'w' in mode:
                self._buf = b''
            elif 'a' in mode:
                self._buf = data
            elif 'x' in mode:
                if raw is not None: raise FileExistsError(path)
                self._buf = b''
            elif '+' in mode:
                # r+ / rb+ : file must exist
                if raw is None: raise FileNotFoundError(path)
                self._buf = data
            else:
                # read mode (default 'r'): file must exist, otherwise raise
                # like a real filesystem. Returning empty silently leads to
                # subtle bugs in agent scripts (e.g., str.replace('', X) blowup).
                if raw is None: raise FileNotFoundError(path)
                self._buf = data
            self._pos = len(self._buf) if 'a' in mode else 0

        def read(self, n=-1):
            if n < 0 or n is None:
                chunk = self._buf[self._pos:]
                self._pos = len(self._buf)
            else:
                chunk = self._buf[self._pos:self._pos+n]
                self._pos += n
            return chunk if self.binary else chunk.decode('utf-8', 'replace')

        def readline(self, size=-1):
            nl = self._buf.find(b'\n', self._pos)
            if nl == -1:
                chunk = self._buf[self._pos:]; self._pos = len(self._buf)
            else:
                chunk = self._buf[self._pos:nl+1]; self._pos = nl+1
            return chunk if self.binary else chunk.decode('utf-8', 'replace')

        def readlines(self, hint=-1):
            data = self._buf[self._pos:]; self._pos = len(self._buf)
            if self.binary:
                # bytes: split keeping newlines
                out = []
                start = 0
                for i, b in enumerate(data):
                    if b == 0x0a:
                        out.append(bytes(data[start:i+1])); start = i+1
                if start < len(data): out.append(bytes(data[start:]))
                return out
            text = data.decode('utf-8', 'replace')
            return text.splitlines(keepends=True)

        def write(self, s):
            if isinstance(s, str): s = s.encode('utf-8')
            # All write modes splice at current position; 'a' mode initialized
            # _pos = len(_buf), so writes append. 'w' initialized _buf = b''.
            self._buf = self._buf[:self._pos] + s + self._buf[self._pos + len(s):]
            self._pos += len(s)
            self._dirty = True
            return len(s)

        def writelines(self, lines):
            for ln in lines: self.write(ln)

        def seek(self, off, whence=0):
            if whence == 0: self._pos = off
            elif whence == 1: self._pos += off
            elif whence == 2: self._pos = len(self._buf) + off
            return self._pos

        def tell(self): return self._pos
        def flush(self): pass
        def truncate(self, size=None):
            if size is None: size = self._pos
            self._buf = self._buf[:size]
            self._dirty = True

        def close(self):
            if self._closed: return
            self._closed = True
            if any(m in self.mode for m in ('w', 'a', 'x', '+')) and self._dirty:
                self.vfs.write(self.path, self._buf)

        def __iter__(self):
            for ln in self.readlines(): yield ln

        def __enter__(self): return self
        def __exit__(self, *a):
            self.close()
            return False

    def safe_open(file, mode='r', buffering=-1, encoding=None, errors=None,
                  newline=None, closefd=True, opener=None):
        path = _resolve(file)
        # Simplify mode (drop 'b'/'t' for our buf model — we always store bytes)
        return VFSFile(path, mode)

    return safe_open


class _Blocker:
    """Catch-all object that raises on any attribute access."""
    def __init__(self, name): self._name = name
    def __getattr__(self, k):
        raise RuntimeError(f'sandbox: blocked access to {self._name}.{k}')
    def __call__(self, *a, **kw):
        raise RuntimeError(f'sandbox: blocked call to {self._name}')


def _make_vfs_path_factory(vfs, cwd):
    """A pathlib.Path-like factory backed by the VFS."""
    import os.path as op
    import pathlib as _pathlib

    def _resolve(p):
        p = str(p)
        if p.startswith('/'): return op.normpath(p)
        return op.normpath(op.join(cwd, p))

    class VFSPath:
        __slots__ = ('_path',)

        def __init__(self, *parts):
            joined = op.normpath('/'.join(str(p) for p in parts) or '.')
            self._path = _resolve(joined)

        def __fspath__(self): return self._path
        def __str__(self):    return self._path
        def __repr__(self):   return f'VFSPath({self._path!r})'
        def __truediv__(self, other):
            return VFSPath(self._path, str(other))
        def __rtruediv__(self, other):
            return VFSPath(str(other), self._path)
        def __eq__(self, other):
            return isinstance(other, VFSPath) and self._path == other._path
        def __hash__(self): return hash(self._path)

        @property
        def name(self): return op.basename(self._path)
        @property
        def parent(self): return VFSPath(op.dirname(self._path) or '/')
        @property
        def stem(self):
            n = self.name; return n.rsplit('.', 1)[0] if '.' in n else n
        @property
        def suffix(self):
            n = self.name; return ('.' + n.rsplit('.', 1)[1]) if '.' in n else ''

        def exists(self):
            return vfs.read(self._path) is not None
        def is_file(self): return self.exists()
        def is_dir(self):  return False

        def read_bytes(self):
            d = vfs.read(self._path)
            if d is None: raise FileNotFoundError(self._path)
            return d
        def read_text(self, encoding='utf-8', errors='strict'):
            return self.read_bytes().decode(encoding, errors)
        def write_bytes(self, data):
            vfs.write(self._path, bytes(data))
            return len(data)
        def write_text(self, data, encoding='utf-8', errors='strict', newline=None):
            b = data.encode(encoding, errors)
            vfs.write(self._path, b)
            return len(data)
        def unlink(self, missing_ok=False):
            if not self.exists():
                if missing_ok: return
                raise FileNotFoundError(self._path)
            vfs.delete(self._path)
        def open(self, mode='r', *a, **kw):
            return _make_safe_open(vfs, cwd)(self._path, mode)
        def mkdir(self, *a, **kw): return None
        def resolve(self): return self
        def absolute(self): return self

    return VFSPath


def _make_safe_pathlib_module(vfs, cwd):
    import pathlib as _pathlib, types
    m = types.ModuleType('pathlib')
    factory = _make_vfs_path_factory(vfs, cwd)
    m.Path = factory
    m.PosixPath = factory
    m.PurePath = _pathlib.PurePath
    m.PurePosixPath = _pathlib.PurePosixPath
    m.PureWindowsPath = _pathlib.PureWindowsPath
    return m


def _make_sandbox_globals(vfs, cwd):
    """Build the globals dict for sandboxed exec."""
    safe_open = _make_safe_open(vfs, cwd)
    safe_pathlib = _make_safe_pathlib_module(vfs, cwd)

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == 'pathlib' or name.startswith('pathlib.'):
            return safe_pathlib
        base = name.split('.')[0]
        if name in _SAFE_MODULES or base in _SAFE_MODULES:
            return _builtins.__import__(name, globals, locals, fromlist, level)
        # subprocess, socket, urllib, http, smtplib, ftplib, etc.: block
        raise ImportError(f'sandbox: import {name} blocked')

    # Build a minimal __builtins__
    def _silent_print(*a, **kw): pass
    safe_builtins = {
        # constants / types
        'True': True, 'False': False, 'None': None,
        'int': int, 'float': float, 'bool': bool, 'str': str, 'bytes': bytes,
        'list': list, 'tuple': tuple, 'dict': dict, 'set': set, 'frozenset': frozenset,
        'type': type, 'object': object,
        # iteration / arithmetic
        'len': len, 'range': range, 'enumerate': enumerate, 'zip': zip,
        'sorted': sorted, 'reversed': reversed, 'map': map, 'filter': filter,
        'sum': sum, 'min': min, 'max': max, 'abs': abs, 'round': round,
        'pow': pow, 'divmod': divmod,
        # I/O & io  (print silenced — agent's debug output isn't useful here)
        'print': _silent_print, 'open': safe_open, 'input': lambda *a: '',
        # misc
        'isinstance': isinstance, 'issubclass': issubclass,
        'getattr': getattr, 'setattr': setattr, 'hasattr': hasattr, 'delattr': delattr,
        'iter': iter, 'next': next, 'any': any, 'all': all,
        'callable': callable, 'id': id, 'hash': hash, 'repr': repr,
        'chr': chr, 'ord': ord, 'hex': hex, 'oct': oct, 'bin': bin,
        # exceptions
        'Exception': Exception, 'ValueError': ValueError, 'TypeError': TypeError,
        'KeyError': KeyError, 'IndexError': IndexError, 'AttributeError': AttributeError,
        'FileNotFoundError': FileNotFoundError, 'FileExistsError': FileExistsError,
        'RuntimeError': RuntimeError, 'StopIteration': StopIteration,
        'OSError': OSError, 'IOError': IOError, 'NotImplementedError': NotImplementedError,
        'ArithmeticError': ArithmeticError, 'ZeroDivisionError': ZeroDivisionError,
        'AssertionError': AssertionError, 'EOFError': EOFError,
        # imports
        '__import__': safe_import, '__name__': '__main__',
    }
    return {
        '__builtins__': safe_builtins,
        'open': safe_open,
        'os': _Blocker('os'),         # block os.system etc.
        'subprocess': _Blocker('subprocess'),
        'socket': _Blocker('socket'),
    }


class _StepLimitExceeded(BaseException):
    """Raised by the trace function when the bytecode-step budget is spent.

    Inherits from BaseException so user scripts that catch `Exception` can't
    swallow it.
    """


def _make_step_limiter(limit):
    counter = [0]
    def trace(frame, event, arg):
        # Count every event: line, call, return. Cheap counter, no hashing.
        counter[0] += 1
        if counter[0] > limit:
            raise _StepLimitExceeded()
        return trace
    return trace


import sys as _sys


import signal as _signal


class _WallTimeExceeded(BaseException):
    pass


def _sigalrm_handler(signum, frame):
    raise _WallTimeExceeded()


def exec_python_in_sandbox(source, vfs, cwd, step_limit=200_000, wall_timeout=8):
    """Execute `source` against the VFS. Returns True on success, False on error.

    Path resolution: relative paths are resolved against `cwd`. open() routes
    to the VFS so reads return current VFS bytes and writes update the VFS on
    close. Two safeguards:
      - bytecode step counter (catches Python-level infinite loops)
      - SIGALRM wall-clock timeout (catches C-level stalls like pathological
        regex). signal.alarm only works in the main thread; if called from a
        worker thread, skip it.
    """
    try:
        code = compile(source, '<python_c>', 'exec')
    except SyntaxError:
        return False
    g = _make_sandbox_globals(vfs, cwd)
    trace = _make_step_limiter(step_limit)
    prev_trace = _sys.gettrace()
    _sys.settrace(trace)

    armed_alarm = False
    prev_handler = None
    import threading as _threading
    if _threading.current_thread() is _threading.main_thread():
        prev_handler = _signal.signal(_signal.SIGALRM, _sigalrm_handler)
        _signal.alarm(wall_timeout)
        armed_alarm = True
    try:
        exec(code, g)
    except _StepLimitExceeded:
        return False
    except _WallTimeExceeded:
        return False
    except BaseException:
        return False
    finally:
        _sys.settrace(prev_trace)
        if armed_alarm:
            _signal.alarm(0)
            _signal.signal(_signal.SIGALRM, prev_handler)
    return True


def apply_step(vfs, step, cwd_default='/testbed'):
    op = step.get('op')
    target = step.get('target')
    try:
        if op == 'sed_subst':
            data = vfs.read(target)
            if data is None: return False
            text = _to_str(data)
            addr = parse_addr(step.get('addr'))
            new_text = sed_subst(text, step.get('find', ''), step.get('replace', ''),
                                 addr, step.get('flags', ''))
            vfs.write(target, new_text.encode('utf-8'))
            return True
        if op == 'edit_literal':
            data = vfs.read(target)
            if data is None: return False
            text = _to_str(data)
            old = step.get('old', '')
            new = step.get('new', '')
            if not old:
                return False
            # claude-code Edit requires old_string to be unique unless replace_all
            count = -1 if step.get('replace_all') else 1
            new_text = text.replace(old, new, count if count > 0 else 10**9)
            if new_text == text:
                return False
            vfs.write(target, new_text.encode('utf-8'))
            return True
        if op == 'sed_delete':
            data = vfs.read(target)
            if data is None: return False
            addr = parse_addr(step.get('range'))
            new_text = sed_delete(_to_str(data), addr)
            vfs.write(target, new_text.encode('utf-8'))
            return True
        if op in ('sed_insert', 'sed_append'):
            data = vfs.read(target) or b''
            new_text = sed_insert(_to_str(data), int(step.get('line', 1)),
                                  step.get('text', ''), after=(op == 'sed_append'))
            vfs.write(target, new_text.encode('utf-8'))
            return True
        if op == 'write':
            body = step.get('body', '')
            vfs.write(target, _to_bytes(body))
            return True
        if op == 'append':
            body = step.get('body', step.get('text', ''))
            vfs.append(target, _to_bytes(body))
            return True
        if op == 'cat_concat':
            srcs = step.get('sources') or []
            data = b''
            for s in srcs:
                d = vfs.read(s) or b''
                data += d
                if d and not d.endswith(b'\n'): data += b'\n'
            vfs.write(target, data)
            return True
        if op == 'cp':
            vfs.copy(step['src'], step['dst'])
            return True
        if op == 'mv':
            vfs.move(step['src'], step['dst'])
            return True
        if op == 'rm':
            vfs.delete(target)
            return True
        if op == 'touch':
            data = vfs.read(target)
            if data is None:
                vfs.write(target, b'')
            return True
        if op == 'python_c':
            src = step.get('source', '')
            cwd = step.get('cwd_at_run', cwd_default)
            return exec_python_in_sandbox(src, vfs, cwd)
        if op == 'python_script':
            script = step.get('script')
            cwd = step.get('cwd_at_run', cwd_default)
            data = vfs.read(script)
            if not data:
                return False
            try: src = data.decode('utf-8', 'replace')
            except Exception: return False
            return exec_python_in_sandbox(src, vfs, cwd)
        if op in ('python_run', 'sed_other', 'awk_inplace', 'patch'):
            return False  # unsupported reliably
    except Exception as ex:
        return False
    return False


def replay_trial(trial_meta, vfs):
    """Apply all edit_steps in order. Return (n_applied, n_failed)."""
    n_ok = 0; n_fail = 0
    for step in trial_meta.get('edit_steps', []):
        if apply_step(vfs, step): n_ok += 1
        else: n_fail += 1
    return n_ok, n_fail


def make_diff(vfs, only_under='/testbed/'):
    """Produce a unified diff over all touched files."""
    import difflib
    out = []
    for path, before, after in vfs.changes():
        if only_under and not path.startswith(only_under): continue
        rp = _to_repo_path(path)
        before_lines = _to_str(before).splitlines(keepends=True) if before is not None else []
        after_lines = _to_str(after).splitlines(keepends=True) if after is not None else []
        if before == after: continue
        from_name = f'a/{rp}' if before is not None else '/dev/null'
        to_name = f'b/{rp}' if after is not None else '/dev/null'
        d = difflib.unified_diff(before_lines, after_lines, fromfile=from_name, tofile=to_name, n=3)
        out.append('diff --git a/{0} b/{0}'.format(rp))
        out.extend(line.rstrip('\n') for line in d)
    return '\n'.join(out) + ('\n' if out else '')


# ----- self-test -----
if __name__ == '__main__':
    # Quick smoke test on a known trial
    meta = {}
    for l in open('/data/swebench-verified/task_metadata.jsonl'):
        r = json.loads(l)
        meta[r['instance_id']] = r
    edits = {}
    for l in open('/data/swebench-verified/terminus2_edits.jsonl'):
        r = json.loads(l)
        if r.get('n_files', 0) > 0 and r.get('task_name') == 'scikit-learn__scikit-learn-14496':
            edits[r['trial_id']] = r
            if len(edits) >= 2: break
    print(f'testing on {len(edits)} trials')
    for tid, e in edits.items():
        task = meta[e['task_name']]
        vfs = VFS(task['repo'], task['base_commit'])
        ok, fail = replay_trial(e, vfs)
        diff = make_diff(vfs)
        print(f'\n=== {tid}  steps ok={ok} fail={fail} ===')
        print(diff[:3000])
