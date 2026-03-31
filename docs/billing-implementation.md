# Billing Implementation

## Overview

CurrIA billing is webhook-driven.

- Credits are granted only from trusted Asaas webhook events.
- `credit_accounts` is the authoritative runtime balance.
- `user_quotas` stores subscription metadata only.
- `billing_checkouts` is the source of truth for post-cutover paid checkout resolution.
- `processed_events` guarantees idempotent webhook processing.

## Data Model

### `credit_accounts`

- Owns the runtime balance.
- Every new-session credit check reads from this table.
- Billing credit grants add to the current balance.

### `user_quotas`

- Owns billing metadata:
  - `plan`
  - `asaas_subscription_id`
  - `renews_at`
  - `status`
- Pre-cutover recurring subscriptions continue to resolve from this table by `asaas_subscription_id`.

### `billing_checkouts`

- Paid Asaas flows only.
- Free tier and historical pre-cutover subscriptions are not synthesized into this table.
- Lifecycle:
  - `pending`
  - `created`
  - `failed`
  - `paid`
  - `subscription_active`
  - `canceled`

### `processed_events`

- Stores webhook fingerprints and payloads.
- Prevents duplicate credit grants and duplicate metadata updates.

## Checkout Flow

1. Validate authenticated user and requested paid plan.
2. Create a `billing_checkouts` row in `pending`.
3. Format `externalReference` as `curria:v1:c:<checkoutReference>`.
4. Call Asaas with that `externalReference`.
5. If Asaas succeeds, mark the checkout `created`.
6. If Asaas fails, mark the checkout `failed`.

## Webhook Resolution

### `PAYMENT_RECEIVED`

- Requires v1 `externalReference`.
- Resolves plan and user from `billing_checkouts`.
- Verifies webhook amount matches `billing_checkouts.amount_minor`.
- Grants credits through the transactional RPC.
- Marks checkout `paid`.

### `SUBSCRIPTION_CREATED`

- Requires v1 `externalReference`.
- Resolves plan and user from `billing_checkouts`.
- Verifies `nextDueDate` is in the future.
- Grants credits through the transactional RPC.
- Persists `asaas_subscription_id`.
- Marks checkout `subscription_active`.

### `SUBSCRIPTION_RENEWED`

- Resolves from `user_quotas.asaas_subscription_id`.
- Does not depend on checkout lookup.
- Verifies `nextDueDate` is in the future.
- Grants credits through the transactional RPC.

### `SUBSCRIPTION_CANCELED` / `SUBSCRIPTION_DELETED`

- Resolves from `user_quotas.asaas_subscription_id`.
- Does not revoke credits.
- Updates subscription metadata only.

## Credit Carryover and Renewal Logic

### Carryover on Plan Change (Initial and Subscriptions)

When a user changes plans—whether from a one-time purchase or upgrading/downgrading their subscription—remaining credits are preserved and **added** to the new plan's credit allocation.

**Implementation**:
- The RPC function `apply_billing_credit_grant_event` accepts a `p_is_renewal` parameter.
- For `PAYMENT_RECEIVED` and `SUBSCRIPTION_CREATED` events: `p_is_renewal = FALSE` (default).
  - Balance calculation: `new_balance = current_balance + plan.credits`
  - This preserves unused credits from the previous plan.
- Example:
  - User on Unitário (3 credits) with 1 remaining.
  - Upgrades to Mensal (20 credits).
  - Result: 1 + 20 = 21 credits.

### Replacement on Renewal (No Carryover)

When a monthly subscription renews, credits are **replaced**, not added. This prevents unlimited credit accumulation and ensures predictable monthly allocations.

**Implementation**:
- For `SUBSCRIPTION_RENEWED` events: `p_is_renewal = TRUE`.
  - Balance calculation: `new_balance = plan.credits` (no addition).
  - Previous month's remaining balance is discarded.
- Example:
  - User on Mensal (20 credits) with 6 remaining from last month.
  - Subscription renews.
  - Result: Exactly 20 credits (previous 6 are discarded).

### Implementation Details

The `p_is_renewal` parameter is set by the application code in `src/lib/asaas/credit-grants.ts`:

```typescript
const isRenewal = request.eventPayload.event === 'SUBSCRIPTION_RENEWED'
```

This value is then passed to the RPC, which applies the correct logic:
- `isRenewal = true`: Replace balance with plan credits (renewal)
- `isRenewal = false`: Add to existing balance (plan change/purchase)

### Operational Note

- Users upgrading plans mid-cycle preserve their unused credits.
- Subsequent renewals replace credits, not add to them.
- The RPC behavior is controlled by application code setting the `p_is_renewal` parameter based on event type.

## externalReference Formats

### Standard v1

- `curria:v1:c:<checkoutReference>`

Operational note:

