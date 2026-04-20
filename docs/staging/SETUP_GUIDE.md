# Staging Environment Setup Guide

This guide prepares the staging environment used by the billing validation scenarios in [VALIDATION_PLAN.md](./VALIDATION_PLAN.md).

## 1. Start from the committed template

Create the local staging file from the committed example:

```bash
cp .env.staging.example .env.staging
```

Required values in `.env.staging`:

- `STAGING_API_URL`
- `STAGING_ASAAS_WEBHOOK_TOKEN`
- `STAGING_ASAAS_ACCESS_TOKEN`

Optional diagnostics:

- `STAGING_LOG_LEVEL`
- `STAGING_ENABLE_DETAILED_LOGGING`

Database access options for Phase 3:

- preferred direct mode: `STAGING_DB_URL` plus `psql`
- workstation fallback: `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`

Runtime deploy variables for the application itself should still come from `.env.example` and the hosting provider dashboard.

## 2. Confirm workstation prerequisites

Phase 3 assumes a workstation that can run the committed staging helpers. Install or confirm:

- Bash from WSL, Git Bash, or another POSIX-compatible shell
- a real `curl` binary available inside that Bash environment
- `tsx` via the repo's existing `node_modules`

One of these database access paths must also be available:

- `psql` with `STAGING_DB_URL`
- or the Supabase admin fallback using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

PowerShell alone is not sufficient for the full proof path because:

- `bash scripts/verify-staging.sh` is the required first step
- `Invoke-WebRequest` is not a drop-in replacement for the script's `curl` usage
- the snapshot helper still needs either `psql` or Supabase admin access

## 3. Apply the current billing migrations

Run these migrations against the staging database in this order:

```bash
npx prisma db execute --file prisma/migrations/billing_webhook_hardening.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260406_align_asaas_webhook_contract.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260407_persist_billing_display_totals.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260407_harden_text_id_generation.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260407_harden_standard_timestamps.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260412_resume_generation_billing.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260420_credit_reservation_ledger.sql --schema prisma/schema.prisma
```

These migrations are required for the current settlement-based billing contract, resume-generation charging, and the reservation-ledger export billing checks.

## 4. Run the preflight script before any billing scenario

The staging readiness script is the first operator step after filling `.env.staging`:

```bash
bash scripts/verify-staging.sh
```

The script validates:

- `.env.staging` exists and came from `.env.staging.example`
- required staging vars are populated
- staging database connectivity works through either `psql` or the Supabase admin fallback
- current billing tables exist
- staging API is reachable
- the staging test user is present

Do not start webhook or billing scenario testing until this script exits successfully.

## 5. Prepare the staging test user

Use a clean test user before replaying events:

```sql
DELETE FROM billing_checkouts WHERE user_id = 'usr_staging_001';
DELETE FROM credit_accounts WHERE user_id = 'usr_staging_001';
DELETE FROM user_quotas WHERE user_id = 'usr_staging_001';
DELETE FROM users WHERE id = 'usr_staging_001';

INSERT INTO users (id, email, created_at, updated_at)
VALUES ('usr_staging_001', 'staging-test@curria.test', NOW(), NOW());

INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_staging_001', 'usr_staging_001', 5, NOW(), NOW());
```

## 6. Confirm the Phase 3 helper commands

Run the committed helpers locally before a live replay:

```bash
npx tsx scripts/replay-staging-asaas.ts --list-scenarios
npx tsx scripts/check-staging-billing-state.ts --help
```

The replay helper intentionally supports both reference shapes:

- `curria:v1:c:<checkoutReference>`
- `curria:v1:u:<appUserId>:c:<checkoutReference>`

Pass `--app-user <id>` when you need the current checkout-created shape. Omit it when validating the shorter v1 webhook shape. Phase 3 must confirm which shape is canonical in staging before implementation docs are tightened.

## 7. Execute the validation scenarios

After the preflight passes, follow the scenarios in [VALIDATION_PLAN.md](./VALIDATION_PLAN.md).

Use the staging env file for any local shell session that needs the credentials:

```bash
set -a
source .env.staging
set +a
```

Typical evidence workflow:

```bash
npx tsx scripts/check-staging-billing-state.ts --user usr_staging_001 > baseline-state.json
npx tsx scripts/replay-staging-asaas.ts --scenario one_time_settlement --checkout chk_live_001 --payment pay_live_001 --dry-run
npx tsx scripts/replay-staging-asaas.ts --scenario one_time_settlement --checkout chk_live_001 --payment pay_live_001 --output one-time-response.json
npx tsx scripts/check-staging-billing-state.ts --checkout chk_live_001 > post-one-time-state.json
```

## Troubleshooting

If `bash scripts/verify-staging.sh` fails:

- confirm Bash, `npx`, and `curl` are installed in the shell you are using
- confirm `.env.staging` was copied from `.env.staging.example`
- re-check `STAGING_ASAAS_WEBHOOK_TOKEN` and `STAGING_ASAAS_ACCESS_TOKEN`
- confirm all eight billing migrations above were applied to the staging database
- verify `STAGING_API_URL` points at the deployed staging environment
- if `psql` is unavailable, confirm `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are populated for the fallback path

If `npx tsx scripts/check-staging-billing-state.ts ...` fails:

- if you are using direct mode, confirm `psql` is available on `PATH` and `STAGING_DB_URL` points at the verified database
- if you are using the fallback path, confirm `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point at the same project verified by `scripts/verify-staging.sh`

If `npx tsx scripts/replay-staging-asaas.ts ...` fails:

- rerun the same command with `--dry-run`
- confirm the webhook token matches the staging deployment
- confirm you chose the expected `externalReference` shape for the scenario under test
- compare the payload to the current webhook semantics in [../billing/IMPLEMENTATION.md](../billing/IMPLEMENTATION.md)

## Related docs

- [VALIDATION_PLAN.md](./VALIDATION_PLAN.md)
- [../PRODUCTION-READINESS-CHECKLIST.md](../PRODUCTION-READINESS-CHECKLIST.md)
- [../../.env.staging.example](../../.env.staging.example)
