# Production Billing Validation (Sandbox-Safe)

**Context:** Zero real users, product not launched. All validation happens in production database using Asaas SANDBOX API keys. Sandbox payments are test-safe.

**Goal:** Validate billing system end-to-end before launch. No staging environment needed.

---

## PART 1 — Environment Configuration

### Required `.env` Variables

These must be set in production environment:

```bash
# Database (production)
DATABASE_URL="postgresql://user:pass@host:5432/curria_production"
DIRECT_URL="postgresql://user:pass@host:5432/curria_production"

# Supabase (production)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Asaas SANDBOX (NOT production)
ASAAS_API_URL="https://sandbox.asaas.com/api/v3"
ASAAS_API_KEY="pk_test_xxxxxxxxxxxx"  # Sandbox key, NOT production key
ASAAS_WEBHOOK_TOKEN="webhook_test_xxxxxxxxxxxx"  # Sandbox token

# App
NEXT_PUBLIC_APP_URL="https://curria.example.com"
CLERK_SECRET_KEY="sk_live_xxxx"
```

### Verification: Confirm Setup is Correct

```bash
# Check 1: Database is production (NOT staging)
psql "$DATABASE_URL" -c "SELECT current_database();"
# Expected: curria_production (or similar production name)

# Check 2: Asaas is SANDBOX (NOT production)
echo "ASAAS_API_URL: $ASAAS_API_URL"
echo "ASAAS_API_KEY first 20 chars: ${ASAAS_API_KEY:0:20}"
# Expected: https://sandbox.asaas.com/api/v3
# Expected: Key starts with pk_test_ or similar test indicator

# Check 3: All migrations applied
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'billing_checkouts', 'credit_accounts', 'processed_events',
    'user_quotas', 'resume_targets', 'cv_versions'
  );"
# Expected: 6

# Check 4: All RPC functions exist
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as func_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE 'apply_billing_%';"
# Expected: 2
```

**If any check fails:** Fix configuration and re-run checks before proceeding.

---

## PART 2 — Test Data Isolation Strategy

### Naming Convention: Prevent Production Confusion

All test data uses clear prefixes:

```
User ID:        test_user_001, test_user_002, etc.
Email:          test_user_001@curria.test, test_user_002@curria.test
Checkout Ref:   test_checkout_001, test_checkout_002, etc.
Subscription ID: test_sub_001, test_sub_002, etc.
```

Real users will never have IDs starting with `test_`.

### Create Test Users

```bash
# Create test user 1
psql "$DATABASE_URL" <<'SQL'
INSERT INTO users (id, email, created_at, updated_at)
VALUES ('test_user_001', 'test_user_001@curria.test', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('test_cred_001', 'test_user_001', 5, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT 'Test user created' as status;
SELECT id, email FROM users WHERE id = 'test_user_001';
SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';
SQL
```

### Identify Test Data

```bash
# Query: Show all test data
psql "$DATABASE_URL" -c "
  SELECT 'Users' as data_type, COUNT(*) as count
  FROM users WHERE id LIKE 'test_%'
  UNION ALL
  SELECT 'Checkouts', COUNT(*)
  FROM billing_checkouts WHERE user_id LIKE 'test_%'
  UNION ALL
  SELECT 'Credits', COUNT(*)
  FROM credit_accounts WHERE user_id LIKE 'test_%'
  UNION ALL
  SELECT 'Events', COUNT(*)
  FROM processed_events WHERE event_fingerprint LIKE 'test_%';"
```

### Cleanup: Remove Test Data (After Validation)

```bash
# DELETE ALL test data
psql "$DATABASE_URL" <<'SQL'
DELETE FROM billing_checkouts WHERE user_id LIKE 'test_%';
DELETE FROM processed_events WHERE event_fingerprint LIKE 'test_%';
DELETE FROM user_quotas WHERE user_id LIKE 'test_%';
DELETE FROM credit_accounts WHERE user_id LIKE 'test_%';
DELETE FROM users WHERE id LIKE 'test_%';

SELECT 'Test data cleaned up' as status;
SQL
```

---

## PART 3 — End-to-End Validation (Production + Sandbox)

### Scenario 1: One-Time Payment

**Setup:**
```bash
# Start fresh
psql "$DATABASE_URL" <<'SQL'
DELETE FROM billing_checkouts WHERE user_id = 'test_user_001';
DELETE FROM processed_events WHERE event_fingerprint LIKE 'test_payment_%';
UPDATE credit_accounts SET credits_remaining = 5 WHERE user_id = 'test_user_001';
SQL
```

