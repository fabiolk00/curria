# Quick Task 260426-hat Plan

## Scope

Implement only the safe parts of the architectural hardening task:

1. Front 1: add consolidated `job_targeting` pipeline trace observability without persisting debug data in `agentState`.
2. Front 2: document the four ATS `validateRewrite(...)` calls inline and confirm whether any call is redundant before touching behavior.

## Explicit Non-Scope

- Front 3 is intentionally not started.
- We will not migrate ATS save-blocking from `valid` to `blocked` in this task because the user requirement says that front only starts after Fronts 1 and 2 are merged and stable in production.

## Constraints

- Do not persist the new trace to the database.
- Do not remove `valid` or `issues` from `RewriteValidationResult`.
- Keep ATS behavior unchanged while documenting why each validation pass remains in place.
