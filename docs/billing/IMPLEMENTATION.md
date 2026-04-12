---
title: CurrIA Billing Implementation
audience: [developers, operations]
related: [../INDEX.md, README.md, MIGRATION_GUIDE.md, OPS_RUNBOOK.md]
status: current
updated: 2026-04-12
---

# Billing Implementation

Back to [Billing Documentation](./README.md) | [All Docs](../INDEX.md)

## Overview

CurrIA billing is webhook-driven.

- Credits are granted only from trusted Asaas webhook events.
- `credit_accounts` is the authoritative runtime balance.
- `user_quotas` stores subscription metadata plus the UI-facing display total in `credits_remaining`.
- `billing_checkouts` is the source of truth for post-cutover paid checkout resolution.
- `processed_events` guarantees idempotent webhook processing.
- Resume-generation billing is anchored on successful `resume_generations`, not session creation or chat volume.
- `credit_consumptions` gives the auditable record for each consumed generation credit.

## Data Model

### `credit_accounts`

- Owns the runtime balance.
- Every successful resume-generation charge reads and mutates this table.
- Billing credit grants add to the current balance.

### `user_quotas`

- Owns billing metadata and display state:
  - `plan`
  - `credits_remaining` as the dashboard display total for the current plan cycle
  - `asaas_subscription_id`
  - `renews_at`
  - `status`
- Runtime credit enforcement still reads `credit_accounts`, not `user_quotas`.
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

### `resume_generations`

- Stores every billable resume-generation attempt.
- Tracks:
  - generation type: `ATS_ENHANCEMENT` or `JOB_TARGETING`
  - lifecycle: `pending`, `completed`, `failed`
  - idempotency key
  - source CV snapshot and generated CV state
  - artifact paths when generation completes successfully
- A session may contain many resume generations.

### `credit_consumptions`

- Stores the auditable spend record for each billed generation.
- Links one consumed credit event to one `resume_generations` row.
- Prevents double-charge by enforcing one consumption record per generation.

## Runtime Billing Boundaries

- Starting a session is free.
- Sending chat messages is free.
- Pasting or analyzing a job description is free.
- Manual preview edits are free.
- A credit is consumed only after a resume generation succeeds.
- Replaying the same logical generation request through an idempotency key must return the existing result with `creditsUsed = 0`.

## Checkout Flow

1. Validate authenticated user and requested paid plan.
2. Validate and persist billing info before the provider call.
3. Normalize billing fields:
   - `phoneNumber` -> 11-digit BR number
   - `postalCode` -> 8-digit CEP
   - `province` -> uppercase UF
4. Create a `billing_checkouts` row in `pending`.
5. Format `externalReference` as `curria:v1:c:<checkoutReference>`.
6. Call Asaas with that `externalReference`.
7. If Asaas succeeds, mark the checkout `created`.
8. If Asaas fails, mark the checkout `failed`.

### Asaas `customerData` Contract

- Both one-time and recurring checkout creation send the full billing payload when available:
  - `cpfCnpj`
  - `phone`
  - `address`
  - `addressNumber`
  - `postalCode`
  - `province`
- CurrIA stores the normalized phone internally as `phoneNumber`, but the outgoing Asaas field must be `customerData.phone`.
- CurrIA validates checkout onboarding input before persistence and before the provider call so the same normalized values are used for:
  - `customer_billing_info`
  - `billing_checkouts`
  - the Asaas checkout request

## Webhook Resolution

### `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`

- Both are treated as the same internal semantic event: `PAYMENT_SETTLED`.
- One-time purchases resolve plan and user from `billing_checkouts`.
- Current Asaas payloads may omit `payment.externalReference` for one-time payments and send only `payment.checkoutSession`. CurrIA supports both trust anchors:
  - preferred path: v1 `externalReference`
  - fallback path: `checkoutSession`, resolved through the stored hosted-checkout URL in `billing_checkouts.asaas_link`
- Initial recurring activation also resolves from `billing_checkouts`, but only when `payment.subscription` is present and the checkout is still `created`.
- Renewal payments resolve from persisted `user_quotas.asaas_subscription_id`.
- The fingerprint normalizes `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` so the same settled payment cannot grant credits twice.

### `SUBSCRIPTION_CREATED`

- Accepted for compatibility with current Asaas payloads.
- Never grants credits.
- If the snapshot already arrives inactive or deleted, the referenced pending checkout is canceled and the webhook is acknowledged with `200 ignored`.
- Active snapshots are treated as informational only because subscription creation is not the payment trust anchor.

### `SUBSCRIPTION_UPDATED`

- Accepted for compatibility with current Asaas payloads.
- Updates persisted metadata only when `user_quotas.asaas_subscription_id` already exists.
- Can move the billing status to `active`, `past_due`, or `canceled`.
- If it describes a canceled subscription before activation, the referenced pending checkout is canceled and the webhook is acknowledged with `200 ignored`.

