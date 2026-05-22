"use client";

import { useEffect, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

type Edit = {
  n: number;
  tool: string;
  file_path: string;
  file_path_norm?: string;
  attribution?: "agent_only" | "human_only" | "mixed" | "unknown";
  old?: string;
  new?: string;
  replace_all?: boolean;
  edits?: { old: string; new: string; replace_all?: boolean }[];
  write_content?: string;
};

type CommitMeta = {
  sha: string;
  msg: string;
  author: string;
  is_agent: boolean;
  files: string;
  add: number;
  rem: number;
};

type UserMsg = { n: number; text: string; timestamp: string | null };

type AttributionLabel = "agent_only" | "human_only" | "mixed";

type CommitFull = CommitMeta & { patch: string };

type Checkpoint = {
  checkpoint_pk: string;
  checkpoint_id: string;
  commit_date: string | null;
  edit_count: number;
  edits: Edit[];
  user_messages: UserMsg[];
  commits: CommitFull[];
  file_attribution: Record<string, AttributionLabel>;
  attribution_summary: Record<AttributionLabel, number>;
};

type SessionMeta = {
  session_id: string;
  repo_id: string;
  user_id: string;
  agent: string;
  turn_count: number;
  tool_call_count: number;
  files_touched_count: number;
  duration_seconds: number;
  success_score: number;
  persona: string;
  canonical_checkpoint_pk: string;
  agent_lines?: number | null;
  human_added?: number | null;
  human_modified?: number | null;
  human_removed?: number | null;
  total_committed?: number | null;
  agent_percentage?: number | null;
};

type SessionRecord = {
  meta: SessionMeta;
  user_prompt: string;
  assistant_summary: string;
  checkpoints: Checkpoint[];
};

type Report = { description: string; sessions: SessionRecord[] };

function basename(p: string) {
  if (!p) return "";
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

function dur(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Shared style overrides so the diff viewer matches the rest of the page.
const DIFF_STYLES = {
  variables: {
    light: {
      diffViewerBackground: "#ffffff",
      diffViewerColor: "#27272a",
      addedBackground: "#ecfdf5",
      addedColor: "#065f46",
      removedBackground: "#fff1f2",
      removedColor: "#9f1239",
      wordAddedBackground: "#a7f3d0",
      wordRemovedBackground: "#fecdd3",
      addedGutterBackground: "#d1fae5",
      removedGutterBackground: "#fecdd3",
      gutterBackground: "#fafafa",
      gutterBackgroundDark: "#f4f4f5",
      highlightBackground: "#fef9c3",
      highlightGutterBackground: "#fde68a",
      codeFoldGutterBackground: "#f4f4f5",
      codeFoldBackground: "#f4f4f5",
      emptyLineBackground: "#fafafa",
      gutterColor: "#a1a1aa",
      addedGutterColor: "#065f46",
      removedGutterColor: "#9f1239",
      codeFoldContentColor: "#71717a",
      diffViewerTitleBackground: "#fafafa",
      diffViewerTitleColor: "#52525b",
      diffViewerTitleBorderColor: "#e4e4e7",
    },
  },
  line: { padding: "1px 2px", fontSize: 11, lineHeight: "1.4" },
  contentText: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 },
  gutter: { padding: "0 6px", minWidth: 22, fontSize: 10 },
  marker: { padding: "0 4px" },
  emptyGutter: { padding: "0 6px" },
};

// One edit hunk (old → new) using react-diff-viewer-continued.
function EditHunk({
  oldText,
  newText,
  header,
  replaceAll,
  splitView,
}: {
  oldText: string;
  newText: string;
  header: string;
  replaceAll?: boolean;
  splitView: boolean;
}) {
  return (
    <div className="border-t border-zinc-200">
      <div className="px-3 py-1 bg-zinc-50 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span>{header}</span>
        {replaceAll && <span className="text-amber-700">replace_all</span>}
      </div>
      <div className="diff-scroll">
        <ReactDiffViewer
          oldValue={oldText}
          newValue={newText}
          splitView={splitView}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={false}
          hideLineNumbers={false}
          showDiffOnly={true}
          styles={DIFF_STYLES as any}
        />
      </div>
    </div>
  );
}

// New file via Write — render as a side-by-side from empty → content so the
// viewer treats every line as added.
function WriteHunk({
  content,
  header,
  splitView,
}: {
  content: string;
  header: string;
  splitView: boolean;
}) {
  return (
    <div className="border-t border-zinc-200">
      <div className="px-3 py-1 bg-zinc-50 text-[10px] font-mono text-zinc-500">
        {header} <span className="text-emerald-700">(new file)</span>
      </div>
      <div className="diff-scroll">
        <ReactDiffViewer
          oldValue=""
          newValue={content}
          splitView={splitView}
          useDarkTheme={false}
          showDiffOnly={false}
          styles={DIFF_STYLES as any}
        />
      </div>
    </div>
  );
}

type FileBucket = {
  file_path: string;
  file_path_norm: string;
  attribution: AttributionLabel | "unknown";
  edits: Edit[];
  add_lines: number;
  rem_lines: number;
};

function AttributionPill({ label }: { label: AttributionLabel | "unknown" }) {
  if (label === "unknown") return null;
  const style = {
    agent_only: { bg: "bg-emerald-100", text: "text-emerald-800", word: "agent" },
    mixed: { bg: "bg-amber-100", text: "text-amber-800", word: "mixed" },
    human_only: { bg: "bg-rose-100", text: "text-rose-800", word: "human" },
  }[label];
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
      title={`Dataset attribution: ${label.replace("_", " ")}`}
    >
      {style.word}
    </span>
  );
}

function groupByFile(edits: Edit[]): FileBucket[] {
  const buckets = new Map<string, FileBucket>();
  for (const e of edits) {
    if (!buckets.has(e.file_path)) {
      buckets.set(e.file_path, {
        file_path: e.file_path,
        file_path_norm: e.file_path_norm || e.file_path,
        attribution: (e.attribution as AttributionLabel | "unknown") || "unknown",
        edits: [],
        add_lines: 0,
        rem_lines: 0,
      });
    }
    const b = buckets.get(e.file_path)!;
    b.edits.push(e);
    // Tally +/- for the header summary
    if (e.tool === "Edit" || (e.tool === "MultiEdit" && !e.edits)) {
      b.rem_lines += (e.old || "").split("\n").filter(Boolean).length;
      b.add_lines += (e.new || "").split("\n").filter(Boolean).length;
    }
    if (e.tool === "MultiEdit" && e.edits) {
      for (const inner of e.edits) {
        b.rem_lines += (inner.old || "").split("\n").filter(Boolean).length;
        b.add_lines += (inner.new || "").split("\n").filter(Boolean).length;
      }
    }
    if (e.tool === "Write" && e.write_content) {
      b.add_lines += e.write_content.split("\n").length;
    }
  }
  return Array.from(buckets.values());
}

function FilePanel({ bucket, splitView }: { bucket: FileBucket; splitView: boolean }) {
  const [open, setOpen] = useState(true);
  type Hunk =
    | { kind: "edit"; old: string; new: string; replace_all?: boolean; label: string }
    | { kind: "write"; content: string; label: string };
  const hunks: Hunk[] = [];
  for (const e of bucket.edits) {
    if (e.tool === "Edit") {
      hunks.push({
        kind: "edit",
        old: e.old || "",
        new: e.new || "",
        replace_all: e.replace_all,
        label: `@@ Edit · turn ${e.n} @@`,
      });
    } else if (e.tool === "MultiEdit" && e.edits) {
      e.edits.forEach((inner, i) => {
        hunks.push({
          kind: "edit",
          old: inner.old,
          new: inner.new,
          replace_all: inner.replace_all,
          label: `@@ MultiEdit ${i + 1}/${e.edits!.length} · turn ${e.n} @@`,
        });
      });
    } else if (e.tool === "Write" && e.write_content) {
      hunks.push({
        kind: "write",
        content: e.write_content,
        label: `@@ Write · turn ${e.n} @@`,
      });
    }
  }

  return (
    <div className="rounded border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 text-left"
      >
        <span className="text-[10px] text-zinc-400">{open ? "▼" : "▶"}</span>
        <code
          className="font-mono text-xs text-zinc-700 truncate flex-1 min-w-0"
          title={bucket.file_path}
        >
          {bucket.file_path_norm || bucket.file_path || "—"}
        </code>
        <AttributionPill label={bucket.attribution} />
        <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
          {bucket.edits.length} edit{bucket.edits.length === 1 ? "" : "s"}
          {" · "}
          <span className="text-emerald-700">+{bucket.add_lines}</span>
          {" "}
          <span className="text-rose-700">−{bucket.rem_lines}</span>
        </span>
      </button>
      {open && (
        <div>
          {hunks.map((h, i) =>
            h.kind === "edit" ? (
              <EditHunk
                key={i}
                oldText={h.old}
                newText={h.new}
                header={h.label}
                replaceAll={h.replace_all}
                splitView={splitView}
              />
            ) : (
              <WriteHunk
                key={i}
                content={h.content}
                header={h.label}
                splitView={splitView}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function PatchView({ diff }: { diff: string }) {
  if (!diff) {
    return (
      <div className="text-xs text-zinc-500 italic">
        No commit attributed to this checkpoint.
      </div>
    );
  }
  const lines = diff.split("\n");
  return (
    <pre className="text-[11px] font-mono overflow-x-auto bg-white border border-zinc-200 rounded p-2 max-h-[36rem] leading-snug">
      {lines.map((line, i) => {
        let cls = "text-zinc-600";
        if (
          line.startsWith("commit ") ||
          line.startsWith("Author:") ||
          line.startsWith("Date:") ||
          line.startsWith("    ") ||
          line.startsWith("diff --git") ||
          line.startsWith("index ") ||
          line.startsWith("--- ") ||
          line.startsWith("+++ ") ||
          line.startsWith("@@")
        ) {
          cls = "text-zinc-400";
        } else if (line.startsWith("+")) {
          cls = "bg-emerald-50 text-emerald-800";
        } else if (line.startsWith("-")) {
          cls = "bg-rose-50 text-rose-800";
        }
        return (
          <div key={i} className={cls}>
            <span className="select-none text-zinc-300 mr-2 inline-block w-8 text-right">
              {i + 1}
            </span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

function AttributionSummary({
  summary,
  files,
}: {
  summary: Record<AttributionLabel, number>;
  files: Record<string, AttributionLabel>;
}) {
  const total = (summary.agent_only || 0) + (summary.mixed || 0) + (summary.human_only || 0);
  if (total === 0) return null;
  return (
    <div className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-medium text-zinc-500 uppercase tracking-wide text-[10px]">
          Committed files
        </span>
        {summary.agent_only > 0 && (
          <span className="flex items-center gap-1.5">
            <AttributionPill label="agent_only" />
            <span className="tabular-nums">{summary.agent_only}</span>
          </span>
        )}
        {summary.mixed > 0 && (
          <span className="flex items-center gap-1.5">
            <AttributionPill label="mixed" />
            <span className="tabular-nums">{summary.mixed}</span>
          </span>
        )}
        {summary.human_only > 0 && (
          <span className="flex items-center gap-1.5">
            <AttributionPill label="human_only" />
            <span className="tabular-nums">{summary.human_only}</span>
          </span>
        )}
      </div>
      {/* file list */}
      <div className="mt-2 space-y-1">
        {Object.entries(files).map(([path, label]) => (
          <div key={path} className="flex items-center gap-2 text-[11px]">
            <AttributionPill label={label} />
            <code className="font-mono text-zinc-700 truncate" title={path}>
              {path}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckpointCard({
  cp,
  index,
  total,
  splitView,
}: {
  cp: Checkpoint;
  index: number;
  total: number;
  splitView: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <header className="mb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-medium">
            {index + 1}
          </div>
          <span className="text-xs text-zinc-500">
            checkpoint <code className="text-zinc-700">{cp.checkpoint_id}</code>
          </span>
          {cp.commit_date && (
            <span className="text-[11px] text-zinc-400">{shortDate(cp.commit_date)}</span>
          )}
          <span className="ml-auto text-xs text-zinc-500">
            {cp.edit_count} edit{cp.edit_count === 1 ? "" : "s"}
            {cp.commits.length > 0 && (
              <>
                {" · "}
                {cp.commits.length} commit{cp.commits.length === 1 ? "" : "s"}
              </>
            )}
          </span>
        </div>
        {cp.commits.map((c) => (
          <div key={c.sha} className="mt-2 text-sm text-zinc-700 flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-500">{c.sha.slice(0, 10)}</span>
            <span className="italic flex-1 min-w-0 truncate">{c.msg.split("\n")[0]}</span>
            <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
              <span className="text-emerald-700">+{c.add}</span>{" "}
              <span className="text-rose-700">−{c.rem}</span>
            </span>
            {c.is_agent && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded">
                agent author
              </span>
            )}
          </div>
        ))}
      </header>

      {cp.user_messages.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-zinc-600 mb-2 uppercase tracking-wide">
            User message{cp.user_messages.length === 1 ? "" : "s"} leading to this checkpoint
          </div>
          <div className="space-y-2">
            {cp.user_messages.map((u) => (
              <div
                key={u.n}
                className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm"
              >
                <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
                  turn {u.n}
                </div>
                <div className="whitespace-pre-wrap text-zinc-800 leading-relaxed">
                  {u.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cp.edits.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-zinc-600 mb-2 uppercase tracking-wide">
            Edits attributed to this checkpoint — grouped by file
          </div>
          <div className="space-y-3">
            {groupByFile(cp.edits).map((b) => (
              <FilePanel key={b.file_path} bucket={b} splitView={splitView} />
            ))}
          </div>
        </div>
      )}

      {/* Dataset-native per-file attribution summary */}
      <div className="mt-2">
        <AttributionSummary
          summary={cp.attribution_summary}
          files={cp.file_attribution}
        />
      </div>

      {/* Committed patches */}
      {cp.commits.length > 0 && (
        <div className="mt-3">
          <details>
            <summary className="text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer">
              show committed patch{cp.commits.length === 1 ? "" : "es"}
            </summary>
            <div className="mt-2 space-y-3">
              {cp.commits.map((c) => (
                <div key={c.sha}>
                  <div className="text-[11px] text-zinc-500 mb-1">
                    <code>{c.sha.slice(0, 10)}</code> · {c.author}
                    {c.is_agent && (
                      <span className="ml-2 text-emerald-700">(agent author)</span>
                    )}
                  </div>
                  <PatchView diff={c.patch} />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}


    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-zinc-400">{hint}</div>}
    </div>
  );
}

export default function SweChatSessionsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [splitView, setSplitView] = useState(false);

  useEffect(() => {
    fetch("./data/swe_chat_sessions.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        fetch("/data/swe_chat_sessions.json").then((r) => r.json()).then(setData);
      });
  }, []);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }
  const active = data.sessions[activeIdx];
  if (!active) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-zinc-900">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
          Methods · session traces
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Checkpoints inside a claude-code session
        </h1>
        <p className="mt-3 text-sm text-zinc-700">
          {data.description}
        </p>
      </header>

      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex flex-wrap gap-2">
          {data.sessions.map((s, i) => (
            <button
              key={s.meta.session_id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                i === activeIdx
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
              }`}
            >
              {s.meta.repo_id} · {s.checkpoints.length} checkpoint
              {s.checkpoints.length === 1 ? "" : "s"} · {s.meta.files_touched_count}f
            </button>
          ))}
        </nav>
        <div className="text-xs text-zinc-600 flex items-center gap-2">
          <span>diff:</span>
          <button
            type="button"
            onClick={() => setSplitView(false)}
            className={`px-2 py-1 rounded border ${
              !splitView
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
            }`}
          >
            unified
          </button>
          <button
            type="button"
            onClick={() => setSplitView(true)}
            className={`px-2 py-1 rounded border ${
              splitView
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
            }`}
          >
            split
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <code className="text-xs text-zinc-500">{active.meta.session_id}</code>
          <span className="text-xs text-zinc-400">·</span>
          <code className="text-xs text-zinc-700">{active.meta.repo_id}</code>
          <span className="text-xs text-zinc-400">·</span>
          <span className="text-xs text-zinc-500">
            user <code className="text-zinc-700">{active.meta.user_id}</code>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <Stat label="checkpoints" value={String(active.checkpoints.length)} />
          <Stat label="tool calls" value={String(active.meta.tool_call_count)} />
          <Stat label="files touched" value={String(active.meta.files_touched_count)} />
          <Stat label="duration" value={dur(active.meta.duration_seconds)} />
          <Stat
            label="agent share"
            value={
              active.meta.agent_percentage !== null && active.meta.agent_percentage !== undefined
                ? `${Math.round(active.meta.agent_percentage)}%`
                : "—"
            }
            hint="of committed lines"
          />
        </div>
        <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            user prompt
          </div>
          <div className="whitespace-pre-wrap text-zinc-800 leading-relaxed">
            {active.user_prompt || "(none recorded)"}
          </div>
        </div>
      </section>

      <div className="space-y-4 mb-12">
        {active.checkpoints.map((cp, i) => (
          <CheckpointCard
            key={cp.checkpoint_pk}
            cp={cp}
            index={i}
            total={active.checkpoints.length}
            splitView={splitView}
          />
        ))}
      </div>

      <section className="text-xs text-zinc-500 mt-12 border-t border-zinc-200 pt-6">
        <p>
          <strong>How edits are attributed to checkpoints.</strong> Each session
          has an ordered list of <code>checkpoint_ids</code> and each commit has
          a <code>commit_date</code>. We bucket every <code>Edit</code> /{" "}
          <code>Write</code> / <code>MultiEdit</code> turn by its timestamp: an
          edit goes to the first checkpoint whose commit-date is ≥ the edit's
          timestamp; anything after the last commit attaches to the last
          checkpoint. Read/Grep/Glob/Bash turns are not shown — this view is
          the agent's <em>save-point narrative</em>: what changed, at what
          step, and what got committed.
        </p>
        <p className="mt-2">
          <strong>Source.</strong> SALT-NLP/SWE-chat on HuggingFace (gated). We
          join <code>sessions</code>, <code>conversations</code>, and{" "}
          <code>commits</code> tables and render one checkpoint per commit
          attributed to the session.
        </p>
      </section>
    </main>
  );
}
