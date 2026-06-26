// UserSimBench v0 — single static results page.
// Audience: knows SWE-chat, new to user simulation. Every number below comes
// from bench/results/v0_summary.json (mirrored in public/data/v0_results.json).

import type { ReactNode } from "react";

// ---------- ground-truth data ----------

const REAL = { approve: 24.1, critical: 33.3 };
const LUCKY = 0.163; // marginal CondAgree ceiling (Σp²)

const MOVE_MIX: { move: string; pct: number; color: string }[] = [
  { move: "approve", pct: 24.1, color: "bg-zinc-400" },
  { move: "new work", pct: 20.4, color: "bg-blue-400" },
  { move: "refine / redirect", pct: 14.8, color: "bg-blue-300" },
  { move: "bug report", pct: 13.0, color: "bg-amber-400" },
  { move: "pushback", pct: 11.1, color: "bg-amber-500" },
  { move: "interrupt", pct: 9.3, color: "bg-amber-600" },
  { move: "question", pct: 5.6, color: "bg-emerald-400" },
  { move: "other", pct: 1.9, color: "bg-zinc-300" },
];

type Row = {
  model: string;
  mode: "with-profile" | "no-profile" | "reference";
  moveFid: number;
  condAgree: number;
  approve: number;
  critical: number;
  ref?: boolean;
};

const ROWS: Row[] = [
  { model: "deepseek-v3.1", mode: "with-profile", moveFid: 53.9, condAgree: 0.315, approve: 42.6, critical: 9.3 },
  { model: "deepseek-v3.1", mode: "no-profile", moveFid: 39.8, condAgree: 0.189, approve: 49.1, critical: 5.7 },
  { model: "gpt-5", mode: "with-profile", moveFid: 45.5, condAgree: 0.278, approve: 38.9, critical: 3.7 },
  { model: "gpt-5", mode: "no-profile", moveFid: 52.4, condAgree: 0.189, approve: 24.5, critical: 11.3 },
  { model: "gemini-3.1-pro", mode: "with-profile", moveFid: 41.4, condAgree: 0.333, approve: 72.2, critical: 3.7 },
  { model: "gemini-3.1-pro", mode: "no-profile", moveFid: 49.0, condAgree: 0.278, approve: 66.7, critical: 11.1 },
  { model: "prior_sampler", mode: "reference", moveFid: 84.3, condAgree: 0.185, approve: 20.4, critical: 35.2, ref: true },
  { model: "always_approve", mode: "reference", moveFid: 4.9, condAgree: 0.241, approve: 100, critical: 0, ref: true },
];

// ---------- small primitives ----------

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

