# Production Readiness Checklist

Status: settlement-based billing contract current as of Phase 1 hardening.

## Required before deploy

- [ ] Latest billing code is deployed.
- [ ] `prisma/migrations/billing_webhook_hardening.sql` is applied.
- [ ] `prisma/migrations/20260406_align_asaas_webhook_contract.sql` is applied.
- [ ] `prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql` is applied.
- [ ] `prisma/migrations/20260407_persist_billing_display_totals.sql` is applied.
- [ ] `prisma/migrations/20260407_harden_text_id_generation.sql` is applied.
- [ ] `prisma/migrations/20260407_harden_standard_timestamps.sql` is applied.
- [ ] The old overload of `apply_billing_credit_grant_event` is removed.
- [ ] Deploy environments use the canonical runtime contract from `.env.example`.
- [ ] Dedicated webhook secrets are set separately from broader API credentials.

## Runtime behavior to confirm

- [ ] Settled one-time payments store `processed_events.event_type = 'PAYMENT_SETTLED'`.
- [ ] Initial recurring activation stores `processed_events.event_type = 'SUBSCRIPTION_STARTED'`.
- [ ] Renewals store `processed_events.event_type = 'SUBSCRIPTION_RENEWED'`.
- [ ] Metadata-only subscription updates store `processed_events.event_type = 'SUBSCRIPTION_UPDATED'`.
- [ ] Cancellations store `processed_events.event_type = 'SUBSCRIPTION_CANCELED'`.
- [ ] `SUBSCRIPTION_CREATED` inactive snapshots return `200 ignored` and do not grant credits.
- [ ] Renewal replaces the balance once instead of adding to the previous cycle total.
- [ ] Duplicate `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` deliveries do not double-grant.
- [ ] Dashboard display totals are never lower than the runtime credit balance.

## Database verification

### Migration-derived objects

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('billing_checkouts', 'processed_events', 'user_quotas', 'credit_accounts')
ORDER BY table_name;
```

Expected:

- `billing_checkouts`
- `credit_accounts`
- `processed_events`
- `user_quotas`

### Text ID defaults

```sql
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN (
    'user_auth_identities',
    'user_quotas',
    'sessions',
    'messages',
    'api_usage',
    'processed_events',
    'billing_checkouts',
    'customer_billing_info',
    'job_applications',
    'cv_versions',
    'resume_targets'
  )
ORDER BY table_name;
```

Expected:

- Every listed text-ID table uses `gen_random_uuid()::text` or an equivalent expression.

### Timestamp defaults

```sql
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at')
  AND table_name IN (
    'users',
    'user_auth_identities',
    'credit_accounts',
    'user_quotas',
    'sessions',
    'billing_checkouts',
    'customer_billing_info',
    'job_applications',
    'resume_targets'
  )
ORDER BY table_name, column_name;
```

Expected:

- Mutable tables use `NOW()` defaults for both timestamp columns.

### Billing RPC signatures

```sql
SELECT
  p.proname AS routine_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'apply_billing_credit_grant_event',
    'apply_billing_subscription_metadata_event'
  )
ORDER BY p.proname, args;
```

Expected:

- One `apply_billing_credit_grant_event` signature with `p_is_renewal boolean`
- One `apply_billing_subscription_metadata_event` signature

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

## Verification commands

Run these before calling the rollout ready:

```bash
npm run typecheck
npm test
```

## Linked docs

- [billing/IMPLEMENTATION.md](./billing/IMPLEMENTATION.md)
- [billing/MIGRATION_GUIDE.md](./billing/MIGRATION_GUIDE.md)
- [billing/MONITORING.md](./billing/MONITORING.md)
- [billing/OPS_RUNBOOK.md](./billing/OPS_RUNBOOK.md)
- [staging/SETUP_GUIDE.md](./staging/SETUP_GUIDE.md)
- [staging/VALIDATION_PLAN.md](./staging/VALIDATION_PLAN.md)
