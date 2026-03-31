# Billing Ops Runbook

This document provides operational procedures for diagnosing and recovering from billing system issues in production.

---

## Quick Diagnostics: Is Billing Healthy?

### Health Check Query

```sql
-- Run every hour; all should be recent and non-zero
SELECT
  (SELECT COUNT(*) FROM processed_events
    WHERE created_at > NOW() - INTERVAL '1 hour') as webhook_events_last_hour,
  (SELECT COUNT(*) FROM credit_accounts
    WHERE credits_remaining > 0) as active_users,
  (SELECT SUM(credits_remaining) FROM credit_accounts) as total_credits_granted,
  (SELECT COUNT(*) FROM billing_checkouts
    WHERE status = 'failed') as failed_checkouts,
  (SELECT COUNT(*) FROM billing_checkouts
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes') as stale_pending_checkouts;
```

**Expected:**
- webhook_events_last_hour > 0 (if expecting traffic)
- active_users > 0
- total_credits_granted > 0
- failed_checkouts = 0 or low
- stale_pending_checkouts = 0

---

## Common Issues & Diagnosis

### 1. "User has no credits but says they paid"

**Symptoms:**
- User claims they purchased credits
- User's credit_accounts.credits_remaining is 0 or low
- User can't create sessions

**Diagnosis:**

```sql
-- Step 1: Find the payment event
SELECT pe.*
FROM processed_events pe
LEFT JOIN billing_checkouts bc ON bc.checkout_reference = COALESCE(
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$')
)
LEFT JOIN user_quotas uq ON uq.asaas_subscription_id = COALESCE(
  pe.event_payload->'subscription'->>'id',
  pe.event_payload->'payment'->>'subscription'
)
WHERE bc.user_id = '<user_id>'
   OR uq.user_id = '<user_id>'
   OR COALESCE(
        pe.event_payload->'payment'->>'externalReference',
        pe.event_payload->'subscription'->>'externalReference'
      ) = '<user_id>'
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check credit account
SELECT * FROM credit_accounts WHERE user_id = '<user_id>';

-- Step 3: Check checkout record
SELECT * FROM billing_checkouts WHERE user_id = '<user_id>'
ORDER BY created_at DESC LIMIT 5;

-- Step 4: Check if there's an orphaned payment (processed but checkout not updated)
SELECT pe.*, bc.status
FROM processed_events pe
LEFT JOIN billing_checkouts bc ON bc.checkout_reference = COALESCE(
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$')
)
WHERE pe.event_type = 'PAYMENT_RECEIVED'
  AND bc.user_id = '<user_id>'
ORDER BY pe.created_at DESC LIMIT 1;
```

**Possible Causes:**

**A) Payment processed but webhook never arrived**
```sql
-- Check: is there a processed_events row but checkout status is still 'created'?
SELECT * FROM billing_checkouts
WHERE user_id = '<user_id>'
  AND status = 'created' -- Should be 'paid'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**Action:** Manually mark checkout paid and retry Asaas webhook
```sql
-- Find the payment ID from Asaas
UPDATE billing_checkouts
SET status = 'paid', asaas_payment_id = '<asaas_payment_id>'
WHERE checkout_reference = '<checkout_reference>'
  AND user_id = '<user_id>';

