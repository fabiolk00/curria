# Phase 19 Context - JSON Persistence Contract Reduction

## Why this phase exists

CurrIA already made good progress on safety and ownership boundaries, but several core persistence seams still rely on broad JSON columns whose runtime meaning is only partially enforced by repository adapters.

Today the most important JSON-backed seams are:

- `sessions.cv_state`
- `sessions.agent_state`
- `sessions.generated_output`
- `user_profiles.cv_state`
- `resume_targets.derived_cv_state`
- `resume_targets.gap_analysis`
- `resume_targets.generated_output`
- `resume_generations.source_cv_snapshot`
- `resume_generations.generated_cv_state`
- `processed_events.event_payload`

Not all of these should be treated the same. Some are mature product contracts that deserve strong typed adapters and validation. Others are intentionally event-log shaped and should remain flexible, but documented as such.

## Current codebase reality

- `session-normalization.ts` already provides partial normalization for session JSON, but `agent_state` and `generated_output` still accept broad object shapes.
- `resume-targets.ts` validates `derived_cv_state` and `gap_analysis`, which is a strong pattern worth making more explicit.
- `resume-generations.ts` already treats source and generated CV snapshots as typed `CVState`.
- `user-profiles.ts` still returns raw rows with `cv_state: unknown`, which is a weaker contract than the other resume seams.
- `processed_events.event_payload` is intentionally closer to a raw provider/event log and should likely remain flexible rather than being over-constrained.

## Phase intent

This phase should reduce ambiguity, not force a large schema rewrite.

The right outcome is:

1. inventory the JSON seams and classify them by ownership and stability
2. strengthen typed adapters for the mature, high-value seams
3. narrow at least one important repository contract so callers stop dealing with raw JSON for stable product data
4. publish clear non-goals for intentionally opaque JSON such as provider event payloads

## What this phase should not do

- broad relational redesign of every JSON column
- risky schema churn across the whole milestone
- overfitting raw webhook payload logs into brittle app-level types

## Requirements

- `DATA-01`
- `DATA-02`
