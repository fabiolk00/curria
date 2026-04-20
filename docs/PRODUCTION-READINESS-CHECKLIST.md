# Production Readiness Checklist

Status: launch hardening complete through Phase 4.

## Required before deploy

- [ ] Latest application code is deployed.
- [ ] `prisma/migrations/billing_webhook_hardening.sql` is applied.
- [ ] `prisma/migrations/20260406_align_asaas_webhook_contract.sql` is applied.
- [ ] `prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql` is applied.
- [ ] `prisma/migrations/20260407_persist_billing_display_totals.sql` is applied.
- [ ] `prisma/migrations/20260407_harden_text_id_generation.sql` is applied.
- [ ] `prisma/migrations/20260407_harden_standard_timestamps.sql` is applied.
- [ ] `prisma/migrations/20260412_resume_generation_billing.sql` is applied.
- [ ] `prisma/migrations/20260420_credit_reservation_ledger.sql` is applied.
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

## Observability to confirm

- [ ] `billing.info.load_failed` appears as a structured warning if billing metadata reads degrade.
- [ ] `api.file.download_urls_failed` appears when signed artifact URLs cannot be created.
- [ ] `api.session.list_failed` and `api.session.messages_failed` appear for session retrieval failures.
- [ ] `clerk.webhook.*` events are queryable for config, signature, duplicate, and handler failures.
- [ ] LinkedIn import failures emit structured logs without exposing raw backend details to users.

## Database verification

### Migration-derived objects

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('billing_checkouts', 'processed_events', 'user_quotas', 'credit_accounts', 'credit_reservations', 'credit_ledger_entries')
ORDER BY table_name;
```

Expected:

- `billing_checkouts`
- `credit_accounts`
- `credit_ledger_entries`
- `credit_reservations`
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

## Proof set

### Repo-local proof

Run these in the repository before calling the rollout ready:

```bash
npm run typecheck
npm test
npm run test:e2e -- --project=chromium
```

### Focused hardening reruns

Use these when you touched launch-hardening areas directly:

```bash
npm test -- src/app/api/session/route.test.ts src/app/api/session/[id]/messages/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/app/api/webhook/clerk/route.test.ts src/app/(auth)/layout.test.tsx
npm test -- src/components/dashboard/preview-panel.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/components/dashboard/resume-workspace.test.tsx src/app/api/profile/extract/route.test.ts src/app/api/profile/status/[jobId]/route.test.ts
```

### Live staging proof

Run the staging preflight before executing billing scenarios:

```bash
bash scripts/verify-staging.sh
```

## Release handoff

- [launch-readiness.md](./launch-readiness.md)
- [billing/OPS_RUNBOOK.md](./billing/OPS_RUNBOOK.md)
- [billing/MONITORING.md](./billing/MONITORING.md)
- [staging/SETUP_GUIDE.md](./staging/SETUP_GUIDE.md)
- [staging/VALIDATION_PLAN.md](./staging/VALIDATION_PLAN.md)
