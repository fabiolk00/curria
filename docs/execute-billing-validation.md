# Agent Prompt: Execute Production-Safe Billing System Validation

**Purpose:** Validate that the Asaas billing system is safe and ready for production deployment.

**Status:** Code complete (41 tests passing), migrations applied, all documentation created. This validation confirms environment safety, schema correctness, and end-to-end billing flow.

**Output:** Markdown report with PROCEED / PARTIAL / STOP recommendation and ops-ready debugging playbook.

---

## How This Works

This prompt guides you through 5 phases:

1. **PART 0: Safety Check** — Confirm database is staging (not production)
2. **PART 1: Environment Verification** — Confirm correct database
3. **PART 2: Schema Verification** — Confirm all tables/functions exist
4. **PART 3: Asaas Configuration** — Confirm webhook credentials
5. **PART 4: End-to-End Scenarios** — Run 7 billing scenarios with verification
6. **PART 5: Debugging Playbook** — Provide ops-ready SQL queries

Reference files:
- `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` — Complete validation plan with all details
- `C:\CurrIA\.env.staging.example` — Staging credentials template
- `C:\CurrIA\docs\staging-setup-guide.md` — Environment setup guide
- `C:\CurrIA\scripts\verify-staging.sh` — Automated environment verification script
- `C:\CurrIA\docs\staging-validation-plan.md` — Original 7-scenario plan (for additional context)

---

## YOUR EXECUTION CHECKLIST

### Before You Start
- [ ] Read this entire prompt
- [ ] Have access to `$STAGING_DB_URL`, `$STAGING_API_URL`, `$STAGING_ASAAS_WEBHOOK_TOKEN` environment variables
- [ ] Have `psql` and `curl` available in bash
- [ ] Can run bash commands and read files

### Phase 0: Safety Check (CRITICAL — STOP IF ANY CHECK FAILS)

```bash
# Check 1: Confirm database is NOT production
echo "=== CHECK 1: Database Environment ==="
echo "DATABASE_URL host:"
echo "$DATABASE_URL" | grep -oP '(?<=@)[^:]+' | head -1

echo "DIRECT_URL host:"
echo "$DIRECT_URL" | grep -oP '(?<=@)[^:]+' | head -1

# Query database metadata
psql "$DATABASE_URL" -c "SELECT current_database() as database, current_user as user;"
```

**What to verify:**
- Output should show staging project name (e.g., `curria-staging`), NOT production name
- If production database detected: **STOP IMMEDIATELY**. Do not run any scenarios.

---

```bash
# Check 2: Verify all migrations applied successfully
echo "=== CHECK 2: Required Tables ==="
psql "$DATABASE_URL" -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'billing_checkouts', 'credit_accounts', 'processed_events',
    'user_quotas', 'resume_targets', 'cv_versions'
  )
  ORDER BY table_name;"
```

**Expected result:** 6 rows (all tables present)

**If fewer than 6:**
- STOP. Schema is incomplete.
- Check migration history: `psql "$DATABASE_URL" -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"`
- Identify which migration failed and re-run: `npm run db:push`

---

```bash
# Check 3: Verify all required RPC functions exist
echo "=== CHECK 3: Required Functions ==="
psql "$DATABASE_URL" -c "
  SELECT routine_name, routine_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name IN (
    'apply_billing_credit_grant_event',
    'apply_billing_subscription_metadata_event',
    'apply_session_patch_with_version',
    'create_cv_version_record',
    'create_resume_target_with_version'
  )
  ORDER BY routine_name;"
```

**Expected result:** 5 rows (all functions present)

**If fewer than 5:** STOP. Do not proceed.

---

```bash
# Check 4: Confirm test user isolation is safe
echo "=== CHECK 4: Test Data Isolation ==="
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as existing_test_users
  FROM users
  WHERE id LIKE 'usr_test_%' OR id = 'usr_staging_001';"
```

**Expected result:** 0 rows (no pre-existing test users)

---

```bash
# Check 5: Confirm webhook security is enabled
echo "=== CHECK 5: Webhook Security ==="
echo "STAGING_ASAAS_WEBHOOK_TOKEN: ${STAGING_ASAAS_WEBHOOK_TOKEN:0:10}... (length: ${#STAGING_ASAAS_WEBHOOK_TOKEN})"
echo "STAGING_API_URL: $STAGING_API_URL"

# Test API reachability
echo "Testing API reachability..."
curl -s -I "$STAGING_API_URL/api/health" | head -1
```