### `SUBSCRIPTION_RENEWED`

- Kept as a legacy compatibility path.
- Resolves from `user_quotas.asaas_subscription_id`.
- Grants renewal credits through the transactional RPC with `p_is_renewal = true`.

### `SUBSCRIPTION_INACTIVATED` / `SUBSCRIPTION_CANCELED` / `SUBSCRIPTION_DELETED`

- Treated as the same internal semantic event: `SUBSCRIPTION_CANCELED`.
- Resolve from `user_quotas.asaas_subscription_id` when metadata already exists.
- Do not revoke credits.
- Update subscription metadata only.
- If metadata does not exist yet, the webhook is acknowledged and the pending checkout is canceled when a v1 checkout reference is present.

## Credit Carryover and Renewal Logic

### Carryover on Plan Change (Initial and Subscription Starts)

When a user changes plans—whether from a one-time purchase or upgrading/downgrading their subscription—remaining credits are preserved and **added** to the new plan's credit allocation.

**Implementation**:
- The RPC function `apply_billing_credit_grant_event` accepts a `p_is_renewal` parameter.
- For `PAYMENT_SETTLED` and `SUBSCRIPTION_STARTED` events: `p_is_renewal = FALSE` (default).
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

The `p_is_renewal` parameter is set explicitly by the application code in `src/lib/asaas/credit-grants.ts`:

```typescript
const isRenewal = request.isRenewal ?? false
```

This value is then passed to the RPC, which applies the correct logic:
- `isRenewal = true`: Replace balance with plan credits (renewal)
- `isRenewal = false`: Add to existing balance (plan change/purchase)

### Operational Note

- Users upgrading plans mid-cycle preserve their unused credits.
- Subsequent renewals replace credits, not add to them.
- The RPC behavior is controlled by application code setting the `p_is_renewal` parameter based on event type.
- The dashboard denominator uses the persisted display total in `user_quotas.credits_remaining`, which is written alongside billing grants and refreshed by the `20260407_persist_billing_display_totals.sql` migration.

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
- Unsupported or informational Asaas events return `200 ignored` instead of `400`, preventing the Asaas queue from pausing on non-actionable snapshots.
- RPCs reject:
  - missing trust anchors
  - plan mismatches
  - amount mismatches
  - non-positive credit grants
  - negative or overflowing balances

## Migration Notes

- `20260407_harden_text_id_generation.sql` hardens generic text primary-key tables and the SQL write paths that create billing-adjacent rows.
- `20260407_harden_standard_timestamps.sql` hardens mutable timestamp columns so billing and dashboard writes do not fail when `updated_at` defaults drift.
- Billing tables affected directly by this standard include:
  - `billing_checkouts`
  - `processed_events`
  - `customer_billing_info`
