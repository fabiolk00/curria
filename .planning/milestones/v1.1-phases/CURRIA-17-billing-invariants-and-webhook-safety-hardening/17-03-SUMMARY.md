# 17-03 Summary

Closed the phase by proving billable generation replay safety and publishing the operator-facing billing invariant checklist.

Added focused resume-generation regressions for:

- failed idempotent replay returning the previous failure without a second charge
- no-credit short-circuit before a pending paid generation is created
- post-render credit-finalization failure marking the generation failed instead of silently succeeding
- target-scope replay preserving `creditsUsed: 0` and `JOB_TARGETING` at the route boundary

Operational docs now distinguish ownership checks from billing replay safety:

- `docs/billing/OPS_RUNBOOK.md` includes a duplicate-charge and generation-replay incident flow
- `docs/operations/security-boundary-audit.md` now calls out billing checkout and paid-generation seams as separate from file ownership alone

Verification:

- `pnpm tsc --noEmit`
- `pnpm vitest run src/lib/resume-generation/generate-billable-resume.test.ts "src/app/api/session/[id]/generate/route.test.ts"`
- `rg -n "duplicate|credit_accounts|processed_events|billing_checkouts|idempotent" docs/billing/OPS_RUNBOOK.md docs/operations/security-boundary-audit.md`
