# Phase 45 Validation

## Goal

Prove that reservation-backed export billing becomes inspectable for authenticated users, actionable for operators, and safe under concurrent retries without changing the existing billing state machine or authenticated route surfaces.

## Validation Architecture

### Wave 1: Shared history and anomaly contracts

- `npx vitest run src/lib/db/credit-reservations.test.ts src/lib/billing/credit-activity.test.ts`
  - proves user-scoped audit reads stay derived from `credit_reservations` plus `credit_ledger_entries`
  - proves recent export credit activity maps raw ledger events into product-safe PT-BR copy
- `npx vitest run src/lib/db/credit-reservations.test.ts src/lib/billing/billing-alerts.test.ts`
  - proves stale `needs_reconciliation`, repeated finalize or release failures, and reserved backlog thresholds are summarized through one shared anomaly contract

### Wave 2: Authenticated user surface

- `npx vitest run src/app/api/billing/history/route.test.ts`
  - proves the new history endpoint is authenticated, user-scoped, and returns the shared DTO contract
- `npx vitest run src/components/dashboard/billing-activity-card.test.tsx`
  - proves the additive settings-surface card renders localized history, empty state, reconciliation messaging, and non-blocking degraded loading states

### Wave 2: Operator alerts and concurrency proof

- `npx vitest run src/lib/db/credit-reservations.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/asaas/reconciliation.test.ts "src/app/api/session/[id]/generate/route.test.ts"`
  - proves concurrent reserve, finalize, release, and reconciliation paths remain idempotent and do not double-hold credits under retries
- `npx vitest run scripts/stress-export-generation.test.ts`
  - proves the export stress harness stays parseable, reports anomalies clearly, and exits non-zero on unsafe outcomes
- `npx tsx scripts/stress-export-generation.ts --help`
  - proves the staging-friendly export stress entrypoint is runnable from the repo without extra infrastructure
- `npx tsx scripts/check-staging-billing-state.ts --help`
  - proves the staging snapshot helper remains the repo-native operator entrypoint for billing evidence
- `npm run typecheck`
  - proves the new billing DTOs, route surface, settings card, scripts, and operator helpers remain type-safe together

## Requirement Mapping

| Requirement | Evidence |
|-------------|----------|
| `BILL-UX-01` | `src/lib/billing/credit-activity.test.ts`, `src/app/api/billing/history/route.test.ts`, `src/components/dashboard/billing-activity-card.test.tsx` |
| `BILL-ALERT-01` | `src/lib/billing/billing-alerts.test.ts`, `scripts/stress-export-generation.test.ts`, `docs/billing/MONITORING.md`, `docs/billing/OPS_RUNBOOK.md`, `docs/staging/VALIDATION_PLAN.md` |
| `BILL-CONC-01` | `src/lib/db/credit-reservations.test.ts`, `src/lib/resume-generation/generate-billable-resume.test.ts`, `src/lib/asaas/reconciliation.test.ts`, `src/app/api/session/[id]/generate/route.test.ts`, `scripts/stress-export-generation.test.ts` |

## Open Questions (RESOLVED)

1. **Should the first user-facing feed include all billing events?** RESOLVED: no; Phase 45 will ship "recent export credit activity" first because the existing audit trail currently covers export reservation movements only.
2. **Should billing history extend optional billing-info loading or use a dedicated route?** RESOLVED: use a dedicated authenticated read-only history route so plan and balance metadata stay isolated from the new timeline payload.
3. **How far should concurrency proof go in this phase?** RESOLVED: require both repo-local automated race coverage and a staging-friendly export stress harness plus documented operator commands.
