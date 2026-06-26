// UserSimBench v0.1 — single static results page.
// Numbers are USER-WEIGHTED (macro): each developer's own rate, averaged across
// 10 developers × 50 held-out turns each, 95% CI shown.
// Source: bench/results/site_v01.json (10-user × 50-turn run).

import type { ReactNode } from "react";

// ---------- ground-truth data (user-weighted macro, [mean, ci95]) ----------

const REAL = { approve: 20.5, critical: 23.7 };
const LUCKY = 0.272; // per-developer lucky-guess line (unbiased Σp²)

const MOVE_MIX: { move: string; pct: number; color: string }[] = [
  { move: "question", pct: 20.6, color: "bg-emerald-400" },
  { move: "approve", pct: 20.5, color: "bg-zinc-400" },
  { move: "refine / redirect", pct: 19.5, color: "bg-blue-300" },
  { move: "new work", pct: 13.1, color: "bg-blue-400" },
  { move: "pushback", pct: 10.6, color: "bg-amber-500" },
  { move: "interrupt", pct: 7.4, color: "bg-amber-600" },
  { move: "bug report", pct: 5.6, color: "bg-amber-400" },
  { move: "other", pct: 2.6, color: "bg-zinc-300" },
];

type Vv = [number, number]; // [mean, ci95]
type Row = {
  model: string;
  mode: "with-profile" | "no-profile" | "reference";
  moveFid: Vv; condAgree: Vv; approve: Vv; critical: Vv;
  ref?: boolean; spec?: boolean;
};

const ROWS: Row[] = [
  { model: "deepseek-v3.1", mode: "with-profile", moveFid: [43.9, 9.4], condAgree: [0.247, 0.038], approve: [30.6, 13.8], critical: [14.1, 8.5] },
  { model: "deepseek-v3.1", mode: "no-profile", moveFid: [41.2, 7.5], condAgree: [0.231, 0.034], approve: [30.0, 10.6], critical: [5.6, 6.8] },
  { model: "gpt-5", mode: "with-profile", moveFid: [40.6, 7.7], condAgree: [0.261, 0.064], approve: [32.8, 16.4], critical: [9.2, 8.1] },
  { model: "gpt-5", mode: "no-profile", moveFid: [39.2, 8.3], condAgree: [0.246, 0.117], approve: [16.5, 10.6], critical: [8.9, 8.6] },
  { model: "gemini-3.1-pro", mode: "with-profile", moveFid: [38.2, 6.7], condAgree: [0.241, 0.064], approve: [50.3, 18.3], critical: [8.2, 5.5] },
  { model: "gemini-3.1-pro", mode: "no-profile", moveFid: [37.9, 6.4], condAgree: [0.305, 0.122], approve: [51.3, 16.0], critical: [4.0, 3.8] },
  { model: "osim-8b", mode: "with-profile", moveFid: [47.2, 9.4], condAgree: [0.257, 0.063], approve: [36.0, 13.6], critical: [11.8, 8.5], spec: true },
  { model: "osim-8b", mode: "no-profile", moveFid: [52.0, 12.1], condAgree: [0.272, 0.091], approve: [24.9, 11.4], critical: [11.6, 4.5], spec: true },
  { model: "osim-4b", mode: "with-profile", moveFid: [50.3, 10.4], condAgree: [0.257, 0.064], approve: [32.6, 12.8], critical: [13.8, 7.0], spec: true },
  { model: "osim-4b", mode: "no-profile", moveFid: [55.6, 9.3], condAgree: [0.239, 0.067], approve: [28.2, 9.6], critical: [10.5, 5.7], spec: true },
  { model: "prior_sampler", mode: "reference", moveFid: [81.4, 7.6], condAgree: [0.289, 0.142], approve: [21.7, 9.1], critical: [24.1, 8.7], ref: true },
  { model: "always_approve", mode: "reference", moveFid: [4.6, 1.8], condAgree: [0.205, 0.086], approve: [100, 0], critical: [0, 0], ref: true },
];

const mv = (v: Vv) => v[0];
const cv = (v: Vv) => v[1];

// ---------- primitives ----------

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