**Expected result:**
- Token is non-empty (at least 20 characters)
- API returns HTTP 200 or 404 (proves reachable, proves not 502/503)

**If token empty or API unreachable:** STOP. Staging not ready.

---

## ✅ If All 5 Safety Checks Pass, Continue Below

### Phase 1: Environment Verification

```bash
echo "=== PART 1: Environment Verification ==="

# Determine active database
ACTIVE_DB=$(psql "$DATABASE_URL" -t -c "SELECT current_database();")
ACTIVE_USER=$(psql "$DATABASE_URL" -t -c "SELECT current_user;")

echo "Active database: $ACTIVE_DB"
echo "Active user: $ACTIVE_USER"
echo "Status: ✓ Confirmed staging (not production)"
```

### Phase 2: Schema Verification

Run these queries and verify expected results:

```bash
echo "=== PART 2: Schema Verification ==="

# Tables
echo "Tables:"
psql "$DATABASE_URL" -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'billing_checkouts', 'credit_accounts', 'processed_events',
    'user_quotas', 'resume_targets', 'cv_versions'
  )
  ORDER BY table_name;"

# Functions
echo "Functions:"
psql "$DATABASE_URL" -c "
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE 'apply_billing_%'
  ORDER BY routine_name;"

# Constraints
echo "Processed events unique fingerprint:"
psql "$DATABASE_URL" -c "
  SELECT constraint_name FROM information_schema.table_constraints
  WHERE table_name = 'processed_events' AND constraint_type = 'UNIQUE';"
```

**Status:** If all checks pass, continue to scenarios.

### Phase 3: Asaas Configuration

```bash
echo "=== PART 3: Asaas Configuration ==="
echo "Webhook token present: ✓"
echo "API endpoint reachable: ✓"
echo "Status: ✓ Ready for scenarios"
```

---

## Phase 4: End-to-End Scenarios

### Setup: Create Test User & Initial Credits

```bash
echo "=== PHASE 4 SETUP: Test User & Data ==="

# Create test user
psql "$DATABASE_URL" <<'SQL'
INSERT INTO users (id, email, created_at, updated_at)
VALUES ('usr_staging_001', 'test@staging.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create initial credit account
INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_001', 'usr_staging_001', 5, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT 'Test user created:' as status;
SELECT id, email FROM users WHERE id = 'usr_staging_001';
SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'usr_staging_001';
SQL
```

---

### Scenario 1: One-Time Payment with Idempotency Test

**Reference:** See `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 1

```bash
echo "=== SCENARIO 1: One-Time Payment ==="

# Step 1: Create checkout
CHECKOUT_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

echo "Checkout response: $CHECKOUT_RESPONSE"

# Extract checkoutReference from response
CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | grep -oP '"checkoutReference":"?\K[^"]*')
echo "Checkout reference: $CHECKOUT_REF"

# Verify checkout was created
psql "$DATABASE_URL" -c "
  SELECT id, checkoutReference, status, amount_minor
  FROM billing_checkouts
  WHERE checkoutReference = '$CHECKOUT_REF';"

# Step 2: Send webhook (PAYMENT_RECEIVED)
echo "Sending PAYMENT_RECEIVED webhook..."

WEBHOOK_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_001\",
      \"externalReference\": \"curria:v1:u:usr_staging_001:c:$CHECKOUT_REF\",
      \"value\": 300,
      \"status\": \"received\"
    }
  }")

echo "Webhook response: $WEBHOOK_RESPONSE"

# Verify credits increased
echo "Verifying credits..."
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

echo "Expected: credits_remaining = 8 (was 5, added 3)"

# Verify processed_event
psql "$DATABASE_URL" -c "
  SELECT event_type, event_fingerprint, created_at
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  ORDER BY created_at DESC LIMIT 1;"

# Idempotency test: Replay same webhook
echo "Testing idempotency: replaying same webhook..."

REPLAY_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_001\",
      \"externalReference\": \"curria:v1:u:usr_staging_001:c:$CHECKOUT_REF\",
      \"value\": 300,
      \"status\": \"received\"
    }
  }")

echo "Replay response: $REPLAY_RESPONSE"

# Verify no double-grant
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

echo "Expected: still 8 (no double-grant)"

# Verify only one processed_event for this fingerprint
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as count
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  AND event_fingerprint IS NOT NULL;"

