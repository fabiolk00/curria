# Quick Task 260504-1fi Summary

## Result

Ran seeded 10 rewrite validation with real LLM rewrite and all requested cost/provider guards.

## Inputs And Outputs

- Input: `.local/job-targeting-shadow-cases/seeded-30-diverse-cases-fixed.jsonl`
- Output: `.local/job-targeting-shadow-results/seeded-10-rewrite-validation.jsonl`
- Report: `.local/job-targeting-shadow-results/seeded-10-rewrite-validation/report.json`

## Metrics

- processed: 10
- runtimeSuccess: 10
- rewriteSucceeded: 10
- traceFallbackUsed: 0
- providerOperationalFailures: 0
- providerRateLimited: 0
- providerCircuitOpen: 0
- providerShortCircuited: 0
- providerRetries: 0
- blocked: 0
- factualViolations: 0
- generatedClaimTraceAverage: 15.5
- estimatedCostUsd: 0.50
- cacheHits: 0
- cacheMisses: 10

## Security Checks

- resume_generations shadow count: 0
- credit_reservations shadow count: 0
- artifact generated: no
- internal credit consumed: no
- source-of-truth enabled: no

## Notes

`CUTOVER_READY` remains false in the analyzer because the sample has only 10 cases and legacy divergence thresholds are not the quality gate for this validation run.
