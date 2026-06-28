// UserSimBench — centered on a single metric: CondAgree.
// Data: bench/profileopt/experiments/condagree_multi/summary.json (v2 4-way taxonomy, single Haiku
// judge, 20-user user+repo-disjoint SWE-chat test split, 480 held-out points, 9 models x ±profile).

import type { ReactNode } from "react";

const LUCKY = 0.419; // lucky-guess line = expected CondAgree from the move-mix alone (per-developer Σp²)

type M = { id: string; label: string; note: string; kind: "general" | "specialized"; np: { ca: number; ci: number }; wp: { ca: number; ci: number } };
// sorted by with-profile CondAgree (descending)
const MODELS: M[] = [
  { id: "glm-5.2", label: "GLM-5.2", note: "reasoning · max", kind: "general", np: { ca: 0.583, ci: 0.130 }, wp: { ca: 0.667, ci: 0.104 } },
  { id: "gpt-5.5", label: "GPT-5.5", note: "reasoning · xhigh", kind: "general", np: { ca: 0.548, ci: 0.146 }, wp: { ca: 0.547, ci: 0.147 } },
  { id: "deepseek-v4-pro", label: "DeepSeek-V4-Pro", note: "reasoning", kind: "general", np: { ca: 0.486, ci: 0.065 }, wp: { ca: 0.509, ci: 0.081 } },
  { id: "deepseek-v4-flash", label: "DeepSeek-V4-Flash", note: "reasoning", kind: "general", np: { ca: 0.496, ci: 0.075 }, wp: { ca: 0.507, ci: 0.098 } },
  { id: "gemini-3.1-pro", label: "Gemini-3.1-Pro", note: "reasoning · high", kind: "general", np: { ca: 0.511, ci: 0.127 }, wp: { ca: 0.492, ci: 0.112 } },
  { id: "deepseek-v3.1", label: "DeepSeek-V3.1", note: "frontier", kind: "general", np: { ca: 0.512, ci: 0.075 }, wp: { ca: 0.488, ci: 0.093 } },
  { id: "osim-8b", label: "OSim-8B", note: "purpose-built simulator", kind: "specialized", np: { ca: 0.427, ci: 0.064 }, wp: { ca: 0.476, ci: 0.072 } },
  { id: "claude-opus-4.8", label: "Claude-Opus-4.8", note: "reasoning · xhigh", kind: "general", np: { ca: 0.457, ci: 0.107 }, wp: { ca: 0.465, ci: 0.143 } },
  { id: "osim-4b", label: "OSim-4B", note: "purpose-built simulator", kind: "specialized", np: { ca: 0.388, ci: 0.064 }, wp: { ca: 0.461, ci: 0.073 } },
];
const MOVE_MIX = [
  { move: "directive", pct: 51.8, color: "bg-blue-400" },
  { move: "critical", pct: 27.8, color: "bg-amber-500" },
  { move: "approve", pct: 12.1, color: "bg-zinc-400" },
  { move: "inquiry", pct: 8.4, color: "bg-emerald-400" },
];

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

// horizontal CondAgree bar (0–MAX), dashed lucky-guess baseline, CI whisker
function CABar({ label, value, ci, color, max = 0.75 }: { label: string; value: number; ci: number; color: string; max?: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <div className="w-20 shrink-0 text-right text-[10px] text-zinc-500">{label}</div>
      <div className="relative h-5 flex-1 rounded bg-zinc-100">
        <div className="absolute bottom-[-3px] top-[-3px] border-l-2 border-dashed border-zinc-500/80" style={{ left: `${(LUCKY / max) * 100}%` }} />
        <div className={`h-full rounded ${color}`} style={{ width: `${(value / max) * 100}%` }} />
        <div className="absolute top-1/2 h-[1.5px] -translate-y-1/2 bg-zinc-700/60"
             style={{ left: `${Math.max(0, ((value - ci) / max) * 100)}%`, width: `${(Math.min(max, value + ci) - Math.max(0, value - ci)) / max * 100}%` }} />
      </div>
      <div className="w-20 shrink-0">
        <Mono className={value > LUCKY ? "text-emerald-700" : "text-amber-700"}>{value.toFixed(3)}</Mono>
        <Mono className="text-zinc-400"> ±{ci.toFixed(2)}</Mono>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="font-mono text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{children}</p>
    </div>
  );
}

