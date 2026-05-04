# Quick Task 260504-0sl: Exportar seed shadow multidominio e rodar compatibility sem LLM

**Completed:** 2026-05-04
**Status:** Done

## What Changed

- Added `scripts/job-targeting/export-seeded-shadow-cases.ts`.
- Exported the 30 database-seeded shadow sessions for `shadow-seed-multidomain-001` to JSONL.
- Ran the compatibility shadow batch without LLM flags.
- Generated a dedicated divergence report.

## Commands Run

```bash
npx tsx scripts/job-targeting/export-seeded-shadow-cases.ts --seed-run-id shadow-seed-multidomain-001 --output .local/job-targeting-shadow-cases/seeded-30-diverse-cases.jsonl
npx tsx scripts/job-targeting/run-shadow-batch.ts --input .local/job-targeting-shadow-cases/seeded-30-diverse-cases.jsonl --output .local/job-targeting-shadow-results/seeded-30-diverse-compatibility.jsonl --limit 30 --concurrency 2 --persist
npx tsx scripts/job-targeting/analyze-shadow-divergence.ts .local/job-targeting-shadow-results/seeded-30-diverse-compatibility.jsonl --output-dir .local/job-targeting-shadow-results/seeded-30-diverse-compatibility
```

No tests were run.

## Outputs

- `.local/job-targeting-shadow-cases/seeded-30-diverse-cases.jsonl`
- `.local/job-targeting-shadow-results/seeded-30-diverse-compatibility.jsonl`
- `.local/job-targeting-shadow-results/seeded-30-diverse-compatibility/report.json`
- `.local/job-targeting-shadow-results/seeded-30-diverse-compatibility/report.md`

## Result

```json
{
  "seedRunId": "shadow-seed-multidomain-001",
  "exportedCases": 30,
  "compatibilityProcessed": 30,
  "runtimeSuccess": "30/30",
  "OpenAICalls": 0,
  "estimatedCostUsd": 0,
  "llmCases": 0,
  "gapAnalysisCalls": 0,
  "rewriteCalls": 0,
  "CUTOVER_READY": false,
  "scoreDelta": {
    "meanAbsolute": 17.3,
    "p50": 15,
    "p90": 30,
    "p95": 36
  },
  "lowFitDivergentCount": 2,
  "criticalGapDivergentCount": 25,
  "possibleFalseNegativeCandidates": 1
}
```

`CUTOVER_READY=false` is expected for this run because it intentionally uses only 30 cases, synthetic gap analysis, and no rewrite validation.