function Section({ kicker, title, children }: { kicker?: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-200 py-10">
      {kicker && <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">{kicker}</div>}
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function RateBar({ label, sub, value, ciVal, color, baseline, max = 100, flag }: {
  label: string; sub?: string; value: number; ciVal?: number; color: string; baseline?: number; max?: number; flag?: string;
}) {
  const left = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 py-[3px] text-xs">
      <div className="w-40 shrink-0 text-right text-zinc-600">{label}{sub && <span className="text-zinc-400"> · {sub}</span>}</div>
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

function Scatter() {
  const W = 460, H = 300, padL = 44, padB = 34, padT = 14, padR = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (v: number) => padL + (v / 100) * plotW;
  const y = (v: number) => padT + (1 - v / 0.4) * plotH;
  const luckyY = y(LUCKY);
  const pts = ROWS.map((r) => ({ ...r, cx: x(mv(r.moveFid)), cy: y(mv(r.condAgree)), fill: r.ref ? "#a1a1aa" : r.spec ? "#8b5cf6" : "#3b82f6" }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MoveFid vs CondAgree">
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#d4d4d8" />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#d4d4d8" />
      <line x1={padL} y1={luckyY} x2={padL + plotW} y2={luckyY} stroke="#f59e0b" strokeDasharray="4 3" />
      <text x={padL + plotW} y={luckyY - 4} textAnchor="end" className="fill-amber-600 font-mono" fontSize="10">lucky-guess = 0.27 (per developer)</text>
      <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" className="fill-zinc-500 font-mono" fontSize="10">MoveFid (right-mix score) →</text>
      <text x={12} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 12 ${padT + plotH / 2})`} className="fill-zinc-500 font-mono" fontSize="10">CondAgree →</text>
      {[0, 0.1, 0.2, 0.3, 0.4].map((t) => <text key={t} x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 font-mono" fontSize="9">{t.toFixed(1)}</text>)}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.ref ? 5 : 5.5} fill={p.fill} opacity={0.9} />
          {p.model === "prior_sampler" && <text x={p.cx - 8} y={p.cy + 3} textAnchor="end" className="fill-zinc-500 font-mono" fontSize="9.5">dumb sampler — tops MoveFid ←</text>}
          {p.model === "osim-4b" && p.mode === "no-profile" && <text x={p.cx} y={p.cy - 9} textAnchor="middle" className="fill-violet-600 font-mono" fontSize="9.5">OSim</text>}
        </g>
      ))}
    </svg>
  );
}

const LIFT = [
  { model: "deepseek-v3.1", from: 0.231, to: 0.247, delta: "+0.02", appr: "30.0% → 30.6%", apprUp: true },
  { model: "gpt-5", from: 0.246, to: 0.261, delta: "+0.02", appr: "16.5% → 32.8%", apprUp: true },
  { model: "gemini-3.1-pro", from: 0.305, to: 0.241, delta: "−0.06", appr: "51.3% → 50.3%", apprUp: false },
];

function Dumbbell({ from, to }: { from: number; to: number }) {
  const pos = (v: number) => `${(v / 0.4) * 100}%`;
  const up = to >= from;
  return (
    <div className="relative h-5 flex-1 rounded bg-zinc-100">
      <div className="absolute bottom-[-3px] top-[-3px] border-l border-dashed border-amber-500/70" style={{ left: pos(LUCKY) }} />
      <div className={`absolute top-1/2 h-[2px] -translate-y-1/2 ${up ? "bg-emerald-400" : "bg-rose-300"}`} style={{ left: pos(Math.min(from, to)), width: pos(Math.abs(to - from)) }} />
      <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-400 bg-white" style={{ left: pos(from) }} />
      <div className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${up ? "bg-emerald-500" : "bg-rose-400"}`} style={{ left: pos(to) }} />
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
      <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.mode === "with-profile" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"}`}>{r.mode}</span></td>
      <td className="px-3 py-2 text-right"><Mono>{mv(r.moveFid).toFixed(1)}</Mono><Mono className="text-zinc-400"> ±{cv(r.moveFid).toFixed(0)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className={mv(r.condAgree) > LUCKY + 0.01 ? "text-emerald-700" : "text-zinc-500"}>{mv(r.condAgree).toFixed(3)}</Mono><Mono className="text-zinc-400"> ±{cv(r.condAgree).toFixed(2)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className={Math.abs(mv(r.approve) - REAL.approve) <= 6 ? "text-emerald-700" : "text-zinc-900"}>{mv(r.approve)}</Mono><Mono className="text-zinc-400"> ±{cv(r.approve).toFixed(0)}</Mono></td>
      <td className="px-3 py-2 text-right"><Mono className={mv(r.critical) >= 13 ? "text-emerald-700" : "text-amber-700"}>{mv(r.critical)}</Mono><Mono className="text-zinc-400"> ±{cv(r.critical).toFixed(0)}</Mono></td>
    </tr>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">UserSimBench <span className="text-zinc-400">v0.1</span></h1>
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
            AI models can’t stand in for real developers — they’re <span className="text-amber-600">too polite</span>, and they don’t <span className="text-amber-600">read the moment.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            A <span className="font-semibold text-zinc-900">user simulator</span> is an AI pretending to be the human
            developer, so we can stress-test coding agents without a real person. Two problems. <span className="font-semibold">(1) Too polite:</span> every
            model under-produces criticism (real developers say <em>something’s wrong</em> <Mono>24%</Mono> of turns;
            simulators manage <Mono>4–14%</Mono>), and Gemini over-approves (<Mono>50%</Mono> vs real <Mono>20%</Mono>).
            <span className="font-semibold"> (2) No situational skill:</span> at picking the right move at the right
            moment, every simulator scores about the same as blindly guessing from that developer’s habits.
          </p>
          <div className="mt-7 max-w-xl rounded-lg border border-zinc-200 bg-white p-4">
            <RateBar label="Real developers" sub="critical" value={23.7} color="bg-emerald-500" max={30} />
            <RateBar label="Most critical model" sub="DeepSeek+profile" value={14.1} ciVal={8.5} color="bg-blue-500" max={30} />
            <RateBar label="Gemini" sub="critical" value={8.2} ciVal={5.5} color="bg-amber-500" max={30} />
            <p className="mt-2 text-xs text-zinc-500">
              Real developers object on ~1 turn in 4. The toughest simulator manages ~3 in 20; most are gentler. An
              agent tested against any of them looks better than real users would allow.
            </p>
          </div>
        </div>

        {/* METHODOLOGY BANNER */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-xs leading-relaxed text-zinc-700">
          <span className="font-semibold text-zinc-900">How these numbers are computed.</span> Every figure is
          <span className="font-semibold"> user-weighted (macro)</span>: each developer’s own rate, averaged across
          <span className="font-semibold"> 10 developers × 50 held-out turns</span> each (not pooled over turns, so no
          high-volume developer dominates). <Mono>±</Mono> is the 95% CI across developers. The
          <em> lucky-guess line</em> (<Mono>0.27</Mono>) is each developer’s own move-predictability — the CondAgree you’d
          get by sampling from their habits with no read on the moment.
        </div>

        {/* WHAT WE TESTED */}
        <Section kicker="the setup" title="What we tested, and why we grade the move not the words">
          <div className="space-y-3 text-sm leading-relaxed text-zinc-700">
            <p>
              For each developer we take held-out moments — a real prompt with the agent’s work so far held fixed — and
              ask a simulator to write that developer’s next message. We then label its <span className="font-semibold text-zinc-900">move</span>
              {" "}(intent), one of seven, by classifier (<Mono className="text-zinc-500">claude-haiku-4.5</Mono>):
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs text-zinc-500">What real developers do (user-weighted across the 10 developers):</div>
              <div className="flex h-7 w-full overflow-hidden rounded">
                {MOVE_MIX.map((mm) => <div key={mm.move} className={`${mm.color}`} style={{ width: `${mm.pct}%` }} title={`${mm.move} ${mm.pct}%`} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                {MOVE_MIX.map((mm) => <span key={mm.move} className="inline-flex items-center gap-1"><span className={`inline-block size-2 rounded-sm ${mm.color}`} />{mm.move} <Mono className="text-zinc-500">{mm.pct}%</Mono></span>)}
              </div>
            </div>
            <p>
              These 10 are high-volume developers — note they ask a lot of <Mono>questions</Mono> (21%) and
              <Mono> refine</Mono> (20%), and report fewer bugs than a casual user. We grade the move, not the wording:
              does the simulator push back, approve, and report bugs <em>in the same situations</em> a real developer would?
            </p>
          </div>
        </Section>

        {/* METRIC PRIMER */}
        <Section kicker="the two scores (made plain)" title="How to read the numbers">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard name="MoveFid" plain="right-mix score (0–100)"
              oneLiner="How closely the simulator’s overall blend of move-types matches the blend real developers produce. 100 = identical blend."
              why="If the simulator never reports bugs or pushes back, the coding agent only gets tested on easy days."
              example={<>OSim models top this (up to <Mono>55.6</Mono>); frontier models land <Mono>38–44</Mono>.</>}
              gotcha={<>It only checks the <em>overall</em> blend, not timing — gameable. A brainless sampler that just draws from the real mix <span className="font-semibold">tops the chart at 81</span> with no situational skill.</>} />
            <MetricCard name="CondAgree" plain="right-move-right-place (0–1)"
              oneLiner="Per developer, the fraction of held-out moments where the simulator made the very same move that developer made — averaged across developers."
              why="Matching the average blend is cheap; reacting correctly turn-by-turn is the real test."
              example={<>Every simulator scores <Mono>0.24–0.27</Mono> — clustered right at the lucky-guess line (<Mono>0.27</Mono>).</>}
              gotcha={<>The bar isn’t 50% (it’s a 7-way choice) — it’s each developer’s own predictability, <Mono>0.27</Mono>. <span className="font-semibold">Sitting at the line means no skill beyond imitating habits.</span> That’s where every model lands.</>} />
            <MetricCard name="approve% / critical%" plain="the temperament check"
              oneLiner={<>Rate of “looks good” (<Mono>approve_proceed</Mono>) vs. saying something’s wrong — <Mono>pushback + interrupt + bug_report</Mono> — against the real <Mono>20%</Mono> / <Mono>24%</Mono>.</>}
              why="The quickest read on whether a simulator behaves like a real developer or a pushover."
              example={<>Gemini approves <Mono>50%</Mono> (≈2.5× real) and is critical just <Mono>4–8%</Mono>; DeepSeek+profile is the most critical at <Mono>14%</Mono>.</>}
              gotcha={<>The other moves — <Mono>new_work</Mono>, <Mono>refine/redirect</Mono>, <Mono>question</Mono> — count as neither. Read both rates together, against <Mono>20%</Mono>/<Mono>24%</Mono>.</>} />
            <MetricCard name="user-weighted" plain="macro, not pooled"
              oneLiner="Each developer's own rate, averaged across developers — so a developer with many turns doesn't dominate."
              why="A turn-pooled average is swayed by whoever had the most held-out turns. This asks: across developers, how does the simulator do on a typical one?"
              example={<>10 developers × 50 turns each; <Mono>±</Mono> is the 95% CI across developers.</>}
              gotcha={<>Wide-ish CIs remain (10 developers) — treat gaps under ~the <Mono>±</Mono> as ties.</>} />
          </div>
        </Section>

        {/* VISUAL A — approve / critical */}
        <Section kicker="problem 1 — temperament" title="Every model is too polite">
          <div className="mb-5 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-xs md:grid-cols-2">
            <div><div className="font-mono font-semibold text-zinc-900">approve%</div><div className="mt-1 text-zinc-600">Share of turns labelled <Mono className="text-zinc-700">approve_proceed</Mono> — “looks good”, “continue”, “commit/push”, “move on”.</div></div>
            <div><div className="font-mono font-semibold text-zinc-900">critical% <span className="font-normal text-zinc-400">= pushback + interrupt + bug_report</span></div><div className="mt-1 text-zinc-600"><Mono className="text-zinc-700">pushback</Mono> (correcting/rejecting), <Mono className="text-zinc-700">interrupt</Mono> (cutting off mid-work), or <Mono className="text-zinc-700">bug_report</Mono> (reporting something broken).</div></div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">approve% <span className="font-normal text-emerald-600">— line = real 20%</span></div>
              {frontier.map((r, i) => <RateBar key={i} label={r.model.split("-")[0]} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={mv(r.approve)} ciVal={cv(r.approve)} color="bg-blue-500" baseline={REAL.approve} max={110} />)}
              {spec.map((r, i) => <RateBar key={i} label={r.model} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={mv(r.approve)} ciVal={cv(r.approve)} color="bg-violet-500" baseline={REAL.approve} max={110} />)}
              <RateBar label="always_approve" sub="ref" value={100} color="bg-zinc-300" baseline={REAL.approve} max={110} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">critical% <span className="font-normal text-emerald-600">— line = real 24%</span></div>
              {frontier.map((r, i) => <RateBar key={i} label={r.model.split("-")[0]} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={mv(r.critical)} ciVal={cv(r.critical)} color="bg-amber-500" baseline={REAL.critical} max={30} />)}
              {spec.map((r, i) => <RateBar key={i} label={r.model} sub={r.mode === "with-profile" ? "profile" : "no profile"} value={mv(r.critical)} ciVal={cv(r.critical)} color="bg-violet-500" baseline={REAL.critical} max={30} flag={mv(r.critical) >= 13 ? "tough" : undefined} />)}
              <RateBar label="prior_sampler" sub="ref" value={24.1} color="bg-zinc-400" baseline={REAL.critical} max={30} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Every simulator falls short of the real <Mono>24%</Mono> critical rate; only the dumb <Mono>prior_sampler</Mono>
            (which copies the real mix) reaches it. Gemini is the worst over-approver. <span className="text-violet-600">Violet = purpose-built OSim.</span>
          </p>
        </Section>

        {/* VISUAL B — situational skill */}
        <Section kicker="problem 2 — do they read the moment?" title="Barely: every simulator sits at the lucky-guess line">
          <div className="rounded-lg border border-zinc-200 bg-white p-4"><Scatter /></div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            CondAgree asks: did the simulator make the same move the real developer made, <em>right there</em>? The amber
            line is each developer’s own predictability (<Mono>0.27</Mono>) — what you’d get by sampling their habits with
            no read on the moment. <span className="text-zinc-700">Every real model clusters right on that line
            (0.24–0.27)</span> — they imitate a developer’s habits but don’t read the situation. Meanwhile the dumb
            <Mono> prior_sampler</Mono> wins MoveFid (<Mono>81</Mono>) — proof the move-<em>mix</em> is easy to fake. (An
            earlier small-sample cut suggested real situational skill; at 10×50 it does not hold up.)
          </p>
        </Section>

        {/* LEADERBOARD */}
        <Section kicker="all the numbers (user-weighted, ± 95% CI)" title="Leaderboard">
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2 font-medium">Simulator</th><th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">MoveFid</th><th className="px-3 py-2 text-right font-medium">CondAgree</th>
                <th className="px-3 py-2 text-right font-medium">approve%</th><th className="px-3 py-2 text-right font-medium">critical%</th>
              </tr></thead>
              <tbody>
                <tr className="bg-blue-50/40"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-blue-500">general-purpose frontier models</td></tr>
                {frontier.map(lbRow)}
                <tr className="border-t border-zinc-200 bg-violet-50/50"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-500">purpose-built user simulators — OdysSim (OSim)</td></tr>
                {spec.map(lbRow)}
                <tr className="border-t border-zinc-200 bg-zinc-50"><td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">references — not real simulators</td></tr>
                {refs.map(lbRow)}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            User-weighted across 10 developers; <Mono>±</Mono> = 95% CI. Read against real <span className="font-semibold text-zinc-700">20% approve / 24% critical</span>
            {" "}and the <Mono>0.27</Mono> lucky-guess line. <Mono>critical% = pushback + interrupt + bug_report</Mono>. No
            column names a clean winner: OSim tops MoveFid but the move-<em>mix</em> is gameable (the dumb sampler tops it
            at 81); every model’s CondAgree sits at the lucky-guess line; DeepSeek+profile is most critical but still
            well under real.
          </p>
        </Section>

        {/* PERSONA */}
        <Section kicker="does a profile help?" title="A developer profile shifts temperament — but not aim">
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
            {LIFT.map((l) => (
              <div key={l.model} className="flex items-center gap-3 text-xs">
                <div className="w-32 shrink-0 text-right"><Mono className="text-zinc-900">{l.model}</Mono></div>
                <Dumbbell from={l.from} to={l.to} />
                <div className="w-48 shrink-0">
                  <Mono className={l.delta.startsWith("−") ? "text-rose-600" : "text-zinc-600"}>{l.delta}</Mono>
                  <span className="text-zinc-400"> CondAgree · approve </span>
                  <Mono className={l.apprUp ? "text-amber-600" : "text-zinc-600"}>{l.appr}</Mono>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
              <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border border-zinc-400 bg-white" /> no profile</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-emerald-500" /> with profile</span>
              <span>· amber dashed = lucky-guess line</span>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            Giving the simulator a profile of the specific developer barely moves right-move-right-place (CondAgree
            <Mono> +0.02 / +0.02 / −0.06</Mono>) — for Gemini it <em>hurts</em>. It does shift <em>temperament</em>
            (e.g. GPT-5’s approval jumps <Mono>16.5→32.8%</Mono> with a profile). An earlier small run showed a big
            CondAgree lift; that was noise — it doesn’t replicate at scale.
          </p>
        </Section>

        {/* OSIM */}
        <Section kicker="the purpose-built simulator" title="Does a model built for this do better? Best blend, no edge at the moment">
          <p className="mb-4 max-w-2xl text-sm text-zinc-600">
            <Mono className="text-violet-700">OdysSim (OSim-4B / 8B)</Mono> is a Qwen3 model post-trained to imitate the
            <em> human</em> side of conversations — the best specialized user simulator on customer-service. We hosted both
            on Modal and ran the same test.
          </p>
          <ul className="max-w-3xl space-y-2 text-sm text-zinc-700">
            <li>✓ <span className="font-semibold">Tops move-mix fidelity.</span> OSim-4B/8B lead MoveFid (up to <Mono>55.6</Mono> vs frontier <Mono>38–44</Mono>) — its training objective (match the human behavior <em>distribution</em>) transfers.</li>
            <li>✓ <span className="font-semibold">Doesn’t over-approve.</span> Uninstructed OSim-8B approves only <Mono>25%</Mono> (vs Gemini’s 50%) — it isn’t a yes-man.</li>
            <li>~ <span className="font-semibold">No criticality edge.</span> On this population OSim’s critical rate (<Mono>11–14%</Mono>) is in the same band as DeepSeek+profile (<Mono>14%</Mono>) — the earlier “OSim is uniquely least easy-mode” gap closes.</li>
            <li>✗ <span className="font-semibold">No situational edge.</span> OSim’s CondAgree (<Mono>0.24–0.27</Mono>) sits at the lucky-guess line like everyone else — it was trained on social/customer-service data, not coding.</li>
          </ul>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-700">
            <span className="font-semibold">Bottom line.</span> A specialized simulator gets the <em>blend</em> right and
            avoids sycophancy, but doesn’t read coding moments any better than a frontier model. The best coding
            user-simulator likely needs fine-tuning an OSim-style model on real coding sessions (e.g. SWE-chat) for the
            situational skill none of these has yet.
          </p>
        </Section>

        {/* CAVEATS */}
        <Section title="Caveats">
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
            Numbers are <span className="font-semibold text-zinc-600">user-weighted (macro)</span> over
            <span className="font-semibold"> 10 high-volume developers × 50 held-out turns</span> each; <Mono>±</Mono> is
            the 95% CI across developers (still wide-ish at 10). Moves are labelled by one classifier
            (<Mono>claude-haiku-4.5</Mono>). This is a <span className="font-semibold">request-side</span> test (the real
            agent is held fixed); OSim-4B/8B are served zero-shot on Modal in their native role-swapped format; DeepSeek
            had ~4% provider errors (n≈480 for one cell). The developer population matters — these power users push back
            less and ask more than casual users, so absolute rates are population-specific; the patterns (under-criticism,
            CondAgree at the lucky-guess line, profile shifts temperament not aim) hold across cuts.
          </p>
        </Section>

        <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-400">
          UserSimBench v0.1 · move-fidelity eval built on{" "}
          <a href="https://github.com/AlienKevin/user-simulator" className="hover:text-zinc-700">user.skill</a> ·
          data from real <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" className="hover:text-zinc-700">SWE-chat</a> sessions.
        </footer>
      </main>
    </div>
  );
}
