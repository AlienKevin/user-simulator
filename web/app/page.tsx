// UserSimBench v0 — single static results page.
// Numbers here are USER-WEIGHTED (macro): each developer's own rate, averaged across
// developers (not pooled over turns). Interim: 7 developers with ≥3 held-out turns each,
// 95% CI shown. A 10-developer × 50-turn run is in progress for tighter bounds.
// Source: bench/results/v0_macro_7user.json (+ OSim from the same run).

import type { ReactNode } from "react";

// ---------- ground-truth data (user-weighted macro, mean ± 95% CI) ----------

const REAL = { approve: 27.4, critical: 37.9 };
const LUCKY = 0.302; // per-user Σp² averaged — inflated at small n (see note); provisional

const MOVE_MIX: { move: string; pct: number; color: string }[] = [
  { move: "approve", pct: 27.4, color: "bg-zinc-400" },
  { move: "new work", pct: 16.9, color: "bg-blue-400" },
  { move: "bug report", pct: 13.3, color: "bg-amber-400" },
  { move: "pushback", pct: 14.9, color: "bg-amber-500" },
  { move: "refine / redirect", pct: 9.5, color: "bg-blue-300" },
  { move: "interrupt", pct: 9.7, color: "bg-amber-600" },
  { move: "question", pct: 7.1, color: "bg-emerald-400" },
  { move: "other", pct: 1.2, color: "bg-zinc-300" },
];

type V = [number, number]; // [mean, ci95]
type Row = {
  model: string;
  mode: "with-profile" | "no-profile" | "reference";
  moveFid: V;
  condAgree: V;
  approve: V;
  critical: V;
  ref?: boolean;
  spec?: boolean;
};

const ROWS: Row[] = [
  { model: "deepseek-v3.1", mode: "with-profile", moveFid: [34.9, 21.1], condAgree: [0.276, 0.150], approve: [39.9, 24.8], critical: [10.5, 11.3] },
  { model: "deepseek-v3.1", mode: "no-profile", moveFid: [22.5, 12.4], condAgree: [0.174, 0.111], approve: [42.8, 21.6], critical: [5.3, 6.4] },
  { model: "gpt-5", mode: "with-profile", moveFid: [28.9, 15.9], condAgree: [0.220, 0.217], approve: [35.1, 28.3], critical: [4.0, 6.4] },
  { model: "gpt-5", mode: "no-profile", moveFid: [30.1, 12.8], condAgree: [0.167, 0.159], approve: [21.8, 13.1], critical: [17.7, 22.8] },
  { model: "gemini-3.1-pro", mode: "with-profile", moveFid: [25.5, 12.1], condAgree: [0.351, 0.169], approve: [75.2, 15.7], critical: [4.2, 6.7] },
  { model: "gemini-3.1-pro", mode: "no-profile", moveFid: [32.4, 6.0], condAgree: [0.302, 0.196], approve: [68.5, 14.7], critical: [12.9, 16.4] },
  { model: "osim-8b", mode: "with-profile", moveFid: [42.8, 26.8], condAgree: [0.220, 0.173], approve: [46.4, 12.7], critical: [18.5, 11.7], spec: true },
  { model: "osim-8b", mode: "no-profile", moveFid: [28.6, 13.4], condAgree: [0.173, 0.169], approve: [10.1, 11.3], critical: [10.1, 11.3], spec: true },
  { model: "osim-4b", mode: "with-profile", moveFid: [31.4, 12.1], condAgree: [0.260, 0.220], approve: [64.3, 25.4], critical: [11.1, 12.3], spec: true },
  { model: "osim-4b", mode: "no-profile", moveFid: [23.6, 14.7], condAgree: [0.079, 0.103], approve: [22.8, 22.2], critical: [9.3, 9.0], spec: true },
  { model: "prior_sampler", mode: "reference", moveFid: [58.9, 24.8], condAgree: [0.290, 0.195], approve: [13.1, 10.5], critical: [39.7, 30.8], ref: true },
  { model: "always_approve", mode: "reference", moveFid: [11.9, 11.9], condAgree: [0.274, 0.187], approve: [100, 0], critical: [0, 0], ref: true },
];

