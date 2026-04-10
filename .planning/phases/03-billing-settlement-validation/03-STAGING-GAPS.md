# Phase 3 Staging Gaps

**Phase:** 03-billing-settlement-validation  
**Status:** Open  
**Last updated:** 2026-04-10T05:57:00Z

## Open

### Gap 1: Bash preflight cannot run from this workstation

- **scenario:** phase_preflight
- **requirement_ids:** BILL-01, BILL-02, BILL-03
- **issue_class:** operator
- **observed_behavior:** `bash scripts/verify-staging.sh` fails before script execution because `/bin/bash` is unavailable in the current environment.
- **expected_behavior:** Phase 3 operators can run the committed preflight script before any staging replay attempt.
- **owner_files:** `scripts/verify-staging.sh`, `docs/staging/SETUP_GUIDE.md`
- **status:** Open

### Gap 2: `.env.staging` is missing

- **scenario:** baseline_snapshot
- **requirement_ids:** BILL-01, BILL-02, BILL-03
- **issue_class:** operator
- **observed_behavior:** `npx tsx scripts/check-staging-billing-state.ts --user usr_staging_001` fails with `ENOENT` because `.env.staging` does not exist.
- **expected_behavior:** Operators can load staging credentials from `.env.staging` and capture baseline billing state before replay.
- **owner_files:** `.env.staging.example`, `docs/staging/SETUP_GUIDE.md`, `scripts/check-staging-billing-state.ts`
- **status:** Open

### Gap 3: `psql` is unavailable on PATH

- **scenario:** baseline_snapshot
- **requirement_ids:** BILL-01, BILL-02, BILL-03
- **issue_class:** operator
- **observed_behavior:** This workstation does not have `psql` available, so the committed snapshot helper cannot query `billing_checkouts`, `credit_accounts`, `user_quotas`, or `processed_events`.
- **expected_behavior:** Operators can capture JSON snapshots from the staging database using the committed helper.
- **owner_files:** `scripts/check-staging-billing-state.ts`, `docs/staging/SETUP_GUIDE.md`, `scripts/README.md`
- **status:** Open

### Gap 4: Live staging credentials and endpoints are not available in this session

- **scenario:** full_matrix
- **requirement_ids:** BILL-01, BILL-02, BILL-03
- **issue_class:** operator
- **observed_behavior:** No live replay could be attempted because the required staging credentials and API/database access are not available from this environment.
- **expected_behavior:** Operators can run the full settlement matrix and compare `runtime_balance` against `display_total` with auditable evidence.
- **owner_files:** `docs/staging/VALIDATION_PLAN.md`, `docs/billing/OPS_RUNBOOK.md`, `scripts/replay-staging-asaas.ts`
- **status:** Open

## Resolved

None yet.
