---
phase: CURRIA-45-improve-billing-transparency-alerts-and-concurrency-proof
plan: "01"
subsystem: payments
tags: [billing, reservations, ledger, alerts, vitest, typescript]
requires:
  - phase: 44-01
    provides: reservation and ledger schema plus atomic reserve, finalize, and release wrappers
  - phase: 44-02
    provides: reservation-backed export runtime, reconciliation flows, and billing-stage diagnostics
provides:
  - shared billing history DTOs for authenticated export credit activity
  - user-scoped reservation and ledger read helpers derived from the existing audit trail
  - typed billing anomaly summaries for stale reconciliation, repeated failures, and reserved backlog alerts
affects: [billing, dashboard-polling, observability, authenticated-api, operator-tooling]
tech-stack:
  added: []
  patterns:
    - billing transparency is derived from credit_reservations and credit_ledger_entries instead of a second mutable history source
    - user-facing copy maps raw ledger enums into localized export credit activity labels
    - operator alert thresholds stay explicit and overridable in repo-native code
key-files:
  created:
    - src/types/billing.ts
    - src/lib/billing/credit-activity.ts
    - src/lib/billing/credit-activity.test.ts
    - src/lib/billing/billing-alerts.ts
    - src/lib/billing/billing-alerts.test.ts
  modified:
    - src/lib/db/credit-reservations.ts
    - src/lib/db/credit-reservations.test.ts
key-decisions:
  - "Expose the first user-facing feed as recent export credit activity because the current audit trail only covers reservation-backed export movements."
  - "Keep billing history and anomaly summaries read-only over the Phase 44 reservation and ledger truth instead of adding a second reporting table."
  - "Encode stale-state, repeated-failure, and backlog thresholds directly in the shared contract so later scripts and APIs reuse the same definitions."
patterns-established:
  - "Authenticated consumers can reuse BillingHistory and BillingAnomalyReport without reading billing tables ad hoc."
  - "Reservation status and reconciliation state remain available in the DTOs even when product copy hides raw internal enum names."
requirements-completed: [BILL-UX-01, BILL-ALERT-01]
duration: 4min
completed: 2026-04-20
---

# Phase 45 Plan 01: Improve billing transparency alerts and concurrency proof Summary

**Recent export credit activity and operator anomaly summaries now share one typed contract derived from the reservation and ledger audit trail.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-20T13:20:56Z
- **Completed:** 2026-04-20T13:24:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added shared billing DTOs for recent export credit activity and anomaly summaries so later API and UI work can stay additive.
- Extended the existing reservation repository with user-scoped ledger and reservation list helpers filtered by `user_id`.
- Added read-only mappers for localized billing history copy and operator alert thresholds over stale reconciliation, repeated failures, and reserved backlog counts.

## Task Commits

1. **Task 1: Define the shared billing transparency DTOs and user-scoped audit reads** - `bb2d9ca` (`test`), `8b8918e` (`feat`)
2. **Task 2: Define anomaly summaries and repo-native alert hook thresholds** - `f3853fe` (`test`), `d6d040e` (`feat`)
3. **Verification follow-up:** `fdd2a35` (`fix`) tightened the new billing test fixtures to satisfy the repo typecheck gate

## Files Created/Modified

- `src/types/billing.ts` - Shared DTOs for billing history and anomaly summaries.
- `src/lib/db/credit-reservations.ts` - User-scoped reservation and ledger list helpers over the existing audit tables.
- `src/lib/db/credit-reservations.test.ts` - Regression proof for per-user ordering and reconciliation-safe reads.
- `src/lib/billing/credit-activity.ts`, `src/lib/billing/credit-activity.test.ts` - Recent export credit activity mapper with localized product-safe copy.
- `src/lib/billing/billing-alerts.ts`, `src/lib/billing/billing-alerts.test.ts` - Repo-native anomaly summarizer with explicit thresholds and machine-readable examples.

## Decisions Made

- The authenticated feed is intentionally labeled as recent export credit activity, not full account history, because the current ledger truth is export-specific.
- DTOs preserve reservation status, reconciliation status, and evidence links for future UI work while the mapped labels stay product-safe.
- Alert helpers stay pure and read-only so later scripts, dashboards, and structured logs can reuse them without mutating billing state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tightened new billing test fixtures to match the shared reservation contract**
- **Found during:** Final verification
- **Issue:** `npm run typecheck` failed because the new test builders widened `reconciliationStatus` to plain `string`, which no longer matched `CreditReservation`.
- **Fix:** Typed the new test builders against `CreditReservation` so fixture literals stay aligned with the repository contract.
- **Files modified:** `src/lib/billing/credit-activity.test.ts`, `src/lib/billing/billing-alerts.test.ts`
- **Verification:** `npm run typecheck`, `npx vitest run src/lib/db/credit-reservations.test.ts src/lib/billing/credit-activity.test.ts`, `npx vitest run src/lib/db/credit-reservations.test.ts src/lib/billing/billing-alerts.test.ts`
- **Committed in:** `fdd2a35`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to satisfy the repo compile gate. No scope creep and no runtime behavior change.

## Issues Encountered

- PowerShell rejected `&&` during commit orchestration, so git and verification commands were run with PowerShell-safe separators instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans can expose billing history through authenticated APIs and UI surfaces without reinterpreting raw ledger rows in multiple places.
- Operator scripts, dashboards, and docs can reuse the anomaly thresholds and examples contract instead of redefining billing risk states.

## Self-Check: PASSED
