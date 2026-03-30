# Staging Validation Plan for Asaas Billing

This document provides exact, reproducible validation steps for the Asaas billing system before production deployment.

## Pre-Staging Setup

1. **Deploy code to staging**
   - All billing routes, handlers, helpers, and migrations applied
   - Database migration `billing_webhook_hardening.sql` applied
   - Fresh test data: no real user credits

2. **Test credentials**
   - Staging Asaas account with valid API key
   - Staging webhook token configured
   - Test user: `usr_staging_001`

3. **Tools needed**
   - `curl` or REST client (Postman, insomnia)
   - Direct Postgres access to staging DB
   - Access to Asaas sandbox webhook logs

---

## Scenario 1: One-Time Payment (PAYMENT_RECEIVED)

### Setup
```sql
-- Create test user and initial credits
INSERT INTO users (id, email, created_at, updated_at)
VALUES ('usr_staging_001', 'staging@curria.test', NOW(), NOW());

INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_staging_001', 'usr_staging_001', 5, NOW(), NOW());

SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 5
```

### Step 1: Create One-Time Checkout

**Request:**
```bash
POST /api/checkout
Content-Type: application/json
Authorization: Bearer <auth_token>

{
  "plan": "unit"
}
```

**Expected Response:**
```json
{
  "url": "https://asaas.sandbox/paymentlink/..."
}
```

**Expected DB State:**
```sql
SELECT * FROM billing_checkouts WHERE user_id = 'usr_staging_001';
-- Expected row:
-- checkout_reference: UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)
-- plan: 'unit'
-- amount_minor: 1900
-- status: 'created'
-- asaas_link: 'https://asaas.sandbox/paymentlink/...'
-- asaas_payment_id: NULL
-- asaas_subscription_id: NULL
```

**Critical Validation:**
- ✅ Checkout record exists BEFORE Asaas call (status='pending' briefly, then 'created')
- ✅ externalReference is v1 format: `curria:v1:c:<checkoutReference>`
- ✅ Amount matches plan price (1900 centavos = R$19)

### Step 2: Simulate Payment in Asaas

**In Asaas sandbox, mark payment as received**

Or via webhook replay (curl):
```bash
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1900,
    "payment": {
      "id": "pay_staging_001",
      "externalReference": "curria:v1:c:550e8400-e29b-41d4-a716-446655440000",
      "subscription": null,
      "amount": 1900
    }
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 8 (was 5 + 3 from unit plan)

SELECT * FROM processed_events
WHERE event_type = 'PAYMENT_RECEIVED'
ORDER BY created_at DESC LIMIT 1;
-- Expected: event_fingerprint populated, event_payload stored

SELECT * FROM billing_checkouts
WHERE user_id = 'usr_staging_001'
ORDER BY created_at DESC LIMIT 1;
-- Expected: status = 'paid', asaas_payment_id = 'pay_staging_001'
```

**Critical Validations:**
- ✅ Credit balance increased: 5 → 8 (additive, not reset)
- ✅ Checkout marked 'paid'
- ✅ processed_events has one row for this fingerprint
- ✅ user_quotas NOT modified (one-time, no subscription)

### Step 3: Duplicate Payment Webhook

Send the same webhook again:
```bash
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1900,
    "payment": {
      "id": "pay_staging_001",
      "externalReference": "curria:v1:c:550e8400-e29b-41d4-a716-446655440000",
      "subscription": null,
      "amount": 1900
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "cached": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 8 (unchanged, no double-grant)

SELECT COUNT(*) FROM processed_events
WHERE event_type = 'PAYMENT_RECEIVED'
AND user_id = 'usr_staging_001';
-- Expected: 1 (only one economic event, not duplicated)
```

**Critical Validations:**
- ✅ Duplicate webhook returns `cached: true`
- ✅ Credits NOT doubled (8, not 11)
- ✅ No second processed_events row

---

## Scenario 2: Subscription Creation (SUBSCRIPTION_CREATED)

### Setup
```sql
-- Reset test user
UPDATE credit_accounts SET credits_remaining = 5
WHERE user_id = 'usr_staging_001';

INSERT INTO user_quotas
(id, user_id, plan, status, created_at, updated_at)
VALUES
(gen_random_uuid()::text, 'usr_staging_001', 'free', 'active', NOW(), NOW());

SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 5

SELECT * FROM user_quotas WHERE user_id = 'usr_staging_001';
-- Expected: plan = 'free', asaas_subscription_id = NULL
```

### Step 1: Create Subscription Checkout

**Request:**
```bash
POST /api/checkout
Content-Type: application/json
Authorization: Bearer <auth_token>

{
  "plan": "monthly"
}
```

