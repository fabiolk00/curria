# Phase 9: ATS Enhancement Reliability Hardening - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** Phase 9 roadmap entry plus codebase inspection after Phase 8 delivery

<domain>
## Phase Boundary

Harden the deterministic ATS-enhancement pipeline delivered in Phase 8 so it stays reliable under real resume workloads instead of only succeeding on the happy path.

This phase is not about reintroducing broad product scope. The base ATS-enhancement behavior already exists. The remaining work is to make that path resilient, consistent across sections, observable in production, and affordable enough to operate repeatedly.

In scope:
- step-level ATS workflow state and retries
- section-based rewrite planning that keeps summary, experience, skills, education, and certifications aligned
- stronger factual and cross-section validation
- structured workflow logs and cost/failure telemetry for ATS runs
- regression and stress coverage for large resumes plus preview/export continuity

Out of scope for this phase:
- new UI flows or major workspace redesign
- reopening job-targeting rewrite architecture
- broad model-routing changes outside the ATS-enhancement path
- new onboarding/import surfaces such as PDF profile upload
</domain>

<implementation_state>
## Current Implementation Observations

- `src/lib/agent/ats-enhancement-pipeline.ts` already runs ATS analysis, full rewrite, validation, and version persistence imperatively for resume-only sessions.
- The current pipeline persists a coarse `rewriteStatus`, but it does not track step-level attempts, retries, or detailed failure locations.
- `src/lib/agent/tools/rewrite-resume-full.ts` already rewrites by section, but it does so with one generic loop and no explicit intermediate rewrite plan to keep sections mutually consistent.
- The current design intent for this phase is to add an explicit intermediate rewrite-plan artifact so section rewrites share the same factual positioning, keyword focus, and scope boundaries before execution begins.
- `src/lib/agent/tools/validate-rewrite.ts` blocks some hallucinations, but today it mainly checks experience/company/date drift, certifications, skills, and unsupported numeric claims. It does not yet validate section coherence such as summary claims unsupported by experience or duplicate drift introduced across rewritten sections.
- Existing observability already supports `logInfo`, `logWarn`, and `logError` through `src/lib/observability/structured-log.ts`, but the ATS-enhancement pipeline does not emit a stable workflow log schema for phase, step, section, attempt, cost, and outcome.
- `rewrite-section.ts` already records token usage through `trackApiUsage`, which is a useful seam for phase-level affordability telemetry, but that usage is not yet aggregated into ATS workflow logs or session state.
- No current test forces the ATS pipeline through a large-resume stress fixture with bounded retries, so oversized payload and retry-spend regressions could still slip through unnoticed.
</implementation_state>

<decisions>
## Implementation Decisions

### Reliability Scope
- Treat Phase 8 as the baseline contract and Phase 9 as a hardening pass.
- Preserve the existing user-facing ATS-enhancement behavior while making its internal execution deterministic and diagnosable.

### Retry Strategy
- Use bounded, step-level retries instead of retrying the entire ATS run from scratch.
- Persist per-step attempt state so operators and tests can distinguish analysis failure, section rewrite failure, validation failure, and persistence failure.
- Reuse existing retry conventions where practical instead of inventing a one-off backoff style.

### Section Consistency Strategy
- Add an explicit intermediate rewrite plan derived from the original CV plus ATS analysis before section rewriting starts.
- Use that plan to keep summary, experience, and skills aligned around the same factual positioning and keyword focus.
- Keep section execution isolated so one failed or retried section does not silently corrupt already valid sections.

### Validation Strategy
- Keep factual preservation as a hard gate.
- Expand validation beyond hallucinated entities to also catch unsupported summary claims, cross-section terminology drift, and duplicated or contradictory rewrite output where the current data model allows it.
- Validation failures must remain observable and must not persist as `optimizedCvState`.

