# Phase 45 Context - Improve billing transparency alerts and concurrency proof

## Decisions

- This phase builds directly on the reservation, ledger, and reconciliation model from Phase 44 without changing the core billing state machine.
- The goal is to make the current billing model more trustworthy and operable by improving three areas together:
  1. user-facing transparency for credit consumption
  2. operator-facing alerts and metrics for degraded billing states
  3. stronger concurrency and end-to-end proof for reservation and reconciliation behavior
- `credit_accounts` remains the fast balance view and `credit_reservations` plus `credit_ledger_entries` remain the billing audit trail.
- New user-facing history must be derived from the existing ledger and reservation data rather than introducing a second history source.
- Existing generate, file, and dashboard surfaces should be preserved and extended rather than replaced.
- Alerting should be actionable and tied to business-risk states such as `needs_reconciliation`, repeated finalize failures, and unusual reservation backlogs.
- Concurrency proof should include both repo-native automated tests and a staging-friendly load or E2E path that can reproduce reservation, release, and reconciliation transitions under stress.
- If some heavier operational tooling cannot be fully automated inside this repo, the phase should still land the scripts, docs, and workflow entrypoints needed for repeated staging verification.

## Claude's Discretion

- Choose the narrowest safe API and UI surface for exposing billing history to authenticated users.
- Decide whether the billing history should live under an existing authenticated dashboard route or a dedicated billing history route, as long as it is secure and understandable.
- Choose the most repo-native alerting and metrics shape available today; if a full external integration is too environment-specific, land structured metrics, thresholds, and clear operational hooks instead.
- Decide whether concurrency proof is best expressed through Vitest integration-style tests, dedicated scripts, k6/Artillery scenarios, or a mix, as long as the result is repeatable and meaningful.

## Deferred Ideas

- Replacing the current credits model with subscription-only export entitlements.
- Migrating billing truth to an external metering platform.
- Replacing the current artifact job runtime with a separately deployed queue system in this phase.