**Expected Response:**
```json
{
  "url": "https://asaas.sandbox/subscription/..."
}
```

**Expected DB State:**
```sql
SELECT * FROM billing_checkouts
WHERE user_id = 'usr_staging_001'
ORDER BY created_at DESC LIMIT 1;
-- Expected:
-- plan: 'monthly'
-- amount_minor: 3900
-- status: 'created'
-- asaas_subscription_id: NULL (not set yet)
```

### Step 2: Simulate Subscription Created in Asaas

```bash
CHECKOUT_REF="<checkout_reference_from_above>"

curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_CREATED\",
    \"amount\": 3900,
    \"subscription\": {
      \"id\": \"sub_staging_001\",
      \"externalReference\": \"curria:v1:c:${CHECKOUT_REF}\",
      \"nextDueDate\": \"$(date -d '+30 days' +%Y-%m-%d)\"
    }
  }"
```

**Expected Response:**
```json
{
  "success": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 25 (was 5 + 20 from monthly plan)

SELECT * FROM user_quotas WHERE user_id = 'usr_staging_001';
-- Expected:
-- plan = 'monthly'
-- asaas_subscription_id = 'sub_staging_001'
-- renews_at = 2026-04-29 (or next 30 days)
-- status = 'active'

SELECT * FROM billing_checkouts
WHERE checkout_reference = '${CHECKOUT_REF}';
-- Expected:
-- status = 'subscription_active'
-- asaas_subscription_id = 'sub_staging_001'
```

**Critical Validations:**
- ✅ Credits additive: 5 + 20 = 25
- ✅ user_quotas.asaas_subscription_id set
- ✅ Checkout marked 'subscription_active'
- ✅ renews_at populated with future date

---

## Scenario 3: Subscription Renewal (SUBSCRIPTION_RENEWED)

### Setup
User already has active subscription from Scenario 2

### Step 1: Simulate Renewal

```bash
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SUBSCRIPTION_RENEWED",
    "amount": 3900,
    "subscription": {
      "id": "sub_staging_001",
      "externalReference": "usr_staging_001",
      "status": "ACTIVE",
      "nextDueDate": "2026-05-29"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 45 (was 25 + 20 from renewal)

SELECT * FROM user_quotas WHERE user_id = 'usr_staging_001';
-- Expected:
-- plan = 'monthly' (unchanged)
-- asaas_subscription_id = 'sub_staging_001' (unchanged)
-- renews_at = '2026-05-29' (updated)
-- status = 'active' (unchanged)

SELECT * FROM billing_checkouts
WHERE asaas_subscription_id = 'sub_staging_001';
-- Expected: status = 'subscription_active' (unchanged - not touched by renewal)
```

**Critical Validations:**
- ✅ Renewal does NOT use billing_checkouts for trust (uses user_quotas.asaas_subscription_id)
- ✅ Credits additive: 25 + 20 = 45
- ✅ renews_at updated to new renewal date
- ✅ Checkout row untouched by renewal

### Step 2: Duplicate Renewal Webhook

Send the same renewal again:

**Expected Response:**
```json
{
  "success": true,
  "cached": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 45 (unchanged, no double-grant)
```

**Critical Validations:**
- ✅ Duplicate renewal is cached
- ✅ Credits NOT doubled (45, not 65)

---

## Scenario 4: Subscription Cancellation (SUBSCRIPTION_CANCELED)

### Setup
User still has active subscription from Scenario 3

### Step 1: Simulate Cancellation

```bash
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SUBSCRIPTION_CANCELED",
    "subscription": {
      "id": "sub_staging_001",
      "externalReference": "usr_staging_001"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 45 (unchanged - cancellation does NOT revoke)

SELECT * FROM user_quotas WHERE user_id = 'usr_staging_001';
-- Expected:
-- status = 'canceled'
-- renews_at = NULL
-- plan = 'monthly' (unchanged)
-- asaas_subscription_id = 'sub_staging_001' (unchanged)

SELECT * FROM billing_checkouts
WHERE asaas_subscription_id = 'sub_staging_001';
-- Expected: status = 'canceled'
```

**Critical Validations:**
- ✅ Cancellation is metadata-only (no credit change)
- ✅ Credits preserved: 45
- ✅ user_quotas.status = 'canceled'
- ✅ renews_at cleared

---

## Scenario 5: Webhook Failure & Retry

### Setup
Create a scenario where the webhook temporarily fails

### Step 1: Send Invalid Trust Anchor