export default function Page() {
  const glm = MODELS.find((m) => m.id === "glm-5.2")!;
  const o4 = MODELS.find((m) => m.id === "osim-4b")!;
  const d31 = MODELS.find((m) => m.id === "deepseek-v3.1")!;
  const delta = (m: M) => +(m.wp.ca - m.np.ca).toFixed(3);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">UserSimBench · <span className="text-zinc-400">CondAgree</span></h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <a href="/data" className="hover:text-zinc-900">data</a>
            <a href="https://github.com/AlienKevin/user-simulator" target="_blank" rel="noreferrer" className="hover:text-zinc-900">github</a>
            <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" target="_blank" rel="noreferrer" className="hover:text-zinc-900">SWE-chat</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        {/* HERO */}
        <div className="py-12">
          <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">one metric: CondAgree · 9 simulators</div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
            A user profile helps some simulators read the moment — but not the strongest general models.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            A <span className="font-semibold text-zinc-900">user simulator</span> stands in for the human developer so we can stress-test
            coding agents. <span className="font-semibold">CondAgree</span> asks the one thing that matters: at each real moment, did the
            simulator make the <em>same move</em> the real developer made? Giving the simulator a distilled profile of that specific
            developer helps <span className="font-semibold text-teal-700">GLM-5.2 most (+{delta(glm)} → best at {glm.wp.ca.toFixed(3)})</span> and
            the <span className="font-semibold text-violet-700">purpose-built OSim models (+{delta(o4)})</span>, but does nothing for the
            strongest general models (DeepSeek-V3.1 {delta(d31)}, GPT-5.5 ≈0) — they already read the situation.
          </p>
        </div>

        {/* THE CHART */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-xs font-semibold text-zinc-700">CondAgree — right move, right moment (higher is better)</div>
            <div className="text-[10px] text-zinc-400">sorted by with-profile</div>
          </div>
          <div className="mb-4 text-[11px] text-zinc-400">dashed line = lucky-guess <Mono>{LUCKY}</Mono> · whisker = 95% CI across 20 developers · scale 0–0.75</div>
          {MODELS.map((m) => {
            const d = delta(m);
            const bar = m.kind === "specialized" ? "bg-violet-500" : "bg-indigo-500";
            const barLight = m.kind === "specialized" ? "bg-violet-300" : "bg-indigo-300";
            return (
              <div key={m.id} className="mb-3">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-900">{m.label}</span>
                  <span className="text-[10px] text-zinc-400">{m.note}</span>
                  <span className={`ml-auto text-[11px] font-semibold ${d > 0.01 ? "text-emerald-600" : d < -0.01 ? "text-rose-500" : "text-zinc-400"}`}>
                    profile Δ {d > 0 ? "+" : ""}{d}
                  </span>
                </div>
                <CABar label="no profile" value={m.np.ca} ci={m.np.ci} color={barLight} />
                <CABar label="with profile" value={m.wp.ca} ci={m.wp.ci} color={bar} />
              </div>
            );
          })}
          <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <span className="inline-block size-2 rounded-sm bg-violet-500 align-middle" /> purpose-built OSim simulators ·
            <span className="ml-1 inline-block size-2 rounded-sm bg-indigo-500 align-middle" /> general models. Everything clears the
            lucky-guess line except <span className="text-amber-700">OSim-4B without a profile</span> — the profile lifts it over. The
            biggest profile gains go to GLM-5.2 (+{delta(glm)}) and the OSim models; the strong general models are flat or slightly
            negative. At n=20 the CIs are ±0.06–0.15, so single-model lifts are suggestive, not definitive.
          </p>
        </section>

        {/* EXPLAINERS */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card title="CondAgree">
            Per developer, the fraction of held-out moments where the simulator made the <em>same move</em> the real developer made — then
            averaged across developers. It scores the move, not the words.
          </Card>
          <Card title="lucky-guess line">
            The CondAgree you’d get by sampling a developer’s own move-mix with no read on the moment (per-developer Σp², here <Mono>{LUCKY}</Mono>).
            Beating it = genuine situational skill, not just matching habits.
          </Card>
          <Card title="moves (4-way)">
            Each message → <Mono>approve</Mono> / <Mono>critical</Mono> / <Mono>directive</Mono> / <Mono>inquiry</Mono>. This taxonomy reaches
            inter-judge κ≈0.80 (vs 0.69 for the old 7-way), so a single cheap judge is reliable.
          </Card>
        </div>

        {/* MOVE MIX */}
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-xs text-zinc-500">What the real developers actually do (these 20 test developers are directive-heavy):</div>
          <div className="flex h-6 w-full overflow-hidden rounded">
            {MOVE_MIX.map((m) => <div key={m.move} className={m.color} style={{ width: `${m.pct}%` }} title={`${m.move} ${m.pct}%`} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
            {MOVE_MIX.map((m) => (
              <span key={m.move} className="inline-flex items-center gap-1"><span className={`inline-block size-2 rounded-sm ${m.color}`} />{m.move} <Mono className="text-zinc-500">{m.pct}%</Mono></span>
            ))}
          </div>
        </section>

        {/* METHOD */}
        <section className="mt-6 border-t border-zinc-200 pt-6">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Method</h3>
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
            <span className="font-semibold text-zinc-600">Test split:</span> 20 SWE-chat developers, <span className="font-semibold">user- and
            repo-disjoint</span> from train/val (connected-components of the user↔repo graph), 480 held-out prediction points (≤30/developer).
            Each developer’s profile is distilled from <em>their</em> train sessions only; we score on held-out turns — no within-developer leakage.
            <span className="font-semibold text-zinc-600"> Simulators (frozen, 9):</span> deepseek-v3.1, deepseek-v4-flash, deepseek-v4-pro,
            gpt-5.5 (xhigh), claude-opus-4.8 (xhigh), glm-5.2 (max), gemini-3.1-pro (high) via OpenRouter; osim-4b, osim-8b via Modal.
            With-profile = the distilled persona prefix; without = a generic developer prompt. <span className="font-semibold text-zinc-600">
            Labeling:</span> the v2 4-way taxonomy, a single Haiku-4.5 judge (κ≈0.80 makes majority voting unnecessary).
            <span className="font-semibold text-zinc-600"> CI:</span> per-developer macro, 95% over n=20 (t₁₉). All trials are downloadable on the{" "}
            <a href="/data" className="text-blue-700 hover:underline">data page</a>.
          </p>
        </section>

        <footer className="mt-8 border-t border-zinc-200 pt-6 text-xs text-zinc-400">
          UserSimBench · CondAgree on real{" "}
          <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" className="hover:text-zinc-700">SWE-chat</a> sessions ·
          <a href="/data" className="hover:text-zinc-700"> download the data</a> ·
          built on <a href="https://github.com/AlienKevin/user-simulator" className="hover:text-zinc-700">user.skill</a>.
        </footer>
      </main>
    </div>
  );
}