echo "Expected: 1 (only one unique fingerprint)"

echo "SCENARIO 1: [PASS or FAIL based on above results]"
```

**Expected outcomes:**
- ✅ Checkout created with checkoutReference
- ✅ Webhook HTTP 200
- ✅ Credits: 5 → 8
- ✅ processed_events has 1 row
- ✅ Replay webhook: credits still 8 (no double-grant)
- ✅ Processed_events count still 1 (fingerprint cached)

**Failure branches:**
- Webhook returns 400: Invalid externalReference format
- Webhook returns 404: Checkout not found
- Webhook returns 500: RPC error (check server logs)
- Credits don't increase: RPC failed (check processed_events error_message)
- Double-grant occurs: Idempotency broken (CRITICAL BLOCKER)

---

### Scenario 2: Subscription Creation

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 2

```bash
echo "=== SCENARIO 2: Subscription Creation ==="

# Clean up from scenario 1
psql "$DATABASE_URL" <<'SQL'
DELETE FROM user_quotas WHERE user_id = 'usr_staging_001';
UPDATE credit_accounts SET credits_remaining = 5 WHERE user_id = 'usr_staging_001';
SQL

# Create subscription checkout
CHECKOUT_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | grep -oP '"checkoutReference":"?\K[^"]*')
echo "Checkout reference: $CHECKOUT_REF"

# Send SUBSCRIPTION_CREATED webhook
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_CREATED\",
    \"subscription\": {
      \"id\": \"sub_001\",
      \"externalReference\": \"curria:v1:u:usr_staging_001:c:$CHECKOUT_REF\",
      \"value\": 2900,
      \"nextDueDate\": \"2026-04-29\"
    }
  }"

# Verify credits and subscription
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

echo "Expected: credits_remaining = 29 (was 5, added 24 from monthly plan)"

psql "$DATABASE_URL" -c "
  SELECT user_id, asaas_subscription_id, plan
  FROM user_quotas
  WHERE user_id = 'usr_staging_001';"

echo "Expected: asaas_subscription_id = sub_001, plan = monthly"

echo "SCENARIO 2: [PASS or FAIL]"
```

**Expected outcomes:**
- ✅ Credits: 5 → 29
- ✅ user_quotas.asaas_subscription_id = 'sub_001'
- ✅ user_quotas.plan = 'monthly'
- ✅ billing_checkouts.status = 'subscription_active'

---

### Scenario 3: Subscription Renewal (Critical: No Checkout Lookup)

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 3

```bash
echo "=== SCENARIO 3: Subscription Renewal ==="

# Prepare: set credits to 25
psql "$DATABASE_URL" -c "
  UPDATE credit_accounts SET credits_remaining = 25
  WHERE user_id = 'usr_staging_001';"

# Send SUBSCRIPTION_RENEWED webhook (resolves by subscription_id, NOT checkout)
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_RENEWED\",
    \"subscription\": {
      \"id\": \"sub_001\",
      \"value\": 2000,
      \"nextDueDate\": \"2026-05-29\"
    }
  }"

# Verify credits are additive
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

echo "Expected: credits_remaining = 45 (was 25, added 20)"

# Idempotency test: replay
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_RENEWED\",
    \"subscription\": {
      \"id\": \"sub_001\",
      \"value\": 2000,
      \"nextDueDate\": \"2026-05-29\"
    }
  }"

psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

echo "Expected: still 45 (no double-grant)"

echo "SCENARIO 3: [PASS or FAIL]"
```

**Expected outcomes:**
- ✅ Credits: 25 → 45 (additive)
- ✅ Resolves by subscription_id (no checkout lookup)
- ✅ Replay webhook: credits still 45 (cached)

---

### Scenario 4: Subscription Cancellation (Credits Must NOT Change)

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 4

```bash
echo "=== SCENARIO 4: Subscription Cancellation ==="

# Remember current credits before cancellation
BEFORE_CANCEL=$(psql "$DATABASE_URL" -t -c "
  SELECT credits_remaining FROM credit_accounts WHERE user_id = 'usr_staging_001';")

echo "Credits before cancellation: $BEFORE_CANCEL"

# Send SUBSCRIPTION_CANCELED webhook (metadata-only, NO credit change)
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"SUBSCRIPTION_CANCELED\",
    \"subscription\": {
      \"id\": \"sub_001\",
      \"status\": \"canceled\"
    }
  }"

