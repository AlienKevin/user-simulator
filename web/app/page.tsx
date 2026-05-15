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

// ---- Helpers ----

function decodeAssistantJson(content: string): { decision?: string; message?: string } | null {
  // Parse our training-time assistant outputs which are always JSON.
  // Mirror with-user's parser: re.search(r"\{.*\}", text, re.DOTALL) + json.loads.
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
  const [traces, setTraces] = useState<Trace[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("./traces.json")
      .then((r) => r.json())
      .then((data: Trace[]) => setTraces(data));
  }, []);

  const filtered = useMemo(() => {
    if (!traces) return [];
    if (!search) return traces.map((t, i) => ({ t, i }));
    const q = search.toLowerCase();
    return traces
      .map((t, i) => ({ t, i }))
      .filter(({ t }) =>
        t.messages.some((m) => m.content.toLowerCase().includes(q)),
      );
  }, [traces, search]);

  if (!traces) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">
        Loading traces…
      </div>
    );
  }

  const active = traces[activeIdx];
  const stats = summarize(active);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">
            with-user · training trace viewer
          </h1>
          <span className="text-xs text-zinc-500">
            Qwen2.5-7B-Instruct + LoRA · user{" "}
            <span className="font-mono text-zinc-700">marcus-sa</span> ·{" "}
            {traces.length} traces shown
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
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-3 py-2">
            <input
              type="text"
              placeholder="Search traces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <ul className="flex-1 overflow-y-auto">
            {filtered.map(({ t, i }) => {
              const s = summarize(t);
              return (
                <li key={i}>
                  <button
                    onClick={() => setActiveIdx(i)}
                    className={classNames(
                      "block w-full border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50",
                      activeIdx === i && "bg-blue-50 hover:bg-blue-50",
                    )}
                  >
                    <div className="font-mono text-[11px] text-zinc-500">
                      {trimSession(t.session_id)}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-zinc-800">
                      {s.firstUserMessage || "(no opening message)"}
                    </div>
                    <div className="mt-1 flex gap-2 text-[10px] text-zinc-500">
                      <span>{s.totalMessages} msgs</span>
                      <span>·</span>
                      <span>{s.stepDecisions} steps</span>
                      <span>·</span>
                      <span className="text-emerald-700">{s.interject}↳</span>
                      <span className="text-zinc-500">{s.continueCnt}·</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="mb-4 border-b border-zinc-200 pb-3">
              <div className="font-mono text-xs text-zinc-500">
                session_id ·{" "}
                <span className="text-zinc-900">{active.session_id}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-600">
                <span>
                  <strong className="text-zinc-900">{stats.totalMessages}</strong>{" "}
                  messages
                </span>
                <span>
                  <strong className="text-zinc-900">{stats.stepDecisions}</strong>{" "}
                  step decisions
                </span>
                <span className="text-emerald-700">
                  <strong>{stats.interject}</strong> interject
                </span>
                <span className="text-zinc-500">
                  <strong>{stats.continueCnt}</strong> continue
                </span>
              </div>
            </div>

            <ol className="space-y-3">
              {active.messages.map((m, j) => (
                <MessageCard key={j} idx={j} msg={m} />
              ))}
            </ol>
          </div>
        </main>
      </div>
    </div>
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

      {/* Body */}
      {msg.role === "assistant" && decoded ? (
        <div className="border-t border-zinc-200 px-3 py-2 text-sm">
          <div className="font-mono text-xs text-zinc-500">decision</div>
          <div className="mb-2 font-mono text-sm text-zinc-900">
            {decoded.decision}
          </div>
          <div className="font-mono text-xs text-zinc-500">message</div>
          <div className="whitespace-pre-wrap text-sm text-zinc-900">
            {decoded.message || (
              <span className="text-zinc-400">(empty)</span>
            )}
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
          {!open && isLong && (
            <div className="pointer-events-none -mt-6 h-6 bg-gradient-to-b from-transparent to-current opacity-50" />
          )}
        </div>
      )}
    </li>
  );
}

// ---- Stats ----

function summarize(t: Trace) {
  let interject = 0;
  let continueCnt = 0;
  let stepDecisions = 0;
  let firstUserMessage = "";
  for (let i = 0; i < t.messages.length; i++) {
    const m = t.messages[i];
    if (m.role === "assistant") {
      const d = decodeAssistantJson(m.content);
      if (d?.decision === "interject") interject++;
      else if (d?.decision === "continue") continueCnt++;
      stepDecisions++;
    }
    if (!firstUserMessage && m.role === "user" && i > 0) {
      // The initial_template prompt — take the content after "Problem:\n---"
      const problem = m.content.match(/Problem:\s*-{3,}\s*([\s\S]*?)\s*-{3,}/);
      if (problem) firstUserMessage = problem[1].trim().slice(0, 160);
    }
  }
  // step_decisions count includes the opening "interject" target; subtract 1 for true step count
  stepDecisions = Math.max(0, stepDecisions - 1);
  return {
    totalMessages: t.messages.length,
    stepDecisions,
    interject,
    continueCnt,
    firstUserMessage,
  };
}
