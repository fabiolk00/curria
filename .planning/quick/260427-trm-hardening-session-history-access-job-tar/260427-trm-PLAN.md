# Quick Task 260427-trm: Hardening session history access, job targeting start idempotency, and override review highlights

## Plan

1. Remove AI chat plan gating from `GET /api/session/[id]` and add a dedicated AI chat snapshot route that keeps Pro gating isolated.
2. Add job-targeting start idempotency around `/api/profile/smart-generation` plus a frontend pre-await guard for the initial generation CTA.
3. Generate deterministic override review highlights from validation metadata and render warning-mode copy in the comparison UI.

## Verification

- Run focused Vitest suites for session route, smart generation route, highlight artifact/module, pipeline, and comparison component where feasible.
- Run typecheck.