### Observability Strategy
- Emit structured ATS workflow logs keyed by `workflowMode`, `sessionId`, `userId`, step, section, attempt, and outcome.
- Make cost and failure points observable from logs without requiring ad hoc local debugging.
- Prefer additive helper modules around the current pipeline over broad route rewrites.

### Brownfield Constraint
- Keep `cvState` as canonical base truth and `agentState` as operational context.
- Reuse the Phase 8 pipeline seams instead of moving ATS enhancement into an unrelated orchestration layer.
- Favor targeted tests around the ATS path rather than sweeping refactors of the broader agent loop.

### the agent's Discretion
- Exact shape of step-level ATS state inside `agentState`
- Whether cost aggregation lives only in logs, in session state, or both
- Whether large-resume mitigation uses section-specific prompt compaction, canonical fact maps, or other bounded payload shaping
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ATS pipeline entry points
- `src/lib/agent/ats-enhancement-pipeline.ts` - current imperative ATS-enhancement orchestration
- `src/app/api/agent/route.ts` - resume-only workflow resolution and pre-loop ATS execution seam
- `src/app/api/profile/ats-enhancement/route.ts` - dedicated ATS-enhancement route that must stay aligned with the shared pipeline

### Rewrite and validation modules
- `src/lib/agent/tools/rewrite-resume-full.ts` - current section loop for full resume rewrite
- `src/lib/agent/tools/rewrite-section.ts` - section rewrite primitive, validation, and usage tracking seam
- `src/lib/agent/tools/validate-rewrite.ts` - current factual validation gate
- `src/lib/agent/tools/ats-analysis.ts` - current ATS-general analysis service

### Observability and retry patterns
- `src/lib/observability/structured-log.ts` - structured log contract used elsewhere in the repo
- `src/lib/openai/chat.ts` - existing generic retry/backoff helpers for OpenAI calls
- `src/app/api/agent/route.ts` - existing gap-analysis retry wrapper pattern
- `src/lib/agent/usage-tracker.ts` - token accounting persistence used by ATS-related tools

### Persistence and consumers
- `src/types/agent.ts` - ATS workflow state, validation, and version source contracts
- `src/lib/db/sessions.ts` - agent-state persistence and normalization
- `src/lib/db/cv-versions.ts` - ATS-enhancement version history support
- `src/lib/agent/tools/index.ts` - effective base CV selection for generation
- `src/app/api/session/[id]/route.ts` - workspace session snapshot
- `src/app/api/file/[sessionId]/route.ts` - download/export path
- `src/lib/dashboard/workspace-client.ts` - workspace consumer contract

### Existing tests
- `src/app/api/agent/route.sse.test.ts`
- `src/app/api/profile/ats-enhancement/route.test.ts`
- `src/app/api/session/[id]/route.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `src/lib/agent/tools/index.test.ts`
</canonical_refs>

<specifics>
## Specific Ideas

- Candidate state additions:
  - `atsWorkflowRun`
  - `stepStatusByName`
  - `attemptCount`
  - `lastFailureStep`
  - `lastFailureReason`
  - `usageTotals`
- Candidate helper modules:
  - `src/lib/agent/ats-enhancement-observability.ts`
  - `src/lib/agent/ats-enhancement-retry.ts`
  - `src/lib/agent/tools/build-rewrite-plan.ts`
- Candidate new validations:
  - summary claims must map back to existing experience or skills
  - skills reordered or grouped, but not newly introduced by synonymous wording without evidence
  - repeated bullets or contradictory section wording are flagged before persistence
- Candidate stress fixtures:
  - long experience arrays with many bullets
  - sparse skills plus verbose summary
  - malformed single-section rewrite responses that require targeted retry
</specifics>

<deferred>
## Deferred Ideas

- UI progress indicators for ATS-enhancement internals
- cost optimization via model tier changes or caching across sessions
- bringing the same reliability treatment to `job_targeting` in this phase
</deferred>

---

*Phase: CURRIA-09-ats-enhancement-reliability-hardening*
*Context gathered: 2026-04-14 via roadmap and code inspection*
