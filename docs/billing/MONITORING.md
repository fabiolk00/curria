# Billing Monitoring

This document defines the minimum monitoring setup for the Asaas billing flow after the settlement-based webhook hardening.

## What changed

- Credits now come from payment settlement, not from `SUBSCRIPTION_CREATED`.
- `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` collapse into the internal event type `PAYMENT_SETTLED`.
- One-time payment settlement can reconcile from `payment.checkoutSession` when `payment.externalReference` is null.
- Subscription snapshots that are not actionable return `200 ignored` instead of pausing the Asaas queue.
- Metadata-only subscription events use the internal event type `SUBSCRIPTION_CANCELED` or `SUBSCRIPTION_UPDATED`.
- Dashboard credit denominators now come from the persisted display total in `user_quotas.credits_remaining`.

## Core alerts

### 1. Failed checkouts

Run every 15 minutes:

```sql
SELECT COUNT(*) AS failed_count
FROM billing_checkouts
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '15 minutes';
```

Alert if `failed_count > 0`.

### 2. Stale pending checkouts

Run every 30 minutes:

```sql
SELECT COUNT(*) AS stale_pending_count,
       MIN(created_at) AS oldest_checkout
FROM billing_checkouts
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

Alert if `stale_pending_count > 0`.

### 3. Stale created recurring checkouts

This catches recurring flows where checkout creation succeeded but neither activation nor cancellation was reconciled.

```sql
SELECT COUNT(*) AS stale_created_recurring_count
FROM billing_checkouts
WHERE status = 'created'
  AND plan IN ('monthly', 'pro')
  AND created_at < NOW() - INTERVAL '1 hour';
```

Investigate if `stale_created_recurring_count > 0`.

### 4. RPC / trust-anchor rejections

Search structured logs for:

- `asaas.webhook.failed`
- `billing.pre_cutover_missing_metadata`
- `billing.checkout.cancel_mark_failed`
- `asaas.webhook.duplicate_reconcile_failed`

Treat any recent occurrence as operator-review required.

### 5. Legacy webhook path frequency

Track how often legacy `usr_...` references still appear.

```sql
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_events,
  SUM(
    CASE
      WHEN COALESCE(
        event_payload->'payment'->>'externalReference',
        event_payload->'subscription'->>'externalReference'
      ) ~ '^usr_[A-Za-z0-9]+$'
      THEN 1
      ELSE 0
    END
  ) AS legacy_path_events
FROM processed_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

This should trend toward zero.

### 6. Display-total drift

Run every hour:

```sql
SELECT COUNT(*) AS drift_count
FROM user_quotas AS quota
JOIN credit_accounts AS account ON account.user_id = quota.user_id
WHERE quota.credits_remaining < account.credits_remaining;
```

Alert if `drift_count > 0`.

### 7. Stale export reconciliation backlog

Run every 15 minutes:

```sql
SELECT COUNT(*) AS stale_reconciliation_count,
       MIN(created_at) AS oldest_reconciliation
FROM credit_reservations
WHERE status = 'needs_reconciliation'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

Alert if `stale_reconciliation_count > 0`.

Repo-native fallback:

```bash
npx tsx scripts/check-staging-billing-state.ts --user <user_id>
```

Expected anomaly output:

- `billing_anomalies.anomalies[].kind = "stale_reconciliation"`
- `billing_anomalies.thresholds.staleReconciliationMinutes = 30`

### 8. Repeated finalize or release failures

Run every 15 minutes:

```sql
SELECT user_id,
       CASE
         WHEN failure_reason ILIKE '%release%' THEN 'release'
         ELSE 'finalize'
       END AS failure_kind,
       COUNT(*) AS repeated_failures,
       COUNT(DISTINCT generation_intent_key) AS affected_intents
FROM credit_reservations
WHERE status = 'needs_reconciliation'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND (
    failure_reason ILIKE '%finalize%'
    OR failure_reason ILIKE '%release%'
  )
GROUP BY user_id, failure_kind
HAVING COUNT(*) >= 2
ORDER BY repeated_failures DESC;
```

Alert if any row is returned. This is intentionally keyed by `user_id` plus failure kind because the reservation model keeps at most one row per `generation_intent_key`.

Repo-native fallback:

```bash
npx tsx scripts/check-staging-billing-state.ts --user <user_id>
```

Expected anomaly kinds:

- `repeated_finalize_failure`
- `repeated_release_failure`

### 9. Reserved export backlog

Run every 15 minutes:

```sql
SELECT COUNT(*) AS reserved_backlog_count,
       MIN(created_at) AS oldest_reserved_hold
FROM credit_reservations
WHERE status = 'reserved';
```

Investigate if `reserved_backlog_count >= 10`.

Repo-native fallback:

```bash
npx tsx scripts/check-staging-billing-state.ts --session <session_id>
```

Expected anomaly output:

- `billing_anomalies.anomalies[].kind = "reserved_backlog"`
- `billing_anomalies.thresholds.reservedBacklogCount = 10`

## Useful sanity queries

### Export reservation health snapshot

```bash
npx tsx scripts/check-staging-billing-state.ts --user <user_id>
```

This now includes:

- `credit_reservations`
- `credit_ledger_entries`
- `billing_anomalies`

Use it when `psql` is unavailable or when you need a committed JSON artifact for staging evidence.

### Recent internal billing event types

```sql
SELECT event_type, COUNT(*) AS count
FROM processed_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY event_type;
```

Expected current event types:

- `PAYMENT_SETTLED`
- `SUBSCRIPTION_STARTED`
- `SUBSCRIPTION_RENEWED`
- `SUBSCRIPTION_UPDATED`
- `SUBSCRIPTION_CANCELED`

### Reconciled one-time payments

```sql
SELECT checkout_reference, status, asaas_payment_id, updated_at
FROM billing_checkouts
WHERE plan = 'unit'
ORDER BY updated_at DESC
LIMIT 20;
```

Expected:

- newly paid one-time checkouts move to `paid`
- some provider payloads may show `event_payload.payment.externalReference = null`; `checkoutSession` is still a valid reconciliation path

### Reconciled recurring activations

```sql
SELECT checkout_reference, status, asaas_subscription_id, updated_at
FROM billing_checkouts
WHERE plan IN ('monthly', 'pro')
ORDER BY updated_at DESC
LIMIT 20;
```

Expected:

- active recurring checkouts move to `subscription_active`
- invalid snapshots may move to `canceled`

### Duplicate protection overview

```sql
SELECT event_type, COUNT(*) AS count
FROM processed_events
GROUP BY event_type
ORDER BY count DESC;
```

If you see both `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` here, the new SQL contract was not applied correctly. The DB should store `PAYMENT_SETTLED` instead.

## Escalation guide

- `failed_checkouts > 0`: check provider/API logs and checkout route errors immediately.
- stale `created` recurring checkouts: inspect whether the first settled payment arrived, or whether the snapshot was ignored and should have canceled the checkout.
- trust-anchor rejection: compare `billing_checkouts`, `user_quotas`, and the webhook payload.
- legacy-path frequency rising: investigate whether new traffic is still being emitted with legacy `externalReference`.
- display-total drift: apply `20260407_persist_billing_display_totals.sql` and confirm future grants update `user_quotas.credits_remaining`.

## Sunset note

When legacy references remain at zero for a sustained period, the temporary legacy parser path in `src/lib/asaas/external-reference.ts` can be removed in a future cleanup.
