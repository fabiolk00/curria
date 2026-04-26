# Quick Task 260426-isx Plan

## Scope

Harden the post-refactor `job_targeting` validation UX without changing ATS-only behavior:

1. Correct the Rule 8 warning copy so it matches the current original-evidence logic.
2. Surface successful `job_targeting` warnings to the user in a visible but non-blocking way.
3. Split blocking issues and advisory observations inside the 422 validation modal.

## Constraints

- Do not change the backend behavior of `validateRewrite`, `runJobTargetingPipeline`, or `buildTargetingPlan`.
- Keep the `issues` compatibility alias intact.
- Do not introduce ATS-specific warning rendering or ATS route-contract changes.

## Implementation Notes

- Use the existing success toast surface in `user-data-page.tsx` because the page redirects immediately after a successful generation, so an inline banner on the source page would not remain visible.
- Read `hardIssues` and `softWarnings` directly in the modal, with `issues` only as a compatibility fallback when building local state.
