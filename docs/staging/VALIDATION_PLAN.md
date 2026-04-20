# Staging Validation Plan for Asaas Billing

This plan validates the current settlement-based billing contract in staging.

## Preconditions

Before running scenarios:

1. Deploy the latest billing code.
2. Fill `.env.staging` from `.env.staging.example`.
   - Use `STAGING_DB_URL` when `psql` is available.
   - Use `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when the workstation needs the Supabase admin fallback.
3. Apply the current billing migrations:
   - `billing_webhook_hardening.sql`
   - `20260406_align_asaas_webhook_contract.sql`
   - `20260406_fix_billing_checkout_timestamp_defaults.sql`
   - `20260407_persist_billing_display_totals.sql`
   - `20260407_harden_text_id_generation.sql`
   - `20260407_harden_standard_timestamps.sql`
   - `20260412_resume_generation_billing.sql`
   - `20260420_credit_reservation_ledger.sql`
4. Run the preflight script:

```bash
bash scripts/verify-staging.sh
```

5. Confirm the staging test user exists, for example `usr_staging_001`.
6. Confirm the committed helper commands work locally:

```bash
npx tsx scripts/replay-staging-asaas.ts --list-scenarios
npx tsx scripts/check-staging-billing-state.ts --help
npx tsx scripts/check-staging-billing-state.ts --healthcheck --preflight-user usr_staging_001
npx tsx scripts/stress-export-generation.ts --help
```

## Proof set

### Repo-local proof

```bash
npm run typecheck
npm test -- src/lib/asaas/event-handlers.test.ts src/app/api/webhook/asaas/route.test.ts src/lib/asaas/credit-grants.test.ts src/lib/asaas/quota.test.ts src/app/api/checkout/route.test.ts
npx tsx scripts/replay-staging-asaas.ts --list-scenarios
npx tsx scripts/check-staging-billing-state.ts --help
npx tsx scripts/stress-export-generation.ts --help
```

### Live staging proof

```bash
bash scripts/verify-staging.sh
```

## Reference-shape note

Phase 3 still needs to validate the canonical checkout `externalReference` shape in staging.

- Current webhook docs and tests exercise `curria:v1:c:<checkoutReference>`.
- Current checkout creation code still emits `curria:v1:u:<appUserId>:c:<checkoutReference>`.

Use the replay helper's `--app-user` flag when you need to reproduce the checkout-created shape. Omit `--app-user` when validating the shorter v1 webhook path. Do not silently normalize this difference in staging evidence.

## Scenario 1: One-time settlement

Goal: credits move only after a settled payment event.

Expected path:

1. Create a checkout for `plan = unit`.
2. Confirm `billing_checkouts.status = 'created'`.
3. Send `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED`.
4. Verify:
   - credits change once
   - checkout becomes `paid`
   - `processed_events.event_type = 'PAYMENT_SETTLED'`
   - `user_quotas.credits_remaining >= credit_accounts.credits_remaining`
5. Replay with `payment.externalReference = null` and `payment.checkoutSession = <checkout_session_id>` and verify the same checkout still settles exactly once.

Suggested commands:

```bash
npx tsx scripts/check-staging-billing-state.ts --checkout <checkout_reference>
npx tsx scripts/replay-staging-asaas.ts --scenario one_time_settlement --checkout <checkout_reference> --payment <payment_id> [--app-user <user_id>] --output .planning/phases/03-billing-settlement-validation/03-SCENARIO-RESPONSES.json
npx tsx scripts/check-staging-billing-state.ts --checkout <checkout_reference>
```

## Scenario 2: Invalid subscription snapshot is ignored

Goal: inactive or deleted snapshots never grant credits.

Send a `SUBSCRIPTION_CREATED` payload with `status = 'INACTIVE'` and `deleted = true`.

Verify:

- response is `200`
- response body contains `ignored: true`
- no credit change occurs
- any referenced pending recurring checkout may become `canceled`

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario inactive_subscription_snapshot --checkout <checkout_reference> --subscription <subscription_id> [--app-user <user_id>]
```

## Scenario 3: Initial recurring activation from settlement

Goal: the first paid subscription cycle activates from a settled payment, not from `SUBSCRIPTION_CREATED`.

Expected path:

1. Create a checkout for `plan = monthly` or `plan = pro`.
2. Confirm the row is `created`.
3. Send a settled payment event with `payment.subscription` present.
4. Verify:
   - checkout becomes `subscription_active`
   - `user_quotas.asaas_subscription_id` is set
   - `processed_events.event_type = 'SUBSCRIPTION_STARTED'`
   - the displayed plan total is at least the runtime balance

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario initial_recurring_activation --checkout <checkout_reference> --subscription <subscription_id> --payment <payment_id> [--app-user <user_id>]
```

## Scenario 4: Renewal replaces balance

Goal: renewals replace the previous cycle balance once.

Expected path:

1. Start from an active recurring subscription.
2. Send a new settled payment for the same `payment.subscription`, or replay legacy `SUBSCRIPTION_RENEWED`.
3. Verify:
   - the balance becomes exactly the plan allocation
   - the previous cycle remainder is not added on top
   - `processed_events.event_type = 'SUBSCRIPTION_RENEWED'`

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario renewal_replace_balance --checkout <checkout_reference> --subscription <subscription_id> --payment <payment_id> [--app-user <user_id>]
```

## Scenario 5: Cancellation updates metadata only

Goal: cancellation preserves credits and updates metadata.

Send one of:

- `SUBSCRIPTION_INACTIVATED`
- `SUBSCRIPTION_DELETED`
- legacy `SUBSCRIPTION_CANCELED`

Verify:

- `user_quotas.status = 'canceled'`
- `user_quotas.renews_at = NULL`
- credits stay unchanged
- `processed_events.event_type = 'SUBSCRIPTION_CANCELED'`

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario cancellation_metadata_only --subscription <subscription_id> [--checkout <checkout_reference>] [--app-user <user_id>]
```

## Scenario 6: Duplicate delivery

Goal: the same economic event never grants credits twice.

Verify:

- replaying the same payment payload twice changes credits once
- replaying both `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` for the same payment still changes credits once

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario duplicate_delivery --checkout <checkout_reference> --payment <payment_id> [--subscription <subscription_id>] [--app-user <user_id>]
npx tsx scripts/replay-staging-asaas.ts --scenario duplicate_delivery --checkout <checkout_reference> --payment <payment_id> [--subscription <subscription_id>] [--app-user <user_id>]
```

## Scenario 7: Partial-success reconciliation

Goal: a duplicate replay can repair stale checkout state without re-granting credits.

Verify:

- if the economic mutation already exists but checkout status is stale, a replay does not grant credits again
- checkout status converges after reconciliation

Suggested command:

```bash
npx tsx scripts/replay-staging-asaas.ts --scenario partial_success_reconcile --checkout <checkout_reference> --payment <payment_id> [--subscription <subscription_id>] [--checkout-session <session_id>] [--app-user <user_id>]
```

## Scenario 8: Concurrent export retry proof

Goal: repeated export requests for the same session prove one durable retry path instead of double-holding credits.

Expected path:

1. Choose a staging session that already has an AI-generated exportable snapshot.
2. Capture a baseline snapshot:

```bash
npx tsx scripts/check-staging-billing-state.ts --session <session_id>
```

3. Run the export stress harness:

```bash
npx tsx scripts/stress-export-generation.ts --url <staging-url> --session-id <session_id> --cookie "<cookie>" --requests 6 --concurrency 3 --format markdown --output .planning/phases/CURRIA-45-improve-billing-transparency-alerts-and-concurrency-proof/45-03-stress-export.md
```

4. Capture the post-run snapshot:

```bash
npx tsx scripts/check-staging-billing-state.ts --session <session_id>
```

Verify:

- the stress artifact shows accepted safe outcomes only
- repeated requests collapse onto one durable `jobId`, or retries return `BILLING_RECONCILIATION_PENDING`
- the snapshot now includes `credit_reservations`, `credit_ledger_entries`, and `billing_anomalies`
- no anomaly summary crosses:
  - `staleReconciliationMinutes = 30`
  - `repeatedFailureCount = 2`
  - `reservedBacklogCount = 10`

## Final checks

### Internal processed event names

```sql
SELECT event_type, COUNT(*) AS count
FROM processed_events
GROUP BY event_type
ORDER BY event_type;
```

Expected values include:

- `PAYMENT_SETTLED`
- `SUBSCRIPTION_STARTED`
- `SUBSCRIPTION_RENEWED`
- `SUBSCRIPTION_UPDATED`
- `SUBSCRIPTION_CANCELED`

### Stale recurring checkouts

```sql
SELECT *
FROM billing_checkouts
WHERE status = 'created'
  AND plan IN ('monthly', 'pro')
  AND created_at < NOW() - INTERVAL '1 hour';
```

Expected: zero rows, or only rows currently under investigation.

## Evidence checklist

For every scenario, record:

- command executed
- whether `--app-user` was used
- webhook response body
- pre and post snapshots from `scripts/check-staging-billing-state.ts`
- `BILL-01`, `BILL-02`, and `BILL-03` pass or fail judgment
- any warning or open gap with likely owner files