**Step 1: Create Checkout (via API)**

```bash
CHECKOUT_RESPONSE=$(curl -s -X POST "https://curria.example.com/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "unit"
  }')

echo "Checkout response:"
echo "$CHECKOUT_RESPONSE" | jq .

# Extract checkoutReference
CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | jq -r '.checkoutReference')
echo "Checkout Reference: $CHECKOUT_REF"
```

**Expected:**
- HTTP 200
- checkoutReference in response (e.g., `test_checkout_001`)
- asaasLink to Asaas sandbox payment page

**Step 2: Verify Checkout Created**

```bash
psql "$DATABASE_URL" -c "
  SELECT id, checkoutReference, status, amount_minor
  FROM billing_checkouts
  WHERE checkoutReference = '$CHECKOUT_REF';"
```

**Expected:**
- One row with status = 'created'
- amount_minor > 0

**Step 3: Simulate Payment in Asaas Sandbox**

Option A: Via Asaas Sandbox Dashboard
- Go to https://sandbox.asaas.com/
- Find the payment
- Click to mark as received

Option B: Via Webhook Simulation (see PART 4)

**Step 4: Verify Webhook Was Received**

```bash
# Wait 2 seconds for webhook to process
sleep 2

psql "$DATABASE_URL" -c "
  SELECT event_type, event_fingerprint, created_at
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  ORDER BY created_at DESC LIMIT 1;"
```

**Expected:**
- One row with event_type = 'PAYMENT_RECEIVED'
- event_fingerprint is not null

**Step 5: Verify Credits Increased**

```bash
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'test_user_001';"
```

**Expected:**
- credits_remaining = 8 (was 5, added 3 for 'unit' plan)

**Step 6: Test Idempotency (CRITICAL)**

Replay the EXACT same webhook:

```bash
# Get the last processed event
LAST_EVENT=$(psql "$DATABASE_URL" -t -c "
  SELECT event_fingerprint FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  ORDER BY created_at DESC LIMIT 1;" | xargs)

echo "Last event fingerprint: $LAST_EVENT"

# Replay webhook
curl -s -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_001\",
      \"externalReference\": \"curria:v1:u:test_user_001:c:$CHECKOUT_REF\",
      \"value\": 300,
      \"status\": \"received\"
    }
  }"

# Verify no double-grant
sleep 1
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'test_user_001';"
```

**Expected:**
- Credits still 8 (no double-grant)
- No new processed_events row with same fingerprint

**Status:** ✅ SCENARIO 1 PASS (or FAIL with details)

---

### Scenario 2: Subscription Creation

**Setup:**
```bash
psql "$DATABASE_URL" <<'SQL'
DELETE FROM user_quotas WHERE user_id = 'test_user_001';
UPDATE credit_accounts SET credits_remaining = 5 WHERE user_id = 'test_user_001';
SQL
```

**Step 1: Create Subscription Checkout**

```bash
CHECKOUT_RESPONSE=$(curl -s -X POST "https://curria.example.com/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | jq -r '.checkoutReference')
echo "Subscription checkout: $CHECKOUT_REF"
```

**Step 2: Mark as Paid + Create Subscription**

Simulate SUBSCRIPTION_CREATED webhook:

```bash
curl -s -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_CREATED\",
    \"subscription\": {
      \"id\": \"test_sub_001\",
      \"externalReference\": \"curria:v1:u:test_user_001:c:$CHECKOUT_REF\",
      \"value\": 2900,
      \"nextDueDate\": \"2026-04-29\"
    }
  }"

sleep 1
```

**Step 3: Verify Credits & Subscription**

```bash
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';"

psql "$DATABASE_URL" -c "
  SELECT user_id, asaas_subscription_id, plan FROM user_quotas WHERE user_id = 'test_user_001';"
```

**Expected:**
- credits_remaining = 29 (was 5, added 24)
- user_quotas.asaas_subscription_id = 'test_sub_001'
- user_quotas.plan = 'monthly'

**Status:** ✅ SCENARIO 2 PASS

---

### Scenario 3: Subscription Renewal (No Checkout Lookup)

**Setup:**
```bash
psql "$DATABASE_URL" -c "UPDATE credit_accounts SET credits_remaining = 25 WHERE user_id = 'test_user_001';"
```

**Step 1: Send SUBSCRIPTION_RENEWED Webhook**

