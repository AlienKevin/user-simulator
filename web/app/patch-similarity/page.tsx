"use client";

import { useEffect, useState } from "react";

type ScopeStats = {
  n: number;
  mean: number;
  p10: number;
  median: number;
  p90: number;
  exact_pct: number;
  zero_pct: number;
};

type DiffSample = {
  jaccard: number;
  task_a: string;
  task_b: string;
  model_a: string;
  model_b: string;
  trial_a: string;
  trial_b: string;
  diff_a: string;
  diff_b: string;
};

type Scope = {
  label: string;
  sublabel: string;
  stats: ScopeStats;
  hist: number[];
  stats_gold: ScopeStats;
  hist_gold: number[];
  samples: DiffSample[][];
  samples_gold: DiffSample[][];
};

type Threshold = {
  threshold: number;
  balanced_accuracy: number;
  precision: number;
  recall: number;
  accuracy: number;
};

type ModelStats = {
  model: string;
  n: number;
  mean: number;
  median: number;
  p90: number;
  exact_pct: number;
  zero_pct: number;
};

type ModelDiscrim = {
  model: string;
  n_pos: number;
  n_neg: number;
  auc: number;
  pos_median: number;
  pos_mean: number;
  neg_mean: number;
  auc_gold: number | null;
  delta: number | null;
  pos_gold_mean: number | null;
  neg_gold_mean: number | null;
  noise_median: number | null;
  noise_mean: number | null;
};

type AgentPilotPair = {
  trial_a: string;
  trial_b: string;
  task: string;
  model: string;
  line_jaccard: number;
  resolved_a: boolean | null;
  resolved_b: boolean | null;
  agent_similarity: number | null;
  agent_verdict: string | null;
  agent_reasoning: string | null;
  duration_ms: number | null;
  usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number } | null;
};
type AgentPilot = { description: string; pairs: AgentPilotPair[] };

type AgentComparePair = {
  a: string;
  b: string;
  task: string;
  model: string;
  kind: "pass_pass" | "pass_fail" | "fail_fail";
  line_jaccard: number;
  agent_similarity: number;
  agent_verdict: string | null;
  agent_reasoning: string | null;
  test_outcome_jaccard: number;
  resolved_a: boolean | null;
  resolved_b: boolean | null;
  equivalent_label: boolean;
};

type AgentCompareMetrics = {
  auc: number | null;
  best_threshold: {
    balanced_accuracy: number;
    threshold: number;
    precision: number;
    recall: number;
  } | null;
  mean_positive: number;
  mean_negative: number;
};

type AgentCompareDisagreement = {
  a: string;
  b: string;
  task: string;
  model: string;
  line_jaccard: number;
  agent_similarity: number;
  agent_verdict: string | null;
  agent_reasoning: string | null;
  truth: string;
  line_says: string;
  agent_says: string;
  winner: string;
  test_outcome_jaccard: number;
  kind: string;
};

type AgentCompareAtThreshold = {
  threshold: number;
  precision: number;
  recall: number;
  accuracy: number;
  balanced_accuracy?: number;
};

type AgentCompareSide = {
  auc: number | null;
  at_best_threshold: AgentCompareAtThreshold;
};

type AgentJudgeCompare = {
  description: string;
  n_pairs: number;
  n_positive: number;
  n_negative: number;
  line_metrics: AgentCompareMetrics;
  agent_metrics: AgentCompareMetrics;
  comparison: {
    ground_truth: string;
    threshold_note?: string;
    line_jaccard: AgentCompareSide;
    agent_judge: AgentCompareSide;
  };
  pairs: AgentComparePair[];
  disagreements: AgentCompareDisagreement[];
};

type Report = {
  overall: {
    agent: string;
    n_models: number;
    n_all_pass_cells: number;
    n_trials_used: number;
    corpus_size: number;
    metric: string;
    auc: number;
    best_threshold: Threshold;
  };
  hist_edges_labels: string[];
  scopes: { equivalent: Scope; different: Scope };
  per_model_within_cell: ModelStats[];
  per_model_discrimination: ModelDiscrim[];
};

type DiffTest = { test: string; a: "pass" | "fail"; b: "pass" | "fail" };
type Counterexample = {
  jaccard: number;
  kind: "pass_pass" | "pass_fail" | "fail_fail";
  task: string;
  model: string;
  trial_a: string;
  trial_b: string;
  resolved_a: boolean;
  resolved_b: boolean;
  diff_a: string;
  diff_b: string;
  n_diff_tests: number;
  diff_tests: DiffTest[];
};

type ReverseBucket = { count: number; divergent: number };
type CalibrationRow = {
  label: string;
  range: string;
  n: number;
  hist: number[];
  mean?: number;
  median?: number;
  p10?: number;
  p90?: number;
  zero_pct?: number;
  identical_pct?: number;
};

type ReverseReport = {
  description: string;
  agent: string;
  bucket_labels: string[];
  bucket_ranges: string[];
  breakdown: Record<
    "pass_pass" | "pass_fail" | "fail_fail",
    { n: number; buckets: ReverseBucket[]; divergence_rate: (number | null)[] }
  >;
  counterexamples_by_bucket: Record<string, Counterexample[]>;
  calibration: CalibrationRow[];
  patch_bucket_labels: string[];
  patch_bucket_ranges: string[];
};

function pct(n: number) {
  return `${Math.round(n)}%`;
}
function fmt(n: number, d = 2) {
  return n.toFixed(d);
}
function fmt3(n: number) {
  return n.toFixed(3);
}

const FRIENDLY_LABELS: { label: string; range: string }[] = [
  { label: "no overlap", range: "0%" },
  { label: "tiny", range: "1–10%" },
  { label: "small", range: "10–25%" },
  { label: "moderate", range: "25–50%" },
  { label: "substantial", range: "50–75%" },
  { label: "near-identical", range: "75–95%" },
  { label: "identical", range: "100%" },
];

type Scoring = "full" | "gold";