-- Verify credits were granted
SELECT * FROM credit_accounts WHERE user_id = '<user_id>';
```

**B) Payment never created a processed_event (no trace in Asaas either)**
```sql
-- Check if there's a checkout but no processed_event
SELECT * FROM billing_checkouts
WHERE user_id = '<user_id>'
  AND status IN ('created', 'paid')
  AND checkout_reference NOT IN (
    SELECT COALESCE(
      substring(event_payload->'payment'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
      substring(event_payload->'payment'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$'),
      substring(event_payload->'subscription'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
      substring(event_payload->'subscription'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$')
    )
    FROM processed_events
    WHERE event_type IN ('PAYMENT_RECEIVED', 'SUBSCRIPTION_CREATED')
  );
```

**Action:** Contact Asaas support - payment may not have been sent to webhook

**C) Checkout record missing entirely**
```sql
-- Check if there's no billing_checkouts row at all
SELECT COUNT(*) FROM billing_checkouts
WHERE user_id = '<user_id>';
```

**Action:** User may have purchased before billing_checkouts table existed (pre-cutover)
- Check user_quotas for recurring subscriptions
- If free user, explain plan/upgrade flow
- If should have credits, manually create credit account

---

### 2. "Subscription renewed twice in one month"

**Symptoms:**
- User shows credits increased twice in 30 days
- User complains about double-charging

**Diagnosis:**

```sql
-- Find all renewal events for this subscription
SELECT * FROM processed_events
WHERE event_type = 'SUBSCRIPTION_RENEWED'
  AND event_payload->>'subscription'->>'id' = '<subscription_id>'
ORDER BY created_at DESC;

-- Check if fingerprints are identical (would be deduplicated)
SELECT
  event_fingerprint,
  COUNT(*) as count,
  STRING_AGG(id, ',') as event_ids
FROM processed_events
WHERE event_type = 'SUBSCRIPTION_RENEWED'
  AND event_payload->>'subscription'->>'id' = '<subscription_id>'
GROUP BY event_fingerprint
HAVING COUNT(*) > 1;
```

**Possible Causes:**

**A) Different renewal events (legitimate)**
- Renewal dates may have moved due to plan change in Asaas
- Check if nextDueDate is different between events

**Action:** No action needed; intended behavior

**B) Identical fingerprint processed twice (deduplication failed)**
```sql
-- Should never happen, but if it did:
SELECT COUNT(*) FROM processed_events
WHERE event_fingerprint = '<fingerprint>';
-- Should be exactly 1
```

**Action:** Contact engineering; deduplication should prevent this

**C) Webhook retried by Asaas (same event, expected)**
```sql
-- Check if second event has same fingerprint but Asaas is retrying
SELECT * FROM processed_events
WHERE event_type = 'SUBSCRIPTION_RENEWED'
  AND event_fingerprint = '<fingerprint>';
-- If count = 1, webhook only processed once (correct)
```

**Action:** Verify user wasn't double-charged in Asaas invoice; if Asaas shows one charge, billing is correct

---

### 3. "Credits stuck at 0, user can't create sessions"

**Symptoms:**
- credit_accounts.credits_remaining = 0
- User purchased subscription or one-time package
- User paid and got confirmation from Asaas

**Diagnosis:**

```sql
-- Step 1: Is there a credit_accounts row at all?
SELECT * FROM credit_accounts WHERE user_id = '<user_id>';
-- If no row: user never created a session

-- Step 2: Is there a payment/subscription processed?
SELECT COUNT(*)
FROM processed_events pe
LEFT JOIN billing_checkouts bc ON bc.checkout_reference = COALESCE(
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$')
)
LEFT JOIN user_quotas uq ON uq.asaas_subscription_id = COALESCE(
  pe.event_payload->'subscription'->>'id',
  pe.event_payload->'payment'->>'subscription'
)
WHERE bc.user_id = '<user_id>'
   OR uq.user_id = '<user_id>'
   OR COALESCE(
        pe.event_payload->'payment'->>'externalReference',
        pe.event_payload->'subscription'->>'externalReference'
      ) = '<user_id>';

-- Step 3: If subscription, check renewal history
SELECT * FROM processed_events
WHERE event_type IN ('SUBSCRIPTION_CREATED', 'SUBSCRIPTION_RENEWED')
  AND event_payload->>'subscription'->>'id' = '<subscription_id>'
ORDER BY created_at DESC LIMIT 5;

-- Step 4: Check app logs for a failed webhook or checkout attempt.
-- Failed webhook/checkouts do not create processed_events rows because the
-- transaction rolls back before the insert on rejection paths.
-- Search logs by:
--   - user_id
--   - checkout_reference
--   - payment.id
--   - asaas_subscription_id
```

**Possible Causes:**

**A) User just created account, hasn't purchased yet**
- Expected behavior; explain purchase flow

**B) Payment/subscription created but credits never granted (RPC failed)**
```sql
-- Check app logs first; failed RPC attempts do not persist in processed_events.
-- Then confirm no successful payment/subscription event exists for this user:
SELECT COUNT(*)
FROM processed_events pe
LEFT JOIN billing_checkouts bc ON bc.checkout_reference = COALESCE(
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'payment'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:c:(.+)$'),
  substring(pe.event_payload->'subscription'->>'externalReference' FROM '^curria:v1:u:[^:]+:c:(.+)$')
)
LEFT JOIN user_quotas uq ON uq.asaas_subscription_id = COALESCE(
  pe.event_payload->'subscription'->>'id',
  pe.event_payload->'payment'->>'subscription'
)
WHERE bc.user_id = '<user_id>'
   OR uq.user_id = '<user_id>'
   OR COALESCE(
        pe.event_payload->'payment'->>'externalReference',
        pe.event_payload->'subscription'->>'externalReference'
      ) = '<user_id>';
```

**Action:** If error is "Credit balance overflow":
```sql
-- User is at 1000000 credit limit
-- Manually adjust if they should have fewer
UPDATE credit_accounts
SET credits_remaining = <new_amount>
WHERE user_id = '<user_id>';
```

If error is something else, contact engineering.

**C) User never initiated a purchase**
- Explain checkout flow
- Send checkout link
- Monitor next webhook

---

### 4. "Pending checkout for 2+ hours, no payment webhook"

**Symptoms:**
- billing_checkouts.status = 'pending' for over 1 hour
- User didn't see Asaas payment page
- No PAYMENT_RECEIVED or SUBSCRIPTION_CREATED webhook

**Diagnosis:**

```sql
-- Find stale pending checkouts
SELECT * FROM billing_checkouts
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;

-- For each: was there a failure?
SELECT * FROM processed_events
WHERE COALESCE(
  event_payload->'payment'->>'externalReference',
  event_payload->'subscription'->>'externalReference'
) = '<externalReference>';
-- If no row: Asaas never sent webhook

-- Check Asaas logs/dashboard for this payment link
```

**Possible Causes:**

**A) User didn't click the link / abandoned checkout**
- Expected; no action needed

**B) Asaas API call failed (marked as 'failed')**
```sql
SELECT status FROM billing_checkouts
WHERE checkout_reference = '<ref>';
-- If status = 'failed': Asaas creation failed
```

**Action:**
```sql
-- Create a new checkout for the user
DELETE FROM billing_checkouts WHERE checkout_reference = '<ref>';
-- Or just send new checkout link with fresh reference
```

**C) Asaas succeeded but webhook delivery failed**
```sql
-- Webhook should have arrived within minutes
-- If > 1 hour and no webhook, check Asaas webhook logs
-- If webhook was sent but we didn't receive it, check our logs
```

**Action:** Manually replay the webhook from Asaas dashboard (if available) or ask Asaas support

---

### 5. "Failed checkout - Asaas call threw an error"

**Symptoms:**
- billing_checkouts.status = 'failed'
- User complained checkout didn't work
- Logs show Asaas API error

**Diagnosis:**

```sql
-- Find failed checkouts
SELECT * FROM billing_checkouts
WHERE status = 'failed'
ORDER BY created_at DESC LIMIT 10;

-- Check app logs for reason
-- Logs will include: [api/checkout] Error: <Asaas error>

-- Is it a transient error (timeout, 5xx)?
-- Or permanent error (invalid credentials, bad request)?
```

**Possible Causes:**

**A) Asaas API temporarily down**
- Check Asaas status page
- Retry checkout; reference should be different

**B) Invalid Asaas credentials**
- Check ASAAS_ACCESS_TOKEN env var in staging/prod
- Verify token hasn't expired

**C) Invalid checkout parameters**
- Plan doesn't exist in PLANS config
- Amount doesn't match plan price
- externalReference format invalid

**Action:**
```sql
-- Create a new checkout for the user
-- Fresh checkout_reference will be generated
-- externalReference will be reformatted

-- Delete the failed row (or leave as historical record)
DELETE FROM billing_checkouts WHERE checkout_reference = '<failed_ref>';
```

---

### 6. "Renewal didn't grant credits - pre-cutover subscription"

**Symptoms:**
- Subscription renewed but credits_remaining didn't change
- User has old subscription (created before billing_checkouts table)
- Logs show: `billing.pre_cutover_missing_metadata`

**Diagnosis:**

```sql
-- Check user_quotas for subscription metadata
SELECT * FROM user_quotas
WHERE asaas_subscription_id = '<subscription_id>';

-- If row missing or plan is NULL:
-- Pre-cutover subscription metadata gap

-- Check processed_events for the renewal
SELECT * FROM processed_events
WHERE event_type = 'SUBSCRIPTION_RENEWED'
  AND event_payload->>'subscription'->>'id' = '<subscription_id>'
ORDER BY created_at DESC LIMIT 1;
```

**Possible Causes:**

**A) user_quotas row exists but asaas_subscription_id is NULL**
```sql
SELECT * FROM user_quotas
WHERE user_id = '<user_id>'
  AND asaas_subscription_id IS NULL;
```

**Action:** Update the row with the subscription ID
```sql
UPDATE user_quotas
SET asaas_subscription_id = '<subscription_id>'
WHERE user_id = '<user_id>'
  AND asaas_subscription_id IS NULL;

-- Manually grant the credits for this renewal
INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_' || '<user_id>', '<user_id>', <plan_credits>, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE
SET credits_remaining = credits_remaining + <plan_credits>;

-- Record the processed event
INSERT INTO processed_events
(id, event_id, event_fingerprint, event_type, event_payload, processed_at, created_at)
VALUES
(gen_random_uuid()::text, '<renewal_fingerprint>', '<renewal_fingerprint>',
 'SUBSCRIPTION_RENEWED', '<event_payload_json>'::jsonb, NOW(), NOW());
```

**B) user_quotas row missing entirely**
```sql
SELECT COUNT(*) FROM user_quotas
WHERE user_id = '<user_id>';
-- If 0: user has no quota record
```

**Action:** Create user_quotas row from renewal event data
```sql
INSERT INTO user_quotas
(id, user_id, plan, asaas_subscription_id, renews_at, status, created_at, updated_at)
VALUES
(gen_random_uuid()::text, '<user_id>', '<plan>', '<subscription_id>',
 '<next_renewal_date>'::timestamptz, 'active', NOW(), NOW());

-- Then grant credits (as above)
```

---

## Manual Credit Adjustment

**When to use:** User refund, discount correction, abuse prevention, migration from legacy system

**Procedure:**

```sql
-- Step 1: Record current state
SELECT id, user_id, credits_remaining FROM credit_accounts
WHERE user_id = '<user_id>';

-- Step 2: Update credits
UPDATE credit_accounts
SET credits_remaining = <new_amount>
WHERE user_id = '<user_id>';

-- Step 3: Log the change (in observability system or manually via app)
-- Create a support ticket with:
-- - User ID
-- - Old balance
-- - New balance
-- - Reason (refund / correction / abuse prevention)
-- - Approver name

-- Step 4: Verify
SELECT * FROM credit_accounts WHERE user_id = '<user_id>';
```

**Example: User refund**
```sql
-- User refunded R$19.90 (unit plan)
UPDATE credit_accounts
SET credits_remaining = credits_remaining - 3  -- unit plan = 3 credits
WHERE user_id = '<user_id>';
```

**Example: Subscription credits doubled by mistake**
```sql
-- Correction: user was double-credited in one renewal
UPDATE credit_accounts
SET credits_remaining = credits_remaining - 20  -- monthly plan = 20 credits
WHERE user_id = '<user_id>';
```

---

## Reprocessing a Webhook Manually

**When to use:** Webhook failed, RPC rejected, manual recovery needed

**Procedure:**

```sql
-- Step 1: Verify the event doesn't already exist
SELECT * FROM processed_events
WHERE event_fingerprint = '<fingerprint>';
-- If result is 1 row: already processed, do NOT reprocess

-- Step 2: If missing, manually insert via curl to webhook endpoint
curl -X POST https://curria.app/api/webhook/asaas \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '<original_webhook_payload_json>'

-- Step 3: Check response and logs
# If success: verify DB state changed as expected
# If failure: diagnose the error (see Common Issues above)

-- Step 4: If webhook processing still fails after diagnosis:
# Manually create processed_event and credit/metadata row
```

**Example: Manually reprocess PAYMENT_RECEIVED**

```bash
curl -X POST https://curria.app/api/webhook/asaas \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1990,
    "payment": {
      "id": "pay_123",
      "externalReference": "curria:v1:c:chk_xyz",
      "subscription": null,
      "amount": 1990
    }
  }'
```

---

## Pre-Cutover Subscription Handling

**Context:** Subscriptions created before the billing_checkouts table existed. They have:
- `externalReference = appUserId` (not v1 format)
- `asaas_subscription_id` in user_quotas
- No corresponding billing_checkouts row

### Renewal path (should work)
```sql
-- Renewal events resolve by asaas_subscription_id, not by externalReference
-- So pre-cutover renewals should grant credits normally
SELECT * FROM processed_events
WHERE event_type = 'SUBSCRIPTION_RENEWED'
  AND event_payload->>'subscription'->>'id' = '<pre_cutover_subscription_id>'
ORDER BY created_at DESC LIMIT 1;

-- If no row and renewal happened in Asaas:
# Check user_quotas for metadata
# If present, credits should have been granted automatically
# If missing, see "Pre-cutover subscription metadata gap" above
```

### Cancellation path (should work)
```sql
-- Cancellation events also resolve by asaas_subscription_id
-- So pre-cutover cancellations should update metadata normally
SELECT * FROM user_quotas
WHERE asaas_subscription_id = '<pre_cutover_subscription_id>';
-- status should be 'canceled' after event
```

### Legacy externalReference sunset
```sql
-- Pre-cutover subscriptions use old externalReference = appUserId format
-- This is supported temporarily for backward compatibility

-- Check how many active subscriptions still use legacy format:
SELECT COUNT(*) FROM user_quotas
WHERE asaas_subscription_id IS NOT NULL
  AND status = 'active'
  AND created_at < TIMESTAMP '2026-03-01';  -- Before cutover date

-- Once all pre-cutover subscriptions expire/cancel, legacy parsing can be disabled
-- At that point, update external-reference.ts to reject legacy format
```

---

## Monitoring Queries to Run Regularly

### Hourly
```sql
-- Failed checkouts
SELECT COUNT(*) as failed_count, NOW() as checked_at
FROM billing_checkouts
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour';
-- Alert if > 5 in past hour

-- Stale pending checkouts
SELECT COUNT(*) as stale_count, NOW() as checked_at
FROM billing_checkouts
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';
-- Alert if any
```

### Daily
```sql
-- Legacy-path webhook frequency (track for sunset)
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_webhooks,
  SUM(
    CASE
      WHEN COALESCE(
        event_payload->'payment'->>'externalReference',
        event_payload->'subscription'->>'externalReference'
      ) ~ '^usr_[A-Za-z0-9]+$' THEN 1
      ELSE 0
    END
  ) as legacy_count
FROM processed_events
WHERE created_at > NOW() - INTERVAL '7 days'
  AND event_type IN ('SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED')
GROUP BY DATE(created_at)
ORDER BY date DESC;
-- Should trend toward zero legacy events

-- Pre-cutover metadata gaps (any occurrence should alert)
SELECT COUNT(*) as anomaly_count
FROM processed_events
WHERE created_at > NOW() - INTERVAL '1 day'
  AND event_payload->>'error' LIKE '%pre_cutover_missing_metadata%';
-- Alert if > 0
```

### Weekly
```sql
-- Credit balance health
SELECT
  COUNT(*) as total_users,
  SUM(credits_remaining) as total_credits,
  AVG(credits_remaining) as avg_credits,
  MIN(credits_remaining) as min_credits,
  MAX(credits_remaining) as max_credits
FROM credit_accounts
WHERE credits_remaining > 0;
-- Verify totals make sense
```

---

## Escalation Procedures

**For issues you CAN resolve:**
- Manual credit adjustments (refund, correction)
- Marking checkouts as paid/failed when webhook delivery failed
- Re-sending webhooks manually
- Updating user_quotas metadata for pre-cutover subscriptions

**For issues requiring engineering:**
- Repeated RPC rejections (overflow, negative balance)
- Duplicate webhooks bypassing deduplication
- Asaas integration errors (API key, token)
- Data corruption or inconsistent state across tables

**Escalation path:**
1. Gather diagnostics (SQL queries above)
2. Create ticket with:
   - User ID(s) affected
   - SQL queries run and results
   - Expected vs actual DB state
   - Logs from app/Asaas
3. Include: "Billing runbook diagnosis complete, manual recovery needed"