Note: No externalReference, resolves by subscription_id only:

```bash
curl -s -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_RENEWED\",
    \"subscription\": {
      \"id\": \"test_sub_001\",
      \"value\": 2000,
      \"nextDueDate\": \"2026-05-29\"
    }
  }"

sleep 1
```

**Step 2: Verify Credits (Additive)**

```bash
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';"
```

**Expected:**
- credits_remaining = 45 (was 25, added 20)
- Resolves by subscription_id (not checkout lookup)

**Step 3: Test Idempotency**

Replay same webhook → credits should stay 45

**Status:** ✅ SCENARIO 3 PASS

---

### Scenario 4: Subscription Cancellation (Metadata-Only)

**Step 1: Send SUBSCRIPTION_CANCELED**

```bash
# Remember current credits
BEFORE=$(psql "$DATABASE_URL" -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';")

curl -s -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_CANCELED\",
    \"subscription\": {
      \"id\": \"test_sub_001\",
      \"status\": \"canceled\"
    }
  }"

sleep 1
```

**Step 2: Verify Credits Unchanged**

```bash
AFTER=$(psql "$DATABASE_URL" -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';")

echo "Before: $BEFORE, After: $AFTER"
if [ "$BEFORE" = "$AFTER" ]; then
  echo "✅ Credits unchanged (correct)"
else
  echo "❌ CRITICAL BUG: Credits changed on cancellation!"
fi
```

**Expected:**
- Credits unchanged (45 stays 45)
- **If credits decreased: STOP validation, report critical bug**

**Status:** ✅ SCENARIO 4 PASS

---

### Scenario 5: Webhook Failure & Retry

**Step 1: Invalid Reference (Should Fail)**

```bash
FAIL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_fail_001\",
      \"externalReference\": \"invalid_format\",
      \"value\": 300
    }
  }")

echo "Response: $FAIL_RESPONSE"
# Expected: HTTP 400
```

**Step 2: Verify No Processing**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM processed_events WHERE event_id = 'pay_fail_001';"
# Expected: 0 (validation failed before persistence)
```

**Step 3: Retry with Corrected Reference**

Create new checkout:

```bash
CHECKOUT_RESPONSE=$(curl -s -X POST "https://curria.example.com/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | jq -r '.checkoutReference')

# Retry with correct reference
SUCCESS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_fail_001\",
      \"externalReference\": \"curria:v1:u:test_user_001:c:$CHECKOUT_REF\",
      \"value\": 300
    }
  }")

echo "Response: $SUCCESS_RESPONSE"
# Expected: HTTP 200
```

**Status:** ✅ SCENARIO 5 PASS

---

### Scenario 6: Overflow Prevention

**Setup:**
```bash
psql "$DATABASE_URL" -c "UPDATE credit_accounts SET credits_remaining = 999900 WHERE user_id = 'test_user_001';"
```

**Step 1: Try to Grant Credits That Would Overflow**

```bash
CHECKOUT_RESPONSE=$(curl -s -X POST "https://curria.example.com/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | jq -r '.checkoutReference')

OVERFLOW_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://curria.example.com/api/webhook/asaas" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_overflow\",
      \"externalReference\": \"curria:v1:u:test_user_001:c:$CHECKOUT_REF\",
      \"value\": 200000
    }
  }")

echo "Response: $OVERFLOW_RESPONSE"
# Expected: HTTP 400/402, error message mentions "exceeds max balance"
```

**Step 2: Verify No Side Effects**

```bash
psql "$DATABASE_URL" -c "SELECT credits_remaining FROM credit_accounts WHERE user_id = 'test_user_001';"
# Expected: 999900 (unchanged)

psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM processed_events WHERE event_id = 'pay_overflow';"
# Expected: 0 (RPC rejected, not persisted)
```

**Status:** ✅ SCENARIO 6 PASS

---

### Scenario 7: Zero-Credit Enforcement

**Setup:**
```bash
psql "$DATABASE_URL" -c "UPDATE credit_accounts SET credits_remaining = 0 WHERE user_id = 'test_user_001';"
```

**Step 1: Attempt Protected Action (Create Agent Session)**

```bash
curl -s -X POST "https://curria.example.com/api/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "improve my resume",
    "sessionId": null
  }'