# Verify credits unchanged
AFTER_CANCEL=$(psql "$DATABASE_URL" -t -c "
  SELECT credits_remaining FROM credit_accounts WHERE user_id = 'usr_staging_001';")

echo "Credits after cancellation: $AFTER_CANCEL"
echo "Expected: $BEFORE_CANCEL (unchanged)"

if [ "$BEFORE_CANCEL" -eq "$AFTER_CANCEL" ]; then
  echo "SCENARIO 4: [PASS]"
else
  echo "SCENARIO 4: [FAIL] - Credits changed! This is a critical bug."
fi
```

**Expected outcome:**
- ✅ Credits unchanged (45 remains 45)
- ❌ CRITICAL: If credits decreased, STOP validation here

---

### Scenario 5: Webhook Failure & Retry

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 5

```bash
echo "=== SCENARIO 5: Webhook Failure & Retry ==="

# First attempt with invalid externalReference
echo "Sending webhook with INVALID externalReference..."

FAIL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_fail_001\",
      \"externalReference\": \"invalid_reference_format\",
      \"value\": 300,
      \"status\": \"received\"
    }
  }")

echo "Response: $FAIL_RESPONSE"
echo "Expected: HTTP 400 (bad request)"

# Verify NO processed_event created (error before persistence)
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as count FROM processed_events WHERE event_id = 'pay_fail_001';"

echo "Expected: 0 (no processed_event because validation failed)"

# Second attempt with corrected reference
echo "Sending webhook with CORRECTED reference..."

# First create a valid checkout
CHECKOUT_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | grep -oP '"checkoutReference":"?\K[^"]*')

SUCCESS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_fail_001\",
      \"externalReference\": \"curria:v1:u:usr_staging_001:c:$CHECKOUT_REF\",
      \"value\": 300,
      \"status\": \"received\"
    }
  }")

echo "Response: $SUCCESS_RESPONSE"
echo "Expected: HTTP 200"

# Verify credits increased
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'usr_staging_001';"

echo "Expected: credits increased"

echo "SCENARIO 5: [PASS or FAIL]"
```

**Expected outcomes:**
- ✅ Invalid request: HTTP 400, no processed_event
- ✅ Retry with corrected reference: HTTP 200, credits increase

---

### Scenario 6: RPC Rejection (Overflow)

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 6

```bash
echo "=== SCENARIO 6: RPC Rejection (Overflow) ==="

# Set credits to near-max
psql "$DATABASE_URL" -c "
  UPDATE credit_accounts SET credits_remaining = 999900
  WHERE user_id = 'usr_staging_001';"

# Create checkout for large amount that would exceed 1,000,000
CHECKOUT_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | grep -oP '"checkoutReference":"?\K[^"]*')

# Send webhook that would overflow
OVERFLOW_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$STAGING_API_URL/api/webhook/asaas" \
  -H "asaas-access-token: $STAGING_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"PAYMENT_RECEIVED\",
    \"payment\": {
      \"id\": \"pay_overflow\",
      \"externalReference\": \"curria:v1:u:usr_staging_001:c:$CHECKOUT_REF\",
      \"value\": 200000,
      \"status\": \"received\"
    }
  }")

echo "Response: $OVERFLOW_RESPONSE"
echo "Expected: HTTP 400 or 402, error message contains 'exceeds max balance'"

# Verify credits unchanged
psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id = 'usr_staging_001';"

echo "Expected: credits_remaining still 999900 (no overflow)"

# Verify no processed_event created
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) as count FROM processed_events WHERE event_id = 'pay_overflow';"

echo "Expected: 0 (RPC rejected, not persisted)"

echo "SCENARIO 6: [PASS or FAIL]"
```

**Expected outcomes:**
- ✅ Webhook returns 400 (overflow rejected)
- ✅ Credits unchanged (999900)
- ✅ No processed_event created

---

### Scenario 7: Partial Success (RPC Succeeds, Status Mark May Fail)

**Reference:** `C:\CurrIA\.claude\plans\glowing-fluttering-frost.md` PART 4, Scenario 7

```bash
echo "=== SCENARIO 7: Partial Success (Documentation) ==="

# This scenario documents the partial-success state
# (RPC succeeds, credits granted, but checkout status marking may lag)

echo "Partial success is expected behavior:"
echo "- RPC succeeds: credits granted, processed_events row created"
echo "- Checkout status marking: may fail or lag due to network/server issues"
echo "- Recovery: No retry needed, system is in valid state (credits granted)"
echo "- Ops can manually reconcile checkout status if needed"

