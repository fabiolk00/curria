# Phase 35: Rewrite State Coherence - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Source:** Investigation of stale resume sourcing after ATS enhancement plus review of earlier rewrite phases

<domain>
## Phase Boundary

Keep the deterministic rewrite contract coherent after an ATS or target-job rewrite has already produced `optimizedCvState`.

In scope:
- chat follow-up rewrites that currently derive `current_content` from stale base `cvState`
- deterministic helper paths that should score, keyword-build, or derive target resumes from the latest effective resume state
- target resume creation paths that should start from the latest optimized resume when one already exists
- regression proof for the user-visible complaint that rewritten experience can appear to come from the old resume rather than the optimized one

Out of scope:
- redesigning the ATS or job-targeting rewrite pipelines themselves
- changing the canonical rule that `cvState` is persisted truth and `agentState` is operational context
- broad product UX changes unrelated to rewrite-state coherence
</domain>

<historical_context>
## Prior Phases Reviewed

- `.planning/milestones/v1.1-phases/06-dialog-continuity-and-model-routing-hardening/06-RESEARCH.md`
- `.planning/milestones/v1.1-phases/06-dialog-continuity-and-model-routing-hardening/06-03-PLAN.md`
- `.planning/milestones/v1.1-phases/CURRIA-08-ats-enhancement-rewrite-pipeline/08-02-PLAN.md`
- `.planning/milestones/v1.1-phases/CURRIA-09-ats-enhancement-reliability-hardening/09-02-SUMMARY.md`
- `.planning/milestones/v1.1-phases/CURRIA-10-target-job-rewrite-pipeline/10-CONTEXT.md`
- `.planning/milestones/v1.3-phases/CURRIA-27-performance-proof-and-critical-route-hardening/27-02-SUMMARY.md`

Key historical truths carried forward:
- Phase 6 established that terse rewrite follow-ups must preserve the latest rewrite intent instead of degrading to stale bootstrap behavior.
- Phases 8 and 9 established `optimizedCvState` as the validated deterministic rewrite output for ATS enhancement.
- Phase 10 extended the same optimized-state discipline to target-job rewriting and target resume persistence.
- Phase 27 deferred ordinary ATS work off the hot chat path, which makes it even more important that later chat rewrites pick the right already-optimized source instead of reconstructing from stale base state.
</historical_context>

<implementation_state>
## Current Implementation Observations

- The ATS enhancement and job-targeting pipelines already populate `agentState.optimizedCvState` with the validated rewritten resume snapshot.
- Some later chat rewrite helpers still read from `session.cvState`, which can cause follow-up rewrite requests to start from stale base data.
- `create_target_resume` also had a stale-source risk when an ATS rewrite already existed, because it could derive a target resume from the pre-optimization base state.
- The user-visible complaint is strongest around experience rewrites, where stale source selection makes it look like the chat is not truly rewriting the latest professional experience content.
</implementation_state>

<canonical_refs>
## Canonical References

- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/index.ts`
- `src/lib/agent/ats-enhancement-pipeline.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/agent/streaming-loop.test.ts`
- `src/lib/agent/tools/index.test.ts`
- `AGENTS.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
</canonical_refs>

---

*Phase: CURRIA-35-harden-rewrite-state-coherence-between-ats-optimized-state-c*
