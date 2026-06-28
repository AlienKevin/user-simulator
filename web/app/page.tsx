// UserSimBench — centered on a single metric: CondAgree.
// Data: bench/profileopt/rerun_summary.json (v2 4-way taxonomy, single Haiku judge,
// 20-user user+repo-disjoint SWE-chat test split, 480 held-out points).

import type { ReactNode } from "react";

const LUCKY = 0.419; // lucky-guess line = expected CondAgree from the move-mix alone (per-developer Σp²)

type Row = { model: string; profile: boolean; ca: number; ci: number };
const ROWS: Row[] = [
  { model: "deepseek-v3.1", profile: false, ca: 0.512, ci: 0.088 },
  { model: "deepseek-v3.1", profile: true, ca: 0.488, ci: 0.108 },
  { model: "osim-4b", profile: false, ca: 0.388, ci: 0.075 },
  { model: "osim-4b", profile: true, ca: 0.461, ci: 0.086 },
];
const MOVE_MIX = [
  { move: "directive", pct: 51.8, color: "bg-blue-400" },
  { move: "critical", pct: 27.8, color: "bg-amber-500" },
  { move: "approve", pct: 12.1, color: "bg-zinc-400" },
  { move: "inquiry", pct: 8.4, color: "bg-emerald-400" },
];
const MODELS = [
  { id: "deepseek-v3.1", label: "DeepSeek-V3.1", note: "frontier model", color: "bg-blue-500", light: "bg-blue-300" },
  { id: "osim-4b", label: "OSim-4B", note: "small purpose-built simulator", color: "bg-violet-500", light: "bg-violet-300" },
];

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

// horizontal CondAgree bar (0–MAX), dashed lucky-guess baseline, CI whisker
function CABar({ label, value, ci, color, max = 0.7 }: { label: string; value: number; ci: number; color: string; max?: number }) {
  const w = (value / max) * 100;
  return (
    <div className="flex items-center gap-3 py-1 text-xs">
      <div className="w-24 shrink-0 text-right text-zinc-600">{label}</div>
      <div className="relative h-6 flex-1 rounded bg-zinc-100">
        <div className="absolute bottom-[-4px] top-[-4px] border-l-2 border-dashed border-zinc-500/80" style={{ left: `${(LUCKY / max) * 100}%` }} />
        <div className={`h-full rounded ${color}`} style={{ width: `${w}%` }} />
        <div className="absolute top-1/2 h-[1.5px] -translate-y-1/2 bg-zinc-700/70"
             style={{ left: `${Math.max(0, ((value - ci) / max) * 100)}%`, width: `${(Math.min(max, value + ci) - Math.max(0, value - ci)) / max * 100}%` }} />
      </div>
      <div className="w-24 shrink-0">
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
  const get = (id: string, p: boolean) => ROWS.find((r) => r.model === id && r.profile === p)!;
  const dDelta = +(get("deepseek-v3.1", true).ca - get("deepseek-v3.1", false).ca).toFixed(3);
  const oDelta = +(get("osim-4b", true).ca - get("osim-4b", false).ca).toFixed(3);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">UserSimBench · <span className="text-zinc-400">CondAgree</span></h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <a href="https://github.com/AlienKevin/user-simulator" target="_blank" rel="noreferrer" className="hover:text-zinc-900">github</a>
            <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" target="_blank" rel="noreferrer" className="hover:text-zinc-900">SWE-chat</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        {/* HERO */}
        <div className="py-12">
          <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">one metric: CondAgree</div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
            A user profile helps the <span className="text-violet-700">small</span> simulator read the moment — not the <span className="text-blue-700">frontier</span> one.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            A <span className="font-semibold text-zinc-900">user simulator</span> stands in for the human developer so we can stress-test
            coding agents. <span className="font-semibold">CondAgree</span> asks the one thing that matters: at each real moment, did the
            simulator make the <em>same move</em> the real developer made? Given a distilled profile of the specific developer,
            <span className="font-semibold text-violet-700"> OSim-4B improves by {oDelta > 0 ? "+" : ""}{oDelta}</span> (crossing from below to
            above the lucky-guess line), while <span className="font-semibold text-blue-700">DeepSeek-V3.1 doesn’t benefit</span> ({dDelta})
            — the frontier model already reads the situation.
          </p>
        </div>

        {/* THE CHART */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-1 text-xs font-semibold text-zinc-700">CondAgree — right move, right moment (higher is better)</div>
          <div className="mb-4 text-[11px] text-zinc-400">dashed line = lucky-guess <Mono>{LUCKY}</Mono> · whisker = 95% CI across 20 developers · scale 0–0.7</div>
          {MODELS.map((m) => {
            const np = get(m.id, false), wp = get(m.id, true);
            const delta = +(wp.ca - np.ca).toFixed(3);
            return (
              <div key={m.id} className="mb-4">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-900">{m.label}</span>
                  <span className="text-[10px] text-zinc-400">{m.note}</span>
                  <span className={`ml-auto text-[11px] font-semibold ${delta > 0 ? "text-emerald-600" : "text-zinc-400"}`}>
                    profile Δ {delta > 0 ? "+" : ""}{delta}
                  </span>
                </div>
                <CABar label="no profile" value={np.ca} ci={np.ci} color={m.light} />
                <CABar label="with profile" value={wp.ca} ci={wp.ci} color={m.color} />
              </div>
            );
          })}
          <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Both DeepSeek conditions and OSim-4B-with-profile clear the lucky-guess line; <span className="text-amber-700">OSim-4B without a
            profile sits below it</span>. The profile lifts OSim-4B by <Mono className="text-emerald-700">+{oDelta}</Mono> but nudges DeepSeek
            <Mono> {dDelta}</Mono>. At n=20 these lifts are about one CI wide — suggestive, not definitive.
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
            <span className="font-semibold text-zinc-600"> Models (frozen):</span> deepseek-v3.1 (OpenRouter), osim-4b (Modal). With-profile =
            the distilled persona prefix; without = a generic developer prompt. <span className="font-semibold text-zinc-600"> Labeling:</span> the
            v2 4-way taxonomy, a single Haiku-4.5 judge (κ≈0.80 makes majority voting unnecessary). <span className="font-semibold text-zinc-600">
            CI:</span> per-developer macro, 95% over n=20 (t₁₉). Prior versions of this page also measured easy-mode/MoveFid/transfer; this one is
            deliberately centered on CondAgree alone.
          </p>
        </section>

        <footer className="mt-8 border-t border-zinc-200 pt-6 text-xs text-zinc-400">
          UserSimBench · CondAgree on real{" "}
          <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" className="hover:text-zinc-700">SWE-chat</a> sessions ·
          built on <a href="https://github.com/AlienKevin/user-simulator" className="hover:text-zinc-700">user.skill</a>.
        </footer>
      </main>
    </div>
  );
}