- Cross-cutting details live in [../database-conventions.md](../database-conventions.md).

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
- Must send Asaas `customerData.phone`, not `customerData.phoneNumber`.
- Must normalize phone and CEP before persistence and provider creation.
- Initial paid webhook events fail closed if the checkout record is missing.
- One-time webhook reconciliation may use `checkoutSession` when `externalReference` is null in the provider payload.

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
- display-total drift between UI metadata and runtime balance:
  - `SELECT quota.user_id, quota.plan, quota.credits_remaining AS display_total, account.credits_remaining AS runtime_balance FROM user_quotas AS quota JOIN credit_accounts AS account ON account.user_id = quota.user_id WHERE quota.credits_remaining < account.credits_remaining;`
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
| One-time settlements resolve from checkout trust anchors only | `src/lib/asaas/event-handlers.ts` -> `handlePaymentSettlement()` | Requires either v1 `externalReference` or `checkoutSession`, loads `billing_checkouts`, validates amount and `status='created'` | Automated: `src/lib/asaas/event-handlers.test.ts` covers valid v1, `checkoutSession` fallback, missing checkout, and legacy rejection | Inspect `processed_events` for `PAYMENT_SETTLED`, then confirm matching `billing_checkouts.checkout_reference`, `status='paid'`, and unchanged plan source |
| Initial subscriptions activate from first settled payment, not `SUBSCRIPTION_CREATED` | `src/lib/asaas/event-handlers.ts` -> `handlePaymentSettlement()` | Requires `payment.subscription`, v1 `externalReference`, checkout in `created`, and matching amount | Automated: `src/lib/asaas/event-handlers.test.ts` covers recurring activation from `PAYMENT_CONFIRMED` | Inspect `processed_events` for `SUBSCRIPTION_STARTED`, then verify `billing_checkouts.status='subscription_active'` and `user_quotas.asaas_subscription_id` populated |
| Renewals resolve from `asaas_subscription_id`, not initial checkout trust | `src/lib/asaas/event-handlers.ts` -> `handlePaymentSettlement()` / `handleSubscriptionRenewed()` | Uses persisted subscription metadata and explicit renewal semantics | Automated: `src/lib/asaas/event-handlers.test.ts` covers payment-driven renewal and legacy renewal | Run `SELECT * FROM user_quotas WHERE asaas_subscription_id = '<sub_id>';` then verify the renewal replaced the user's balance once |
| Cancellation updates metadata only and never revokes credits | `src/lib/asaas/event-handlers.ts` -> `handleSubscriptionCanceled()` / `handleSubscriptionUpdated()` | Calls metadata RPC only; no credit grant path is invoked | Automated: `src/lib/asaas/event-handlers.test.ts` covers cancellation and ignored pre-activation snapshots | Compare `credit_accounts.credits_remaining` before and after a `SUBSCRIPTION_CANCELED` event; only `user_quotas.status` and `renews_at` should change |
| Duplicate webhook protection works at route and DB levels | `src/app/api/webhook/asaas/route.ts`; billing RPCs in `prisma/migrations/billing_webhook_hardening.sql` | Fast pre-check via `getProcessedEvent()`, transactional RPC duplicate check under advisory lock | Automated: `src/app/api/webhook/asaas/route.test.ts` covers pre-check duplicate and downstream duplicate result | Send the same webhook twice and verify only one credit mutation occurs; query `processed_events` by fingerprint and confirm a single authoritative record |
| Temporary webhook failures remain retryable | `src/app/api/webhook/asaas/route.ts` -> `POST` | Handler errors return `500`; route does not convert failures to success | Automated: `src/app/api/webhook/asaas/route.test.ts` covers failed first attempt and successful retry | Force a temporary failure, confirm 500 in logs, retry the same payload, and verify it later succeeds without duplicate grants |
| Concurrent identical webhook deliveries are safe | `src/app/api/webhook/asaas/route.ts`; billing RPC advisory lock | Same fingerprint can race through the route, but one path is deduped downstream | Automated: `src/app/api/webhook/asaas/route.test.ts` covers concurrent identical requests with one `processed` and one `duplicate` result; DB lock itself is still verified operationally | Replay identical events in parallel and verify one response is cached/duplicate and only one credit delta occurs in `credit_accounts` |
| RPC trust-anchor validation rejects bad checkout or subscription references | `src/lib/asaas/credit-grants.ts`; billing RPCs in `prisma/migrations/billing_webhook_hardening.sql` | RPC re-checks `billing_checkouts` or `user_quotas` before mutating state | Automated: `src/lib/asaas/credit-grants.test.ts` covers propagation of invalid checkout, invalid subscription, overflow, and negative-balance rejections; SQL semantics should still be spot-checked in staging | Call the RPC with a bad `checkout_reference` or `asaas_subscription_id` in staging and verify it raises without writing `processed_events` or changing balances |
| Pre-cutover recurring metadata gaps are visible | `src/lib/asaas/credit-grants.ts` -> `getPersistedSubscriptionMetadata()` | Logs `billing.pre_cutover_missing_metadata` and `billing.pre_cutover_invalid_plan_metadata` | Automated: recurring resolution tests cover the positive path; anomaly logging is operationally verified | Run `SELECT * FROM user_quotas WHERE plan IN ('monthly', 'pro') AND status != 'canceled' AND asaas_subscription_id IS NULL;` and treat any row or matching warning log as a migration blocker |
| Partial-success exceptions are detectable and recoverable | `src/app/api/checkout/route.ts`; `src/lib/asaas/event-handlers.ts` | If post-provider or post-RPC marking fails, the request errors instead of silently succeeding; processed state may already exist | Automated: `src/app/api/checkout/route.test.ts` covers `markCheckoutCreated()` and `formatExternalReference()` failures after pending row creation; `src/lib/asaas/event-handlers.test.ts` covers `markCheckoutPaid()` and `markCheckoutSubscriptionActive()` failures after successful grant | Look for `processed_events` entries where the corresponding `billing_checkouts.status` is still `created`; reconcile by checking the provider object and manually updating the checkout lifecycle if the economic event already succeeded |
| Dashboard credit denominators stay aligned with preserved balances | `src/lib/asaas/quota.ts`; `apply_billing_credit_grant_event`; `20260407_persist_billing_display_totals.sql` | Stores a UI-facing display total in `user_quotas.credits_remaining` while runtime checks still use `credit_accounts` | Automated: `src/lib/asaas/quota.test.ts` covers preserved-credit totals larger than the base plan allocation | Compare `user_quotas.credits_remaining` to `credit_accounts.credits_remaining`; the display total should never be lower than the runtime balance |

## Related Documentation

- [Core Concepts](../CONCEPTS.md) - billing mental model and credit boundaries.
- [Billing Monitoring](./MONITORING.md) - operational checks, alerts, and query patterns.
- [Billing Ops Runbook](./OPS_RUNBOOK.md) - response workflows for common billing incidents.
- [Logging and Error Queries](../logging.md) - log patterns and debugging entry points.
