# SWESimBench — website

The web frontend for **SWESimBench**, a benchmark for how faithfully a model can simulate a
software engineer using an AI coding agent, grounded in real
[SWE-chat](https://huggingface.co/datasets/SALT-NLP/SWE-chat) sessions.

- **Live site:** https://swesimbench.vercel.app
- **What it is:** a Next.js static-export walkthrough of the CondAgree results (9 simulators, with and
  without a distilled developer profile, on a user- and repo-disjoint test split), plus a public data catalog.

## Develop

```bash
cd web
npm install
npm run dev      # local dev server
npm run build    # static export to web/out
```

Deployed to Vercel (static export).

## Layout

- `web/` — the Next.js app. This repo hosts the website only.

## Where the rest lives

- **Benchmark code** (eval harness, 4-way move taxonomy + judge, analysis/ablation scripts, and the
  Modal serving for the OSim models): private repo `AlienKevin/user.skill`, `swesimbench` branch,
  available on request.
- **Trial data** (every generation + move label, the splits, the taxonomy, and the
  per-category / verbosity / ablation breakdowns): public on Vercel Blob; browse it at
  https://swesimbench.vercel.app/data.
- **Built on** the [cooperbench/user.skill](https://github.com/cooperbench/user.skill) benchmark.

> Earlier scaffolding (Modal serving, notes, configs, SWE-chat patch-reconstruction scripts) was
> removed from the working tree to keep this repo website-only. It remains in git history.
