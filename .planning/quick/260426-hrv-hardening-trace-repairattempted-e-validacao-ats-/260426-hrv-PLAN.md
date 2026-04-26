# Quick Task 260426-hrv Plan

## Scope

Implement the two remaining hardening items from the follow-up audit:

1. Front 1: stop logging a fake `repairAttempted: false` in the `job_targeting` trace and propagate the real repair-attempt signal from `analyzeGap(...)`.
2. Front 2: re-audit the fourth ATS `validateRewrite(...)` call and remove it if the fallback is just validating the original CV against itself.

## Decision

- Front 1 uses **Option A**: expose `repairAttempted` from `analyzeGap(...)` because repair execution is relevant to production diagnosis and cheap to propagate honestly.
- Front 2 removes the fourth ATS validation call because the deeper audit proves it was vacuous once the pipeline fell back to the canonical original CV snapshot.

## Constraints

- Do not start Front 3 of the architectural hardening.
- Keep `valid` and `issues` in the validation contract.
- Prove ATS safety with focused tests after touching the production ATS pipeline.
