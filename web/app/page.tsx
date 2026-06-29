// SWESimBench: explanatory walkthrough centered on CondAgree.
// Content: workflow-drafted + fact-checked against bench/profileopt/experiments/condagree_multi/
// {summary,manifest,taxonomy,splits,cases}.json. Chart data = summary.json (9 models x ±profile).

import type { ReactNode } from "react";

const LUCKY = 0.419;

/* ----------------------------- chart data ----------------------------- */
type M = { id: string; label: string; note: string; kind: "general" | "specialized"; hidden?: boolean; np: { ca: number; ci: number }; wp: { ca: number; ci: number } };
const MODELS: M[] = [
  { id: "glm-5.2", label: "GLM-5.2", note: "[max]", kind: "general", np: { ca: 0.46, ci: 0.075 }, wp: { ca: 0.559, ci: 0.075 } },
  { id: "gpt-5.5", label: "GPT-5.5", note: "[xhigh]", kind: "general", np: { ca: 0.546, ci: 0.077 }, wp: { ca: 0.53, ci: 0.101 } },
  { id: "gemini-3.1-pro", label: "Gemini-3.1-Pro", note: "[high]", kind: "general", np: { ca: 0.522, ci: 0.09 }, wp: { ca: 0.51, ci: 0.084 } },
  { id: "deepseek-v4-pro", label: "DeepSeek-V4-Pro", note: "[max]", kind: "general", np: { ca: 0.487, ci: 0.089 }, wp: { ca: 0.526, ci: 0.076 } },
  { id: "deepseek-v4-flash", label: "DeepSeek-V4-Flash", note: "[low]", kind: "general", hidden: true, np: { ca: 0.496, ci: 0.075 }, wp: { ca: 0.507, ci: 0.098 } },
  { id: "claude-opus-4.8", label: "Claude-Opus-4.8", note: "[xhigh]", kind: "general", np: { ca: 0.464, ci: 0.085 }, wp: { ca: 0.487, ci: 0.09 } },
  { id: "deepseek-v3.1", label: "DeepSeek-V3.1", note: "[low]", kind: "general", hidden: true, np: { ca: 0.511, ci: 0.075 }, wp: { ca: 0.485, ci: 0.091 } },
  { id: "osim-8b", label: "OSim-8B", note: "", kind: "specialized", np: { ca: 0.427, ci: 0.064 }, wp: { ca: 0.476, ci: 0.072 } },
  { id: "osim-4b", label: "OSim-4B", note: "", kind: "specialized", np: { ca: 0.388, ci: 0.064 }, wp: { ca: 0.461, ci: 0.073 } },
];
const MOVE_MIX = [
  { move: "directive", pct: 51.8, color: "bg-blue-400" },
  { move: "critical", pct: 27.8, color: "bg-rose-400" },
  { move: "approve", pct: 12.1, color: "bg-zinc-400" },
  { move: "inquiry", pct: 8.4, color: "bg-emerald-400" },
];
// per-move agree-rate (recall): of moments whose real move was X, how often the sim matched.
// d = profile minus no-profile; wp = with-profile rate. Source: bench/profileopt/category_recall.json
const CATS = ["approve", "critical", "directive", "inquiry"] as const;
const CAT = {
  freq: { approve: 0.121, critical: 0.278, directive: 0.518, inquiry: 0.084 },
  rows: [
    { id: "glm-5.2", label: "GLM-5.2", d: { approve: 0.155, critical: 0.086, directive: 0.112, inquiry: 0.05 }, wp: { approve: 0.414, critical: 0.328, directive: 0.826, inquiry: 0.1 } },
    { id: "osim-4b", label: "OSim-4B", d: { approve: 0.087, critical: 0.09, directive: 0.105, inquiry: -0.125 }, wp: { approve: 0.259, critical: 0.338, directive: 0.657, inquiry: 0.05 } },
    { id: "osim-8b", label: "OSim-8B", d: { approve: 0.138, critical: 0.136, directive: 0.028, inquiry: -0.2 }, wp: { approve: 0.345, critical: 0.331, directive: 0.681, inquiry: 0.1 } },
    { id: "claude-opus-4.8", label: "Claude-Opus-4.8", d: { approve: 0.0, critical: -0.026, directive: 0.064, inquiry: -0.023 }, wp: { approve: 0.155, critical: 0.451, directive: 0.681, inquiry: 0.077 } },
    { id: "deepseek-v4-pro", label: "DeepSeek-V4-Pro", d: { approve: 0.069, critical: -0.047, directive: 0.052, inquiry: 0.1 }, wp: { approve: 0.397, critical: 0.248, directive: 0.782, inquiry: 0.125 } },
    { id: "deepseek-v4-flash", label: "DeepSeek-V4-Flash", d: { approve: 0.138, critical: 0.03, directive: -0.04, inquiry: 0.028 }, wp: { approve: 0.345, critical: 0.271, directive: 0.742, inquiry: 0.128 } },
    { id: "gemini-3.1-pro", label: "Gemini-3.1-Pro", d: { approve: 0.034, critical: -0.037, directive: -0.004, inquiry: 0.0 }, wp: { approve: 0.362, critical: 0.226, directive: 0.806, inquiry: 0.025 } },
    { id: "deepseek-v3.1", label: "DeepSeek-V3.1", d: { approve: 0.121, critical: 0.053, directive: -0.085, inquiry: -0.025 }, wp: { approve: 0.328, critical: 0.211, directive: 0.77, inquiry: 0.075 } },
    { id: "gpt-5.5", label: "GPT-5.5", d: { approve: -0.017, critical: -0.06, directive: -0.009, inquiry: 0.025 }, wp: { approve: 0.328, critical: 0.286, directive: 0.81, inquiry: 0.075 } },
  ],
};
// avg words per message, no-profile (np) vs with-profile (wp). Source: bench/profileopt/verbosity.json
const VERB = {
  devMedian: 18, // typical real developer message (median; mean is 63, a long tail of spec/code dumps)
  rows: [
    { id: "osim-4b", label: "OSim-4B", kind: "specialized", np: 63.1, wp: 38.3 },
    { id: "osim-8b", label: "OSim-8B", kind: "specialized", np: 61.5, wp: 52.0 },
    { id: "glm-5.2", label: "GLM-5.2", kind: "general", np: 34.8, wp: 12.9 },
    { id: "deepseek-v3.1", label: "DeepSeek-V3.1", kind: "general", np: 27.9, wp: 15.3 },
    { id: "deepseek-v4-flash", label: "DeepSeek-V4-Flash", kind: "general", np: 26.4, wp: 11.5 },
    { id: "claude-opus-4.8", label: "Claude-Opus-4.8", kind: "general", np: 25.4, wp: 19.8 },
    { id: "gpt-5.5", label: "GPT-5.5", kind: "general", np: 21.4, wp: 11.0 },
    { id: "deepseek-v4-pro", label: "DeepSeek-V4-Pro", kind: "general", np: 16.9, wp: 7.9 },
    { id: "gemini-3.1-pro", label: "Gemini-3.1-Pro", kind: "general", np: 15.9, wp: 10.0 },
  ],
};