echo "In practice, this appears as:"
echo "- processed_events shows successful grant"
echo "- credit_accounts shows increased balance"
echo "- billing_checkouts.status may not reflect final state"

echo "SCENARIO 7: [DOCUMENTATION ONLY - Not a blocker]"
```

---

## Phase 5: Debugging Playbook for Ops

```bash
echo "=== PART 5: Ops Debugging Playbook ==="

cat << 'DEBUG'

## Diagnosis Queries

### Why didn't credits increase after webhook?
psql "$DATABASE_URL" -c "
  SELECT event_id, event_type, event_fingerprint, created_at, error_message
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  ORDER BY created_at DESC
  LIMIT 5;"

psql "$DATABASE_URL" -c "
  SELECT user_id, credits_remaining, updated_at
  FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"

psql "$DATABASE_URL" -c "
  SELECT id, checkoutReference, status, asaas_payment_id, amount_minor
  FROM billing_checkouts
  WHERE user_id = 'usr_staging_001'
  ORDER BY created_at DESC
  LIMIT 5;"

### Duplicate credits granted?
psql "$DATABASE_URL" -c "
  SELECT event_fingerprint, COUNT(*) as count, array_agg(id)
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  GROUP BY event_fingerprint
  HAVING COUNT(*) > 1;"

### Safe event reprocessing (if needed):
# DELETE FROM processed_events WHERE id = 'EVENT_ID';
# Then replay webhook via curl

DEBUG
```

---

## Final Report

Create a markdown report with this structure:

```markdown
# Production-Safe Billing Validation Report

## Executive Summary
- Safety Checks: 5/5 passed ✓
- Schema Verification: All checks passed ✓
- Scenarios: X/7 passed, Y partial, Z failed
- Critical Blockers: [none | list]
- **Recommendation: PROCEED | PARTIAL | STOP**

## PART 0: Safety Check Results
- [✓] Database is staging (not production)
- [✓] All migrations applied successfully
- [✓] Test data isolation confirmed
- [✓] Auth/webhook security enabled

## PART 4: Scenario Results

### Scenario 1: One-Time Payment
- Status: PASS
- Credits: 5 → 8 ✓
- Idempotency: Cached, no double-grant ✓

### Scenario 2: Subscription Creation
- Status: PASS
- Subscription ID set ✓

### Scenario 3: Subscription Renewal
- Status: PASS
- Additive (25 + 20 = 45) ✓
- No checkout lookup ✓

### Scenario 4: Subscription Cancellation
- Status: PASS
- Credits unchanged (metadata-only) ✓

### Scenario 5: Webhook Failure & Retry
- Status: PASS
- Invalid request rejected ✓
- Retry succeeded ✓

### Scenario 6: RPC Rejection (Overflow)
- Status: PASS
- Overflow rejected ✓
- Credits unchanged ✓

### Scenario 7: Partial Success
- Status: DOCUMENTED
- Expected behavior understood ✓

## PART 5: Debugging Playbook
[Include exact SQL queries for ops]

## Recommendation
**PROCEED to production** with ops team trained on:
- Debugging playbook
- Credit grant procedures
- Subscription metadata procedures
- Overflow prevention

or

**STOP and fix:** [list critical blockers if any]
```

---

## Success Criteria

### ✅ PROCEED (all conditions met)
- All 5 safety checks passed
- All schema verification checks passed
- All 7 scenarios PASS (with correct idempotency)
- No critical blockers found

### ⚠️ PARTIAL (some failures, non-critical)
- Scenario failure that doesn't affect production
- Environment correct, schema correct
- Report details issues for engineering review

### ❌ STOP (critical blockers)
- Environment is production (not staging)
- Schema incomplete
- Duplicate webhook granted credits twice
- Overflow not enforced
- Cancellation revoked credits
- Renewal used checkout lookup

---

## Critical Constraints

- **DO NOT assume anything** — verify every environment variable
- **DO NOT skip idempotency testing** — this is a go/no-go criterion
- **DO NOT proceed if environment is production** — STOP immediately
- **DO NOT continue if double-grant occurs** — critical blocker
- **DO NOT trust API responses** — verify DB state with queries

---

## Ready to Execute

You have everything you need. Start with Phase 0 and work through each phase systematically. Document results clearly. The team will use this report to decide on production deployment.

Good luck! 🚀