```bash
# Wrong externalReference format (legacy format for one-time payment - not allowed)
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1900,
    "payment": {
      "id": "pay_staging_002",
      "externalReference": "usr_staging_001",
      "subscription": null,
      "amount": 1900
    }
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "error": "Invalid externalReference format"
}
```

HTTP Status: 400

**Expected DB State:**
```sql
-- No processed_events row (validation failed before idempotency key)
-- No credit grant
```

### Step 2: Retry with Correct Reference

Create a new checkout and retry:

```bash
curl -X POST /api/checkout ... # Create new checkout
# Get new checkout_reference

curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1900,
    "payment": {
      "id": "pay_staging_002",
      "externalReference": "curria:v1:c:<new_checkout_ref>",
      "subscription": null,
      "amount": 1900
    }
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits increased (previous + 3)
```

**Critical Validations:**
- ✅ Failure (invalid reference) returns 400, not 500
- ✅ Retry succeeds with valid reference
- ✅ Idempotency key (fingerprint) is distinct for different payment IDs

---

## Scenario 6: RPC Rejection (Overflow)

### Setup
User with credits near limit

```sql
UPDATE credit_accounts SET credits_remaining = 999999
WHERE user_id = 'usr_staging_001';
```

### Step 1: Send Payment That Would Overflow

```bash
curl -X POST http://localhost:3000/api/webhook/asaas \
  -H "asaas-access-token: <ASAAS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "amount": 1900,
    "payment": {
      "id": "pay_staging_003",
      "externalReference": "curria:v1:c:<checkout_ref>",
      "subscription": null,
      "amount": 1900
    }
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "error": "Credit balance overflow"
}
```

HTTP Status: 500

**Expected DB State:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits_remaining = 999999 (unchanged)

SELECT * FROM processed_events
WHERE event_payload->>'payment'->>'id' = 'pay_staging_003';
-- Expected: no row (RPC rejected before insert)
```

**Critical Validations:**
- ✅ Overflow is rejected (1000000 limit enforced)
- ✅ Credits NOT partially updated
- ✅ processed_events NOT inserted (transaction rolled back)
- ✅ Webhook can be safely retried after ops fixes the issue

---

## Scenario 7: Partial Success (Marking Failure After RPC)

This scenario tests what happens if the RPC succeeds but marking the checkout fails.

### Setup
Mock or inject a failure in `markCheckoutPaid()` after successful RPC

**Note:** This requires test infrastructure or direct DB manipulation. In staging, you may need to:
- Add a test endpoint that simulates this
- Or manually verify behavior via code inspection

**Expected Behavior:**
```sql
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
-- Expected: credits increased (RPC succeeded)

SELECT * FROM processed_events WHERE ...;
-- Expected: row exists (RPC inserted)

SELECT * FROM billing_checkouts WHERE ...;
-- Expected: status = 'created' (not updated to 'paid' due to marking failure)
```

**Ops Action:**
```sql
-- Manually reconcile:
UPDATE billing_checkouts
SET status = 'paid', asaas_payment_id = '<payment_id>'
WHERE checkout_reference = '<ref>';
```

---

## Pre-Production Sign-Off Checklist

- [ ] Scenario 1: One-time payment (checkout → webhook → credits increase)
- [ ] Scenario 1: Duplicate payment (cached, no double-grant)
- [ ] Scenario 2: Subscription creation (checkout → webhook → subscription_id set)
- [ ] Scenario 3: Renewal (no checkout lookup, credits additive)
- [ ] Scenario 3: Duplicate renewal (cached)
- [ ] Scenario 4: Cancellation (metadata-only, credits preserved)
- [ ] Scenario 5: Invalid reference (400, not 500)
- [ ] Scenario 5: Retry after failure (succeeds with correct reference)
- [ ] Scenario 6: Overflow rejection (RPC rejects, no partial update)
- [ ] Scenario 7: Partial success (credits updated, checkout status may lag)
- [ ] All DB state matches expected values in each scenario
- [ ] No unhandled exceptions in logs
- [ ] Fingerprint deduplication works (identical webhooks cached)
- [ ] Legacy externalReference rejected for one-time/initial subscription
- [ ] Legacy externalReference works for renewal (pre-cutover path)

---

## Rollback Decision Criteria

**STOP and investigate if:**
- Any scenario fails to match expected DB state
- Duplicate webhooks grant credits twice
- Overflow limit is not enforced
- RPC errors are not propagated correctly
- Checkout lifecycle is not updated
- Credits are reset instead of accumulated

**PROCEED to production if:**
- All scenarios pass
- All expected DB state matches
- Duplicate protection works (fingerprint + RPC)
- Error handling is correct (4xx for validation, 5xx for server)
- Ops can manually reconcile partial-success states