```

**Expected Response:**
- HTTP 402 (Payment Required) or similar
- Error message: "Insufficient credits"
- No session created
- No credit consumed

**Status:** ✅ SCENARIO 7 PASS

---

## PART 4 — Data Inspection Queries

### Query 1: Credit Account Status

```bash
psql "$DATABASE_URL" -c "
  SELECT
    ca.user_id,
    ca.credits_remaining,
    ca.updated_at,
    u.email
  FROM credit_accounts ca
  JOIN users u ON u.id = ca.user_id
  WHERE ca.user_id LIKE 'test_%'
  ORDER BY ca.updated_at DESC;"
```

**What to look for:**
- credits_remaining matches expected value
- timestamps are recent (within last few minutes)

---

### Query 2: Processed Events (Webhook History)

```bash
psql "$DATABASE_URL" -c "
  SELECT
    event_id,
    event_type,
    event_fingerprint,
    created_at,
    error_message
  FROM processed_events
  WHERE event_fingerprint LIKE 'test_%'
     OR event_fingerprint LIKE 'curria:v1:u:test_%'
  ORDER BY created_at DESC
  LIMIT 20;"
```

**What to look for:**
- event_type matches (PAYMENT_RECEIVED, SUBSCRIPTION_CREATED, etc.)
- event_fingerprint is unique (no duplicates for same event)
- error_message is null (success) or contains error description
- created_at is recent

---

### Query 3: Billing Checkouts

```bash
psql "$DATABASE_URL" -c "
  SELECT
    id,
    checkoutReference,
    status,
    amount_minor,
    plan,
    asaas_payment_id,
    asaas_subscription_id,
    created_at,
    updated_at
  FROM billing_checkouts
  WHERE user_id LIKE 'test_%'
  ORDER BY created_at DESC
  LIMIT 10;"
```

**What to look for:**
- status progression: created → paid (or subscription_active)
- amount_minor matches plan (unit=300, monthly=2900, etc.)
- asaas_payment_id populated after webhook
- asaas_subscription_id set for subscriptions

---

### Query 4: User Quotas (Subscription Metadata)

```bash
psql "$DATABASE_URL" -c "
  SELECT
    user_id,
    plan,
    asaas_subscription_id,
    asaas_customer_id,
    credits_remaining,
    updated_at
  FROM user_quotas
  WHERE user_id LIKE 'test_%'
  ORDER BY updated_at DESC;"
```

**What to look for:**
- plan matches subscription type (monthly, annual, etc.)
- asaas_subscription_id set correctly
- credits_remaining is accurate

---

### Query 5: Duplicate Detection

```bash
psql "$DATABASE_URL" -c "
  SELECT
    event_fingerprint,
    COUNT(*) as count,
    array_agg(event_id) as event_ids
  FROM processed_events
  WHERE event_fingerprint LIKE 'curria:v1:u:test_%'
  GROUP BY event_fingerprint
  HAVING COUNT(*) > 1;"
```

**Expected:**
- Zero rows (no duplicates)
- If any rows: idempotency is broken (CRITICAL BUG)

---

## PART 5 — Production Safety Rules

**MANDATORY: Never violate these rules**

### Rule 1: Credits Only via Webhook
```
❌ NEVER: UPDATE credit_accounts SET credits_remaining = X;
✅ OK: Credits increased only by POST /api/webhook/asaas
```

### Rule 2: Never Trust Frontend for Billing
```
❌ NEVER: Use client-side amount for credit grant
✅ OK: Derive amount server-side from getPlan(plan)
```

### Rule 3: Always Verify Processed Events
```
❌ NEVER: Grant credits without checking processed_events
✅ OK: Check fingerprint for duplicate before RPC
```

### Rule 4: Never Swallow Webhook Errors
```
❌ NEVER: Return HTTP 200 for failed RPC
✅ OK: Return HTTP 400/500 with error message
```

### Rule 5: Webhook Token Must Be Verified
```
❌ NEVER: Accept webhooks without token validation
✅ OK: Validate asaas-access-token header matches ASAAS_WEBHOOK_TOKEN
```

### Rule 6: Sandbox Only for Testing
```
❌ NEVER: Use production Asaas keys for testing
✅ OK: Use pk_test_ and sandbox.asaas.com
```

---

## PART 6 — Failure Simulation

### Simulate Webhook Failure (Server Down)

```bash
# Stop the server (gracefully, without data loss)
# Then have Asaas retry the webhook