// contrastive-prefix ablation: real persona vs a content-free "be terse, no questions" prefix.
// Source: bench/profileopt/ablation.json
const ABL = [
  { id: "glm-5.2", label: "GLM-5.2", generic: 0.46, persona: 0.559, style: 0.484, accent: "bg-teal-500" },
  { id: "gpt-5.5", label: "GPT-5.5", generic: 0.546, persona: 0.53, style: 0.463, accent: "bg-indigo-400" },
];

/* ----------------------------- primitives ----------------------------- */
function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}
const MOVE_STYLE: Record<string, string> = {
  approve: "bg-zinc-200 text-zinc-700", critical: "bg-rose-100 text-rose-700",
  directive: "bg-blue-100 text-blue-700", inquiry: "bg-emerald-100 text-emerald-700",
};
function Move({ m }: { m: string }) {
  const key = m.split(" ")[0];
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${MOVE_STYLE[key] ?? "bg-zinc-100 text-zinc-500"}`}>{m}</span>;
}
function Heading({ n, id, title }: { n?: string; id: string; title: string }) {
  return (
    <div className="group flex items-baseline gap-3">
      {n && <span className="font-mono text-xs text-zinc-300">{n}</span>}
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
        <a href={`#${id}`} className="decoration-zinc-300 underline-offset-4 hover:underline">{title}</a>
      </h2>
      <a href={`#${id}`} aria-label="link to this section" className="font-mono text-zinc-300 opacity-0 transition hover:text-zinc-500 group-hover:opacity-100">#</a>
    </div>
  );
}
function Section({ n, id, title, dek, children }: { n?: string; id: string; title: string; dek?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-zinc-200 pt-10">
      <Heading n={n} id={id} title={title} />
      {dek && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{dek}</p>}
      <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}

/* ----------------------------- the chart ------------------------------ */
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
function Leaderboard({ exclude = [] }: { exclude?: string[] }) {
  const rows = MODELS.filter((m) => !exclude.includes(m.id)).sort((a, b) => b.wp.ca - a.wp.ca);
  const delta = (m: M) => +(m.wp.ca - m.np.ca).toFixed(3);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-xs font-semibold text-zinc-700">CondAgree: right move, right moment (higher is better)</div>
        <div className="text-[10px] text-zinc-400">sorted by with-profile</div>
      </div>
      <div className="mb-3 text-[11px] text-zinc-400">dashed line = lucky-guess <Mono>{LUCKY}</Mono> · whisker = 95% CI across 20 developers · scale 0–0.75</div>
      {rows.map((m) => {
        const d = delta(m);
        const bar = m.kind === "specialized" ? "bg-violet-500" : "bg-indigo-500";
        const barLight = m.kind === "specialized" ? "bg-violet-300" : "bg-indigo-300";
        return (
          <div key={m.id} className="mb-3">
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-900">{m.label}</span>
              <span className="text-[10px] text-zinc-400">{m.note}</span>
              <span className={`ml-auto text-[11px] font-semibold ${d > 0.01 ? "text-emerald-600" : d < -0.01 ? "text-rose-500" : "text-zinc-400"}`}>profile Δ {d > 0 ? "+" : ""}{d}</span>
            </div>
            <CABar label="no profile" value={m.np.ca} ci={m.np.ci} color={barLight} />
            <CABar label="with profile" value={m.wp.ca} ci={m.wp.ci} color={bar} />
          </div>
        );
      })}
      <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span className="inline-block size-2 rounded-sm bg-violet-500 align-middle" /> OSim simulators ·
        <span className="ml-1 inline-block size-2 rounded-sm bg-indigo-500 align-middle" /> general models. Everything clears the
        lucky-guess line except <span className="text-amber-700">OSim-4B without a profile</span>.
      </p>
    </div>
  );
}
// diverging "profile effect" bars: how much CondAgree moves when the profile is added
function ProfileEffect({ exclude = [] }: { exclude?: string[] }) {
  const rows = MODELS.filter((m) => !exclude.includes(m.id)).map((m) => ({ ...m, d: +(m.wp.ca - m.np.ca).toFixed(3) })).sort((a, b) => b.d - a.d);
  const MAX = 0.1;
  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 text-xs font-semibold text-zinc-700">the profile effect: change in CondAgree when the developer's profile is added</div>
      <div className="mb-4 text-[11px] text-zinc-400">center = no effect · bar to the right = profile helps · bar to the left = profile hurts</div>
      {rows.map((m) => {
        const pos = m.d >= 0;
        const w = Math.min(1, Math.abs(m.d) / MAX) * 50;
        const benefits = pos && (m.kind === "specialized" || m.id === "glm-5.2");
        const color = benefits ? (m.kind === "specialized" ? "bg-violet-500" : "bg-teal-500") : pos ? "bg-zinc-300" : "bg-rose-400";
        return (
          <div key={m.id} className="flex items-center gap-2 py-0.5 text-xs">
            <div className="w-32 shrink-0 text-right font-mono text-[11px] text-zinc-700">{m.label}</div>
            <div className="relative h-4 flex-1">
              <div className="absolute inset-y-0 left-1/2 border-l border-zinc-300" />
              <div className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded ${color}`} style={pos ? { left: "50%", width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` }} />
            </div>
            <div className={`w-12 shrink-0 text-right font-mono text-[11px] ${benefits ? "font-semibold text-emerald-700" : pos ? "text-zinc-500" : "text-rose-600"}`}>{pos ? "+" : ""}{m.d}</div>
          </div>
        );
      })}
      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        The bars that reach right are the <span className="font-semibold text-violet-700">OSim models</span> and{" "}
        <span className="font-semibold text-teal-700">GLM-5.2</span>. The strongest general models sit on the center line or just left of it:
        a profile gives them almost nothing.
      </p>
    </div>
  );
}
// heatmap: per-move agree-rate, profile effect (Δ) as the tint + top number, with-profile rate as the small number
function catTint(d: number) {
  const a = Math.min(0.82, Math.abs(d) / 0.18);
  return d >= 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`;
}
function CategoryAgree({ exclude = [] }: { exclude?: string[] }) {
  const rows = CAT.rows.filter((r) => !exclude.includes(r.id));
  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 text-xs font-semibold text-zinc-700">profile effect by move category: change in agree-rate when the profile is added</div>
      <div className="mb-4 text-[11px] text-zinc-400">agree-rate(move) = of moments whose real move was that, how often the simulator matched · color and top number = profile Δ (green helps, red hurts) · small number = the with-profile rate</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="w-32" />
              {CATS.map((c) => (
                <th key={c} className="px-1 pb-1 align-bottom">
                  <div className="font-mono text-[11px] font-semibold text-zinc-700">{c}</div>
                  <div className="text-[9px] text-zinc-400">{Math.round(CAT.freq[c] * 100)}% of moves</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap pr-2 text-right font-mono text-[11px] text-zinc-700">{r.label}</td>
                {CATS.map((c) => {
                  const d = r.d[c];
                  return (
                    <td key={c} className="rounded" style={{ backgroundColor: catTint(d) }}>
                      <div className="px-1 py-1">
                        <div className={`font-mono text-[11px] font-semibold ${d > 0.005 ? "text-emerald-900" : d < -0.005 ? "text-rose-900" : "text-zinc-400"}`}>{d > 0 ? "+" : ""}{d.toFixed(2)}</div>
                        <div className="font-mono text-[9px] text-zinc-500">{r.wp[c].toFixed(2)}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span className="font-semibold text-teal-700">GLM-5.2</span> is the only model that improves on every move (its row is all green). The{" "}
        <span className="font-semibold text-violet-700">OSim</span> models gain on approve, critical, and directive but lose on the rare inquiry,
        as the profile stops them over-asking. The strongest general models (GPT-5.5, Gemini-3.1-Pro) barely move. Columns are weighted by how
        often developers actually make each move (directive 52%, inquiry only 8%).
      </p>
    </div>
  );
}

// average words/message, no-profile vs with-profile, with a developer-length reference line
function WordBar({ label, value, color, max, dev }: { label: string; value: number; color: string; max: number; dev: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <div className="w-20 shrink-0 text-right text-[10px] text-zinc-500">{label}</div>
      <div className="relative h-5 flex-1 rounded bg-zinc-100">
        <div className="absolute bottom-[-3px] top-[-3px] border-l-2 border-dashed border-zinc-500/70" style={{ left: `${(dev / max) * 100}%` }} />
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <div className="w-14 shrink-0 font-mono text-[11px] text-zinc-500">{value} w</div>
    </div>
  );
}
function Verbosity({ exclude = [] }: { exclude?: string[] }) {
  const rows = VERB.rows.filter((r) => !exclude.includes(r.id));
  const MAX = 65;
  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 text-xs font-semibold text-zinc-700">how wordy each simulator is: average words per message, with and without a profile</div>
      <div className="mb-3 text-[11px] text-zinc-400">dashed line = a typical developer message (≈{VERB.devMedian} words, median) · scale 0–{MAX} words</div>
      {rows.map((r) => {
        const bar = r.kind === "specialized" ? "bg-violet-500" : "bg-indigo-500";
        const light = r.kind === "specialized" ? "bg-violet-300" : "bg-indigo-300";
        return (
          <div key={r.id} className="mb-3">
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-900">{r.label}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-400">{r.np} → <span className="font-semibold text-zinc-700">{r.wp}</span> words</span>
            </div>
            <WordBar label="no profile" value={r.np} color={light} max={MAX} dev={VERB.devMedian} />
            <WordBar label="with profile" value={r.wp} color={bar} max={MAX} dev={VERB.devMedian} />
          </div>
        );
      })}
      <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        The profile makes every simulator terser, but length is a <em>symptom</em>, not the lever: GPT-5.5 also roughly halves its words and
        gets slightly <em>worse</em>, and GLM-5.2's longest no-profile messages actually agreed fine. What matters is <em>what</em> the extra
        words were. For GLM the profile strips out clarifying questions and assistant elaboration, but the ablation below shows that
        reflex-removal is only about a quarter of the story.
      </p>
    </div>
  );
}

// no-profile baseline: how good is each model as a simulator before any profile is added
function Baseline({ exclude = [] }: { exclude?: string[] }) {
  const rows = MODELS.filter((m) => !exclude.includes(m.id)).slice().sort((a, b) => b.np.ca - a.np.ca);
  const MAX = 0.75;
  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 text-xs font-semibold text-zinc-700">how good a simulator is each model with no profile? (no-profile CondAgree, ranked)</div>
      <div className="mb-3 text-[11px] text-zinc-400">dashed line = lucky-guess <Mono>{LUCKY}</Mono> · whisker = 95% CI across 20 developers · scale 0–{MAX}</div>
      {rows.map((m) => {
        const color = m.kind === "specialized" ? "bg-violet-400" : "bg-indigo-400";
        const lo = Math.max(0, m.np.ca - m.np.ci), hi = Math.min(MAX, m.np.ca + m.np.ci);
        return (
          <div key={m.id} className="flex items-center gap-2 py-0.5 text-xs">
            <div className="w-32 shrink-0 text-right"><span className="font-mono text-[11px] font-semibold text-zinc-900">{m.label}</span> <span className="text-[9px] text-zinc-400">{m.note}</span></div>
            <div className="relative h-5 flex-1 rounded bg-zinc-100">
              <div className="absolute bottom-[-3px] top-[-3px] border-l-2 border-dashed border-zinc-500/80" style={{ left: `${(LUCKY / MAX) * 100}%` }} />
              <div className={`h-full rounded ${color}`} style={{ width: `${(m.np.ca / MAX) * 100}%` }} />
              <div className="absolute top-1/2 h-[1.5px] -translate-y-1/2 bg-zinc-700/60" style={{ left: `${(lo / MAX) * 100}%`, width: `${((hi - lo) / MAX) * 100}%` }} />
            </div>
            <div className="w-12 shrink-0"><Mono className={m.np.ca > LUCKY ? "text-emerald-700" : "text-amber-700"}>{m.np.ca.toFixed(3)}</Mono></div>
          </div>
        );
      })}
      <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span className="inline-block size-2 rounded-sm bg-indigo-400 align-middle" /> general models ·
        <span className="ml-1 inline-block size-2 rounded-sm bg-violet-400 align-middle" /> OSim. Before any profile, the general
        frontier models are the better simulators and the small OSim models trail; <span className="text-amber-700">OSim-4B</span> is the only one
        below the chance line. (CIs overlap, so the top of the ranking is a cluster, not a clean winner.)
      </p>
    </div>
  );
}

// ablation: three prompts per model (no profile / real persona / content-free terse style)
function Ablation() {
  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 text-xs font-semibold text-zinc-700">does a content-free “be terse, don’t ask questions” prefix reproduce the gain?</div>
      <div className="mb-4 text-[11px] text-zinc-400">dashed line = lucky-guess <Mono>{LUCKY}</Mono> · CondAgree macro · three prompts per model</div>
      {ABL.map((r) => (
        <div key={r.id} className="mb-4">
          <div className="mb-0.5 font-mono text-xs font-semibold text-zinc-900">{r.label}</div>
          <CABar label="no profile" value={r.generic} ci={0} color="bg-zinc-300" />
          <CABar label="real persona" value={r.persona} ci={0} color={r.accent} />
          <CABar label="terse-only" value={r.style} ci={0} color="bg-amber-300" />
        </div>
      ))}
      <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        For <span className="font-semibold text-teal-700">GLM-5.2</span>, the content-free “terse, no questions” prefix
        (<span className="text-amber-700">terse-only</span>) suppresses the same over-asking (spurious inquiry 0.11→0.03) but recovers only
        about a <span className="font-semibold">quarter</span> of the real persona's gain, and it <em>craters</em> critical recall (0.24→0.17)
        because it doesn't know <em>when</em> this developer pushes back. The other three-quarters is developer-specific content. For GPT-5.5,
        every prefix hurts: it was already near its ceiling.
      </p>
    </div>
  );
}

/* ----------------------------- visuals -------------------------------- */
function Box({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-zinc-700 ${className}`}>{children}</div>;
}
const Arrow = () => <div className="select-none text-center text-sm text-zinc-300">↓</div>;