- The parser still accepts the previously-issued `curria:v1:u:<appUserId>:c:<checkoutReference>` shape for webhook compatibility, but new checkouts always emit the shorter v1 format because Asaas enforces a 100-character maximum on `externalReference`.

### Temporary legacy support

- `usr_<id>`

Legacy support is intentionally narrow:

- Accepted only as a strict parser shape.
- Used only for pre-cutover recurring subscriptions that already have trusted `asaas_subscription_id` metadata.
- Not accepted for new one-time payments or new subscription creation.

## Idempotency

- Fingerprints are computed from a stable JSON projection of the event.
- Versioned `externalReference` values are normalized before hashing.
- Duplicate detection happens twice:
  - route-level fast pre-check
  - transactional RPC re-check under advisory lock

This gives both fast duplicate skips and race-safe final protection.

## Validation and Safety

- Amount-based plan inference is not used.
- Initial paid events must have a matching `billing_checkouts` record.
- Renewal and cancellation events must have a matching `user_quotas.asaas_subscription_id`.
- RPCs reject:
  - missing trust anchors
  - plan mismatches
  - amount mismatches
  - non-positive credit grants
  - negative or overflowing balances

## Migration Notes

### Pre-cutover subscriptions

- Keep working through `user_quotas + asaas_subscription_id`.
- Do not require `billing_checkouts`.
- Do not synthesize fake checkout rows without authoritative source data.

Pre-launch audit:

- verify active recurring rows all have `asaas_subscription_id`:
  - `SELECT COUNT(*) FROM user_quotas WHERE asaas_subscription_id IS NULL AND status != 'canceled' AND plan IN ('monthly', 'pro');`
- any non-zero result means renewals can fail until metadata is backfilled

### Post-cutover purchases

- Must create `billing_checkouts` before the Asaas call.
- Must use v1 `externalReference`.
- Initial paid webhook events fail closed if the checkout record is missing.

## Monitoring

Look for:

- `billing.checkout.failed`
- `billing.legacy_webhook_path`
- `asaas.webhook.failed`
- `asaas.webhook.duplicate_skipped`
- RPC exceptions mentioning checkout mismatch, plan mismatch, or negative balance

Useful queries:

- failed checkout records:
  - `SELECT * FROM billing_checkouts WHERE status = 'failed' ORDER BY updated_at DESC;`
- stale pending checkouts:
  - `SELECT * FROM billing_checkouts WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes';`
- created one-time checkouts still waiting on payment confirmation:
  - `SELECT * FROM billing_checkouts WHERE status = 'created' AND plan = 'unit' AND created_at < NOW() - INTERVAL '1 hour';`
- created recurring checkouts still waiting on subscription activation:
  - `SELECT * FROM billing_checkouts WHERE status = 'created' AND plan IN ('monthly', 'pro') AND created_at < NOW() - INTERVAL '1 hour';`
- orphaned recurring metadata:
  - `SELECT * FROM user_quotas WHERE asaas_subscription_id IS NULL AND plan IN ('monthly', 'pro');`
- duplicate fingerprint audit:
  - `SELECT event_type, COUNT(*) FROM processed_events GROUP BY event_type;`
- legacy-path webhook payloads still reaching the system:
  - `SELECT event_type, processed_at, COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') AS external_reference FROM processed_events WHERE COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') ~ '^usr_[A-Za-z0-9]+$' ORDER BY processed_at DESC;`

Operational expectations:

- `pending` should be transient; stale rows suggest provider-call interruption.
- `failed` should be rare and investigated manually.
- legacy-path recurring events should trend toward zero after cutover.
- any `billing.pre_cutover_missing_metadata` log should be treated as a migration gap.

## Control Matrix

