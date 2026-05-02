# Job Targeting Compatibility Cutover Policy

The JobCompatibilityAssessment must run in shadow mode before it becomes the production source of truth.

## Runtime Modes

- `JOB_COMPATIBILITY_ASSESSMENT_ENABLED=false`: the new assessment does not run.
- `JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true` + `JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE=true` + `JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=false`: the new assessment runs, is persisted as `agentState.jobCompatibilityAssessmentShadow`, and logs comparison metrics. It must not alter UI, score, rewrite, validation, or low-fit decisions.
- `JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true` + `JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=true` + `JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED=false`: source-of-truth is blocked and the effective mode remains shadow. This protects production from accidental promotion before metrics are approved.
- `JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true` + `JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE=false` + `JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=true` + `JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED=true`: the new assessment is persisted as `agentState.jobCompatibilityAssessment` and may drive score, claim policy, low-fit, rewrite, and validation.

## Shadow Batch Validation

Run volume validation through the batch runner, not through 500 browser sessions:

```bash
tsx scripts/job-targeting/run-shadow-batch.ts \
  --input .local/job-targeting-shadow-cases/cases.jsonl \
  --output .local/job-targeting-shadow-results/results.jsonl \
  --limit 500 \
  --concurrency 3 \
  --persist
```

For the most representative compatibility cutover run, use real gap analysis instead of the deterministic synthetic fallback:

```bash
tsx scripts/job-targeting/run-shadow-batch.ts \
  --input .local/job-targeting-shadow-cases/cases.jsonl \
  --output .local/job-targeting-shadow-results/results-real-gap.jsonl \
  --limit 500 \
  --concurrency 2 \
  --persist \
  --use-real-gap-analysis
```

Generate or regenerate the cutover report from an existing result file:

```bash
tsx scripts/job-targeting/analyze-shadow-divergence.ts \
  .local/job-targeting-shadow-results/results-real-gap.jsonl \
  --output-dir .local/job-targeting-shadow-results
```

Run rewrite/trace validation on a smaller controlled sample:

```bash
tsx scripts/job-targeting/run-shadow-batch.ts \
  --input .local/job-targeting-shadow-cases/cases.jsonl \
  --output .local/job-targeting-shadow-results/results-rewrite-validation.jsonl \
  --limit 100 \
  --concurrency 1 \
  --persist \
  --use-real-gap-analysis \
  --include-rewrite-validation
```

The runner writes one JSONL result per case, persists shadow comparisons when `--persist` is used, and generates:

- `.local/job-targeting-shadow-results/report.json`
- `.local/job-targeting-shadow-results/report.md`

The report must contain `CUTOVER_READY=true` before `JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED=true` can be set. The analyzer is conservative: it returns `CUTOVER_READY=false` when the batch used synthetic gap analysis, did not persist shadow comparisons, or did not execute rewrite validation for the final cutover report.

## Promotion Criteria

Promotion to source of truth is blocked until all criteria are true:

1. At least 500 real Job Targeting cases ran in shadow mode.
2. Mean absolute score divergence is <= 15 points.
3. P95 score divergence is <= 30 points.
4. There are 0 confirmed false-positive forbidden claims in generated resumes.
5. There are 0 confirmed factual violations released by override.
6. There are 0 confirmed false negatives for core requirements with explicit evidence.
7. At least 95% of divergent cases are explainable from logs and assessment audit fields.
8. Golden cases pass.
9. Mutation and adversarial cases pass.
10. No operational pipeline error increase is observed.

## Required Event

Every shadow run logs `job_targeting.compatibility.shadow_comparison` with safe metadata only:

- session and user ids
- legacy score and assessment score
- score delta
- critical gap delta
- low-fit delta
- legacy unsupported count
- assessment supported, adjacent, unsupported, and forbidden claim counts
- assessment, score, and catalog versions
- generated timestamp

Full resumes and full job descriptions must never be logged in this event.

## Non-Overrideable Boundary

Low-fit is a business fit warning. A factual violation is an unsafe generated claim. A user may accept low-fit risk, but an override must never release a final artifact with a factual violation such as a forbidden term, unsupported added skill, unsupported certification, unsupported education claim, unsafe direct claim, missing claim trace, or unsupported expressed signal.
