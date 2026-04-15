# Phase 36: Freeform Vacancy Analysis Robustness - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Source:** Repeated job-targeting failures caused by weak `targetRole` extraction from freeform vacancy text

<domain>
## Phase Boundary

Make target-job analysis resilient when the user pastes arbitrary vacancy text instead of a clean title-plus-requirements structure.

In scope:
- target-role extraction that currently promotes headings or recruiter prose into `targetRole`
- targeting-plan logic that should rely primarily on vacancy semantics such as skills, responsibilities, and seniority signals
- job-targeting rewrite safety so unsupported skills do not routinely cause the whole flow to fail
- user-visible failure handling that should distinguish factual blockers from likely vacancy-parsing bugs
- regression proof for Portuguese and English heading-like vacancy text

Out of scope:
- replacing the existing deterministic ATS and job-targeting pipeline architecture
- weakening factual validation so unsupported claims can pass silently
- redesigning the whole workspace or generation UX beyond the failure explanation already present
</domain>

<historical_context>
## Prior Phases Reviewed

- `.planning/milestones/v1.1-phases/06-dialog-continuity-and-model-routing-hardening/06-RESEARCH.md`
- `.planning/milestones/v1.1-phases/CURRIA-08-ats-enhancement-rewrite-pipeline/08-02-PLAN.md`
- `.planning/milestones/v1.1-phases/CURRIA-09-ats-enhancement-reliability-hardening/09-CONTEXT.md`
- `.planning/milestones/v1.1-phases/CURRIA-09-ats-enhancement-reliability-hardening/09-02-SUMMARY.md`
- `.planning/milestones/v1.1-phases/CURRIA-10-target-job-rewrite-pipeline/10-CONTEXT.md`
- `.planning/phases/CURRIA-35-harden-rewrite-state-coherence-between-ats-optimized-state-c/35-PLAN-AUDIT.md`

Key historical truths carried forward:
- Phase 6 established that rewrite follow-ups must preserve user intent instead of degrading into brittle bootstrap behavior.
- Phases 8 and 9 established deterministic full-resume rewriting plus factual validation as the contract for ATS safety.
- Phase 10 established that target-job rewriting should adapt to a vacancy while staying honest about missing skills and unsupported fit.
- Phase 35 restored downstream coherence around the latest effective optimized resume state; this phase must preserve that contract while making vacancy interpretation more robust.
</historical_context>

<implementation_state>
## Current Implementation Observations

- `buildTargetingPlan(...)` still tries to infer one `targetRole` too early and gives that field too much influence over the rewrite instructions.
- Freeform vacancy text can currently produce bad role labels such as `About The Job`, `Responsabilidades E Atribuicoes`, or long recruiter prose like `Buscamos profissionais com forte experiencia...`.
- The rewrite prompt already includes vacancy context, but it still frames the work strongly around `targetRole` even when that value is low quality.
- Validation correctly blocks unsupported skills, but job targeting still fails too often because the rewritten skills list can introduce tools that are present in the vacancy but absent from the original resume.
- The user expectation is reasonable: if they paste any vacancy text, the system should still analyze the vacancy semantics and show a useful result instead of collapsing on formatting quirks.
</implementation_state>

<canonical_refs>
## Canonical References

- `src/lib/agent/tools/build-targeting-plan.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/agent/tools/validate-rewrite.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/components/dashboard/resume-workspace.tsx`
- `src/lib/agent/tools/build-targeting-plan.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `src/components/dashboard/resume-workspace.test.tsx`
- `src/types/agent.ts`
- `AGENTS.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
</canonical_refs>

---

*Phase: CURRIA-36-make-target-job-analysis-robust-to-freeform-vacancy-text-and*