# When server comes back up:
# 1. Webhook is re-delivered by Asaas
# 2. System recognizes fingerprint as duplicate
# 3. Credits are NOT double-granted
# 4. Processed_events shows original + retry timestamps
```

### Simulate Partial Failure (RPC Succeeds, Marking Fails)

```bash
# This is expected and handled:
# 1. RPC succeeds (credits granted, processed_events created)
# 2. Checkout status marking fails (network error)
# 3. System is still in valid state
# 4. Credits were successfully granted
# 5. Ops can manually reconcile checkout status if needed
```

---

## PART 7 — Full Validation Checklist

### Pre-Validation
- [ ] .env configured with production database
- [ ] .env uses Asaas SANDBOX (pk_test_, sandbox.asaas.com)
- [ ] All migrations applied
- [ ] All RPC functions exist
- [ ] App is deployed to production
- [ ] App can reach production database
- [ ] Webhook endpoint is reachable

### Scenario 1: One-Time Payment
- [ ] Checkout created
- [ ] Credits: 5 → 8
- [ ] Webhook processed
- [ ] Idempotency: replay → no double-grant

### Scenario 2: Subscription Creation
- [ ] Credits: 5 → 29
- [ ] user_quotas.asaas_subscription_id set
- [ ] user_quotas.plan = 'monthly'

### Scenario 3: Subscription Renewal
- [ ] Credits: 25 → 45 (additive)
- [ ] Resolves by subscription_id (not checkout lookup)
- [ ] Idempotency: replay → no double-grant

### Scenario 4: Subscription Cancellation
- [ ] Credits unchanged (metadata-only)
- [ ] **CRITICAL: If credits decreased, STOP**

### Scenario 5: Webhook Failure & Retry
- [ ] Invalid request: HTTP 400
- [ ] Retry with corrected reference: HTTP 200
- [ ] Credits increased on retry

### Scenario 6: Overflow Prevention
- [ ] Overflow rejected (HTTP 400)
- [ ] Credits unchanged (999900)
- [ ] No processed_event created

### Scenario 7: Zero-Credit Enforcement
- [ ] Protected action blocked
- [ ] HTTP 402 or similar
- [ ] No session created

### Idempotency Verification
- [ ] Duplicate detection fingerprint is unique
- [ ] Replay same webhook → no new row
- [ ] Replay same webhook → no double-grant

### Data Inspection
- [ ] No duplicate fingerprints in processed_events
- [ ] All test data uses `test_` prefix
- [ ] Credits match expected values

### Safety Rules
- [ ] All credits granted via webhook only
- [ ] No client-side amount used
- [ ] All errors propagated correctly
- [ ] Webhook token validated

---

## PART 8 — Cleanup After Validation

```bash
# Remove all test data
psql "$DATABASE_URL" <<'SQL'
DELETE FROM billing_checkouts WHERE user_id LIKE 'test_%';
DELETE FROM processed_events WHERE event_fingerprint LIKE 'test_%' OR event_fingerprint LIKE 'curria:v1:u:test_%';
DELETE FROM user_quotas WHERE user_id LIKE 'test_%';
DELETE FROM credit_accounts WHERE user_id LIKE 'test_%';
DELETE FROM users WHERE id LIKE 'test_%';

SELECT 'Test data cleanup complete' as status;
SQL

# Verify cleanup
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users WHERE id LIKE 'test_%';"
# Expected: 0
```

---

## Final Go/No-Go Decision

### ✅ PROCEED TO LAUNCH if:
- ✅ All 7 scenarios PASS
- ✅ Idempotency verified (no duplicates)
- ✅ Overflow enforced
- ✅ Cancellation metadata-only
- ✅ Zero-credit enforcement works
- ✅ All safety rules verified
- ✅ Ops team trained on debugging playbook

### ❌ STOP if:
- ❌ Any scenario FAILS
- ❌ Double-grant occurs (idempotency broken)
- ❌ Overflow not enforced
- ❌ Cancellation revokes credits
- ❌ Environment not sandbox (production keys detected)

---

## Timeline

- Environment setup: **5 min** (verify .env)
- Scenarios 1-7: **30-45 min** (with SQL verifications)
- Cleanup: **2 min**
- **Total: 40-50 minutes**

---

## Post-Launch

After validation passes and launch is approved:

1. **Enable production monitoring** (from `docs/billing-monitoring.md`)
2. **Train ops team** on debugging playbook (PART 4 queries)
3. **Deploy to production** (code already validated)
4. **Monitor first 24 hours** for any webhook issues
5. **Keep PART 4 queries handy** for ops support