| Requirement | Code path | What enforces it | Test coverage | How ops verifies it |
|---|---|---|---|---|
| Checkout record exists before Asaas call | `src/app/api/checkout/route.ts` -> `POST` | `createCheckoutRecordPending()` runs before `createCheckoutLink()` | Automated: `src/app/api/checkout/route.test.ts` asserts call order | Create a checkout and verify a new `billing_checkouts` row appears as `pending` before the provider call finishes |
| Asaas creation failures end in `failed` status | `src/app/api/checkout/route.ts` -> `POST` | `catch` block calls `markCheckoutFailed()` when provider creation throws | Automated: `src/app/api/checkout/route.test.ts` covers provider failure and post-provider marking failure | Query `billing_checkouts` for `status = 'failed'`; correlate with `billing.checkout.failed` logs and recent checkout attempts |
| One-time payments resolve from checkout records only | `src/lib/asaas/event-handlers.ts` -> `handlePaymentReceived()` | Requires v1 `externalReference`, loads `billing_checkouts`, validates amount and `status='created'` | Automated: `src/lib/asaas/event-handlers.test.ts` covers valid v1, missing checkout, and legacy rejection | Inspect `processed_events` for `PAYMENT_RECEIVED`, then confirm matching `billing_checkouts.checkout_reference`, `status='paid'`, and unchanged plan source |
| Initial subscriptions resolve from checkout records only | `src/lib/asaas/event-handlers.ts` -> `handleSubscriptionCreated()` | Requires v1 `externalReference`, validates checkout, amount, and future `nextDueDate` | Automated: `src/lib/asaas/event-handlers.test.ts` covers valid v1, missing checkout, and past renewal date rejection | Inspect `processed_events` for `SUBSCRIPTION_CREATED`, then verify `billing_checkouts.status='subscription_active'` and `user_quotas.asaas_subscription_id` populated |
| Renewals resolve from `asaas_subscription_id`, not checkout lookup | `src/lib/asaas/event-handlers.ts` -> `handleSubscriptionRenewed()` | Uses `getPersistedSubscriptionMetadata(subscription.id)` and no checkout lookup | Automated: `src/lib/asaas/event-handlers.test.ts` covers normal and pre-cutover recurring renewals | Run `SELECT * FROM user_quotas WHERE asaas_subscription_id = '<sub_id>';` then verify the renewal credited the same `user_id` in `credit_accounts` |
| Cancellation updates metadata only and never revokes credits | `src/lib/asaas/event-handlers.ts` -> `handleSubscriptionCanceled()` | Calls metadata RPC only; no credit grant path is invoked | Automated: `src/lib/asaas/event-handlers.test.ts` covers cancellation path | Compare `credit_accounts.credits_remaining` before and after a `SUBSCRIPTION_CANCELED` event; only `user_quotas.status` and `renews_at` should change |
| Duplicate webhook protection works at route and DB levels | `src/app/api/webhook/asaas/route.ts`; billing RPCs in `prisma/migrations/billing_webhook_hardening.sql` | Fast pre-check via `getProcessedEvent()`, transactional RPC duplicate check under advisory lock | Automated: `src/app/api/webhook/asaas/route.test.ts` covers pre-check duplicate and downstream duplicate result | Send the same webhook twice and verify only one credit mutation occurs; query `processed_events` by fingerprint and confirm a single authoritative record |
| Temporary webhook failures remain retryable | `src/app/api/webhook/asaas/route.ts` -> `POST` | Handler errors return `500`; route does not convert failures to success | Automated: `src/app/api/webhook/asaas/route.test.ts` covers failed first attempt and successful retry | Force a temporary failure, confirm 500 in logs, retry the same payload, and verify it later succeeds without duplicate grants |
| Concurrent identical webhook deliveries are safe | `src/app/api/webhook/asaas/route.ts`; billing RPC advisory lock | Same fingerprint can race through the route, but one path is deduped downstream | Automated: `src/app/api/webhook/asaas/route.test.ts` covers concurrent identical requests with one `processed` and one `duplicate` result; DB lock itself is still verified operationally | Replay identical events in parallel and verify one response is cached/duplicate and only one credit delta occurs in `credit_accounts` |
| RPC trust-anchor validation rejects bad checkout or subscription references | `src/lib/asaas/credit-grants.ts`; billing RPCs in `prisma/migrations/billing_webhook_hardening.sql` | RPC re-checks `billing_checkouts` or `user_quotas` before mutating state | Automated: `src/lib/asaas/credit-grants.test.ts` covers propagation of invalid checkout, invalid subscription, overflow, and negative-balance rejections; SQL semantics should still be spot-checked in staging | Call the RPC with a bad `checkout_reference` or `asaas_subscription_id` in staging and verify it raises without writing `processed_events` or changing balances |
| Pre-cutover recurring metadata gaps are visible | `src/lib/asaas/credit-grants.ts` -> `getPersistedSubscriptionMetadata()` | Logs `billing.pre_cutover_missing_metadata` and `billing.pre_cutover_invalid_plan_metadata` | Automated: recurring resolution tests cover the positive path; anomaly logging is operationally verified | Run `SELECT * FROM user_quotas WHERE plan IN ('monthly', 'pro') AND status != 'canceled' AND asaas_subscription_id IS NULL;` and treat any row or matching warning log as a migration blocker |
| Partial-success exceptions are detectable and recoverable | `src/app/api/checkout/route.ts`; `src/lib/asaas/event-handlers.ts` | If post-provider or post-RPC marking fails, the request errors instead of silently succeeding; processed state may already exist | Automated: `src/app/api/checkout/route.test.ts` covers `markCheckoutCreated()` and `formatExternalReference()` failures after pending row creation; `src/lib/asaas/event-handlers.test.ts` covers `markCheckoutPaid()` and `markCheckoutSubscriptionActive()` failures after successful grant | Look for `processed_events` entries where the corresponding `billing_checkouts.status` is still `created`; reconcile by checking the provider object and manually updating the checkout lifecycle if the economic event already succeeded |
