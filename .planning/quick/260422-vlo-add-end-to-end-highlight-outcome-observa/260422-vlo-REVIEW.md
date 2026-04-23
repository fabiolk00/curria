# Review - Quick Task 260422-vlo

## Verdict

Issues found. The plan is close, but it does **not** yet guarantee diagnosis of every silent zero-highlight outcome without guessing.

## Findings

### 1. Blocker - The plan stops at serialization and misses the renderer-mismatch seam

- The stated goal is end-to-end diagnosis when the final user-visible result is "no highlights" (`260422-vlo-PLAN.md:5`).
- The research explicitly identifies `renderer_mismatch` as a silent zero-highlight introduction point and recommends a renderability check at the serialization boundary (`260422-vlo-RESEARCH.md:10`, `260422-vlo-RESEARCH.md:17-19`, `260422-vlo-RESEARCH.md:55`, `260422-vlo-RESEARCH.md:89-93`, `260422-vlo-RESEARCH.md:112-113`, `260422-vlo-RESEARCH.md:140-142`, `260422-vlo-RESEARCH.md:212`, `260422-vlo-RESEARCH.md:218`).
- Task 3 only covers omission/presence classification on the response surfaces (`260422-vlo-PLAN.md:66-90`). If the API returns a non-empty `highlightState` but the rendered view still shows zero highlights, telemetry will stop at "present" and the last hop will still require guessing.

Fix:
- Add a shared renderability-summary step at the response boundary and log a distinct mismatch outcome when stored highlights exist but renderable segments are zero.
- Add a regression test for that mismatch branch.

### 2. Blocker - Task 3 omits the shared helper that actually controls response classification

- Both response surfaces already delegate highlight exposure classification to `buildHighlightStateResponseOutcome(...)` (`src/lib/routes/session-comparison/decision.ts:78-95`, `src/app/api/session/[id]/route.ts:57-74`).
- Task 3 does not include `src/lib/agent/highlight-observability.ts` in its file list (`260422-vlo-PLAN.md:68-72`).
- That helper currently declares `artifact_empty` but never returns it, and collapses every present artifact into `not_applicable` (`src/lib/agent/highlight-observability.ts:3-7`, `src/lib/agent/highlight-observability.ts:39-77`).

Impact:
- The planned `present_empty` vs `present_non_empty` outcome split (`260422-vlo-PLAN.md:76-82`) is not actually wired through the shared seam both routes use.
- Without adding the helper to scope, the executor either duplicates logic in both routes or leaves the empty/non-empty distinction impossible.

Fix:
- Add `src/lib/agent/highlight-observability.ts` to Task 3.
- Make the helper return distinct empty-present vs non-empty-present outcomes and keep both routes thin by logging from the shared result.

### 3. Warning - The verification scope is still too loose for the new vocabulary

- The current route/comparison tests assert only omission branches: `preview_locked` and `artifact_missing` (`src/lib/routes/session-comparison/decision.test.ts:155-160`, `src/lib/routes/session-comparison/decision.test.ts:210-215`, `src/app/api/session/[id]/route.test.ts:180-185`, `src/app/api/session/[id]/route.test.ts:256-261`).
- The plan says Task 3 will distinguish `present_empty` and `present_non_empty` (`260422-vlo-PLAN.md:77-82`), but it does not explicitly require those positive-availability cases on both surfaces.
- Task 2 likewise says "at least one ATS flow and one job-targeting flow" (`260422-vlo-PLAN.md:56`), which is weaker than the branch matrix called out in the research for skip, rollback, thrown-error, and persisted-empty paths (`260422-vlo-RESEARCH.md:48-55`, `260422-vlo-RESEARCH.md:87`, `260422-vlo-RESEARCH.md:109-113`, `260422-vlo-RESEARCH.md:216-218`).

Fix:
- Require explicit tests for:
  - response `present_empty`
  - response `present_non_empty`
  - renderer mismatch if added
  - at least one rollback-or-cleared branch per pipeline family, not just a generic ATS/job-targeting happy-path split

## Recommendation

Revise the plan before execution completes:

1. Add the shared response/helper seam to Task 3.
2. Add the renderability mismatch seam so "present in payload but invisible on screen" is diagnosable.
3. Tighten the test matrix so the new outcome vocabulary is asserted, not just logged incidentally.

Without those changes, the work improves observability, but it does not fully close the silent zero-highlight diagnosis loop.
