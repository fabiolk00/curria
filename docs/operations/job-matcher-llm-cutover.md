# Job Matcher LLM Cutover

This document is the operational gate for the job-targeting semantic matcher.

## Fixed Contract

- Model: `gpt-4.1-mini-2025-04-14`
- Prompt version: `job-matcher-llm-v2`
- Schema: `MatcherOutputSchema`
- Default confidence threshold: `JOB_MATCHER_CONFIDENCE_THRESHOLD=0.50`
- Per-session concurrency: `JOB_MATCHER_MAX_CONCURRENT_REQUIREMENT_CALLS=8`
- Retry policy: `JOB_MATCHER_LLM_MAX_RETRIES=3`, `JOB_MATCHER_LLM_INITIAL_BACKOFF_MS=500`, `JOB_MATCHER_LLM_BACKOFF_MULTIPLIER=2`, `JOB_MATCHER_LLM_RETRY_JITTER=true`

Any model, schema, system prompt, or user prompt change requires a new PR, prompt version bump, and real golden-case revalidation.

## Shadow Defaults

PR 2 and PR 3:

```txt
JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true
JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE=true
JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=false
JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED=false
```

PR 4 only:

```txt
JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true
JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE=false
JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=true
JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED=true
```

## Cutover Gates

PR 4 must not open until all are true:

- `JOB_MATCHER_MAX_AVG_COST_USD_PER_SESSION` is defined and owner-approved.
- Prompt version was validated.
- `npm run test:job-matcher:llm` passes 3/3 for every golden case.
- Shadow has at least 100 real sessions and 7 elapsed days.
- At least 20 real rewrites were manually reviewed with 0 critical overclaims and no more than 2 minor wording adjustments.
- Staging rollback was tested.
- `job_targeting.matcher.llm.session_wall_clock_latency_ms.p95 <= 8000`.
- Recurring rate-limit failures have a mitigation.

Cost gate definition may happen after 50 real shadow sessions and 3 elapsed days, but that does not end shadow.

## Pricing Audit

- Pricing URL: https://openai.com/api/pricing
- Consultation date: 2026-05-04
- Model: `gpt-4.1-mini-2025-04-14`
- Input price: USD 0.40 per 1M tokens
- Output price: USD 1.60 per 1M tokens
- Formula: `(input_tokens / 1_000_000 * 0.40) + (output_tokens / 1_000_000 * 1.60)`

`JOB_MATCHER_MAX_AVG_COST_USD_PER_SESSION` must be set by the Tech Lead / Maintainer responsible for job-targeting after reviewing:

- avg cost/session
- p50 cost/session
- p95 cost/session
- max cost/session
- avg requirements/session
- avg input tokens/session
- avg output tokens/session

## Rollback

Rollback env:

```txt
JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH=false
JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE=true
JOB_COMPATIBILITY_ASSESSMENT_ENABLED=true
```

Expected behavior:

- New executions use `legacy-v1` operationally.
- Canonical continues in shadow.
- Running sessions keep the stored `agentState.jobTargetingEngineVersion`.
- Finished sessions are not recalculated automatically.

## Required Commands

```bash
npm run test:job-matcher:llm
npm run audit:job-targeting-catalog-deps
```