function SplitVisual() {
  const bins = [
    { k: "train", v: "135 dev · 140 repo · 1232 sess", c: "bg-indigo-50 border-indigo-200" },
    { k: "val", v: "23 · 21 · 436", c: "bg-amber-50 border-amber-200" },
    { k: "test", v: "31 · 26 · 2240", c: "bg-emerald-50 border-emerald-200" },
  ];
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[11px]">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">component split: no shared developer or repo</div>
      <p className="mb-3 text-zinc-500">a <span className="font-semibold text-zinc-700">component</span> = a developer + every repo they touched + every other developer on those repos. Whole components drop into one split.</p>
      <div className="grid grid-cols-3 gap-2">
        {bins.map((b) => (
          <div key={b.k} className={`rounded-md border ${b.c} p-2`}>
            <div className="font-mono text-xs font-semibold text-zinc-800">{b.k}</div>
            <div className="mt-0.5 text-zinc-600">{b.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-zinc-400">162 components · largest only 16 dev / 3 repos · <span className="text-zinc-600">0 shared developers, 0 shared repos</span> · 20 qualifying eval-developers each in val & test</div>
      <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">per-developer time split</div>
      <div className="flex items-stretch gap-1 overflow-hidden rounded-md">
        <div className="flex-1 bg-indigo-100 px-2 py-1.5 text-indigo-800">← earlier sessions → <span className="font-semibold">distill the profile</span></div>
        <div className="flex-1 bg-emerald-100 px-2 py-1.5 text-right text-emerald-800"><span className="font-semibold">later held-out turns</span> → scored here →</div>
      </div>
      <div className="mt-1 text-zinc-400">the profile only feeds forward; the model never sees the turns it's graded on.</div>
    </div>
  );
}

function EvalVisual() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="mx-auto max-w-md">
        <Box className="text-center"><span className="font-mono text-[10px] text-zinc-400">a moment</span><br />conversation so far (agent's latest turn + history)</Box>
        <Arrow />
        <div className="grid grid-cols-2 gap-2">
          <Box className="border-indigo-200"><span className="font-semibold text-indigo-700">with profile</span><br /><span className="text-zinc-500">[persona prefix] + conversation + task</span></Box>
          <Box className="border-zinc-300"><span className="font-semibold text-zinc-600">without profile</span><br /><span className="text-zinc-500">[generic prompt] + conversation + task</span></Box>
        </div>
        <Arrow />
        <Box className="text-center text-zinc-600">frozen simulator → <span className="text-zinc-800">developer's next message</span> <span className="text-zinc-400">(1 trial, no resampling)</span></Box>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-2 text-center text-[11px] text-zinc-500">
        <Mono className="text-zinc-700">20 developers × ≤30 moments = 480</Mono> × <Mono className="text-zinc-700">2 conditions</Mono> × <Mono className="text-zinc-700">9 simulators</Mono> = <Mono className="font-semibold text-zinc-900">8,640 generations</Mono>
        <div className="mt-1 text-[10px] text-zinc-400">7 general via OpenRouter · 2 (osim-4b/8b) via Modal</div>
      </div>
    </div>
  );
}

function MovesTable() {
  const rows = [
    ["approve", "accepts or permits, no new content, no complaint"],
    ["critical", "asserts something is WRONG: a bug, a failure, or an unwanted approach"],
    ["directive", "tells the agent what to do next, no fault asserted"],
    ["inquiry", "asks for information, expecting an answer"],
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <div className="bg-zinc-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">the four moves</div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([m, t]) => (
            <tr key={m} className="border-t border-zinc-100">
              <td className="w-28 px-3 py-2 align-top"><Move m={m} /></td>
              <td className="px-3 py-2 text-zinc-600">{t}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
        <span className="font-semibold text-zinc-500">fault-first rule:</span> if any fault is asserted it's <Move m="critical" /> even when a directive is also present (“this is broken, revert it” → critical). Interrupts are a separate regex marker. The old 7-way collapsed to 4 lifted cross-family κ <Mono>0.681 → 0.805</Mono>.
      </div>
    </div>
  );
}

function MetricVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400">the moment</div>
        <Box className="bg-zinc-50 text-zinc-600">agent: “I refactored the auth handler and all tests pass. Want me to open the PR?”</Box>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-zinc-200 p-2.5 text-xs">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">real developer</div>
            <div className="text-zinc-700">“hold on, you dropped the rate-limit check”</div>
            <div className="mt-1"><Move m="critical" /></div>
          </div>
          <div className="rounded-md border border-zinc-200 p-2.5 text-xs">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">simulator</div>
            <div className="text-zinc-700">“looks good, go ahead and open it”</div>
            <div className="mt-1"><Move m="approve" /></div>
          </div>
        </div>
        <div className="mt-2 text-center text-[11px] font-semibold text-rose-600">critical ≠ approve → MISS</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">and a hit:</span>
          real “now add tests for the 403 path” <Move m="directive" /> · sim “can you also cover the 403 case?” <Move m="directive" />
          <span className="font-semibold text-emerald-600">→ HIT</span>
          <span className="w-full text-[10px] text-zinc-400">wording differs, the move matches. That's the point.</span>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 text-[11px] text-zinc-500">why the chance line is high, since these developers are directive-heavy:</div>
        <div className="flex h-6 w-full overflow-hidden rounded">
          {MOVE_MIX.map((m) => <div key={m.move} className={m.color} style={{ width: `${m.pct}%` }} title={`${m.move} ${m.pct}%`} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
          {MOVE_MIX.map((m) => <span key={m.move} className="inline-flex items-center gap-1"><span className={`inline-block size-2 rounded-sm ${m.color}`} />{m.move} <Mono className="text-zinc-500">{m.pct}%</Mono></span>)}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">CondAgree = HITs ÷ moments, per developer, averaged over 20 · lucky-guess line = Σp² of the mix = <Mono className="text-zinc-600">0.419</Mono></div>
      </div>
    </div>
  );
}

/* --------------------------- case study ------------------------------- */
const VICTOR = [
  { m: "glm-5.2", a: 0.433, b: 0.633, d: "+0.20" },
  { m: "gemini-3.1-pro", a: 0.700, b: 0.600, d: "−0.10" },
  { m: "osim-4b", a: 0.267, b: 0.600, d: "+0.33" },
];
const CASES = [
  { name: "glm-5.2", up: true, effect: "+0.20 here (0.433 → 0.633) · helps broadly (80 wins / 31 losses across developers)",
    mechanism: "A capable generalist that reads the situation but defaults to a polite, neutral voice. The profile supplies Victor's actual temperament (insistent, willing to push back), so it takes the critical stance instead of softening into a clarification.",
    agent: "“The only place clearFilesystemPrompt is called is at line 959, and it's already guarded…” (pushing back, implying nothing is wrong)",
    real: ["“If we find that there are carry over files, we should not delete the prompt.txt from the metadata” (insistent, repeats himself).", "critical"],
    profile: ["“😭 I've said this three times. Do not delete prompt.txt when there are carry over files. Fix it.”", "critical (MATCH)"],
    generic: ["a long, polite re-clarification of the requirement.", "directive (MISS)"],
    reads: "the profile transplants Victor's voice, so GLM pushes back where the generic prompt only re-explains." },
  { name: "gemini-3.1-pro", up: false, effect: "−0.10 here (0.700 → 0.600) · a wash overall (61 wins / 65 losses)",
    mechanism: "Already reads the moment well. Without a profile it picks Victor's move correctly on its own. The profile gives it nothing to fix and instead makes it over-think: it narrates the task framing to itself and breaks character.",
    agent: "“All done. 9 files modified, ~87 stderr prints replaced…”",
    real: ["gives a concrete next instruction: a replacement list / “run the grep and commit”.", "directive"],
    profile: ["“No, wait. If the conversation provided ends with [DEVELOPER]:… and I am to ‘Write the developer's NEXT message’… maybe I should just output the git command because Victor assumes…”", "mis-move (MISS)"],
    generic: ["“Run the grep command to verify no matches are found, and if it's clean, go ahead and commit the changes with a descriptive message.”", "directive (MATCH)"],
    reads: "without the profile it just gives the next instruction; with it, the persona prefix distracts it into leaking the task framing." },
  { name: "osim-4b", up: true, effect: "+0.33 here (0.267 → 0.600) · big net positive but noisy (111 wins / 73 losses)",
    mechanism: "A small simulator whose default failure is sycophancy: it rubber-stamps whatever the agent claims. The profile breaks that habit, so when the agent declares success it objects the way Victor does.",
    agent: "“All changes are complete and tests pass… Good job!” (claims success)",
    real: ["“I am discarding all those changes, I don't like this approach”", "critical"],
    profile: ["“fix mise run lint” (terse, demanding, like the real developer)", "critical (MATCH)"],
    generic: ["“Confirmed: all changes have been applied successfully and tests pass… Good job…” (rubber-stamps)", "approve (MISS)"],
    reads: "the generic model agrees with the agent's success claim; the profile makes the small model object instead." },
];
function Row({ label, text, move }: { label: string; text: string; move: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 py-1">
      <div className="text-right text-[10px] uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="text-xs text-zinc-700">{text} <span className="ml-1 inline-block"><Move m={move} /></span></div>
    </div>
  );
}
function CaseStudy() {
  return (
    <section id="case-study" className="scroll-mt-16 border-t border-zinc-200 pt-10">
      <Heading n="06" id="case-study" title="case study: one developer, three simulators, three different jobs" />
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">the profile helped GLM-5.2 and OSim-4B on <Mono>gtrrz-victor</Mono> but hurt Gemini-3.1-Pro, because it was fixing three different problems.</p>
      <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-zinc-700">
        <p>The chart shows profile lift varies by model. To see why, take one developer, <Mono>gtrrz-victor</Mono>, and watch three simulators predict his held-out moves. Same developer, same profile, opposite signs:</p>
      </div>

      {/* cross-model strip */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {VICTOR.map((v) => {
          const up = v.d.startsWith("+");
          return (
            <div key={v.m} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="font-mono text-xs font-semibold text-zinc-900">{v.m}</div>
              <div className="mt-1 flex items-baseline gap-1.5 text-sm">
                <Mono className="text-zinc-400">{v.a.toFixed(3)}</Mono>
                <span className="text-zinc-300">→</span>
                <Mono className={up ? "text-emerald-700" : "text-rose-600"}>{v.b.toFixed(3)}</Mono>
                <span className={`ml-auto text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>{v.d}</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-400">{up ? "profile helps" : "profile hurts"}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-zinc-700">
        Victor is blunt and insistent. He repeats himself, pushes back when the agent claims something works, and gives terse next-step orders. A good simulator of Victor has to be willing to say “no” and to keep saying it. For each model below: the effect, the mechanism, and a real moment where the agent had just spoken and the simulator had to write what Victor says next.
      </p>

      {/* per-model cards */}
      <div className="mt-4 space-y-3">
        {CASES.map((c) => (
          <div key={c.name} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-zinc-900">{c.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{c.up ? "profile helps" : "profile hurts"}</span>
              <span className="ml-auto text-[10px] text-zinc-400">{c.effect}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">{c.mechanism}</p>
            <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 p-2.5">
              <div className="text-[11px] italic text-zinc-500">{c.agent}</div>
              <div className="mt-1 divide-y divide-zinc-100">
                <Row label="real" text={c.real[0]} move={c.real[1]} />
                <Row label="+ profile" text={c.profile[0]} move={c.profile[1]} />
                <Row label="generic" text={c.generic[0]} move={c.generic[1]} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500"><span className="text-zinc-400">reads:</span> {c.reads}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 border-l-[3px] border-l-zinc-800 bg-zinc-50 p-4">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">the takeaway</div>
        <p className="text-[14px] leading-relaxed text-zinc-700">
          <span className="font-semibold text-zinc-900">The profile does different jobs.</span> For the small specialist (OSim-4B) it suppresses sycophancy: a reflexive <Move m="approve" /> becomes the <Move m="critical" /> Victor actually makes. For the capable generalist (GLM-5.2) it transplants the developer's voice and willingness to push back. For the already-strong reasoner (Gemini-3.1-Pro) there was nothing to fix, so the persona prefix just distracts it into over-thinking. So “does a profile help?” is the wrong question. The right one is: <span className="font-semibold text-zinc-900">what was wrong with this simulator in the first place?</span> A profile helps only insofar as it fixes that.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ sections ------------------------------ */
const SECTIONS = [
  { id: "split", n: "01", title: "the split", dek: "no developer and no repo crosses the train/val/test line, so a simulator can't have seen the style or codebase it's scored on.",
    paragraphs: [
      "We split developers into train, val, and test so that no developer and no repository appears in more than one split. If a model tuned on a developer's earlier sessions, or on their repo, then scoring it on that same developer or repo would measure recall, not simulation. To enforce this we build the bipartite user↔repo graph (an edge wherever a developer touched a repo) and take its connected components: one developer, every repo they touched, and every other developer on those repos collapse into a single component. Whole components go to one split, so no shared developer or repo can leak across the line. There are 162 components and they are small (the largest is only 16 developers across 3 repos), which keeps the split clean. The result is train 135 developers / 140 repos / 1232 sessions, val 23 / 21 / 436, and test 31 / 26 / 2240. 20 developers qualify for eval in val and test (≥6 sessions, ≥2 held-out sessions, ≥8 held-out turns).",
      "Each cutoff guards a different need. A developer needs enough sessions to distill a profile from (≥6), at least a couple of sessions held out so there is something to score that the profile was not built on (≥2), and enough held-out turns that their score is not pure noise (≥8), since each developer contributes a single averaged number to the headline metric.",
      "A second, orthogonal split runs per developer and is time-ordered. For each developer we distill the user profile (the persona prefix) only from their earlier sessions, and we score only on their later, held-out turns. So the model never sees the turns it is graded on, and the profile is never built from those turns. The two splits guard different leaks: the component split stops a developer's repo or style leaking across splits; the time split stops a developer's own future leaking into their profile.",
    ], visual: <SplitVisual /> },
  { id: "eval", n: "02", title: "the eval", dek: "20 test developers, 480 held-out moments, each simulator writes the developer's next message, with and without a profile.",
    paragraphs: [
      "We run the eval on the 20 test developers. For each one we pick up to 30 held-out moments (points in a real session where the developer actually spoke next) for 480 prediction points total. At each moment the simulator sees the real conversation up to that point: the coding agent's latest turn plus the history. Its job is to write what the developer says next. It never sees the message it is scored against.",
      "The prompt is [optional user profile] + conversation so far + task framing, and we run it two ways. WITH profile prepends a distilled persona prefix for that developer; WITHOUT uses a generic developer prompt. We freeze 9 simulators and have each generate all 480 moments in both conditions: 480 × 2 × 9 = 8,640 generations, one trial per cell, no resampling. Seven are general models served via OpenRouter at fixed reasoning efforts; two are small simulators, osim-4b and osim-8b, served via Modal. The next sections cover how we grade what comes back.",
    ], visual: <EvalVisual /> },
  { id: "moves", n: "03", title: "the moves", dek: "we grade the speech-act, not the wording, just four moves under a fault-first rule.",
    paragraphs: [
      "A developer can say “fix the null check” or “this crashes on empty input, handle it” and mean roughly the same thing: stop, something is wrong, change course. Grading the exact words punishes a simulator for picking a different but valid phrasing, and at the single-message level wording saturates: too many surface forms map to the same intent for the words to discriminate. So we grade the move: the speech-act behind the message.",
      "We started with a 7-way taxonomy (new_work, refine_redirect, pushback, bug_report, approve_proceed, question, other), but two pairs were inherently confusable: new_work vs refine_redirect both just tell the agent what to do next; pushback vs bug_report both assert a fault. Even strong judges disagreed on which side each message fell. Collapsing those pairs into directive and critical erases the lines nobody could draw reliably, and a fault-first rule settles the rest. That change raised cross-family inter-judge agreement (Cohen's κ across Haiku-4.5, Opus-4.8, and GPT-5) from 0.681 to 0.805, high enough that a single cheap judge (Haiku-4.5) can label everything, with no multi-judge voting.",
    ], visual: <MovesTable /> },
  { id: "metric", n: "04", title: "the metric", dek: "CondAgree: did the simulator make the right move, at the right moment, scored against chance.",
    paragraphs: [
      "CondAgree means “right move, right moment.” At each held-out moment we ask one thing: did the simulator's 4-way move match the move the real developer actually made there. For a single developer, CondAgree is the fraction of their moments that match; the headline number averages those per-developer fractions across all 20 test developers (a macro, so a chatty developer doesn't outweigh a quiet one), with a 95% CI (t, n=20).",
      "The key word is conditional. CondAgree scores whether you made the right move here, given the conversation so far, not whether your overall mix of moves looks plausible. A simulator that emits a realistic blend of approvals and directives, but fires them at the wrong moments, scores poorly. It has to react to the situation in front of it, turn by turn.",
      "To know whether a score is real skill, compare it to the lucky-guess line: a simulator that ignores the conversation and just samples from a developer's own typical move-mix will still, by chance, land on the real move sometimes. The expected hit rate is the collision probability (Σp²) of that mix, averaged across developers. Here that comes to 0.419. It's high because these developers are directive-heavy, so even blind guessing matches often. Beating 0.419 means the simulator is reading the moment, not parroting habits.",
    ], visual: <MetricVisual /> },
];

/* ------------------------------- page --------------------------------- */
export default function Page() {
  const nav = [["leaderboard", "leaderboard"], ["the split", "split"], ["the eval", "eval"], ["the moves", "moves"], ["the metric", "metric"], ["the results", "results"], ["case study", "case-study"], ["the ablation", "ablation"], ["the data", "data"]];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">SWESimBench</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <a href="/data" className="hover:text-zinc-900">data</a>
            <a href="https://github.com/AlienKevin/user-simulator" target="_blank" rel="noreferrer" className="hover:text-zinc-900">github</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        {/* HERO */}
        <div className="py-12">
          <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">one metric: CondAgree · 9 simulators</div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
            SWESimBench: how well can a model simulate a software engineer using a coding agent?
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            A <span className="font-semibold text-zinc-900">user simulator</span> stands in for the human developer so we can stress-test
            coding agents without a human in the loop. We score one thing, <span className="font-semibold">CondAgree</span>: at each real
            moment, did the simulator make the <em>same move</em> the developer made? The leaderboard is right below. Then this page walks
            the pipeline behind it: the leak-free split, the eval, the move taxonomy, the metric, and finally what a profile actually does,
            a case study of <em>why</em> it helps some simulators and hurts others.
          </p>
          <p className="mt-4 text-[13px] text-zinc-500">
            Every generation, label, and split is public.{" "}
            <a href="/data" className="font-semibold text-blue-700 underline-offset-2 hover:underline">Download the full data →</a>
          </p>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {nav.map(([t, h]) => <a key={h} href={`#${h}`} className="font-mono hover:text-zinc-900">{t}</a>)}
          </div>
        </div>

        <div className="space-y-10">
          <Section id="leaderboard" title="SWESimBench Leaderboard">
            <Leaderboard exclude={["deepseek-v3.1", "deepseek-v4-flash"]} />
          </Section>

          {SECTIONS.map((s) => (
            <Section key={s.id} n={s.n} id={s.id} title={s.title} dek={s.dek}>
              {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              <div className="pt-1">{s.visual}</div>
            </Section>
          ))}

          {/* RESULTS: the profile effect */}
          <Section n="05" id="results" title="the results" dek="profile helps the small simulators, but does little for the strongest general models, except for GLM-5.2.">
            <p>
              Start with the baseline: how good is each model as a user-simulator with no profile at all? Ranked by no-profile CondAgree,
              GPT-5.5 and Gemini-3.1-Pro lead (around 0.52 to 0.55) and every general model clears the 0.419 chance line; the small
              OSim simulators trail, with OSim-4B the only one below it. Note where GLM-5.2 sits: mid-pack at 0.46, one of the weaker general
              simulators out of the box. Hold that thought.
            </p>
            <Baseline exclude={["deepseek-v3.1", "deepseek-v4-flash"]} />
            <p>
              The rest of this section asks the sharper question: what does adding the developer's profile change? The chart below plots each
              model's profile effect, the change in CondAgree when the developer's profile is added. A profile clearly
              helps the OSim models (<span className="font-semibold text-violet-700">osim-4b +0.073</span>, which lifts it from
              below the lucky-guess line to above; osim-8b +0.049) and, most of all, <span className="font-semibold text-teal-700">GLM-5.2
              (+0.099)</span>, which vaults it from mid-pack to the top of the leaderboard. For the strongest general models it does nothing or
              slightly hurts: gpt-5.5 −0.016, gemini-3.1-pro −0.012, since they already read the situation from the conversation alone. With CIs
              of ±0.06–0.15 at n=20, treat individual lifts as suggestive, not settled.
            </p>
            <ProfileEffect exclude={["deepseek-v3.1", "deepseek-v4-flash"]} />
            <p>
              That single number hides where the lift comes from. Breaking the agree-rate down by the kind of move the developer made shows
              each model's profile is doing something different, move by move, the clearest tell for <em>why</em> it helps.
            </p>
            <CategoryAgree exclude={["deepseek-v3.1", "deepseek-v4-flash"]} />
            <p>
              One more lens: how much each simulator <em>says</em>. Without a profile, the simulators that gain most are also the wordiest, and
              the profile collapses them toward a real developer's terse style.
            </p>
            <Verbosity exclude={["deepseek-v3.1", "deepseek-v4-flash"]} />
            <p>
              So the headline average hides the real story: the profile is doing different jobs for different models. The next section takes
              one developer and three of these simulators to show exactly what those jobs are.
            </p>
          </Section>

          <CaseStudy />

          <Section n="07" id="ablation" title="the ablation: content, not just style" dek="we tested whether GLM's gain is generic reflex-suppression or developer-specific content. It is mostly content.">
            <p>
              The case study suggests a profile works by draining a generic “helpful assistant” reflex: GLM-5.2 kept asking clarifying
              questions the real developer never would. So we tested that directly. We replaced GLM's developer-specific persona with a
              content-free instruction, “you are a terse senior engineer; do not ask clarifying questions; reply in under 12 words,” and
              re-scored. If that reproduced the gain, the win was just reflex-suppression.
            </p>
            <Ablation />
            <p>
              It does not. The terse-only prefix suppresses the over-asking but recovers only about a quarter of GLM's +0.099, and it pushes
              the model the wrong way on the moves that matter: it stops asking questions, but it also stops knowing when this developer
              <em> pushes back</em>, so its critical recall falls instead of rising. The other three-quarters of the gain is the developer's
              actual behavior, which only the real profile carries.
            </p>
            <p>
              So the cleanest account of the whole picture: a profile is not extra knowledge bolted on; it is one specific developer's
              behavior that the simulator can imitate. It pays off only when two things hold at once. The model has to be <em>wrong in a
              fixable way</em> (GLM was a weak, generic-sounding simulator out of the box, with the most room of any general model), and it
              has to actually <em>adopt the persona</em> (GLM is highly steerable; Claude-Opus-4.8 barely shifts, so it barely gains). Models
              that were already accurate from the conversation alone, GPT-5.5 and Gemini-3.1-Pro, have nothing to fix, and any prefix, persona
              or generic, only gets in their way.
            </p>
          </Section>

          <Section n="08" id="data" title="the data: all of it is public">
            <p>
              Every number and chart on this page is reproducible from public trial data. Nine files cover the whole pipeline: the{" "}
              <Mono>summary</Mono> of results and the experiment <Mono>manifest</Mono>; the user- and repo-disjoint <Mono>splits</Mono> and the
              4-way <Mono>taxonomy</Mono> with its judge prompt; the 480 frozen <Mono>points</Mono> and the <Mono>raw</Mono> log of all 9,600+
              generations with every move label; and the <Mono>category</Mono>, <Mono>verbosity</Mono>, <Mono>cases</Mono>, and{" "}
              <Mono>ablation</Mono> breakdowns behind each chart.
            </p>
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-relaxed text-zinc-600">
                <div className="font-semibold text-zinc-900">Download any file, or point an agent at the catalog.</div>
                <div className="mt-0.5">A machine-readable <Mono>index.json</Mono> lists every file with its schema and a direct URL.</div>
              </div>
              <a href="/data" className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-zinc-700">
                Open the data page →
              </a>
            </div>
          </Section>
        </div>

        <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-400">
          SWESimBench · CondAgree on real{" "}
          <a href="https://huggingface.co/datasets/SALT-NLP/SWE-chat" className="hover:text-zinc-700">SWE-chat</a> sessions ·
          <a href="/data" className="hover:text-zinc-700"> download the data</a> ·
          built on <a href="https://github.com/cooperbench/user.skill" className="hover:text-zinc-700">cooperbench/user.skill</a>.
        </footer>
      </main>
    </div>
  );
}
