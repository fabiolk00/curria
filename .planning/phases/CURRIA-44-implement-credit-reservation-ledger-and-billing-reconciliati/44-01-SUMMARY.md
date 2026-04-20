---
phase: CURRIA-44-implement-credit-reservation-ledger-and-billing-reconciliati
plan: "01"
subsystem: payments
tags: [billing, reservations, ledger, prisma, vitest]
requires:
  - phase: CURRIA-43-refactor-export-and-billing-pipeline-resilience
    provides: artifact-first export completion semantics and degraded billing fallback boundaries
provides:
  - reservation-backed credit accounting contract keyed by generation intent
  - append-only ledger foundation that keeps credit_accounts as the fast runtime balance view
  - typed reserve/finalize/release billing wrappers for later runtime integration
affects: [billing, export-generation, prisma-schema, migration-guardrails]
tech-stack:
  added: []
  patterns:
    - generation-intent-keyed credit reservations wrap export billing in explicit reserve finalize and release transitions
    - credit_accounts stays hot-path balance state while ledger entries become the auditable trail
    - billing wrappers fail closed when reservation rpc infrastructure drifts
key-files:
  created:
    - prisma/migrations/20260420_credit_reservation_ledger.sql
    - src/lib/db/credit-reservations.ts
    - src/lib/db/credit-reservations.test.ts
  modified:
    - prisma/schema.prisma
    - src/lib/db/schema-guardrails.ts
    - src/lib/db/schema-guardrails.test.ts
    - src/lib/asaas/quota.ts
    - src/lib/asaas/quota.test.ts
key-decisions:
  - "Reservation state lives in credit_reservations while append-only movement history lives in credit_ledger_entries."
  - "Reserve, finalize, and release transition through Postgres RPCs so balance mutation and ledger writes stay atomic at the database boundary."
  - "credit_accounts remains the fast balance view; wrappers do not recompute balance from the ledger on each runtime read."
patterns-established:
  - "Retrying the same generation intent reuses the existing reservation instead of attempting a second hold."
  - "Finalize and release append zero-delta or refund ledger entries without re-spending the held credit."
  - "Missing reservation functions, tables, columns, or enum types raise explicit billing errors instead of silently consuming or skipping credits."
requirements-completed: [BILL-RES-01, BILL-LEDGER-01]
duration: 7min
completed: 2026-04-20
---

# Phase 44 Plan 01: Add reservation and ledger schema plus atomic billing wrappers Summary

**Credit reservation and ledger primitives now exist as a brownfield-safe billing seam, so later export runtime work can reserve, finalize, and release one credit per generation intent without changing the current route surface.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-20T04:20:45Z
- **Completed:** 2026-04-20T04:27:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added typed `credit_reservations` and `credit_ledger_entries` contracts in Prisma plus a repository module that maps reservation rows, ledger rows, and explicit reserve/finalize/release lifecycle semantics.
- Landed `20260420_credit_reservation_ledger.sql` with the new billing tables, indexes, and atomic Postgres RPCs that mutate `credit_accounts` and append ledger entries for hold, finalize, and release transitions.
- Extended `src/lib/asaas/quota.ts` with app-facing reservation-backed wrappers so later runtime work can call a stable billing seam without reinterpreting the database contract.
- Updated the database schema guardrail classification so the new billing tables remain explicitly tracked by the repo's migration audit.

## Task Commits

1. **Task 1: Define the reservation and ledger contract before runtime wiring** - `ce44f5c` (`test`), `ccf57ce` (`feat`)
2. **Task 2: Add schema and billing wrappers for atomic reserve, finalize, and release** - `a9551b3` (`test`), `411f0a2` (`feat`)

## Files Created/Modified

- `prisma/migrations/20260420_credit_reservation_ledger.sql` - Adds the reservation table, append-only ledger table, supporting enums, indexes, and the atomic reserve/finalize/release RPCs.
- `prisma/schema.prisma` - Reflects the new reservation and ledger models and their optional evidence links to jobs, sessions, targets, and generations.
- `src/lib/db/credit-reservations.ts`, `src/lib/db/credit-reservations.test.ts` - Defines the typed repository contract, lifecycle helpers, ledger readers, and regression proof for idempotent reservation behavior.
- `src/lib/db/schema-guardrails.ts`, `src/lib/db/schema-guardrails.test.ts` - Classifies the new billing tables so the migration guardrail stays explicit.
- `src/lib/asaas/quota.ts`, `src/lib/asaas/quota.test.ts` - Exposes reserve/finalize/release wrappers for application code and proves they fail closed when reservation infrastructure drifts.

## Decisions Made

- Generation intent, not `resume_generation_id`, is the primary reservation key; `resume_generation_id` is linked as optional supporting evidence only.
- Reservation transitions stay database-atomic through RPCs because they cross the financial trust boundary and must update both `credit_accounts` and ledger history consistently.
- The ledger records hold, finalize, and release as append-only entries while `credit_accounts` continues serving fast runtime balance reads to avoid widening the brownfield blast radius.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## User Setup Required

None - no manual credentials or external operator step was needed for this plan.

## Next Phase Readiness

- Export runtime code can now be rewired onto a stable `reserve -> render -> finalize/release` billing seam without redesigning existing routes or durable job contracts.
- Operators have a concrete reservation and ledger foundation to support later reconciliation and observability work in Phase 44 Plan 02.

## Self-Check: PASSED
