# Phase 3 Staging Evidence Log

**Phase:** 03-billing-settlement-validation  
**Status:** blocked pending operator prerequisites  
**Last updated:** 2026-04-10T05:57:00Z

## Repo-local proof completed

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | New helper scripts and docs compile cleanly with the repo's TypeScript config. |
| `npm test -- src/lib/asaas/event-handlers.test.ts src/app/api/webhook/asaas/route.test.ts src/lib/asaas/credit-grants.test.ts src/lib/asaas/quota.test.ts src/app/api/checkout/route.test.ts` | PASS | Existing billing contract remains green after the Wave 1 tooling and doc updates. |
| `npx tsx scripts/replay-staging-asaas.ts --list-scenarios` | PASS | Seven named scenarios are committed and discoverable. |
| `npx tsx scripts/check-staging-billing-state.ts --help` | PASS | Snapshot helper is committed and exposes the expected billing tables. |

## Live staging attempts from this workstation

### Preflight attempt

- **Command:** `bash scripts/verify-staging.sh`
- **Result:** BLOCKED
- **Observed output:**

```text
<3>WSL (9 - Relay) ERROR: CreateProcessCommon:800: execvpe(/bin/bash) failed: No such file or directory
```

### Baseline snapshot attempt

- **Command:** `npx tsx scripts/check-staging-billing-state.ts --user usr_staging_001`
- **Result:** BLOCKED
- **Observed output:**

```text
[check-staging-billing-state] Failed: ENOENT: no such file or directory, open 'C:\CurrIA\.env.staging'
```

### Additional observed prerequisites

- `.env.staging` is not present in the repo root on this machine.
- `psql` is not available on PATH in this PowerShell environment.
- Without Bash, `.env.staging`, and `psql`, no baseline `billing_checkouts`, `credit_accounts`, `user_quotas`, or `processed_events` snapshot can be captured yet.

## Scenario matrix

### one_time_settlement

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### inactive_subscription_snapshot

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### initial_recurring_activation

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### renewal_replace_balance

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### cancellation_metadata_only

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### duplicate_delivery

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

### partial_success_reconcile

- **Status:** Not executed
- **Blocker:** operator prerequisites missing
- **BILL-01:** not evaluated
- **BILL-02:** not evaluated
- **BILL-03:** not evaluated

## Display-total evidence status

- `runtime_balance`: not captured yet
- `display_total`: not captured yet
- `credit_accounts`: snapshot blocked by missing `.env.staging` and `psql`
- `user_quotas`: snapshot blocked by missing `.env.staging` and `psql`

## Next operator step

1. Run Phase 3 from a workstation that has Bash, `psql`, and `.env.staging`.
2. Rerun `bash scripts/verify-staging.sh`.
3. Capture a baseline snapshot with `npx tsx scripts/check-staging-billing-state.ts --user usr_staging_001`.
4. Append real scenario commands, responses, and post-run state to this file.