function DualHistogram({
  countsFull,
  countsGold,
  accent,
  selected,
  onSelect,
}: {
  countsFull: number[];
  countsGold: number[];
  accent: string;
  selected: { bucket: number; scoring: Scoring } | null;
  onSelect: (sel: { bucket: number; scoring: Scoring } | null) => void;
}) {
  const totalFull = countsFull.reduce((a, b) => a + b, 0) || 1;
  const totalGold = countsGold.reduce((a, b) => a + b, 0) || 1;
  const peak = Math.max(...countsFull, ...countsGold) || 1;

  // Color for the lighter (gold-only) sibling. Tailwind doesn't compose
  // arbitrary opacity classes from props, so use opacity utility.
  const lightOpacity = "opacity-40";

  function selSame(b: number, s: Scoring) {
    return selected && selected.bucket === b && selected.scoring === s;
  }

  return (
    <div>
      <div className="flex items-end justify-between text-xs text-zinc-500 mb-2 px-1">
        <span>← less overlap</span>
        <span className="font-medium text-zinc-600">line-Jaccard score</span>
        <span>more overlap →</span>
      </div>
      <div className="flex items-end gap-1.5 h-44 px-1">
        {FRIENDLY_LABELS.map((_, i) => {
          const cFull = countsFull[i] ?? 0;
          const cGold = countsGold[i] ?? 0;
          const hFull = (cFull / peak) * 100;
          const hGold = (cGold / peak) * 100;
          const shareFull = (cFull / totalFull) * 100;
          const shareGold = (cGold / totalGold) * 100;
          const selFull = selSame(i, "full");
          const selGold = selSame(i, "gold");
          const dimFull = selected !== null && !selFull;
          const dimGold = selected !== null && !selGold;

          return (
            <div key={i} className="flex-1 flex flex-col h-full">
              <div className="text-[10px] text-zinc-400 tabular-nums mb-1 text-center">
                {shareFull >= 1 ? `${shareFull.toFixed(0)}%` : ""}
              </div>
              <div className="flex-1 flex items-end justify-center gap-px">
                <button
                  type="button"
                  disabled={cFull === 0}
                  onClick={() =>
                    onSelect(selFull ? null : { bucket: i, scoring: "full" })
                  }
                  className={`w-1/2 self-end ${
                    cFull > 0 ? "cursor-pointer" : "cursor-default"
                  } group`}
                  title={
                    cFull > 0
                      ? `full diff · ${cFull.toLocaleString()} pairs (${shareFull.toFixed(1)}%)`
                      : "no pairs"
                  }
                  style={{ height: "100%" }}
                >
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-t ${accent} transition-all
                        ${dimFull ? "opacity-30" : "opacity-100"}
                        ${selFull ? "ring-2 ring-offset-1 ring-zinc-900" : ""}
                        ${cFull > 0 ? "group-hover:brightness-110" : "opacity-20"}`}
                      style={{ height: `${Math.max(hFull, 1.5)}%` }}
                    />
                  </div>
                </button>
                <button
                  type="button"
                  disabled={cGold === 0}
                  onClick={() =>
                    onSelect(selGold ? null : { bucket: i, scoring: "gold" })
                  }
                  className={`w-1/2 self-end ${
                    cGold > 0 ? "cursor-pointer" : "cursor-default"
                  } group`}
                  title={
                    cGold > 0
                      ? `gold-only · ${cGold.toLocaleString()} pairs (${shareGold.toFixed(1)}%)`
                      : "no pairs"
                  }
                  style={{ height: "100%" }}
                >
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-t ${accent} ${lightOpacity} transition-all
                        ${dimGold ? "opacity-10" : ""}
                        ${selGold ? "ring-2 ring-offset-1 ring-zinc-900" : ""}
                        ${cGold > 0 ? "group-hover:opacity-60" : "opacity-10"}`}
                      style={{ height: `${Math.max(hGold, 1.5)}%` }}
                    />
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 px-1 mt-2 border-t border-zinc-200 pt-2">
        {FRIENDLY_LABELS.map((lbl, i) => {
          const sel = selected !== null && selected.bucket === i;
          return (
            <div key={lbl.label} className="flex-1 text-center">
              <div
                className={`text-xs font-medium ${
                  sel ? "text-zinc-900" : "text-zinc-700"
                }`}
              >
                {lbl.label}
              </div>
              <div className="text-[10px] text-zinc-400 tabular-nums">{lbl.range}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${accent}`} />
          full diff ({totalFull.toLocaleString()})
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${accent} ${lightOpacity}`} />
          gold-path only ({totalGold.toLocaleString()})
        </span>
      </div>
      <div className="mt-1 text-xs text-zinc-400 text-center">
        click any bar to see example pairs scored under that view
      </div>
    </div>
  );
}

function DiffView({ diff, sharedLines }: { diff: string; sharedLines?: Set<string> }) {
  const lines = diff.split("\n");
  // Layout: outer <pre> is the horizontal scroll container; the inner wrapper
  // is `inline-block min-w-full` so it shrink-wraps to the widest content line
  // while staying at least as wide as the visible area. Each line is then a
  // block child of that wrapper, so its row background paints the full content
  // width when the user scrolls right (otherwise rows clip at the viewport).
  return (
    <pre className="text-[11px] font-mono overflow-x-auto bg-white border border-zinc-200 rounded max-h-[26rem] leading-snug">
      <div className="inline-block min-w-full py-2">
        {lines.map((line, i) => {
          let cls = "text-zinc-600";
          let mark = "";
          if (
            line.startsWith("diff --git") ||
            line.startsWith("--- ") ||
            line.startsWith("+++ ") ||
            line.startsWith("@@")
          ) {
            cls = "text-zinc-400";
          } else if (line.startsWith("+")) {
            const key = `+${line.slice(1).trim()}`;
            const shared = sharedLines && line.slice(1).trim() && sharedLines.has(key);
            cls = shared ? "bg-emerald-100 text-emerald-900" : "bg-emerald-50 text-emerald-800";
            mark = shared ? " ◆" : "";
          } else if (line.startsWith("-")) {
            const key = `-${line.slice(1).trim()}`;
            const shared = sharedLines && line.slice(1).trim() && sharedLines.has(key);
            cls = shared ? "bg-rose-100 text-rose-900" : "bg-rose-50 text-rose-800";
            mark = shared ? " ◆" : "";
          }
          return (
            <div key={i} className={`${cls} px-2 whitespace-pre`}>
              <span className="select-none text-zinc-300 mr-2 inline-block w-8 text-right">
                {i + 1}
              </span>
              {line || " "}
              {mark && <span className="text-zinc-400">{mark}</span>}
            </div>
          );
        })}
      </div>
    </pre>
  );
}

function extractAddRemoveLines(diff: string): Set<string> {
  const out = new Set<string>();
  for (const line of diff.split("\n")) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("@@")
    )
      continue;
    if (line.startsWith("+")) {
      const c = line.slice(1).trim();
      if (c) out.add(`+${c}`);
    } else if (line.startsWith("-")) {
      const c = line.slice(1).trim();
      if (c) out.add(`-${c}`);
    }
  }
  return out;
}

function SamplePanel({ samples, accent }: { samples: DiffSample[]; accent: string }) {
  if (!samples || samples.length === 0) {
    return (
      <div className="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 text-center">
        No example pairs in this bucket.
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-6">
      {samples.map((s, i) => {
        const setA = extractAddRemoveLines(s.diff_a);
        const setB = extractAddRemoveLines(s.diff_b);
        const shared = new Set<string>();
        for (const x of setA) if (setB.has(x)) shared.add(x);
        const sameTask = s.task_a === s.task_b;
        return (
          <div
            key={`${s.trial_a}-${s.trial_b}-${i}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-100 border-b border-zinc-200 text-xs">
              <div className="flex items-center gap-3 text-zinc-700">
                <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
                <span>
                  Example pair {i + 1} of {samples.length}
                </span>
                {sameTask && (
                  <span className="text-zinc-400">
                    · task <code className="text-zinc-700">{s.task_a}</code>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 tabular-nums text-zinc-600">
                <span>
                  similarity <strong className="text-zinc-900">{s.jaccard.toFixed(2)}</strong>
                </span>
                <span className="text-zinc-400">·</span>
                <span>{shared.size} shared line-edits</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
              <DiffPanel
                title="Trial A"
                task={s.task_a}
                model={s.model_a}
                trial={s.trial_a}
                diff={s.diff_a}
                sharedLines={shared}
                showTask={!sameTask}
              />
              <DiffPanel
                title="Trial B"
                task={s.task_b}
                model={s.model_b}
                trial={s.trial_b}
                diff={s.diff_b}
                sharedLines={shared}
                showTask={!sameTask}
              />
            </div>
            {shared.size > 0 && (
              <div className="px-4 py-2 border-t border-zinc-200 bg-white text-xs text-zinc-500">
                <span className="inline-block w-3 text-center text-zinc-400">◆</span>{" "}
                marks a line-edit present in both patches.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiffPanel({
  title,
  task,
  model,
  trial,
  diff,
  sharedLines,
  showTask,
}: {
  title: string;
  task: string;
  model: string;
  trial: string;
  diff: string;
  sharedLines: Set<string>;
  showTask: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {title}
          </span>
          <code className="text-[11px] text-zinc-500">{model}</code>
        </div>
        <code className="text-[10px] text-zinc-400">{trial.slice(0, 8)}</code>
      </div>
      {showTask && (
        <div className="text-[11px] text-zinc-500 mb-1">
          task <code className="text-zinc-700">{task}</code>
        </div>
      )}
      <DiffView diff={diff} sharedLines={sharedLines} />
    </div>
  );
}

function ScopeCard({
  title,
  subtitle,
  scope,
  accent,
  readout,
}: {
  title: string;
  subtitle: string;
  scope: Scope;
  accent: string;
  readout: React.ReactNode;
}) {
  const [selected, setSelected] = useState<{ bucket: number; scoring: Scoring } | null>(
    null
  );
  const samples =
    selected === null
      ? []
      : selected.scoring === "full"
      ? scope.samples?.[selected.bucket] ?? []
      : scope.samples_gold?.[selected.bucket] ?? [];
  return (
    <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6">
      <div className="flex items-baseline gap-3 mb-1">
        <div className={`inline-block h-2 w-2 rounded-full ${accent}`} />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-zinc-500 mb-5">{subtitle}</p>
      <DualHistogram
        countsFull={scope.hist}
        countsGold={scope.hist_gold}
        accent={accent}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
            full diff
          </div>
          <MiniStats stats={scope.stats} />
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
            gold-path only
          </div>
          <MiniStats stats={scope.stats_gold} />
        </div>
      </div>
      <div className="mt-5 text-sm leading-relaxed text-zinc-800">{readout}</div>
      {selected !== null && (
        <div className="mt-6 border-t border-zinc-200 pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-700">
              Examples from the{" "}
              <strong>{FRIENDLY_LABELS[selected.bucket].label}</strong> bucket
              <span className="text-zinc-400 ml-1">
                ({FRIENDLY_LABELS[selected.bucket].range})
              </span>
              <span className="ml-2 text-xs text-zinc-500">
                scoring:{" "}
                <strong className="text-zinc-700">
                  {selected.scoring === "full" ? "full diff" : "gold-path only"}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-zinc-500 hover:text-zinc-900 underline"
            >
              close
            </button>
          </div>
          <SamplePanel samples={samples} accent={accent} />
        </div>
      )}
    </section>
  );
}

function MiniStats({ stats }: { stats: ScopeStats }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <div className="text-zinc-500">pairs</div>
        <div className="font-medium tabular-nums">{stats.n.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-zinc-500">median</div>
        <div className="font-medium tabular-nums">{fmt(stats.median)}</div>
      </div>
      <div>
        <div className="text-zinc-500">identical</div>
        <div className="font-medium tabular-nums">{pct(stats.exact_pct)}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-medium text-zinc-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-zinc-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          accent ?? "text-zinc-900"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function ReverseSection({ rev }: { rev: ReverseReport }) {
  const [bucketIdx, setBucketIdx] = useState<number | null>(6);  // start on 'identical'

  // Compute headline counts
  const pf = rev.breakdown.pass_fail;
  const highJaccPF = (pf.buckets[5]?.count || 0) + (pf.buckets[6]?.count || 0);
  // Total pass-fail pairs (= pairs where one passed, one failed)
  const totalPF = pf.n;

  const identicalPF = pf.buckets[6]?.count || 0;
  const exemplars = bucketIdx !== null ? rev.counterexamples_by_bucket[String(bucketIdx)] || [] : [];

  return (
    <section className="mb-12">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
          Direction 1
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          Similar patch ⇒ similar behavior?
        </h2>
        <p className="text-sm text-zinc-700 mt-1">
          Look at high-Jaccard pairs and check whether their test outcomes
          agree.
        </p>
      </div>

      {/* Punchline card */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 mb-6">
        <h3 className="text-base font-semibold text-emerald-900 mb-2">
          Mostly yes — and the exceptions are benign.
        </h3>
        <p className="text-sm text-emerald-900 leading-relaxed">
          <strong>Most pairs at high Jaccard agree on test outcomes.</strong>{" "}
          Of the 23 fail-fail pairs at ≥ 75% Jaccard — the only pairs where
          outcome agreement is informative rather than forced by construction —
          every single one fails on the same set of tests. Similar patches
          usually behave the same way.
        </p>
        <p className="mt-3 text-sm text-emerald-900 leading-relaxed">
          The exceptions are rare and benign: the {identicalPF}{" "}
          identical-Jaccard pass-fail pairs are all infrastructure failures (one
          failed trial, 124 tests broken at collection time), and only{" "}
          <strong>{highJaccPF - identicalPF}</strong> genuinely semantic
          counterexample remains at high Jaccard — a one-line{" "}
          <code>now()</code> vs <code>utcnow()</code> swap that flips 2 tests.
          Use Jaccard as a strong indicator, not an oracle; click any row below
          to inspect the pairs.
        </p>
      </div>

      <h3 className="text-base font-semibold mb-2">
        Test-outcome divergence by Jaccard bucket
      </h3>
      <p className="text-sm text-zinc-700 mb-3">
        For each pair flavor, how many pairs land in each Jaccard bucket and how
        many have differing test outcomes. The Jaccard score below is computed
        on the +/- lines in the reconstructed unified diff; the divergence
        column counts pairs where the test-outcome vectors aren't identical.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Jaccard bucket</th>
              <th className="text-right px-3 py-2 font-medium">pass-pass</th>
              <th className="text-right px-3 py-2 font-medium">pass-fail</th>
              <th className="text-right px-3 py-2 font-medium">fail-fail</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rev.bucket_labels.map((label, i) => {
              const pp = rev.breakdown.pass_pass.buckets[i] || { count: 0, divergent: 0 };
              const pfb = rev.breakdown.pass_fail.buckets[i] || { count: 0, divergent: 0 };
              const ff = rev.breakdown.fail_fail.buckets[i] || { count: 0, divergent: 0 };
              const total = pp.count + pfb.count + ff.count;
              const hasCounterex = (rev.counterexamples_by_bucket[String(i)] || []).length > 0;
              const isSel = bucketIdx === i;
              return (
                <tr
                  key={label}
                  className={`border-t border-zinc-100 ${
                    isSel ? "bg-amber-50" : hasCounterex ? "hover:bg-zinc-50 cursor-pointer" : ""
                  }`}
                  onClick={() => hasCounterex && setBucketIdx(isSel ? null : i)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-800">{label}</div>
                    <div className="text-[10px] text-zinc-400 tabular-nums">
                      {rev.bucket_ranges[i]}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                    {pp.count > 0 ? (
                      <>
                        {pp.count}
                        <span className="text-[10px] text-zinc-400 ml-1">
                          ({pp.divergent} diverge)
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pfb.count > 0 ? (
                      <span className="text-rose-700 font-medium">
                        {pfb.count}
                        <span className="text-[10px] text-rose-400 ml-1">
                          ({pfb.divergent}/{pfb.count})
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                    {ff.count > 0 ? (
                      <>
                        {ff.count}
                        <span className="text-[10px] text-zinc-400 ml-1">
                          ({ff.divergent} diverge)
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {hasCounterex && (
                      <span className="text-zinc-500">
                        {isSel ? "▼ examples below" : "▶ click to see examples"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-zinc-500 mt-3 leading-relaxed">
        <strong>Reading the table.</strong> The agreement / disagreement in the
        pass-pass and pass-fail columns is{" "}
        <em>tautological</em>: <strong>pass-pass</strong> always shows 0
        divergence (resolved means every test passes, so two resolved trials
        match by definition); <strong>pass-fail</strong> always shows divergence
        equal to count (one resolved + one not means at least one test differs
        by definition). Treat those columns as <em>frequency tables</em>, not
        evidence. The two questions they answer:
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>
            How often does the same model write the <em>same exact patch</em>{" "}
            on two successful runs? (pass-pass at high Jaccard — many)
          </li>
          <li>
            How often does it write a similar-looking patch that nonetheless
            fails? (pass-fail at high Jaccard — the counterexamples)
          </li>
        </ol>
        <p className="mt-2">
          The <strong>fail-fail</strong> column is the only one carrying
          informative agreement data: both trials failed, but they might have
          failed in different ways. At every high Jaccard bucket (≥ 50%) the
          fail-fail divergence is ≤ 1, meaning failed patches that look alike
          fail in the same way. Combined with the rare pass-fail counterexamples,
          that's the empirical argument for "similar patches usually behave the
          same, but Jaccard alone can't certify it."
        </p>
      </div>

      {/* Counterexample viewer */}
      {bucketIdx !== null && exemplars.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-amber-900">
              <strong>{rev.bucket_labels[bucketIdx]}</strong> bucket ({rev.bucket_ranges[bucketIdx]}) —
              showing {exemplars.length} pair{exemplars.length === 1 ? "" : "s"} with diverging test outcomes
            </div>
            <button
              type="button"
              onClick={() => setBucketIdx(null)}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              close
            </button>
          </div>
          <div className="space-y-5">
            {exemplars.map((ce, idx) => (
              <CounterexampleCard key={idx} ce={ce} idx={idx} total={exemplars.length} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function shortTestName(name: string): string {
  // pytest-style: "sklearn/x/y.py::test_foo[param]" → "test_foo[param]"
  const m1 = name.match(/::([^()]+)$/);
  if (m1) return m1[1];
  // django-style: "test_foo (utils_tests.test_http.HttpDateProcessingTests)" → "test_foo"
  const m2 = name.match(/^([^\s(]+)/);
  if (m2) return m2[1];
  return name;
}

function missedSummary(ce: Counterexample): string {
  if (ce.kind !== "pass_fail") {
    // For fail-fail divergence, mention the tests that disagreed.
    const aFails = ce.diff_tests.filter((t) => t.a === "fail" && t.b === "pass");
    const bFails = ce.diff_tests.filter((t) => t.b === "fail" && t.a === "pass");
    const head = bFails.length >= aFails.length ? bFails : aFails;
    if (!head.length) return "";
    const which = head === bFails ? "B" : "A";
    const names = head.slice(0, 2).map((t) => shortTestName(t.test));
    return `Trial ${which} additionally breaks: ${names.join(", ")}${head.length > 2 ? ` (+${head.length - 2} more)` : ""}.`;
  }
  // pass_fail: the failing trial misses tests the passing one caught.
  const missedByFailing = ce.diff_tests.filter(
    (t) => (ce.resolved_a && t.a === "pass" && t.b === "fail") ||
           (ce.resolved_b && t.b === "pass" && t.a === "fail"),
  );
  if (!missedByFailing.length) return "";
  const names = missedByFailing.slice(0, 2).map((t) => shortTestName(t.test));
  const more = ce.n_diff_tests > names.length ? ` (+${ce.n_diff_tests - names.length} more)` : "";
  return `Failing trial fails: ${names.join(", ")}${more}.`;
}

function explainDivergence(ce: Counterexample): { tag: string; tagClass: string; sentence: string } {
  const { jaccard, kind, n_diff_tests } = ce;
  const missed = missedSummary(ce);

  if (kind === "pass_fail") {
    // Byte-identical patch text + huge test divergence ⇒ very likely the
    // failed trial's run blew up at test-collection / sandbox level rather
    // than the patch behaving differently.
    if (jaccard >= 0.99 && n_diff_tests >= 30) {
      return {
        tag: "infra failure, not semantic",
        tagClass: "bg-zinc-200 text-zinc-700",
        sentence: `Patch text is identical (Jaccard ${jaccard.toFixed(2)}) but ${n_diff_tests} tests diverge — signature of a test-collection / sandbox failure on the failing trial, not a real behavioral difference. ${missed}`,
      };
    }
    // High Jaccard, few diverging tests → real edge-case miss.
    if (jaccard >= 0.5 && n_diff_tests <= 6) {
      return {
        tag: "near-miss edge case",
        tagClass: "bg-rose-100 text-rose-800",
        sentence: `Patches share most edits (Jaccard ${jaccard.toFixed(2)}) but the failing trial misses ${n_diff_tests} specific test${n_diff_tests === 1 ? "" : "s"} — a real semantic gap. ${missed}`,
      };
    }
    // Moderate Jaccard with many divergent tests → patches converge on the
    // bug-region but diverge on which lines actually change.
    if (jaccard >= 0.10 && jaccard < 0.5) {
      return {
        tag: "different approaches",
        tagClass: "bg-amber-100 text-amber-800",
        sentence: `Two different approaches to the same bug (Jaccard ${jaccard.toFixed(2)}). One found a working fix; the other didn't. ${missed}`,
      };
    }
    // Low Jaccard, pass-fail: trivially divergent — the patches barely
    // overlap in text, so of course they don't behave the same.
    return {
      tag: "trivial — barely overlapping",
      tagClass: "bg-zinc-200 text-zinc-700",
      sentence: `Patches share very little text (Jaccard ${jaccard.toFixed(2)}); easy case for Jaccard. ${missed}`,
    };
  }

  if (kind === "fail_fail") {
    if (jaccard >= 0.5) {
      return {
        tag: "alike but break differently",
        tagClass: "bg-amber-100 text-amber-800",
        sentence: `Both trials failed, patches look similar (Jaccard ${jaccard.toFixed(2)}), but they break different test subsets — ${n_diff_tests} disagree. ${missed}`,
      };
    }
    return {
      tag: "different broken patches",
      tagClass: "bg-zinc-200 text-zinc-700",
      sentence: `Both failed, taking different routes (Jaccard ${jaccard.toFixed(2)}); ${n_diff_tests} test${n_diff_tests === 1 ? "" : "s"} diverge — trivially so because the patches barely overlap. ${missed}`,
    };
  }

  // pass_pass shouldn't appear in counterexamples (outcomes match by construction)
  return { tag: "unexpected", tagClass: "bg-zinc-200", sentence: "" };
}

function AgentJudgePilotTable({ pilot }: { pilot: AgentPilot }) {
  const pairs = pilot.pairs;
  if (!pairs.length) return null;
  return (
    <>
      <h3 className="text-sm font-semibold mb-2 mt-8">
        3-pair pilot (exploratory)
      </h3>
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">pair</th>
              <th className="text-right px-3 py-2 font-medium">line-Jaccard</th>
              <th className="px-3 py-2 font-medium">verifier (ground truth)</th>
              <th className="px-3 py-2 font-medium">agent</th>
              <th className="px-3 py-2 font-medium">agent reasoning</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => {
              const truth =
                p.resolved_a === null || p.resolved_b === null
                  ? "?"
                  : p.resolved_a === p.resolved_b
                  ? p.resolved_a
                    ? "both resolved"
                    : "both failed"
                  : "pass-fail (divergent)";
              const truthClass =
                truth === "both resolved"
                  ? "bg-emerald-100 text-emerald-800"
                  : truth.startsWith("pass-fail")
                  ? "bg-rose-100 text-rose-800"
                  : "bg-zinc-100 text-zinc-700";
              const agentClass = p.agent_verdict
                ? p.agent_verdict.startsWith("equiv")
                  ? "bg-emerald-100 text-emerald-800"
                  : p.agent_verdict.startsWith("near")
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
                : "";
              return (
                <tr key={i} className="border-t border-zinc-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px] text-zinc-700">
                      {p.trial_a.slice(0, 8)} ↔ {p.trial_b.slice(0, 8)}
                    </div>
                    <div className="text-[10px] text-zinc-500">{p.task}</div>
                    <div className="text-[10px] text-zinc-400">{p.model}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {p.line_jaccard.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${truthClass}`}
                    >
                      {truth}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {p.agent_similarity !== null && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium tabular-nums">
                          {p.agent_similarity.toFixed(2)}
                        </span>
                        {p.agent_verdict && (
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${agentClass}`}
                          >
                            {p.agent_verdict}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 leading-relaxed max-w-md">
                    {p.agent_reasoning}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AgentJudgeMetricsTable({ cmp }: { cmp: AgentJudgeCompare }) {
  const fmt3 = (v: number | null | undefined) =>
    v == null ? "—" : v.toFixed(3);

  const line =
    cmp.comparison?.line_jaccard ??
    ({
      auc: cmp.line_metrics.auc,
      at_best_threshold: {
        threshold: cmp.line_metrics.best_threshold?.threshold ?? 0,
        precision: cmp.line_metrics.best_threshold?.precision ?? 0,
        recall: cmp.line_metrics.best_threshold?.recall ?? 0,
        accuracy: 0,
        balanced_accuracy: cmp.line_metrics.best_threshold?.balanced_accuracy,
      },
    } as AgentCompareSide);
  const agent =
    cmp.comparison?.agent_judge ??
    ({
      auc: cmp.agent_metrics.auc,
      at_best_threshold: {
        threshold: cmp.agent_metrics.best_threshold?.threshold ?? 0,
        precision: cmp.agent_metrics.best_threshold?.precision ?? 0,
        recall: cmp.agent_metrics.best_threshold?.recall ?? 0,
        accuracy: 0,
        balanced_accuracy: cmp.agent_metrics.best_threshold?.balanced_accuracy,
      },
    } as AgentCompareSide);

  const rows = [
    { label: "line-Jaccard", ...line, rowClass: "" },
    { label: "agent judge", ...agent, rowClass: "bg-emerald-50/50" },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden mb-6">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">metric</th>
            <th className="text-right px-3 py-2 font-medium">AUC</th>
            <th className="text-right px-3 py-2 font-medium">best thr</th>
            <th className="text-right px-3 py-2 font-medium">precision</th>
            <th className="text-right px-3 py-2 font-medium">recall</th>
            <th className="text-right px-3 py-2 font-medium">bal. acc</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className={`border-t border-zinc-100 ${r.rowClass}`}
            >
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {fmt3(r.auc)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {fmt3(r.at_best_threshold.threshold)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.at_best_threshold.precision)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.at_best_threshold.recall)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {fmt(r.at_best_threshold.balanced_accuracy ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100 text-xs text-zinc-500 leading-relaxed">
        Ground truth:{" "}
        {cmp.comparison?.ground_truth ?? "test_outcome_jaccard >= 0.999"}. n=
        {cmp.n_pairs} pairs ({cmp.n_positive} equivalent, {cmp.n_negative}{" "}
        different).{" "}
        {cmp.comparison?.threshold_note ??
          "Each metric's threshold maximizes balanced accuracy on this sample."}
      </div>
    </div>
  );
}

function AgentJudgeFront({
  cmp,
  pilot,
}: {
  cmp: AgentJudgeCompare | null;
  pilot: AgentPilot | null;
}) {
  if (!cmp && !pilot) return null;

  const agentWins = cmp?.disagreements.filter((d) => d.winner === "agent") ?? [];
  const lineWins = cmp?.disagreements.filter((d) => d.winner === "line") ?? [];
  const fmt3 = (v: number | null | undefined) =>
    v == null ? "—" : v.toFixed(3);

  const kindLabel = (k: string) =>
    k === "pass_pass" ? "pass-pass" : k === "pass_fail" ? "pass-fail" : "fail-fail";

  return (
    <section className="mb-14 rounded-xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-6 sm:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">
          Agent judge · headline result
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mt-1">
          Can an agent judge beat line-Jaccard?
        </h2>
        <p className="text-sm text-zinc-700 mt-2 leading-relaxed max-w-2xl">
          We stage both patched codebases side-by-side and ask{" "}
          <strong>cursor-agent</strong> (<code>composer-2.5</code>, read-only) to
          score patch equivalence. Ground truth is verifier test-outcome
          agreement — did both trials pass and fail the exact same tests?
        </p>
      </div>

      {cmp && (
        <>
          <AgentJudgeMetricsTable cmp={cmp} />

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-6 text-sm text-emerald-900 leading-relaxed">
            <strong>Headline.</strong> Agent judge AUC{" "}
            {fmt3(cmp.comparison?.agent_judge?.auc ?? cmp.agent_metrics.auc)} vs
            line-Jaccard{" "}
            {fmt3(cmp.comparison?.line_jaccard?.auc ?? cmp.line_metrics.auc)}.
            At each metric&apos;s best threshold (line-J{" "}
            {fmt3(
              cmp.comparison?.line_jaccard?.at_best_threshold.threshold ??
                cmp.line_metrics.best_threshold?.threshold
            )}
            , agent{" "}
            {fmt3(
              cmp.comparison?.agent_judge?.at_best_threshold.threshold ??
                cmp.agent_metrics.best_threshold?.threshold
            )}
            ), the agent reaches{" "}
            {fmt(
              cmp.comparison?.agent_judge?.at_best_threshold.precision ??
                cmp.agent_metrics.best_threshold?.precision ??
                0
            )}{" "}
            precision /{" "}
            {fmt(
              cmp.comparison?.agent_judge?.at_best_threshold.recall ??
                cmp.agent_metrics.best_threshold?.recall ??
                0
            )}{" "}
            recall vs line-Jaccard&apos;s{" "}
            {fmt(
              cmp.comparison?.line_jaccard?.at_best_threshold.precision ??
                cmp.line_metrics.best_threshold?.precision ??
                0
            )}{" "}
            /{" "}
            {fmt(
              cmp.comparison?.line_jaccard?.at_best_threshold.recall ??
                cmp.line_metrics.best_threshold?.recall ??
                0
            )}
            . Where the two metrics disagree at those cutoffs (
            {cmp.disagreements.length} pairs), the agent matches ground truth{" "}
            {agentWins.length}× vs line-Jaccard {lineWins.length}×.
          </div>

          {cmp.disagreements.length > 0 && (
            <details className="rounded-lg border border-zinc-200 bg-white mb-4">
              <summary className="px-4 py-2 cursor-pointer text-sm text-zinc-600">
                Example disagreements ({Math.min(3, cmp.disagreements.length)} of{" "}
                {cmp.disagreements.length})
              </summary>
              <div className="border-t border-zinc-100 px-4 py-3 space-y-3">
                {cmp.disagreements.slice(0, 3).map((d, i) => (
                  <div key={i} className="text-xs leading-relaxed">
                    <div className="font-mono text-[11px] text-zinc-700">
                      {d.task} · {kindLabel(d.kind)} · winner: {d.winner}
                    </div>
                    <div className="text-zinc-500 mt-0.5">
                      line-J {d.line_jaccard.toFixed(2)} · agent{" "}
                      {d.agent_similarity.toFixed(2)} · truth {d.truth}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <details className="rounded-lg border border-zinc-200 bg-white">
            <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-zinc-700">
              All {cmp.n_pairs} judged pairs + agent reasoning
            </summary>
            <div className="border-t border-zinc-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">pair</th>
                    <th className="text-right px-3 py-2 font-medium">line-J</th>
                    <th className="text-right px-3 py-2 font-medium">agent</th>
                    <th className="px-3 py-2 font-medium">equiv?</th>
                    <th className="px-3 py-2 font-medium">reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.pairs.map((p, i) => (
                    <tr key={i} className="border-t border-zinc-100 align-top">
                      <td className="px-3 py-2">
                        <div className="font-mono text-[11px]">
                          {p.a.slice(0, 8)} ↔ {p.b.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {kindLabel(p.kind)} · {p.task}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.line_jaccard.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {p.agent_similarity.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        {p.equivalent_label ? (
                          <span className="text-emerald-700">yes</span>
                        ) : (
                          <span className="text-rose-700">no</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 leading-relaxed max-w-md">
                        {p.agent_reasoning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {pilot && <AgentJudgePilotTable pilot={pilot} />}

      <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
        Setup: each pair staged as <code>A/</code> and <code>B/</code> patched
        trees; agent explores with read-only file access (~3 min, ~100K input
        tokens per pair). No test execution — judgment is purely from code
        inspection.
      </p>
    </section>
  );
}

function CalibrationSection({ rev }: { rev: ReverseReport }) {
  const cal = rev.calibration;
  if (!cal || cal.length === 0) return null;
  // Reorder rows so the highest test-Jaccard (identical) is first.
  const rows = cal.slice().reverse();
  const peak = Math.max(...rows.flatMap((r) => r.hist));
  return (
    <section className="mb-12 rounded-lg border border-zinc-200 bg-white p-6">
      <h3 className="text-base font-semibold mb-2">
        Extension: graded behavioral agreement
      </h3>
      <p className="text-sm text-zinc-700 mb-4 leading-relaxed">
        We can also ask the same question at a finer grain: instead of "both
        resolved" vs not, score each pair by the <strong>Jaccard over its
        test-outcome vectors</strong> — what fraction of tests both trials
        agree on (pass-pass or fail-fail). This pools{" "}
        every pair the verifier sees identically, including <em>fail-fail
        pairs that broke in the same way</em>. If Direction 2 held, pairs in
        the higher test-agreement buckets should also have higher patch
        agreement.
      </p>

      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Test-outcome agreement</th>
              <th className="text-right px-3 py-2 font-medium">pairs</th>
              <th className="text-right px-3 py-2 font-medium">patch Jaccard<br/>median</th>
              <th className="text-right px-3 py-2 font-medium">mean</th>
              <th className="text-right px-3 py-2 font-medium">% zero overlap</th>
              <th className="text-right px-3 py-2 font-medium">% byte-identical</th>
              <th className="px-3 py-2 font-medium">distribution of patch-Jaccard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const isIdentical = r.label.startsWith("identical");
              return (
                <tr
                  key={r.label}
                  className={`border-t border-zinc-100 ${
                    isIdentical ? "bg-emerald-50/40" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-800">{r.label}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.n.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.median !== undefined ? r.median.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {r.mean !== undefined ? r.mean.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.zero_pct !== undefined ? `${r.zero_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.identical_pct !== undefined ? `${r.identical_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-1">
                    <div className="flex items-end gap-px h-7 w-full" title="patch-Jaccard distribution: no-overlap → identical">
                      {r.hist.map((c, hi) => {
                        const h = (c / peak) * 100;
                        const share = r.n > 0 ? (c / r.n) * 100 : 0;
                        return (
                          <div
                            key={hi}
                            className="flex-1 bg-emerald-400 rounded-sm"
                            style={{
                              height: `${Math.max(h, c > 0 ? 4 : 0)}%`,
                              opacity: isIdentical ? 1 : 0.6,
                            }}
                            title={`${rev.patch_bucket_labels[hi]} (${rev.patch_bucket_ranges[hi]}): ${c} (${share.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-zinc-500 leading-relaxed">
        Distribution column: 7 bars, left-to-right = patch-Jaccard bins{" "}
        <code>=0 · (0,.10] · (.10,.25] · (.25,.50] · (.50,.75] · (.75,.95] · =1.0</code>.
        Bar heights are normalized across the whole table so rows are
        directly comparable; hover for exact counts.
      </div>

      <div className="mt-4 rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-800 leading-relaxed">
        <strong>Reading.</strong> The identical-outcome row pools{" "}
        {cal[4]?.n.toLocaleString()} pairs (pass-pass and fail-fail combined) —
        every pair the verifier could not distinguish behaviorally. Median
        patch-Jaccard is just{" "}
        <strong>{cal[4]?.median?.toFixed(2)}</strong>; {" "}
        <strong>{cal[4]?.zero_pct?.toFixed(1)}%</strong> have <em>zero</em>{" "}
        line overlap.{" "}
        <strong>{cal[4]?.identical_pct?.toFixed(1)}%</strong> are byte-identical
        — the largest concentration, but still a minority. Lower
        test-agreement rows have lower patch-Jaccard means
        ({cal[3]?.mean?.toFixed(2)}-{cal[0]?.mean?.toFixed(2)}), so there <em>is</em>{" "}
        a weak positive calibration — but the dispersion within the
        identical-outcome row is enough to refute "similar behavior ⇒ similar
        patch" on its own.
      </div>
    </section>
  );
}

function CounterexampleCard({ ce, idx, total }: { ce: Counterexample; idx: number; total: number }) {
  const setA = extractAddRemoveLines(ce.diff_a);
  const setB = extractAddRemoveLines(ce.diff_b);
  const shared = new Set<string>();
  for (const x of setA) if (setB.has(x)) shared.add(x);
  const explanation = explainDivergence(ce);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-zinc-700">
          <span>
            Example {idx + 1} of {total}
          </span>
          <span className="text-zinc-400">·</span>
          <span>
            task <code className="text-zinc-700">{ce.task}</code>
          </span>
          <span className="text-zinc-400">·</span>
          <span>
            model <code className="text-zinc-700">{ce.model}</code>
          </span>
        </div>
        <div className="flex items-center gap-3 tabular-nums text-zinc-700">
          <span>
            Jaccard <strong>{ce.jaccard.toFixed(2)}</strong>
          </span>
          <span className="text-zinc-400">·</span>
          <span>
            <strong className="text-rose-700">{ce.n_diff_tests}</strong> test
            {ce.n_diff_tests === 1 ? "" : "s"} diverge
          </span>
        </div>
      </div>
      {/* Why-it-diverges explainer */}
      <div className="px-4 py-3 border-b border-zinc-200 bg-white">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${explanation.tagClass}`}
          >
            {explanation.tag}
          </span>
        </div>
        <p className="text-xs text-zinc-700 leading-relaxed">
          {explanation.sentence}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Trial A
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  ce.resolved_a
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {ce.resolved_a ? "resolved" : "failed"}
              </span>
            </div>
            <code className="text-[10px] text-zinc-400">{ce.trial_a.slice(0, 8)}</code>
          </div>
          <DiffView diff={ce.diff_a} sharedLines={shared} />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Trial B
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  ce.resolved_b
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {ce.resolved_b ? "resolved" : "failed"}
              </span>
            </div>
            <code className="text-[10px] text-zinc-400">{ce.trial_b.slice(0, 8)}</code>
          </div>
          <DiffView diff={ce.diff_b} sharedLines={shared} />
        </div>
      </div>
      {ce.diff_tests.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">
            Tests where the two trials disagree {ce.n_diff_tests > ce.diff_tests.length && (
              <span className="text-zinc-400 normal-case">(first {ce.diff_tests.length} of {ce.n_diff_tests})</span>
            )}
          </div>
          <div className="space-y-1">
            {ce.diff_tests.map((t, i) => (
              <div key={i} className="font-mono text-[11px] flex items-baseline gap-2">
                <span className="truncate flex-1 text-zinc-700" title={t.test}>
                  {t.test}
                </span>
                <span className={`px-1 rounded ${t.a === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  A: {t.a}
                </span>
                <span className={`px-1 rounded ${t.b === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  B: {t.b}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatchSimilarityPage() {
  const [data, setData] = useState<Report | null>(null);
  const [reverse, setReverse] = useState<ReverseReport | null>(null);
  const [agentPilot, setAgentPilot] = useState<AgentPilot | null>(null);
  const [agentCompare, setAgentCompare] = useState<AgentJudgeCompare | null>(
    null
  );

  useEffect(() => {
    fetch("./data/patch_similarity.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        fetch("/data/patch_similarity.json").then((r) => r.json()).then(setData);
      });
    fetch("./data/patch_similarity_reverse.json")
      .then((r) => r.json())
      .then(setReverse)
      .catch(() => {
        fetch("/data/patch_similarity_reverse.json").then((r) => r.json()).then(setReverse);
      });
    fetch("./data/agent_judge_pilot.json")
      .then((r) => r.json())
      .then(setAgentPilot)
      .catch(() => {
        fetch("/data/agent_judge_pilot.json")
          .then((r) => r.json())
          .then(setAgentPilot)
          .catch(() => {});
      });
    fetch("./data/agent_judge_compare.json")
      .then((r) => r.json())
      .then(setAgentCompare)
      .catch(() => {
        fetch("/data/agent_judge_compare.json")
          .then((r) => r.json())
          .then(setAgentCompare)
          .catch(() => {});
      });
  }, []);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  const { overall, scopes, per_model_discrimination } = data;
  const thr = overall.best_threshold;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-900 leading-relaxed">
      <header className="mb-10">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
          Methods · code patch similarity
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Is line-Jaccard an <em>iff</em>-condition for behavioral equivalence?
        </h1>
        <p className="mt-4 text-zinc-700">
          People often use <strong>line-Jaccard</strong> — the fraction of{" "}
          <span className="text-emerald-700">+</span>/
          <span className="text-rose-700">−</span> lines two patches share — as
          a shortcut for "are these two patches equivalent?". For the shortcut
          to be sound, two implications need to hold:
        </p>
        <ol className="mt-3 list-decimal list-inside text-zinc-700 space-y-1.5 ml-2">
          <li>
            <strong>Direction 1 (soundness)</strong>: similar patch ⇒ similar
            behavior. If the metric says two patches look alike, do they
            actually pass the same tests?
          </li>
          <li>
            <strong>Direction 2 (completeness)</strong>: similar behavior ⇒
            similar patch. If two patches pass the same tests, do they
            actually look alike?
          </li>
        </ol>
        <p className="mt-3 text-zinc-700">
          We use SWE-bench-Verified test outcomes as ground truth: for each
          pair of trials on the same bug, we know exactly which tests each
          patch passed or failed. Below we evaluate each direction
          independently and then synthesize.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          A patch <em>resolves</em> a SWE-bench task when every{" "}
          <code>FAIL_TO_PASS</code> test transitions to passing and every{" "}
          <code>PASS_TO_PASS</code> test stays passing. Trial pairs come in
          three flavors: <strong>pass-pass</strong> (both resolved),{" "}
          <strong>pass-fail</strong> (one resolved, one not),{" "}
          <strong>fail-fail</strong> (neither). All pairs in this analysis are
          on the same task, same model, same harness — the only thing that
          varies is which fix attempt the agent produced.
        </p>
      </header>

      <AgentJudgeFront cmp={agentCompare} pilot={agentPilot} />

      {reverse && (
        <ReverseSection rev={reverse} />
      )}

      <section className="mb-12">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            Direction 2
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Similar behavior ⇒ similar patch?
          </h2>
          <p className="text-sm text-zinc-700 mt-1">
            Look at pairs that <em>pass the same tests</em> (both resolved the
            same bug) and check whether their patches look similar.
          </p>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 mb-6">
          <h3 className="text-base font-semibold text-rose-900 mb-2">
            No — same-behavior patches span the full Jaccard range.
          </h3>
          <p className="text-sm text-rose-900 leading-relaxed">
            Of the{" "}
            <strong>{scopes.equivalent.stats.n.toLocaleString()}</strong>{" "}
            pass-pass pairs (same task, same model, both trials resolved by the
            verifier — therefore behaviorally indistinguishable to the test
            suite),{" "}
            <strong>{pct(scopes.equivalent.stats.zero_pct)}</strong> have{" "}
            <em>zero</em> Jaccard overlap and the median pair scores only{" "}
            <strong>{fmt(scopes.equivalent.stats.median)}</strong>. Only{" "}
            <strong>{pct(scopes.equivalent.stats.exact_pct)}</strong> are
            byte-identical. Two patches passing the same tests tells you almost
            nothing about whether their text agrees.
          </p>
          <p className="mt-3 text-sm text-rose-900 leading-relaxed">
            Two reasons: (1) models <em>routinely write the same fix two
            different ways</em> — renaming a variable, reordering statements,
            picking a different equivalent API — and the metric reads all of
            those as "low overlap"; (2) some models surround a small real fix
            with a large halo of <em>scratch noise</em> (agent-created{" "}
            <code>test_fix.py</code>, <code>debug_*.py</code>, backup files)
            that's unique per trial, so the noise drowns the actual fix signal
            in the Jaccard denominator. The per-model table further below shows
            the same pattern.
          </p>
        </div>
      </section>

      <ScopeCard
        title="Same-task, both-resolved pairs by Jaccard"
        subtitle={scopes.equivalent.sublabel}
        accent="bg-emerald-500"
        scope={scopes.equivalent}
        readout={
          <p>
            If "similar behavior ⇒ similar patch" held strictly, this
            distribution would clump at the right (high Jaccard). Instead, it
            spreads across every bucket. The dark bars (full diff) and the
            light bars (gold-path only) tell the same story — the dispersion
            isn't an artifact of scratch noise; even restricted to the
            target file, behaviorally-equivalent patches diverge in form.
          </p>
        }
      />

      {reverse && <CalibrationSection rev={reverse} />}

      <section className="mb-12 rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-800">
        <h2 className="text-base font-semibold mb-2 text-zinc-900">
          Synthesis: line-Jaccard is a one-sided indicator, not an{" "}
          <em>iff</em> condition.
        </h2>
        <p>
          The two directions don't cash out symmetrically.{" "}
          <strong>Direction 1 holds</strong> — high Jaccard reliably predicts
          shared behavior, with the one genuine counterexample being a single
          tightly-scoped API-mock issue.{" "}
          <strong>Direction 2 fails</strong> — same behavior does <em>not</em>{" "}
          imply same patch text; the test suite cannot detect the form
          differences that line-Jaccard counts. So the metric is sound (a high
          score is good evidence of equivalence) but incomplete (a low score is
          weak evidence of inequivalence).
        </p>
        <p className="mt-3 text-zinc-700">
          Practical reading: use line-Jaccard as a <em>positive-only</em>{" "}
          filter — non-zero overlap is strong evidence two patches do the same
          thing — but a zero score doesn't mean the patches differ. As a
          behavioral oracle you'd combine it with a structural metric (AST edit
          distance) for the false-negative tail, or fall back to actually
          running tests for the cases that matter. The supporting evidence
          below quantifies the AUC, threshold sensitivity, and per-model
          variation, with the same data viewed as a binary classifier.
        </p>
      </section>

      <section className="mb-3">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
          Supporting evidence
        </div>
        <h2 className="text-lg font-semibold mt-1">
          Same data, as a classifier
        </h2>
        <p className="text-sm text-zinc-700 mt-1 mb-4">
          The same pair sets viewed as a binary discrimination task:
          behaviorally-equivalent vs behaviorally-different. The AUC + best
          threshold + per-model breakdown are diagnostic for picking a usable
          threshold and seeing which models the metric struggles with.
        </p>
      </section>

      <section className="mb-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BigStat
          label="AUC"
          value={fmt3(overall.auc)}
          hint="P(equivalent pair scores higher than different pair)"
          accent="text-emerald-700"
        />
        <BigStat
          label="precision at best threshold"
          value={pct(thr.precision * 100)}
          hint={`threshold = ${thr.threshold.toFixed(3)}`}
        />
        <BigStat
          label="recall at best threshold"
          value={pct(thr.recall * 100)}
          hint={`balanced accuracy ${fmt3(thr.balanced_accuracy)}`}
        />
      </section>

      <section className="mb-12 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-2">How we measured similarity</h2>
        <p className="text-sm text-zinc-700">
          A patch is the set of lines added (<span className="text-emerald-700">+</span>)
          and removed (<span className="text-rose-700">−</span>) from the codebase.
          line-Jaccard is the number of <span className="text-emerald-700">+</span>/
          <span className="text-rose-700">−</span> lines two patches have in common,
          divided by the number either patch has in total.
        </p>
        <div className="mt-3 text-sm font-mono bg-zinc-50 rounded p-3 text-zinc-700">
          score = (line-edits in both patches) / (line-edits in either patch)
        </div>

        <h3 className="mt-6 text-sm font-semibold text-zinc-800">
          Worked example — score = 0.5
        </h3>
        <p className="mt-1 text-sm text-zinc-700">
          Two trials are fixing the same bug. Both rewrite the same buggy line, but
          each adds its own comment explaining the fix.
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600 mb-1">
              Trial A's patch
            </div>
            <pre className="text-[11px] font-mono bg-white border border-zinc-200 rounded p-2 leading-snug">
              <span className="block bg-rose-50 text-rose-800">- min_samples = max(2, min_samples * n_samples)</span>
              <span className="block bg-emerald-50 text-emerald-800">+ min_samples = int(max(2, min_samples * n_samples))</span>
              <span className="block bg-emerald-50 text-emerald-800">+ # fix: ensure integer for k-NN</span>
            </pre>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600 mb-1">
              Trial B's patch
            </div>
            <pre className="text-[11px] font-mono bg-white border border-zinc-200 rounded p-2 leading-snug">
              <span className="block bg-rose-50 text-rose-800">- min_samples = max(2, min_samples * n_samples)</span>
              <span className="block bg-emerald-50 text-emerald-800">+ min_samples = int(max(2, min_samples * n_samples))</span>
              <span className="block bg-emerald-50 text-emerald-800">+ # convert to int to avoid TypeError</span>
            </pre>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
          <div className="space-y-1">
            <div>
              Shared edits: <strong>2</strong> (the buggy line removed, the fixed line added)
            </div>
            <div>Unique edits: <strong>2</strong> (each patch's own comment)</div>
            <div className="pt-1 border-t border-zinc-200 mt-2 font-mono text-zinc-700">
              score = 2 / (2 + 2) = <strong className="text-zinc-900">0.5</strong>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Patches reconstructed by replaying each agent's tool calls (claude-code's{" "}
          <code>Edit</code> / <code>Write</code> / <code>Bash</code> calls) against
          the repo at the bug's base commit. Agent fixed at <code>claude-code</code>,{" "}
          across {overall.n_models} models on ~52 SWE-bench-Verified tasks (drawn
          from {overall.corpus_size.toLocaleString()} valid runs).{" "}
          <strong>Positive class</strong>: pairs of trials from the same{" "}
          (task, model) cell where the random sample of 5 trials all passed —{" "}
          {scopes.equivalent.stats.n.toLocaleString()} pairs across{" "}
          {overall.n_all_pass_cells} all-pass cells.{" "}
          <strong>Negative class</strong>: pairs of trials from the same (task,
          model) cell where some of the 5 passed and some failed — one passing
          trial paired with one failing trial — yielding{" "}
          {scopes.different.stats.n.toLocaleString()} pass-fail pairs across mixed
          cells.
        </p>
      </section>

      <ScopeCard
        title="Negative-class distribution (pass-fail pairs)"
        subtitle={scopes.different.sublabel}
        accent="bg-rose-500"
        scope={scopes.different}
        readout={
          <p>
            For comparison: pass-fail pairs (one resolved + one not) cluster
            near zero overlap, as expected — but{" "}
            <strong>{pct(scopes.different.stats.exact_pct)}</strong> still
            score 1.0 (the same byte-identical infrastructure-failure cases
            we saw in Direction 1) and the median (
            {fmt(scopes.different.stats.median)}) shows a long tail of failing
            patches that look mostly like the passing ones. This is what
            limits the classifier's precision when you push the threshold
            down.
          </p>
        }
      />

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-2">By model: discrimination quality</h2>
        <p className="text-sm text-zinc-700 mb-3">
          AUC per model under two scopings of the line-Jaccard, alongside how much of
          each model's diff is <em>scratch</em> rather than the real fix.
        </p>
        <ul className="text-sm text-zinc-700 mb-4 space-y-2 list-disc list-inside">
          <li>
            <strong>AUC (full diff)</strong> — line-Jaccard over <em>every</em>{" "}
            <span className="text-emerald-700">+</span>/
            <span className="text-rose-700">−</span> line in the reconstructed patch,
            including agent-created test scripts (<code>test_fix.py</code>),
            debug files, scratch notes, and the like.
          </li>
          <li>
            <strong>AUC (gold-path only)</strong> — same metric, but counting only
            lines in the file SWE-bench's maintainer-written gold fix targets. This
            isolates "did the model write the same code <em>change</em>?" from "did
            the model produce the same diff <em>text</em>?". Requires knowing which
            file is the gold path — fine on a benchmark, harder in the wild.
          </li>
          <li>
            <strong>Patch noise</strong> — median fraction of a trial's{" "}
            <span className="text-emerald-700">+</span>/
            <span className="text-rose-700">−</span> lines that land <em>outside</em>{" "}
            the gold file. 0% means every edit-line is on the fix; 90% means only one
            line in ten is the actual fix and the rest is scaffolding.
          </li>
        </ul>
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">model</th>
                <th className="text-right px-3 py-2 font-medium">AUC<br/><span className="text-[10px] font-normal text-zinc-400">full diff</span></th>
                <th className="text-right px-3 py-2 font-medium">AUC<br/><span className="text-[10px] font-normal text-zinc-400">gold-path only</span></th>
                <th className="text-right px-3 py-2 font-medium">Δ<br/><span className="text-[10px] font-normal text-zinc-400">gold − full</span></th>
                <th className="text-right px-3 py-2 font-medium">patch noise<br/><span className="text-[10px] font-normal text-zinc-400">% outside fix</span></th>
              </tr>
            </thead>
            <tbody>
              {per_model_discrimination.map((m) => {
                const delta = m.delta ?? 0;
                const noise = m.noise_median ?? 0;
                return (
                  <tr key={m.model} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.model}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmt3(m.auc)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {m.auc_gold !== null ? fmt3(m.auc_gold) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        delta > 0.03
                          ? "text-emerald-700"
                          : delta < -0.005
                          ? "text-rose-700"
                          : "text-zinc-500"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {fmt3(delta)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        noise >= 0.5
                          ? "text-rose-700 font-medium"
                          : noise >= 0.25
                          ? "text-amber-700"
                          : "text-zinc-500"
                      }`}
                    >
                      {pct(noise * 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-zinc-700">
          The pattern is clean: <strong>noise predicts AUC</strong>. The four models
          with zero or near-zero patch noise (
          <code>MiniMax-M2.5</code>, <code>mimo-v2-pro</code>,{" "}
          <code>claude-opus-4-6</code>, <code>claude-sonnet-4-6</code>) hit AUC{" "}
          {`>`} 0.83 on the full diff and gold-only filtering changes little (their
          diff <em>is</em> the gold file). The four high-noise models (
          <code>deepseek-chat</code> at 87%, <code>claude-haiku</code> at 89%,{" "}
          <code>kimi-k2.5</code> at 49%, <code>glm-5</code> at 43%) all sit at AUC
          0.57–0.69 on the full diff, and all gain 0.06–0.12 AUC when we strip the
          scratch.
        </p>
        <p className="mt-3 text-sm text-zinc-700">
          The takeaway: when a model writes a 6-line fix surrounded by 46 lines of
          per-trial-unique <code>debug_fix.py</code>, <code>test_patch.py</code>, and{" "}
          <code>final_check.py</code> scratch, line-Jaccard on the raw diff drowns
          the signal in noise. The fix at the line level is still there — the model
          really does write the same code change across runs — you just need to look
          past the scaffolding to see it.
        </p>
      </section>

      <section className="mb-12 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-2">
          What line-Jaccard misses, and what could fix it
        </h2>
        <p className="text-sm text-zinc-700">
          Line-Jaccard has <em>two</em> failure modes:
        </p>
        <ul className="mt-2 text-sm text-zinc-700 space-y-1.5 list-disc list-inside">
          <li>
            <strong>False negatives</strong> ({pct(scopes.equivalent.stats.zero_pct)}{" "}
            of equivalent pairs) — two successful patches that share zero lines
            because the model solved the same bug with different code shape.
          </li>
          <li>
            <strong>False positives</strong> ({pct(scopes.different.stats.exact_pct + 0)}%
            of pass-fail pairs at score = 1.0; many more in the moderate range) —
            failing patches that look textually close to successful ones but
            actually do something slightly wrong.
          </li>
        </ul>
        <p className="mt-4 text-sm text-zinc-700">
          The standard remedies, in order of cost:
        </p>
        <ul className="mt-3 text-sm text-zinc-700 space-y-2 list-disc list-inside">
          <li>
            <strong>AST edit distance</strong> (TSED / GumTree-family). Catches
            structural similarity that survives renaming, whitespace, and reordering.
            Helps with the false-negative side; doesn't help with the false-positive
            side.
          </li>
          <li>
            <strong>Test-outcome equivalence.</strong> Run the project's unit tests
            on both patches and compare pass/fail vectors. This is the ground truth
            we're trying to approximate — exact by construction, but requires the
            test environment and seconds per patch. Solves both failure modes.
          </li>
          <li>
            <strong>CodeBERTScore</strong> on the post-patch functions. Catches
            semantic paraphrase. Adds an ML dependency and isn't deterministic
            across model versions.
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-700">
          For a fast first-pass filter line-Jaccard at threshold ≥{" "}
          <strong>{fmt3(thr.threshold)}</strong> is reasonable — it gives{" "}
          {pct(thr.precision * 100)} precision and {pct(thr.recall * 100)} recall
          against the test-equivalence ground truth. But if you genuinely need to
          tell a successful fix from a failed one without running tests, you should
          combine line-Jaccard with either structural (AST) or behavioral
          (test-outcome) signal — neither is optional for high recall.
        </p>
      </section>

      <section className="text-xs text-zinc-500 mt-12 border-t border-zinc-200 pt-6">
        <p>
          <strong>Glossary.</strong> <em>SWE-bench-Verified</em>: a 500-task benchmark
          of real Python bugs from open-source repos; each task ships a base commit,
          a failing test, and a maintainer-written "gold" fix used only for grading.{" "}
          <em>Trial</em>: one end-to-end attempt at fixing one task by one model
          under one harness, ending in a verifier that runs the failing test on the
          agent's modified codebase. <em>All-pass cell</em>: a (task, model, harness)
          triple where the random sample of 5 trials all passed — we treat those 5
          patches as behaviorally equivalent because the test suite did.{" "}
          <em>Mixed cell</em>: same triple, but the sample of 5 contains both
          passing and failing trials — we pair each passing trial with each failing
          trial to form a "behaviorally different" pair on the same bug.{" "}
          <em>Line-Jaccard</em>: intersection-over-union of the{" "}
          <span className="text-emerald-700">+</span>/
          <span className="text-rose-700">−</span> lines in two unified diffs (lines
          compared after whitespace trim; file-header lines ignored).{" "}
          <em>AUC</em>: probability that a random positive pair scores higher than a
          random negative pair under this metric.
        </p>
      </section>
    </main>
  );
}
