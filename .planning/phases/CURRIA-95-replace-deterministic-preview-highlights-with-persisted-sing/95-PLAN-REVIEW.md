# Phase 95 Plan Review

**Verdict:** BLOCK

The plan is aligned with the phase goal, but it is not yet safe to execute. The biggest problems are incomplete legacy-cleanup coverage, a missing client/manual-edit seam for stale highlight artifacts, and plan scope that is too large for one execution plan.

## Blocking Findings

### 1. Legacy metric-preservation cleanup is incomplete and will not actually retire the old runtime

The plan says Phase 95 removes the deterministic highlight engine and the stale metric-preservation preview architecture, but the current runtime still depends on that subsystem in files the plan does not fully account for:

- `src/lib/agent/ats-enhancement-pipeline.ts` still imports `metric-impact-guard` and `metric-impact-observability`
- `src/lib/agent/ats-enhancement-retry.ts` still imports `isHighValueMetricBullet`
- `src/lib/agent/tools/rewrite-resume-full.ts` still imports `countPreservedMetricImpactBullets`
- `src/lib/agent/tools/validate-rewrite.ts` still imports metric-impact helpers and returns `editorialMetrics`
- tests still import the old modules from:
  - `src/lib/resume/optimized-preview-contracts.test.ts`
  - `src/lib/agent/tools/metric-impact-guard.test.ts`
  - `src/lib/agent/tools/metric-impact-observability.test.ts`

The plan touches some of these files, but it does not explicitly cover all of the remaining runtime and test importers. In particular, `ats-enhancement-retry.ts` is missing from `files_modified`, so deleting `metric-impact-guard.ts` would leave a live runtime dependency behind.

**Required fix:** add explicit work to replace the retry prioritization seam, remove the ATS pipeline observability/editorial-metric callsites, and update or delete every remaining direct importer before deleting the old modules.

### 2. The manual-edit lifecycle is underplanned and can still produce stale-range rendering

The plan correctly says `/manual-edit` must clear `highlightState`, but it does not finish the client-side seam. Today:

- `src/components/resume/resume-comparison-page.tsx` fetches comparison data once
- `src/components/resume/resume-comparison-view.tsx` keeps a local `currentOptimizedCvState`
- the optimized editor save path updates local `currentOptimizedCvState` immediately

That means clearing `highlightState` only on the server is not enough. Without an explicit client action, the page can keep rendering the pre-save highlight artifact against the post-save optimized text until a refetch happens.

This directly conflicts with the phase guardrail that invalid ranges must fail closed and never break rendering.

**Required fix:** add explicit page/view wiring so optimized manual saves either:

- refetch the comparison payload after save, or
- clear the local highlight artifact immediately when `currentOptimizedCvState` changes

Add a regression test for "optimized manual save clears visible highlights until a new artifact exists."

### 3. The persisted-highlight prop chain is not fully planned end-to-end

The new artifact must flow through:

- comparison/session response
- comparison page
- comparison view renderer

The plan updates the response types and the renderer, but it does not include `src/components/resume/resume-comparison-page.tsx`, which is the concrete prop bridge between `ResumeComparisonResponse` and `ResumeComparisonView`.

Without that file in scope, the renderer migration is incomplete.

**Required fix:** add `src/components/resume/resume-comparison-page.tsx` to the plan and explicitly wire `highlightState` through it, with test coverage.

### 4. Scope exceeds the execution budget for a single plan

`95-01-PLAN.md` currently spans 27 files across:

- new shared contracts/helpers
- new OpenAI detector
- ATS and job-targeting lifecycle changes
- manual-edit and reset seams
- route serialization
- renderer migration
- deterministic-engine removal
- metric-preservation subsystem removal
- broad test rewrites

That is above the documented blocker threshold for files per plan and mixes foundation, lifecycle plumbing, UI migration, and destructive cleanup in one pass.

**Required fix:** split this into at least 3 plans, for example:

1. contracts + detector + normalization
2. pipeline/manual-edit/reset lifecycle plumbing
3. route/renderer wiring + legacy cleanup + test retirement

### 5. Nyquist validation gate is missing

No `*-VALIDATION.md` exists in the Phase 95 directory, while `95-RESEARCH.md` includes a `Validation Architecture` section. Per the gate rules, this is a blocking failure and checks 8a-8d cannot pass yet.

**Required fix:** regenerate Phase 95 validation artifacts before execution.

### 6. Research is not fully resolved

`95-RESEARCH.md` still has an unresolved `## Open Questions` section instead of `## Open Questions (RESOLVED)`.

The unresolved decisions are material to execution:

- whether locked previews omit `highlightState` or return an empty artifact
- whether `reason` is persisted even if the UI does not render it yet

The plan assumes answers, but the research artifact does not lock them.

**Required fix:** resolve those questions in `95-RESEARCH.md` and mark the section resolved before execution.

## Structured Issues

```yaml
issues:
  - plan: "95-01"
    dimension: "requirement_coverage"
    severity: "blocker"
    description: "The plan does not fully cover removal of the legacy metric-preservation runtime because current importers remain outside the planned file set, including src/lib/agent/ats-enhancement-retry.ts and legacy direct-import tests."
    fix_hint: "Add explicit cleanup tasks/files for ats-enhancement-retry.ts, ats-enhancement-pipeline.ts callsite removal, and all remaining direct-import tests before deleting metric-impact modules."

  - plan: "95-01"
    dimension: "key_links_planned"
    severity: "blocker"
    description: "The manual-edit lifecycle is not wired end-to-end. Clearing highlightState only in the server route still allows ResumeComparisonView to hold stale highlight data against locally edited optimized text until refetch."
    fix_hint: "Plan client-side invalidation or forced refetch after optimized manual save and cover it with a comparison-page/view regression test."

  - plan: "95-01"
    dimension: "key_links_planned"
    severity: "blocker"
    description: "The persisted highlight artifact is not fully wired from response to renderer because src/components/resume/resume-comparison-page.tsx is not included in the plan."
    fix_hint: "Add resume-comparison-page.tsx to the plan and explicitly pass highlightState from ResumeComparisonResponse into ResumeComparisonView."

  - plan: "95-01"
    dimension: "scope_sanity"
    severity: "blocker"
    description: "Plan 95-01 modifies 27 files in one execution plan, exceeding the blocker threshold and mixing foundation, lifecycle plumbing, UI migration, and destructive cleanup."
    fix_hint: "Split the phase into multiple plans with dependency order: contracts/detector, lifecycle plumbing, then route-renderer cleanup."

  - plan: null
    dimension: "nyquist_compliance"
    severity: "blocker"
    description: "VALIDATION.md not found for Phase 95."
    fix_hint: "Re-run /gsd-plan-phase 95 --research to regenerate the validation artifact before execution."

  - plan: null
    dimension: "research_resolution"
    severity: "blocker"
    description: "95-RESEARCH.md still contains an unresolved 'Open Questions' section."
    fix_hint: "Resolve the locked-preview highlightState contract and reason-persistence decision, then rename the section to '## Open Questions (RESOLVED)'."
```

## Recommendation

Revise the phase before execution. The safest path is:

1. lock the remaining research/validation artifacts
2. split the work into smaller plans
3. add explicit coverage for the remaining metric-impact importers and the comparison-page/manual-edit wiring seam
