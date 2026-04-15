# Phase 10: Target Job Rewrite Pipeline - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** User Task 2 brief plus inspection of existing target-job and ATS-enhancement seams

<domain>
## Phase Boundary

Implement a deterministic full-resume rewrite workflow for the "resume present + target job present" case.

The product already detects target jobs, persists them, and can run gap analysis. This phase extends that path so gap analysis becomes an intermediate artifact that always feeds a full target-job rewrite, factual validation, targeted version persistence, and preview/export readiness.

In scope:
- explicit `workflowMode = job_targeting` when resume context and target job context coexist
- preserve and reuse current target job detection plus gap analysis flow
- treat `gapAnalysis` and `targetFitAssessment` as intermediate state rather than the final outcome
- add a structured targeting plan used to guide rewrite consistency
- deterministically rewrite the full resume for the target job
- validate the rewritten result against fabricated fit or invented facts
- persist a distinct targeted version linked to the target job
- make targeted optimized state the source of preview/export when present

Out of scope for this phase:
- reopening the resume-only ATS-enhancement architecture
- UI redesigns for target-job comparison or editing
- broad changes to phase enums beyond the smaller `workflowMode + rewriteStatus` approach
- inventing new resume facts to close target-job gaps
</domain>

<implementation_state>
## Current Implementation Observations

- `src/app/api/agent/route.ts` already resolves `workflowMode` and can persist detected target job descriptions.
- The route already has seams around detected target-job persistence and gap-analysis generation, including retry-aware gap analysis helpers.
- `gapAnalysis` and `targetFitAssessment` are currently persisted, but there is no mandatory full resume rewrite after successful gap analysis.
- The shared rewrite and validation stack added in Phases 8 and 9 already handles deterministic section-based rewriting, explicit rewrite planning, factual validation, retry ceilings, and structured observability for `ats_enhancement`.
- Versioning and preview/export already understand base optimized ATS snapshots, but they do not yet treat target-job-targeted optimized snapshots as first-class rewrite outputs for the same session plus target context.
- The current target-job path does not yet require a stable `job_targeting` workflow log schema keyed by stage, retry attempt, and outcome, even though the same observability discipline now exists for ATS enhancement.
- High processing cost remains a real risk for target-job rewriting because the current planning baseline does not yet bind target-job execution to explicit retry ceilings, payload shaping, or stress fixtures for long job descriptions plus large resumes.
</implementation_state>

<decisions>
## Implementation Decisions

### Workflow Resolution
- Keep `workflowMode` explicit and use `job_targeting` whenever resume context and `targetJobDescription` are both present.
- Do not rely on `runAgentLoop(...)` to decide whether the target-job rewrite should happen.

### Gap Analysis Role
- Treat `gapAnalysis` as an intermediate step, not the terminal output.
- `gapAnalysis` must feed:
  - rewrite planning
  - target fit explanation
  - final full-resume targeting rewrite

### Rewrite Strategy
- Reuse the shared full-rewrite architecture from ATS enhancement, but extend it with `mode: 'job_targeting'`.
- Rewrite by section with stronger target-job guidance:
  - summary aligned to target role
  - experience bullets reprioritized and reworded for the target
  - skills reordered by relevance
  - education and certifications kept factual and cleaned up only
- Never invent experience, tools, or fake fit to close gaps.

### Targeting Plan Strategy
- Add an explicit intermediate targeting plan artifact derived from:
  - original `cvState`
  - `targetJobDescription`
  - `gapAnalysis`
- Use that plan to keep summary, experience, and skills aligned around the same target-job strategy.

### Persistence Strategy
- Persist target-job rewrite state in `agentState`, including:
  - `targetingPlan`
  - `rewriteStatus`
  - `optimizedCvState`
  - `optimizationSummary`
- Persist a distinct targeted version with metadata tied to the target job so it is distinguishable from generic ATS enhancement.

### Reliability and Observability Strategy
- Extend the Phase 9 discipline to `job_targeting` runs:
  - bounded retries
  - payload shaping for oversized target-job rewrite inputs
  - structured logs keyed by `workflowMode`, stage, and outcome
- Add at least one regression that proves target detection and persistence still hold while the deterministic rewrite pipeline runs.

### Brownfield Constraint
- Prefer the smaller state model change: keep phase handling simple and use `workflowMode` plus rewrite state instead of introducing a large new phase enum tree.
- Reuse existing versioning, generation, and session seams rather than creating a parallel target-job pipeline stack from scratch.
</decisions>

<canonical_refs>
## Canonical References

- `src/app/api/agent/route.ts`
- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/agent/tools/build-rewrite-plan.ts`
- `src/lib/agent/tools/validate-rewrite.ts`
- `src/lib/agent/ats-enhancement-pipeline.ts`
- `src/lib/db/sessions.ts`
- `src/lib/db/cv-versions.ts`
- `src/lib/agent/tools/index.ts`
- `src/app/api/file/[sessionId]/route.ts`
- `src/app/api/session/[id]/route.ts`
- `src/lib/dashboard/workspace-client.ts`
- `src/types/agent.ts`
- `AGENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
</canonical_refs>

<specifics>
## Specific Ideas

- candidate new module:
  - `src/lib/agent/tools/build-targeting-plan.ts`
- candidate new data type:
  - `TargetingPlan`
- candidate orchestration seam:
  - `runJobTargetingPipeline(session, targetJobDescription)` or equivalent helper colocated with existing route logic
- candidate persistence metadata:
  - `source: job_targeting`
  - `targetJobHash`
  - `targetRole`
  - `keywordCoverageSnapshot`
- candidate validation extensions:
  - reject fake alignment wording unsupported by experience
  - reject skills elevated for the target role when not evidenced in the original resume
</specifics>

---

*Phase: CURRIA-10-target-job-rewrite-pipeline*
*Context gathered: 2026-04-14 via Task 2 brief and current codebase seams*