// horizontal bar with an optional dashed baseline (real-dev reference)
function RateBar({ label, sub, value, color, baseline, max = 100, flag }: {
  label: string; sub?: string; value: number; color: string; baseline?: number; max?: number; flag?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-[3px] text-xs">
      <div className="w-40 shrink-0 text-right text-zinc-600">
        {label}{sub && <span className="text-zinc-400"> · {sub}</span>}
      </div>
      <div className="relative h-5 flex-1 rounded bg-zinc-100">
        {baseline !== undefined && (
          <div className="absolute top-[-3px] bottom-[-3px] border-l border-dashed border-emerald-500/70"
               style={{ left: `${(baseline / max) * 100}%` }} />
        )}
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <div className="w-24 shrink-0">
        <Mono className="text-zinc-900">{value}%</Mono>
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

// ---------- the scatter: MoveFid (x) × CondAgree (y) ----------

function Scatter() {
  const W = 460, H = 300, padL = 44, padB = 34, padT = 14, padR = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xMax = 100, yMax = 0.4;
  const x = (v: number) => padL + (v / xMax) * plotW;
  const y = (v: number) => padT + (1 - v / yMax) * plotH;
  const luckyY = y(LUCKY);
  const pts = ROWS.map((r) => ({
    ...r,
    cx: x(r.moveFid), cy: y(r.condAgree),
    fill: r.ref ? "#a1a1aa" : "#3b82f6",
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MoveFid versus CondAgree scatter">
      {/* emerald 'real skill' band above the lucky-guess line */}
      <rect x={padL} y={padT} width={plotW} height={luckyY - padT} fill="#10b981" opacity={0.06} />
      {/* axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#d4d4d8" />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#d4d4d8" />
      {/* lucky-guess line */}
      <line x1={padL} y1={luckyY} x2={padL + plotW} y2={luckyY} stroke="#f59e0b" strokeDasharray="4 3" />
      <text x={padL + plotW} y={luckyY - 4} textAnchor="end" className="fill-amber-600 font-mono" fontSize="10">
        lucky-guess = 0.163
      </text>
      <text x={padL + 4} y={padT + 10} className="fill-emerald-700 font-mono" fontSize="9">real situational skill ↑</text>
      {/* axis labels */}
      <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" className="fill-zinc-500 font-mono" fontSize="10">MoveFid (right-mix score) →</text>
      <text x={12} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 12 ${padT + plotH / 2})`} className="fill-zinc-500 font-mono" fontSize="10">CondAgree →</text>
      {[0, 0.1, 0.2, 0.3, 0.4].map((t) => (
        <text key={t} x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 font-mono" fontSize="9">{t.toFixed(1)}</text>
      ))}
      {/* points */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.ref ? 5 : 5.5} fill={p.fill} opacity={p.ref ? 0.85 : 0.9} />
          {p.model === "prior_sampler" && (
            <text x={p.cx - 8} y={p.cy + 3} textAnchor="end" className="fill-zinc-500 font-mono" fontSize="9.5">tops MoveFid, no skill ←</text>
          )}
          {p.model === "gemini-3.1-pro" && p.mode === "with-profile" && (
            <text x={p.cx + 8} y={p.cy + 3} className="fill-blue-600 font-mono" fontSize="9.5">≈2× the line</text>
          )}
          {p.model === "always_approve" && (
            <text x={p.cx + 8} y={p.cy + 3} className="fill-zinc-500 font-mono" fontSize="9.5">always-approve</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------- persona-lift dumbbells ----------

const LIFT = [
  { model: "deepseek-v3.1", from: 0.189, to: 0.315, delta: "+0.126", appr: "49.1% → 42.6%", apprUp: false, tag: "most coachable" },
  { model: "gpt-5", from: 0.189, to: 0.278, delta: "+0.089", appr: "24.5% → 38.9%", apprUp: true },
  { model: "gemini-3.1-pro", from: 0.278, to: 0.333, delta: "+0.055", appr: "66.7% → 72.2%", apprUp: true },
];

function Dumbbell({ from, to }: { from: number; to: number }) {
  const max = 0.4;
  const pos = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="relative h-5 flex-1 rounded bg-zinc-100">
      <div className="absolute top-[-3px] bottom-[-3px] border-l border-dashed border-amber-500/70" style={{ left: pos(LUCKY) }} />
      <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-emerald-400" style={{ left: pos(from), width: pos(to - from) }} />
      <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-400 bg-white" style={{ left: pos(from) }} />
      <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500" style={{ left: pos(to) }} />
    </div>
  );
}

// ---------- page ----------

export default function Page() {
  const live = ROWS.filter((r) => !r.ref);
  const refs = ROWS.filter((r) => r.ref);

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
            model we tested is too agreeable. They approve more than real developers
            (<Mono>24%</Mono> → <Mono>39–72%</Mono>) and complain far less (<Mono>33%</Mono> → <Mono>3.7–11.3%</Mono>) —
            so any coding agent they test looks better than real users would ever let it.
          </p>
          <div className="mt-7 max-w-xl rounded-lg border border-zinc-200 bg-white p-4">
            <RateBar label="Real developers" sub="critical" value={33.3} color="bg-emerald-500" max={40} />
            <RateBar label="Toughest AI model" sub="critical" value={11.3} color="bg-amber-500" max={40} />
            <p className="mt-2 text-xs text-zinc-500">
              Real developers say <em>something’s wrong</em> on about one turn in three. The most critical AI model
              (GPT-5, no profile) does it on roughly one in nine. The rest are gentler still. The only thing that
              reaches the real rate is a dumb random baseline — more on that below.
            </p>
          </div>
        </div>

        {/* WHAT WE TESTED */}
        <Section kicker="the setup" title="What we tested, and why we grade the move instead of the words">
          <div className="space-y-3 text-sm leading-relaxed text-zinc-700">
            <p>
              We took <span className="font-semibold text-zinc-900">54 conversation moments</span> from{" "}
              <span className="font-semibold text-zinc-900">9 real developers</span> chatting with coding agents — all
              <em> held-out</em>, never shown to any model during tuning. At each moment we showed a candidate simulator
              the real conversation so far (with the real agent’s work held fixed) and asked it to write the developer’s
              next message.
            </p>
            <p>
              Then we labeled what that message was <em>trying to do</em> — its <span className="font-semibold text-zinc-900">move</span>.
              A move is just the labeled intent of a message. There are seven:
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs text-zinc-500">What real developers actually do, across the 54 moments:</div>
              <div className="flex h-7 w-full overflow-hidden rounded">
                {MOVE_MIX.map((m) => (
                  <div key={m.move} className={`${m.color} flex items-center justify-center`} style={{ width: `${m.pct}%` }} title={`${m.move} ${m.pct}%`} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                {MOVE_MIX.map((m) => (
                  <span key={m.move} className="inline-flex items-center gap-1">
                    <span className={`inline-block size-2 rounded-sm ${m.color}`} />
                    {m.move} <Mono className="text-zinc-500">{m.pct}%</Mono>
                  </span>
                ))}
              </div>
            </div>
            <p>
              We grade the <em>move</em>, not the exact wording. Prior work found word-level realism largely saturated —
              a judge can barely tell a real message from a simulated one. What matters is behavior: does the simulator
              push back, approve, and report bugs <em>in the same situations</em> a real developer would? Labeling was
              done by a single AI classifier (<Mono className="text-zinc-500">claude-haiku-4.5</Mono>), whose mistakes set
              a floor on every number here. And with 54 moments, the sparse moves rest on a handful of examples
              (<Mono>11%</Mono> pushback ≈ 6 turns) — read small gaps as noise, big repeated patterns as real.
            </p>
          </div>
        </Section>

        {/* METRIC PRIMER */}
        <Section kicker="the two scores (made plain)" title="How to read the numbers">
          <p className="mb-4 max-w-2xl text-sm text-zinc-600">
            Two scores do the work. <span className="font-semibold">MoveFid</span> checks the overall <em>blend</em> of
            moves; <span className="font-semibold">CondAgree</span> checks the <em>right move at the right moment</em>.
            Neither is trustworthy alone — here’s why.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              name="MoveFid" plain="right-mix score (0–100)"
              oneLiner="How closely the simulator’s overall blend of move-types matches the blend real developers produce. 100 = identical blend."
              why="If the simulator never reports bugs or never pushes back, the coding agent only ever gets tested on easy days. MoveFid checks the diet."
              example={<>A simulator that hits the real proportions (approve <Mono>24%</Mono>, new work <Mono>20%</Mono>, bug report <Mono>13%</Mono>, pushback <Mono>11%</Mono>…) scores high.</>}
              gotcha={<>It only looks at the <em>overall</em> blend, not timing — so it’s gameable. A brainless sampler that just draws from the real mix <span className="font-semibold">tops the chart at 84.3</span> with zero situational skill.</>}
            />
            <MetricCard
              name="CondAgree" plain="right-move-right-place (0–1)"
              oneLiner="Of the 54 real moments, the fraction where the simulator made the very same move the real developer made at that exact moment."
              why="Matching the average blend is cheap; reacting correctly turn-by-turn is the real test. At this point in this conversation, did the simulator do what the human did?"
              example={<>Gemini-3.1-Pro with a profile scores <Mono>0.333</Mono> — the real developer’s exact move at about a third of the moments. The dumb sampler scores only <Mono>0.185</Mono>.</>}
              gotcha={<>A third sounds low, but it’s a 7-way choice — the bar isn’t 50%, it’s the lucky-guess line (next). And high CondAgree ≠ well-behaved: Gemini leads here yet approves <Mono>72%</Mono>.</>}
            />
            <MetricCard
              name="lucky-guess line" plain="the 0.163 reference (Σp²)"
              oneLiner="The CondAgree you’d get by blindly guessing moves from the real mix, understanding nothing about the moment — so anything clearly above it means real situational skill."
              why="A CondAgree number is meaningless without a reference. This is it: beat 0.163 and the simulator is actually reading the situation."
              example={<>Guess “approve” ~24% of the time while the dev also approves ~24%, sum that lucky overlap over all 7 moves → <Mono>0.163</Mono>. The with-profile models hit <Mono>0.278–0.333</Mono> (≈2× the line).</>}
              gotcha={<>Clearing it by a hair is noise. And a model can beat the line yet still approve far too often — the line says “has skill,” not “behaves like a developer.” Even a constant “always approve” clears it (<Mono>0.241</Mono>).</>}
            />
            <MetricCard
              name="approve% / critical%" plain="the temperament check"
              oneLiner={<>The simulator’s own rate of saying “looks good” (approve%) vs. saying something’s wrong — pushback + interrupt + bug report (critical%) — against the real <Mono>24%</Mono> and <Mono>33%</Mono>.</>}
              why="The quickest read on whether a simulator behaves like a real developer or a pushover. Too much approval, too little objection = the agent looks better than it is."
              example={<>No-profile GPT-5 is uncannily calibrated on approval (<Mono>24.5%</Mono>) but critical only <Mono>11.3%</Mono>. With-profile Gemini approves <Mono>72.2%</Mono> (3× real).</>}
              gotcha={<>The two numbers flatter independently — GPT-5’s approval looks perfect while its criticism is far too low. Always read <span className="font-semibold">both</span>, against <Mono>24%</Mono>/<Mono>33%</Mono>.</>}
            />
          </div>
        </Section>

        {/* VISUAL A — approve / critical comparison */}
        <Section kicker="the headline, in two pictures" title="Every model is too polite">
          <p className="mb-5 max-w-2xl text-sm text-zinc-600">
            Read against the dashed real-developer lines. On <span className="font-semibold">approve%</span>, every live
            model sits at or past <Mono>24%</Mono>. On <span className="font-semibold">critical%</span>, every live model
            falls short of <Mono>33%</Mono>.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">approve% <span className="font-normal text-emerald-600">— dashed line = real 24%</span></div>
              <RateBar label="deepseek" sub="profile" value={42.6} color="bg-blue-500" baseline={REAL.approve} />
              <RateBar label="deepseek" sub="no profile" value={49.1} color="bg-blue-500" baseline={REAL.approve} />
              <RateBar label="gpt-5" sub="profile" value={38.9} color="bg-blue-500" baseline={REAL.approve} />
              <RateBar label="gpt-5" sub="no profile" value={24.5} color="bg-emerald-500" baseline={REAL.approve} flag="best-calibrated" />
              <RateBar label="gemini" sub="profile" value={72.2} color="bg-amber-500" baseline={REAL.approve} />
              <RateBar label="gemini" sub="no profile" value={66.7} color="bg-amber-500" baseline={REAL.approve} />
              <RateBar label="prior_sampler" sub="ref" value={20.4} color="bg-zinc-300" baseline={REAL.approve} />
              <RateBar label="always_approve" sub="ref" value={100} color="bg-zinc-300" baseline={REAL.approve} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-700">critical% <span className="font-normal text-emerald-600">— dashed line = real 33%</span></div>
              <RateBar label="deepseek" sub="profile" value={9.3} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="deepseek" sub="no profile" value={5.7} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="gpt-5" sub="profile" value={3.7} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="gpt-5" sub="no profile" value={11.3} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="gemini" sub="profile" value={3.7} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="gemini" sub="no profile" value={11.1} color="bg-amber-500" baseline={REAL.critical} />
              <RateBar label="prior_sampler" sub="ref" value={35.2} color="bg-zinc-400" baseline={REAL.critical} />
              <RateBar label="always_approve" sub="ref" value={0} color="bg-zinc-300" baseline={REAL.critical} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Only the dumb <Mono>prior_sampler</Mono> reaches the real critical rate (<Mono>35.2%</Mono>), and only{" "}
            <Mono>always_approve</Mono> hits <Mono>100%</Mono> approve. The real models are bunched in between — too polite.
          </p>
        </Section>

        {/* LEADERBOARD */}
        <Section kicker="all the numbers" title="Leaderboard">
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
                {live.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-2"><Mono className="text-zinc-900">{r.model}</Mono></td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.mode === "with-profile" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"}`}>{r.mode}</span>
                    </td>
                    <td className="px-3 py-2 text-right"><Mono>{r.moveFid.toFixed(1)}</Mono></td>
                    <td className="px-3 py-2 text-right">
                      <Mono className={r.condAgree > LUCKY + 0.03 ? "text-emerald-700" : "text-zinc-500"}>{r.condAgree.toFixed(3)}</Mono>
                    </td>
                    <td className="px-3 py-2 text-right"><Mono className={Math.abs(r.approve - REAL.approve) <= 5 ? "text-emerald-700" : "text-zinc-900"}>{r.approve}%</Mono></td>
                    <td className="px-3 py-2 text-right"><Mono className="text-amber-700">{r.critical}%</Mono></td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td colSpan={6} className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">references — not real simulators</td>
                </tr>
                {refs.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100 bg-zinc-50/60 text-zinc-500">
                    <td className="px-3 py-2"><Mono>{r.model}</Mono></td>
                    <td className="px-3 py-2"><span className="text-[10px]">{r.mode}</span></td>
                    <td className="px-3 py-2 text-right">
                      <Mono>{r.moveFid.toFixed(1)}</Mono>{r.model === "prior_sampler" && <span className="text-amber-500" title="Tops MoveFid, but has no situational skill — see the lucky-guess line."> *</span>}
                    </td>
                    <td className="px-3 py-2 text-right"><Mono>{r.condAgree.toFixed(3)}</Mono></td>
                    <td className="px-3 py-2 text-right"><Mono>{r.approve}%</Mono></td>
                    <td className="px-3 py-2 text-right"><Mono>{r.critical}%</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            Read every row against the real <span className="font-semibold text-zinc-700">24% approve / 33% critical</span>.{" "}
            <Mono className="text-zinc-600">critical% = pushback + interrupt + bug report</Mono>; all percentages are out of
            54 moments (so 11% ≈ 6 turns). No single column names a winner: the highest CondAgree is with-profile Gemini
            (<Mono>0.333</Mono>) — yet it approves <Mono>72.2%</Mono>. The highest MoveFid is the dumb <Mono>prior_sampler</Mono>{" "}
            (<Mono>84.3 *</Mono>), which has no situational skill at all. Live models top out near MoveFid 54, so ~50 is
            middling, not strong. One generation per cell — treat small row-to-row gaps as noise; the easy-mode pattern is the robust signal.
          </p>
        </Section>

        {/* VISUAL B — the trap */}
        <Section kicker="why one number lies" title="The dumb-sampler trap">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <Scatter />
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            <Mono>prior_sampler</Mono> just draws moves from the real mix — so it <em>wins</em> MoveFid (<Mono>84.3</Mono>,
            far right) but lands on the lucky-guess line (<Mono>0.185 ≈ 0.163</Mono>): no idea what’s happening at any
            given moment. The real models score lower MoveFid yet sit above the line — they read the moment.{" "}
            <span className="text-zinc-700">High MoveFid is gameable; the pair is not.</span> (Even <Mono>always_approve</Mono>{" "}
            clears the line at <Mono>0.241</Mono> — so the line is a floor, not a finish line.)
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
              <span>· amber dashed = lucky-guess line (0.163)</span>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-zinc-500">
            Giving the simulator a profile of the specific developer raises right-move-right-place for all three
            (DeepSeek gains most, <Mono>+0.126</Mono>). But it doesn’t cure easy mode: for GPT-5 and Gemini the profile
            makes them approve <em>even more</em> (<Mono>24.5→38.9%</Mono>, <Mono>66.7→72.2%</Mono>).
          </p>
        </Section>

        {/* VISUAL D — transfer */}
        <Section kicker="from customer-service to coding" title="How strengths carry over from prior work">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: best simulator (USI 76.0)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">DeepSeek-V3.1</div>
              <p className="mt-2 text-xs text-zinc-700">The most <span className="font-semibold">coachable</span> — biggest profile gain (<Mono className="text-emerald-700">+0.126</Mono>) and the top with-profile MoveFid (<Mono>53.9</Mono>).</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: strong, not best (USI ~70.9)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">GPT-5</div>
              <p className="mt-2 text-xs text-zinc-700">Best-calibrated approve rate with no profile (<Mono>24.5%</Mono> ≈ real 24%) — yet still barely pushes back (critical <Mono className="text-amber-700">11.3%</Mono>).</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">prior work: most human-like</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">Gemini-3.1-Pro</div>
              <p className="mt-2 text-xs text-zinc-700">The <span className="font-semibold">worst</span> easy-mode offender — approves <Mono className="text-amber-700">72.2%</Mono>, ~3× real. Sounding human ≠ behaving like a developer.</p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-700">
            <span className="font-semibold">Bottom line.</span> Today’s top models are too polite to stand in for real
            developers: they rarely push back the way real people do. And being good at <em>sounding human</em>, or at
            simulating <em>customers</em>, does not make a model good at simulating a <em>coder</em>.
          </p>
        </Section>

        {/* CAVEATS */}
        <Section title="Caveats">
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
            This rests on 54 moments from 9 users, with one generation per cell (so no error bars — treat tiny gaps as
            noise), moves labeled by a single AI classifier (<Mono>claude-haiku-4.5</Mono>, whose errors bound every
            number), percentages that exclude the small “other” move category and so may not sum to exactly 100%, and a{" "}
            <span className="font-semibold text-zinc-600">request-side</span> setup — we held the real coding agent fixed
            and asked for the developer’s next message, rather than letting the simulator drive a live agent and measuring
            task outcomes. The easy-mode effect, though, is large and consistent across every live model.
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