const m = (v: V) => v[0];
const ci = (v: V) => v[1];

// ---------- primitives ----------

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

function Section({ id, kicker, title, children }: { id?: string; kicker?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-zinc-200 py-10">
      {kicker && <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">{kicker}</div>}
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

// horizontal bar with optional dashed baseline + optional CI whisker
function RateBar({ label, sub, value, ciVal, color, baseline, max = 100, flag }: {
  label: string; sub?: string; value: number; ciVal?: number; color: string; baseline?: number; max?: number; flag?: string;
}) {
  const left = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 py-[3px] text-xs">
      <div className="w-40 shrink-0 text-right text-zinc-600">
        {label}{sub && <span className="text-zinc-400"> · {sub}</span>}
      </div>
      <div className="relative h-5 flex-1 rounded bg-zinc-100">
        {baseline !== undefined && (
          <div className="absolute bottom-[-3px] top-[-3px] border-l border-dashed border-emerald-500/70" style={{ left: `${(baseline / max) * 100}%` }} />
        )}
        <div className={`h-full rounded ${color}`} style={{ width: `${left}%` }} />
        {ciVal !== undefined && ciVal > 0 && (
          <div className="absolute top-1/2 h-[1px] -translate-y-1/2 bg-zinc-500/60"
               style={{ left: `${Math.max(0, ((value - ciVal) / max) * 100)}%`, width: `${(Math.min(max, value + ciVal) - Math.max(0, value - ciVal)) / max * 100}%` }} />
        )}
      </div>
      <div className="w-28 shrink-0">
        <Mono className="text-zinc-900">{value}%</Mono>
        {ciVal !== undefined && ciVal > 0 && <Mono className="text-zinc-400"> ±{ciVal}</Mono>}
        {flag && <span className="ml-1 text-[10px] text-emerald-600">{flag}</span>}
      </div>
    </div>
  );
}

function MetricCard({ name, plain, oneLiner, why, example, gotcha }: {
  name: string; plain: string; oneLiner: ReactNode; why: ReactNode; example: ReactNode; gotcha: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-sm font-semibold text-zinc-900">{name}</h3>
        <span className="text-[11px] text-zinc-400">{plain}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-800">{oneLiner}</p>
      <p className="mt-2 text-xs text-zinc-600"><span className="font-semibold text-zinc-700">Why it matters. </span>{why}</p>
      <p className="mt-1.5 text-xs text-zinc-600"><span className="font-semibold text-zinc-700">Example. </span>{example}</p>
      <p className="mt-1.5 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900"><span className="font-semibold">Gotcha. </span>{gotcha}</p>
    </div>
  );
}

// ---------- scatter ----------

function Scatter() {
  const W = 460, H = 300, padL = 44, padB = 34, padT = 14, padR = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xMax = 100, yMax = 0.4;
  const x = (v: number) => padL + (v / xMax) * plotW;
  const y = (v: number) => padT + (1 - v / yMax) * plotH;
  const luckyY = y(LUCKY);
  const pts = ROWS.map((r) => ({
    ...r,
    cx: x(m(r.moveFid)), cy: y(m(r.condAgree)),
    fill: r.ref ? "#a1a1aa" : r.spec ? "#8b5cf6" : "#3b82f6",
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MoveFid versus CondAgree scatter">
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#d4d4d8" />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#d4d4d8" />
      <line x1={padL} y1={luckyY} x2={padL + plotW} y2={luckyY} stroke="#a1a1aa" strokeDasharray="4 3" />
      <text x={padL + plotW} y={luckyY - 4} textAnchor="end" className="fill-zinc-500 font-mono" fontSize="10">
        lucky-guess ≈0.30 (inflated at small n)
      </text>
      <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" className="fill-zinc-500 font-mono" fontSize="10">MoveFid (right-mix score) →</text>
      <text x={12} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 12 ${padT + plotH / 2})`} className="fill-zinc-500 font-mono" fontSize="10">CondAgree →</text>
      {[0, 0.1, 0.2, 0.3, 0.4].map((t) => (
        <text key={t} x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 font-mono" fontSize="9">{t.toFixed(1)}</text>
      ))}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.ref ? 5 : 5.5} fill={p.fill} opacity={p.ref ? 0.85 : 0.9} />
          {p.model === "prior_sampler" && (
            <text x={p.cx - 8} y={p.cy + 3} textAnchor="end" className="fill-zinc-500 font-mono" fontSize="9.5">tops MoveFid ←</text>
          )}
          {p.model === "osim-8b" && p.mode === "with-profile" && (
            <text x={p.cx + 8} y={p.cy + 3} className="fill-violet-600 font-mono" fontSize="9.5">OSim (specialized)</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------- persona-lift dumbbells (macro CondAgree) ----------

const LIFT = [
  { model: "deepseek-v3.1", from: 0.174, to: 0.276, delta: "+0.10", appr: "42.8% → 39.9%", apprUp: false, tag: "most coachable" },
  { model: "gpt-5", from: 0.167, to: 0.220, delta: "+0.05", appr: "21.8% → 35.1%", apprUp: true },
  { model: "gemini-3.1-pro", from: 0.302, to: 0.351, delta: "+0.05", appr: "68.5% → 75.2%", apprUp: true },
];

function Dumbbell({ from, to }: { from: number; to: number }) {
  const max = 0.4;
  const pos = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="relative h-5 flex-1 rounded bg-zinc-100">
      <div className="absolute bottom-[-3px] top-[-3px] border-l border-dashed border-zinc-400/70" style={{ left: pos(LUCKY) }} />
      <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-emerald-400" style={{ left: pos(from), width: pos(to - from) }} />
      <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-400 bg-white" style={{ left: pos(from) }} />
      <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500" style={{ left: pos(to) }} />
    </div>
  );
}

// ---------- page ----------

export default function Page() {
  const frontier = ROWS.filter((r) => !r.ref && !r.spec);
  const spec = ROWS.filter((r) => r.spec);
  const refs = ROWS.filter((r) => r.ref);
  const lbRow = (r: Row, i: number) => (
    <tr key={`${r.model}-${r.mode}-${i}`} className="border-t border-zinc-100">
      <td className="px-3 py-2"><Mono className="text-zinc-900">{r.model}</Mono></td>
      <td className="px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.mode === "with-profile" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"}`}>{r.mode}</span>
      </td>
      <td className="px-3 py-2 text-right"><Mono>{m(r.moveFid).toFixed(1)}</Mono><Mono className="text-zinc-400"> ±{ci(r.moveFid).toFixed(0)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className="text-zinc-700">{m(r.condAgree).toFixed(3)}</Mono><Mono className="text-zinc-400"> ±{ci(r.condAgree).toFixed(2)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className={Math.abs(m(r.approve) - REAL.approve) <= 6 ? "text-emerald-700" : "text-zinc-900"}>{m(r.approve)}</Mono><Mono className="text-zinc-400"> ±{ci(r.approve).toFixed(0)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className={m(r.critical) >= 15 ? "text-emerald-700" : "text-amber-700"}>{m(r.critical)}</Mono><Mono className="text-zinc-400"> ±{ci(r.critical).toFixed(0)}</Mono></td>
    </tr>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">UserSimBench <span className="text-zinc-400">v0</span></h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <a href="https://github.com/AlienKevin/user-simulator" target="_blank" rel="noreferrer" className="hover:text-zinc-900">github</a>
            <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" target="_blank" rel="noreferrer" className="hover:text-zinc-900">SWE-chat</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-20">
        {/* HERO */}
        <div className="py-12">
          <div className="font-mono text-[11px] uppercase tracking-wider text-amber-600">the finding</div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
            Every AI model we tested is stuck in <span className="text-amber-600">“easy mode.”</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            A <span className="font-semibold text-zinc-900">user simulator</span> is an AI pretending to be the
            human developer, so we can stress-test coding agents without a real person in the loop. The catch: every
            model we tested is too agreeable. General-purpose models approve far more than real developers
            (<Mono>27%</Mono> → <Mono>up to 75%</Mono>) and complain far less (<Mono>38%</Mono> → <Mono>4–18%</Mono>).
            The one <span className="font-semibold text-violet-700">purpose-built</span> simulator (OdysSim) does
            better — it complains <Mono>18.5%</Mono> of the time and doesn’t over-approve — but still only reaches
            half the real rate. Any agent these simulators test looks better than real users would let it.
          </p>
          <div className="mt-7 max-w-xl rounded-lg border border-zinc-200 bg-white p-4">
            <RateBar label="Real developers" sub="critical" value={37.9} color="bg-emerald-500" max={45} />
            <RateBar label="Best AI model" sub="OSim-8B" value={18.5} ciVal={11.7} color="bg-violet-500" max={45} />
            <RateBar label="Frontier best" sub="critical" value={17.7} ciVal={22.8} color="bg-amber-500" max={45} />
            <p className="mt-2 text-xs text-zinc-500">
              Real developers say <em>something’s wrong</em> on about one turn in three. The purpose-built simulator
              (OSim-8B) reaches half that; general-purpose models trail further behind. The one thing that reaches the
              real rate is a dumb random baseline — more on that below.
            </p>
          </div>
        </div>

        {/* METHODOLOGY BANNER */}
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-xs leading-relaxed text-zinc-700">
          <span className="font-semibold text-violet-800">How these numbers are computed.</span> Every figure is
          <span className="font-semibold"> user-weighted (macro)</span>: we compute each developer’s own rate, then
          average across developers — so no high-volume developer dominates (unlike a turn-pooled average). This is an
          <span className="font-semibold"> interim</span> cut over <span className="font-semibold">7 developers</span> with
          ≥3 held-out turns each; <Mono>±</Mono> is the 95% CI across developers (wide at this size). A
          <span className="font-semibold"> 10-developer × 50-turn</span> run is in progress for tighter bounds. One caveat:
          the <em>lucky-guess line</em> (0.30) is inflated at ~8 turns/developer and is provisional until that run lands.
        </div>

        {/* WHAT WE TESTED */}
        <Section kicker="the setup" title="What we tested, and why we grade the move instead of the words">
          <div className="space-y-3 text-sm leading-relaxed text-zinc-700">
            <p>
              For each <span className="font-semibold text-zinc-900">developer</span> we take held-out conversation
              moments — a real prompt with the agent’s work so far held fixed — and ask a candidate simulator to write
              that developer’s next message. (Held-out = never shown to any model during tuning.)
            </p>
            <p>
              Then we label what that message was <em>trying to do</em> — its <span className="font-semibold text-zinc-900">move</span>.
              A move is just the labeled intent of a message. There are seven:
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs text-zinc-500">What real developers do (user-weighted across the 7 developers):</div>
              <div className="flex h-7 w-full overflow-hidden rounded">
                {MOVE_MIX.map((mm) => (
                  <div key={mm.move} className={`${mm.color} flex items-center justify-center`} style={{ width: `${mm.pct}%` }} title={`${mm.move} ${mm.pct}%`} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                {MOVE_MIX.map((mm) => (
                  <span key={mm.move} className="inline-flex items-center gap-1">
                    <span className={`inline-block size-2 rounded-sm ${mm.color}`} />
                    {mm.move} <Mono className="text-zinc-500">{mm.pct}%</Mono>
                  </span>
                ))}
              </div>
            </div>
            <p>
              We grade the <em>move</em>, not the exact wording — prior work found word-level realism largely saturated.
              What matters is behavior: does the simulator push back, approve, and report bugs <em>in the same
              situations</em> a real developer would? Labeling is by a single classifier
              (<Mono className="text-zinc-500">claude-haiku-4.5</Mono>), whose mistakes bound every number.
            </p>
          </div>
        </Section>

        {/* METRIC PRIMER */}
        <Section kicker="the two scores (made plain)" title="How to read the numbers">
          <p className="mb-4 max-w-2xl text-sm text-zinc-600">
            Two scores do the work. <span className="font-semibold">MoveFid</span> checks the overall <em>blend</em> of
            moves; <span className="font-semibold">CondAgree</span> checks the <em>right move at the right moment</em>.
            Neither is trustworthy alone.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              name="MoveFid" plain="right-mix score (0–100)"
              oneLiner="How closely the simulator’s overall blend of move-types matches the blend real developers produce. 100 = identical blend."
              why="If the simulator never reports bugs or never pushes back, the coding agent only ever gets tested on easy days. MoveFid checks the diet."
              example={<>A simulator that hits the real proportions (approve <Mono>27%</Mono>, new work <Mono>17%</Mono>, pushback <Mono>15%</Mono>, bug report <Mono>13%</Mono>…) scores high.</>}
              gotcha={<>It only looks at the <em>overall</em> blend, not timing — so it’s gameable. A brainless sampler that just draws from the real mix <span className="font-semibold">tops the chart at 58.9</span> with zero situational skill.</>}
            />
            <MetricCard
              name="CondAgree" plain="right-move-right-place (0–1)"
              oneLiner="Per developer, the fraction of their held-out moments where the simulator made the very same move the developer made — then averaged across developers."
              why="Matching the average blend is cheap; reacting correctly turn-by-turn is the real test. At this specific point in this conversation, did the simulator do what the human did?"
              example={<>Gemini-3.1-Pro with a profile scores <Mono>0.351</Mono>; the dumb sampler about <Mono>0.29</Mono>.</>}
              gotcha={<>It’s a 7-way choice, so the bar isn’t 50% — it’s the lucky-guess line. <span className="font-semibold">At this small per-developer n that line is inflated (~0.30)</span> and provisional; the 50-turn run will place it. And high CondAgree ≠ well-behaved: Gemini leads yet approves <Mono>75%</Mono>.</>}
            />
            <MetricCard
              name="approve% / critical%" plain="the temperament check"
              oneLiner={<>The simulator’s own rate of saying “looks good” (approve%) vs. saying something’s wrong — pushback + interrupt + bug report (critical%) — against the real <Mono>27%</Mono> and <Mono>38%</Mono>.</>}
              why="The quickest read on whether a simulator behaves like a real developer or a pushover. Too much approval, too little objection = the agent looks better than it is."
              example={<>With-profile Gemini approves <Mono>75%</Mono> (≈3× real) and is critical just <Mono>4%</Mono>. Uninstructed OSim-8B is the opposite — approves only <Mono>10%</Mono>.</>}
              gotcha={<>Read <span className="font-semibold">both</span> together, against <Mono>27%</Mono>/<Mono>38%</Mono>, and mind the wide CIs at this developer count.</>}
            />
            <MetricCard
              name="user-weighted" plain="macro, not pooled"
              oneLiner="Each developer's own rate, averaged across developers — so a developer with many turns doesn't dominate."
              why="A turn-pooled average is swayed by whoever happened to have the most held-out turns. User-weighting asks: across developers, how does the simulator do on a typical one?"
              example={<>Real critical rate is <Mono>38%</Mono> user-weighted (it was <Mono>33%</Mono> turn-pooled — the pool had been tilted by high-volume developers).</>}
              gotcha={<>With only 7 developers the cross-developer CI is wide (<Mono>±</Mono> shown everywhere). The in-progress 10×50 run shrinks it.</>}
            />
          </div>
        </Section>

        {/* VISUAL A — approve / critical comparison */}
        <Section kicker="the headline, in two pictures" title="Every model is too polite">
          <div className="mb-5 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-xs md:grid-cols-2">
            <div>
              <div className="font-mono font-semibold text-zinc-900">approve%</div>
              <div className="mt-1 text-zinc-600">
                Share of the simulator’s turns labelled the <Mono className="text-zinc-700">approve_proceed</Mono> move —
                “looks good”, “continue”, “commit / push”, “move on”.
              </div>
            </div>
            <div>
              <div className="font-mono font-semibold text-zinc-900">critical% <span className="font-normal text-zinc-400">= pushback + interrupt + bug_report</span></div>
              <div className="mt-1 text-zinc-600">
                Share of turns labelled <Mono className="text-zinc-700">pushback</Mono> (correcting/rejecting the agent),
                <Mono className="text-zinc-700"> interrupt</Mono> (cutting it off mid-work), or
                <Mono className="text-zinc-700"> bug_report</Mono> (reporting something broken).
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 md:col-span-2">
              The remaining moves — <Mono>new_work</Mono>, <Mono>refine/redirect</Mono>, <Mono>question</Mono> — count as
              neither. Each is a fraction of one simulator’s ~labelled turns per developer, then averaged across developers
              (user-weighted). Move labels come from the <Mono>claude-haiku-4.5</Mono> classifier.
            </div>
          </div>
          <p className="mb-5 max-w-2xl text-sm text-zinc-600">
            Read against the dashed real-developer lines (whiskers = 95% CI across developers). On
            <span className="font-semibold"> approve%</span>, general-purpose models sit at or past <Mono>27%</Mono>
            (Gemini ≈3×); only purpose-built <span className="text-violet-700">OSim-8B</span>, uninstructed, dips below.
            On <span className="font-semibold"> critical%</span>, every model falls short of <Mono>38%</Mono> —
            <span className="text-violet-700"> OSim-8B</span> comes closest. <span className="text-violet-600">Violet = purpose-built.</span>
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">approve% <span className="font-normal text-emerald-600">— dashed line = real 27%</span></div>
              {frontier.map((r, i) => (
                <RateBar key={i} label={r.model.split("-")[0]} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={m(r.approve)} ciVal={ci(r.approve)} color="bg-blue-500" baseline={REAL.approve} />
              ))}
              {spec.map((r, i) => (
                <RateBar key={i} label={r.model} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={m(r.approve)} ciVal={ci(r.approve)} color="bg-violet-500" baseline={REAL.approve} flag={m(r.approve) < 15 ? "under-approves" : undefined} />
              ))}
              <RateBar label="always_approve" sub="ref" value={100} color="bg-zinc-300" baseline={REAL.approve} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">critical% <span className="font-normal text-emerald-600">— dashed line = real 38%</span></div>
              {frontier.map((r, i) => (
                <RateBar key={i} label={r.model.split("-")[0]} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={m(r.critical)} ciVal={ci(r.critical)} color="bg-amber-500" baseline={REAL.critical} />
              ))}
              {spec.map((r, i) => (
                <RateBar key={i} label={r.model} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={m(r.critical)} ciVal={ci(r.critical)} color="bg-violet-500" baseline={REAL.critical} flag={m(r.critical) >= 15 ? "best live" : undefined} />
              ))}
              <RateBar label="prior_sampler" sub="ref" value={39.7} color="bg-zinc-400" baseline={REAL.critical} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Only the dumb <Mono>prior_sampler</Mono> reaches the real critical rate (<Mono>~40%</Mono>); only
            <Mono> always_approve</Mono> hits <Mono>100%</Mono> approve. The real models are bunched in between — too polite.
          </p>
        </Section>

        {/* LEADERBOARD */}
        <Section kicker="all the numbers (user-weighted, ± 95% CI)" title="Leaderboard">
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-3 py-2 font-medium">Simulator</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 text-right font-medium">MoveFid</th>
                  <th className="px-3 py-2 text-right font-medium">CondAgree</th>
                  <th className="px-3 py-2 text-right font-medium">approve%</th>
                  <th className="px-3 py-2 text-right font-medium">critical%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-blue-50/40"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-blue-500">general-purpose frontier models</td></tr>
                {frontier.map(lbRow)}
                <tr className="border-t border-zinc-200 bg-violet-50/50"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-500">purpose-built user simulators — OdysSim (OSim), prior best on customer-service</td></tr>
                {spec.map(lbRow)}
                <tr className="border-t border-zinc-200 bg-zinc-50"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">references — not real simulators</td></tr>
                {refs.map(lbRow)}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            User-weighted across 7 developers; <Mono>±</Mono> is the 95% CI across developers. Read every row against the
            real <span className="font-semibold text-zinc-700">27% approve / 38% critical</span>.
            <Mono> critical% = pushback + interrupt + bug report</Mono>. No single column names a winner: the highest CondAgree is
            with-profile Gemini (<Mono>0.351</Mono>) — yet it approves <Mono>75%</Mono>; the highest MoveFid is the dumb
            <Mono> prior_sampler</Mono> (<Mono>58.9</Mono>). At this developer count the CIs are wide — treat the ranking as
            provisional; the 10×50 run tightens it.
          </p>
        </Section>

        {/* VISUAL B — the trap */}
        <Section kicker="why one number lies" title="The dumb-sampler trap">
          <div className="rounded-lg border border-zinc-200 bg-white p-4"><Scatter /></div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            <Mono>prior_sampler</Mono> just draws moves from the real mix — so it <em>wins</em> MoveFid (<Mono>58.9</Mono>,
            far right) with no idea what’s happening at any moment. <span className="text-zinc-700">High MoveFid is
            gameable; the pair is not.</span> The <span className="text-violet-600">violet</span> dots are OSim, the
            purpose-built simulator. (The lucky-guess reference line is dashed gray because at ~8 turns/developer it’s
            biased high; the 50-turn run will place it correctly — don’t read “below the line” as “no skill” yet.)
          </p>
        </Section>

        {/* VISUAL C — persona lift */}
        <Section kicker="does a profile help?" title="A developer profile helps aim — but doesn’t cure easy mode">
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
            {LIFT.map((l) => (
              <div key={l.model} className="flex items-center gap-3 text-xs">
                <div className="w-32 shrink-0 text-right">
                  <Mono className="text-zinc-900">{l.model}</Mono>
                  {l.tag && <div className="text-[10px] text-emerald-600">{l.tag}</div>}
                </div>
                <Dumbbell from={l.from} to={l.to} />
                <div className="w-44 shrink-0">
                  <Mono className="text-emerald-700">{l.delta}</Mono>
                  <span className="text-zinc-400"> CondAgree · approve </span>
                  <Mono className={l.apprUp ? "text-amber-600" : "text-emerald-600"}>{l.appr}</Mono>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
              <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border border-zinc-400 bg-white" /> no profile</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-emerald-500" /> with profile</span>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            Giving the simulator a profile of the specific developer raises right-move-right-place for all three
            (DeepSeek gains most). But it doesn’t cure easy mode: for GPT-5 and Gemini the profile makes them approve
            <em> even more</em> (<Mono>21.8→35.1%</Mono>, <Mono>68.5→75.2%</Mono>).
          </p>
        </Section>

        {/* OSIM — temperament vs aim */}
        <Section kicker="the purpose-built simulator" title="Does a model built for this do better? Temperament vs. aim">
          <p className="mb-5 max-w-2xl text-sm text-zinc-600">
            <Mono className="text-violet-700">OdysSim (OSim-4B / 8B)</Mono> is a Qwen3 model post-trained specifically
            to imitate the <em>human</em> side of conversations — the best specialized user simulator in prior
            customer-service work. We hosted both on Modal and ran them through the same test. The result splits in two.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="text-xs font-semibold text-emerald-800">Temperament — transfers ✓</div>
              <p className="mb-3 mt-1 text-xs text-zinc-600">OSim is the <span className="font-semibold">least easy-mode</span> model — it complains most and doesn’t rubber-stamp. critical% (real = 38%):</p>
              <RateBar label="Real devs" value={37.9} color="bg-emerald-500" max={45} baseline={37.9} />
              <RateBar label="OSim-8B" value={18.5} ciVal={11.7} color="bg-violet-500" max={45} baseline={37.9} />
              <RateBar label="Best frontier" value={17.7} ciVal={22.8} color="bg-amber-500" max={45} baseline={37.9} />
              <p className="mt-2 text-[11px] text-zinc-500">OSim-8B also tops <span className="font-semibold">move-mix fidelity</span> (MoveFid 42.8) and, uninstructed, approves just 10% — it asks questions instead of approving.</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="text-xs font-semibold text-amber-800">Situational aim — doesn’t ✗</div>
              <p className="mb-3 mt-1 text-xs text-zinc-600">But at the <span className="font-semibold">right move at the right moment</span> (CondAgree), a frontier model given the developer’s profile leads:</p>
              {[
                { l: "Gemini + profile", v: 0.351, c: "bg-blue-500" },
                { l: "OSim-8B", v: 0.220, c: "bg-violet-500" },
                { l: "DeepSeek + profile", v: 0.276, c: "bg-blue-400" },
              ].map((r) => (
                <div key={r.l} className="flex items-center gap-3 py-[3px] text-xs">
                  <div className="w-28 shrink-0 text-right text-zinc-600">{r.l}</div>
                  <div className="relative h-5 flex-1 rounded bg-zinc-100">
                    <div className={`h-full rounded ${r.c}`} style={{ width: `${(r.v / 0.4) * 100}%` }} />
                  </div>
                  <div className="w-12 shrink-0"><Mono className="text-zinc-900">{r.v.toFixed(3)}</Mono></div>
                </div>
              ))}
              <p className="mt-2 text-[11px] text-zinc-500">OSim was trained on social / customer-service data, not coding — right reflexes, weaker coding-specific situational skill.</p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-700">
            <span className="font-semibold">The split.</span> User-sim ability is two separate skills.
            <span className="text-violet-700"> Temperament</span> — human-like pushback, not being a yes-man —
            transfers from the purpose-built simulator. <span className="text-blue-700">Aim</span> — the right move at
            the right coding moment — comes from a frontier model conditioned on the real developer’s profile. No model
            has both; the best coding user-simulator would combine them (or fine-tune an OSim-style model on real
            coding sessions like SWE-chat).
          </p>
        </Section>

        {/* TRANSFER */}
        <Section kicker="from customer-service to coding" title="How strengths carry over from prior work">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: best general LLM sim (USI 76.0)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">DeepSeek-V3.1</div>
              <p className="mt-2 text-xs text-zinc-700">The most <span className="font-semibold">coachable</span> — biggest profile gain (<Mono className="text-emerald-700">+0.10</Mono> CondAgree).</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: strong, not best (USI ~70.9)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">GPT-5</div>
              <p className="mt-2 text-xs text-zinc-700">Uninstructed, its approve rate (<Mono>21.8%</Mono>) is nearest real (27%) — yet still under-pushes-back.</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: most human-like</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">Gemini-3.1-Pro</div>
              <p className="mt-2 text-xs text-zinc-700">The <span className="font-semibold">worst</span> easy-mode offender — approves <Mono className="text-amber-700">75%</Mono>, ≈3× real. Sounding human ≠ behaving like a developer.</p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-700">
            <span className="font-semibold">Bottom line.</span> Today’s top models are too polite to stand in for real
            developers. And being good at <em>sounding human</em>, or at simulating <em>customers</em>, does not make a
            model good at simulating a <em>coder</em>.
          </p>
        </Section>

        {/* CAVEATS */}
        <Section title="Caveats">
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
            Numbers are <span className="font-semibold text-zinc-600">user-weighted (macro)</span> over an interim
            <span className="font-semibold"> 7 developers</span> with ≥3 held-out turns each (two single-turn developers
            excluded — a per-developer rate from one turn is meaningless); <Mono>±</Mono> is the 95% CI across developers,
            which is wide at this size. The <em>lucky-guess line</em> is inflated at ~8 turns/developer and is provisional.
            A <span className="font-semibold">10-developer × 50-turn</span> run is in progress to tighten all of this.
            Moves are labeled by a single classifier (<Mono>claude-haiku-4.5</Mono>); this is a
            <span className="font-semibold"> request-side</span> test (the real agent is held fixed); OSim-4B/8B are served
            zero-shot on Modal in their native role-swapped format. The easy-mode pattern is large and holds under both
            user-weighted and turn-pooled aggregation.
          </p>
        </Section>

        <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-400">
          UserSimBench v0 · move-fidelity eval built on{" "}
          <a href="https://github.com/AlienKevin/user-simulator" className="hover:text-zinc-700">user.skill</a> ·
          data from real{" "}
          <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" className="hover:text-zinc-700">SWE-chat</a> sessions.
        </footer>
      </main>
    </div>
  );
}
