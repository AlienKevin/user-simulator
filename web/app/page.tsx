"use client";

import { useEffect, useMemo, useState } from "react";

// ---- Types ----
type Role = "system" | "user" | "assistant";
type Message = { role: Role; content: string };
type Trace = {
  session_id: string;
  chunk?: number;
  messages: Message[];
};

type ManifestEntry = {
  id: string;
  split: "train" | "val";
  session_id: string;
  chunk: number;
  totalMessages: number;
  stepDecisions: number;
  interject: number;
  continueCnt: number;
  firstUserMessage: string;
};

// ---- Helpers ----

function decodeAssistantJson(content: string): { decision?: string; message?: string } | null {
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function trimSession(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function classNames(...cs: (string | false | undefined)[]) {
  return cs.filter(Boolean).join(" ");
}

// ---- Main page ----

export default function Page() {
  const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [traces, setTraces] = useState<Record<string, Trace>>({});
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [search, setSearch] = useState("");
  const [splitFilter, setSplitFilter] = useState<"all" | "train" | "val">("all");

  // Load manifest once
  useEffect(() => {
    fetch("./traces/index.json")
      .then((r) => r.json())
      .then((data: ManifestEntry[]) => {
        setManifest(data);
        if (data.length > 0) setActiveId(data[0].id);
      });
  }, []);

  // Lazy-load active trace
  useEffect(() => {
    if (!activeId || traces[activeId]) return;
    setLoadingTrace(true);
    fetch(`./traces/${activeId}.json`)
      .then((r) => r.json())
      .then((t: Trace) => {
        setTraces((prev) => ({ ...prev, [activeId]: t }));
      })
      .finally(() => setLoadingTrace(false));
  }, [activeId, traces]);

  const filtered = useMemo(() => {
    if (!manifest) return [];
    let list = manifest;
    if (splitFilter !== "all") list = list.filter((m) => m.split === splitFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.firstUserMessage.toLowerCase().includes(q) ||
          m.session_id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [manifest, splitFilter, search]);

  if (!manifest) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">
        Loading manifest…
      </div>
    );
  }

  const counts = {
    total: manifest.length,
    train: manifest.filter((m) => m.split === "train").length,
    val: manifest.filter((m) => m.split === "val").length,
  };

  const active = activeId ? traces[activeId] : null;
  const activeMeta = manifest.find((m) => m.id === activeId);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">
            with-user · training trace viewer
          </h1>
          <span className="text-xs text-zinc-500">
            user <span className="font-mono text-zinc-700">marcus-sa</span> ·{" "}
            <span className="font-mono text-zinc-900">{counts.total}</span> traces
            ({counts.train} train · {counts.val} val)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <a
            href="https://github.com/AlienKevin/user-simulator"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-900"
          >
            github
          </a>
          <a
            href="https://huggingface.co/datasets/SALT-NLP/SWE-chat"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-900"
          >
            SWE-chat
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="space-y-2 border-b border-zinc-200 px-3 py-2">
            <input
              type="text"
              placeholder="Search traces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
            <div className="flex gap-1 text-[10px]">
              {(["all", "train", "val"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSplitFilter(s)}
                  className={classNames(
                    "rounded border px-2 py-0.5 font-mono uppercase tracking-wider",
                    splitFilter === s
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  {s} ({s === "all" ? counts.total : counts[s]})
                </button>
              ))}
            </div>
            <div className="text-[10px] text-zinc-500">
              showing {filtered.length} of {counts.total}
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setActiveId(m.id)}
                  className={classNames(
                    "block w-full border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50",
                    activeId === m.id && "bg-blue-50 hover:bg-blue-50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[11px] text-zinc-500">
                      {trimSession(m.session_id)}
                    </div>
                    <span
                      className={classNames(
                        "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase",
                        m.split === "train"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800",
                      )}
                    >
                      {m.split}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-zinc-800">
                    {m.firstUserMessage || "(no opening message)"}
                  </div>
                  <div className="mt-1 flex gap-2 text-[10px] text-zinc-500">
                    <span>{m.totalMessages} msgs</span>
                    <span>·</span>
                    <span>{m.stepDecisions} steps</span>
                    <span>·</span>
                    <span className="text-emerald-700">{m.interject}↳</span>
                    <span>{m.continueCnt}·</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            {!activeMeta ? (
              <div className="text-sm text-zinc-500">Select a trace.</div>
            ) : !active ? (
              <div className="text-sm text-zinc-500">
                {loadingTrace ? "Loading trace…" : "Select a trace."}
              </div>
            ) : (
              <>
                <div className="mb-4 border-b border-zinc-200 pb-3">
                  <div className="font-mono text-xs text-zinc-500">
                    {activeMeta.split} ·{" "}
                    <span className="text-zinc-900">{active.session_id}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-600">
                    <span>
                      <strong className="text-zinc-900">
                        {activeMeta.totalMessages}
                      </strong>{" "}
                      messages
                    </span>
                    <span>
                      <strong className="text-zinc-900">
                        {activeMeta.stepDecisions}
                      </strong>{" "}
                      step decisions
                    </span>
                    <span className="text-emerald-700">
                      <strong>{activeMeta.interject}</strong> interject
                    </span>
                    <span className="text-zinc-500">
                      <strong>{activeMeta.continueCnt}</strong> continue
                    </span>
                  </div>
                </div>

                <ol className="space-y-3">
                  {collapseContinues(active.messages).map((item, j) =>
                    item.kind === "msg" ? (
                      <MessageCard key={j} idx={item.idx} msg={item.msg} />
                    ) : (
                      <ContinueCluster
                        key={j}
                        from={item.from}
                        to={item.to}
                        count={item.count}
                        userSteps={item.userSteps}
                      />
                    ),
                  )}
                </ol>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---- Collapse silent (continue) step-pairs ----
//
// A "silent step" is a (user_step_prompt, assistant_continue) pair: the harness
// asked the simulator to decide after some agent action, and the simulator
// chose to stay silent. These pairs are 80%+ of the timeline and add zero
// signal, so we collapse consecutive ones into a single placeholder card.

type Item =
  | { kind: "msg"; idx: number; msg: Message }
  | {
      kind: "continues";
      from: number;
      to: number;
      count: number;
      // Indexed user-step prompts inside the cluster. We keep these so the
      // user can expand the cluster and see the agent activity they reflect,
      // but the redundant assistant continue replies are dropped entirely.
      userSteps: { idx: number; msg: Message }[];
    };

function collapseContinues(messages: Message[]): Item[] {
  const out: Item[] = [];
  let i = 0;
  while (i < messages.length) {
    const m1 = messages[i];
    const m2 = i + 1 < messages.length ? messages[i + 1] : null;
    if (
      m1.role === "user" &&
      m2 &&
      m2.role === "assistant" &&
      decodeAssistantJson(m2.content)?.decision === "continue"
    ) {
      const startIdx = i;
      const userSteps: { idx: number; msg: Message }[] = [];
      while (
        i + 1 < messages.length &&
        messages[i].role === "user" &&
        messages[i + 1].role === "assistant" &&
        decodeAssistantJson(messages[i + 1].content)?.decision === "continue"
      ) {
        userSteps.push({ idx: i, msg: messages[i] });
        i += 2;
      }
      out.push({
        kind: "continues",
        from: startIdx,
        to: i - 1,
        count: userSteps.length,
        userSteps,
      });
      continue;
    }
    out.push({ kind: "msg", idx: i, msg: messages[i] });
    i += 1;
  }
  return out;
}

function ContinueCluster({
  from,
  to,
  count,
  userSteps,
}: {
  from: number;
  to: number;
  count: number;
  userSteps: { idx: number; msg: Message }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="overflow-hidden rounded-md border border-dashed border-zinc-300 bg-zinc-50/60">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-500 hover:bg-zinc-100/60"
      >
        <span className="font-mono text-zinc-400">
          #{from}–{to}
        </span>
        <span className="flex-1 italic">
          {count} silent step{count > 1 ? "s" : ""} hidden · simulator chose{" "}
          <span className="font-mono text-zinc-600">continue</span> while the
          agent acted
        </span>
        <span className="font-mono text-[10px] text-zinc-400">
          {expanded ? "collapse ▾" : "expand ▸"}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-dashed border-zinc-300 bg-white/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            agent actions during silent stretch (continue replies omitted)
          </div>
          <ol className="space-y-2">
            {userSteps.map((step) => (
              <MessageCard key={step.idx} idx={step.idx} msg={step.msg} />
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

// ---- Message card ----

function MessageCard({ idx, msg }: { idx: number; msg: Message }) {
  const [open, setOpen] = useState(idx < 6);
  const decoded = msg.role === "assistant" ? decodeAssistantJson(msg.content) : null;
  const decision = decoded?.decision;
  const isInterject = decision === "interject";
  const isContinue = decision === "continue";

  const roleStyle: Record<Role, string> = {
    system: "bg-zinc-50 border-zinc-200",
    user: "bg-white border-zinc-200",
    assistant: isInterject
      ? "bg-emerald-50 border-emerald-200"
      : isContinue
        ? "bg-zinc-50 border-zinc-200"
        : "bg-amber-50 border-amber-200",
  };
  const roleBadge: Record<Role, string> = {
    system: "bg-zinc-200 text-zinc-700",
    user: "bg-blue-100 text-blue-800",
    assistant: isInterject
      ? "bg-emerald-200 text-emerald-900"
      : isContinue
        ? "bg-zinc-200 text-zinc-600"
        : "bg-amber-200 text-amber-900",
  };

  const isLong = msg.content.length > 800;

  return (
    <li
      className={classNames(
        "overflow-hidden rounded-md border",
        roleStyle[msg.role],
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <span className="font-mono text-zinc-400">#{idx}</span>
          <span
            className={classNames(
              "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
              roleBadge[msg.role],
            )}
          >
            {msg.role}
          </span>
          {decision && (
            <span
              className={classNames(
                "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                isInterject
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-400 text-white",
              )}
            >
              {decision}
            </span>
          )}
        </div>
        {isLong && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-zinc-500 hover:text-zinc-900"
          >
            {open ? "collapse" : `expand · ${msg.content.length} chars`}
          </button>
        )}
      </div>

      {msg.role === "assistant" && decoded ? (
        <div className="border-t border-zinc-200 px-3 py-2 text-sm">
          <div className="font-mono text-xs text-zinc-500">decision</div>
          <div className="mb-2 font-mono text-sm text-zinc-900">
            {decoded.decision}
          </div>
          <div className="font-mono text-xs text-zinc-500">message</div>
          <div className="whitespace-pre-wrap text-sm text-zinc-900">
            {decoded.message || <span className="text-zinc-400">(empty)</span>}
          </div>
        </div>
      ) : (
        <div
          className={classNames(
            "border-t border-zinc-200 px-3 py-2 font-mono text-xs leading-relaxed",
            !open && isLong && "max-h-40 overflow-hidden",
          )}
        >
          <pre className="whitespace-pre-wrap break-words text-zinc-800">
            {msg.content}
          </pre>
        </div>
      )}
    </li>
  );
}
