# Billing Migration Guide

## Goal

Apply the billing hardening changes safely and verify that post-cutover checkout resolution and pre-cutover recurring renewals both work.

## 1. Apply the SQL Migration

Preferred command:

```bash
npx prisma db execute --file prisma/migrations/billing_webhook_hardening.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260406_align_asaas_webhook_contract.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260407_persist_billing_display_totals.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260407_harden_text_id_generation.sql --schema prisma/schema.prisma
```

If your deployment flow requires manual SQL execution, run the contents of:

- `prisma/migrations/billing_webhook_hardening.sql`
- `prisma/migrations/20260406_align_asaas_webhook_contract.sql`
- `prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql`
- `prisma/migrations/20260407_persist_billing_display_totals.sql`
- `prisma/migrations/20260407_harden_text_id_generation.sql`

against the target database before deploying code that depends on `billing_checkouts`, the updated RPC signatures, and the persisted dashboard display totals.

## 2. Verify Database Objects

### Table checks

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('billing_checkouts', 'processed_events', 'user_quotas', 'credit_accounts');
```

### ID default checks

```sql
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN (
    'billing_checkouts',
    'processed_events',
    'user_quotas',
    'customer_billing_info',
    'job_applications',
    'sessions',
    'messages',
    'api_usage',
    'cv_versions',
    'resume_targets',
    'user_auth_identities'
  )
ORDER BY table_name;
```

Expected result:

- every generic text-ID table has a `gen_random_uuid()::text` default or equivalent expression

### Index checks

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('billing_checkouts', 'processed_events');
```

### Routine checks

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'apply_billing_credit_grant_event',
    'apply_billing_subscription_metadata_event'
  );
```

## 3. Pre-Cutover Recurring Audit

Find active recurring subscriptions that are missing `asaas_subscription_id`:

```sql
SELECT user_id, plan, status, asaas_subscription_id
FROM user_quotas
WHERE plan IN ('monthly', 'pro')
  AND status != 'canceled'
  AND asaas_subscription_id IS NULL;
```

Expected result:

- zero rows

If any rows appear:

- recurring renewals for those users can fail
- backfill `asaas_subscription_id` before cutover
- monitor for `billing.pre_cutover_missing_metadata` logs after deployment

## 4. Post-Cutover Checkout Audit

Verify new paid flows are producing checkout records:

```sql
SELECT id, user_id, checkout_reference, plan, amount_minor, status, created_at, updated_at
FROM billing_checkouts
ORDER BY created_at DESC
LIMIT 50;
```

Watch for:

- stale `pending`
- unexpected `failed`
- `created` rows that never become `paid` or `subscription_active`

## 5. Staging Validation Flow

### One-time payment

1. create checkout
2. confirm `billing_checkouts.status = 'pending'`
3. confirm Asaas call succeeds and row becomes `created`
4. simulate `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED`
5. verify:
   - credits increased in `credit_accounts`
   - `user_quotas.credits_remaining` is greater than or equal to the runtime balance
   - row becomes `paid`
   - processed fingerprint exists
6. repeat with a payload where:
   - `payment.externalReference = null`
   - `payment.checkoutSession = <asaas_session_id>`
   - verify one-time settlement still resolves and credits do not double-grant

### Subscription

1. create checkout
2. confirm row becomes `created`
3. simulate `SUBSCRIPTION_CREATED` with `status=INACTIVE` and verify it is acknowledged with `200 ignored`
4. simulate the first settled payment event with `payment.subscription` present
5. verify:
   - credits increased
   - `user_quotas.asaas_subscription_id` is populated
   - row becomes `subscription_active`
6. simulate `PAYMENT_RECEIVED` for the next cycle or legacy `SUBSCRIPTION_RENEWED`
7. verify:
   - renewal resolves from `user_quotas`
   - no checkout lookup is needed
   - credits are replaced once, not added twice
   - `user_quotas.credits_remaining` matches the renewed plan allocation

### Duplicate replay

1. resend the same webhook payload
2. verify:
   - response is cached/successful
   - balance does not change again

## 6. Monitoring After Deploy

Track:

- `billing.checkout.failed`
- `billing.legacy_webhook_path`
- `billing.pre_cutover_missing_metadata`
- `asaas.webhook.failed`
- `asaas.webhook.duplicate_skipped`

Useful SQL:

```sql
SELECT *
FROM billing_checkouts
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

```sql
SELECT *
FROM billing_checkouts
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '15 minutes'
ORDER BY created_at DESC;
```

```sql
SELECT event_type, processed_at,
  COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') AS external_reference
FROM processed_events
WHERE COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') ~ '^usr_[A-Za-z0-9]+$'
ORDER BY processed_at DESC;
```

```sql
SELECT quota.user_id, quota.plan, quota.credits_remaining AS display_total, account.credits_remaining AS runtime_balance
FROM user_quotas AS quota
JOIN credit_accounts AS account ON account.user_id = quota.user_id
WHERE quota.credits_remaining < account.credits_remaining
ORDER BY quota.user_id;
```

## 7. Rollback Guidance

If code deploy must be rolled back:

- the schema additions are backward-compatible
- do not remove `billing_checkouts`
- do not remove the updated RPCs while deployed code may still call them
- if provider-call failures spike, disable checkout entry points before attempting schema rollback

The safest rollback is:

1. disable new checkout creation in app code
2. leave schema and RPCs in place
3. investigate failed checkout and recurring metadata anomalies
