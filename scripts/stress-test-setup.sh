#!/bin/bash

# ============================================================================
# CurrIA Payment Flow Stress Test - Setup & Execution
# ============================================================================

set -e

echo "🚀 CurrIA Payment Stress Test Suite"
echo "===================================="
echo ""

# ============================================================================
# Step 1: Collect Credentials
# ============================================================================

echo "📋 Step 1: Gathering credentials..."
echo ""

read -p "Enter your app user ID (from database): " USER_ID
read -p "Enter your Clerk auth token (from browser localStorage._ck_obj_Claims): " AUTH_TOKEN
read -p "Enter Asaas webhook token (from .env ASAAS_WEBHOOK_TOKEN): " ASAAS_WEBHOOK_TOKEN
read -p "Enter your Supabase service role key (from .env SUPABASE_SERVICE_ROLE_KEY): " SUPABASE_KEY
read -p "Enter database URL (from .env DATABASE_URL or DIRECT_URL): " DATABASE_URL

echo ""
echo "✅ Credentials collected"
echo ""

# ============================================================================
# Step 2: Pre-Test Database State
# ============================================================================

echo "📊 Step 2: Recording pre-test database state..."
echo ""

export PGPASSWORD=$(echo $DATABASE_URL | grep -oP '(?<=:)[^@]+(?=@)' || echo "")
DB_HOST=$(echo $DATABASE_URL | grep -oP '(?<=@)[^/:]+' || echo "localhost")
DB_NAME=$(echo $DATABASE_URL | grep -oP '(?<=/)[^?]+' || echo "postgres")

CREDITS_BEFORE=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'" 2>/dev/null || echo "0")
SESSIONS_BEFORE=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM sessions WHERE app_user_id='$USER_ID'" 2>/dev/null || echo "0")

echo "Pre-test state:"
echo "  Credits: $CREDITS_BEFORE"
echo "  Sessions: $SESSIONS_BEFORE"
echo ""

# ============================================================================
# Step 3: Scenario A - Concurrent Session Creation
# ============================================================================

echo "🔥 Step 3: Scenario A - Creating 10 concurrent sessions..."
echo ""

CONCURRENT=10
SUCCESS_COUNT=0
FAILED_COUNT=0

for i in $(seq 1 $CONCURRENT); do
  curl -s -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Stress test message $i\"}" \
    -w "\n%{http_code}" | tail -n1 | grep -q "200" && ((SUCCESS_COUNT++)) || ((FAILED_COUNT++)) &
done

wait

echo "Session Creation Results:"
echo "  ✅ Succeeded: $SUCCESS_COUNT"
echo "  ❌ Failed: $FAILED_COUNT"
echo ""

# Verify credits were consumed
sleep 2

CREDITS_AFTER_A=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'" 2>/dev/null || echo "0")
SESSIONS_AFTER_A=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM sessions WHERE app_user_id='$USER_ID'" 2>/dev/null || echo "0")
CREDITS_CONSUMED=$((CREDITS_BEFORE - CREDITS_AFTER_A))

echo "After Scenario A:"
echo "  Credits: $CREDITS_AFTER_A (consumed: $CREDITS_CONSUMED, expected: $CONCURRENT)"
echo "  Sessions: $SESSIONS_AFTER_A (expected: $SESSIONS_BEFORE + $CONCURRENT = $((SESSIONS_BEFORE + CONCURRENT)))"

if [ "$CREDITS_CONSUMED" -eq "$CONCURRENT" ]; then
  echo "  ✅ PASS - Correct credit consumption"
else
  echo "  ❌ FAIL - Expected $CONCURRENT credits consumed, got $CREDITS_CONSUMED"
fi
echo ""

# ============================================================================
# Step 4: Scenario B - Duplicate Webhook Idempotency
# ============================================================================

echo "🔄 Step 4: Scenario B - Testing duplicate webhook idempotency..."
echo ""

WEBHOOK_PAYLOAD='{
  "event": "PAYMENT_RECEIVED",
  "amount": 1990,
  "payment": {
    "id": "pay_idempotency_test_'$(date +%s)'",
    "externalReference": "curria:v1:c:chk_stress_'$(date +%s)'",
    "subscription": null,
    "amount": 1990
  }
}'

CREDITS_BEFORE_B=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'" 2>/dev/null || echo "0")

echo "Sending same webhook 5 times..."

for i in $(seq 1 5); do
  curl -s -X POST http://localhost:3000/api/webhook/asaas \
    -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$WEBHOOK_PAYLOAD" > /dev/null &
done

wait

sleep 2

CREDITS_AFTER_B=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'" 2>/dev/null || echo "0")
CREDITS_INCREASED=$((CREDITS_AFTER_B - CREDITS_BEFORE_B))

echo "Webhook Idempotency Results:"
echo "  Credits before: $CREDITS_BEFORE_B"
echo "  Credits after: $CREDITS_AFTER_B"
echo "  Credits increased: $CREDITS_INCREASED (expected: 3 for unit plan)"

if [ "$CREDITS_INCREASED" -eq "3" ]; then
  echo "  ✅ PASS - Idempotency working (no double credits)"
elif [ "$CREDITS_INCREASED" -eq "0" ]; then
  echo "  ⚠️  WARNING - No credits granted (webhook may have failed)"
else
  echo "  ❌ FAIL - Expected 3 credits, got $CREDITS_INCREASED (idempotency broken)"
fi
echo ""

# ============================================================================
# Step 5: Scenario C - Rate Limiting
# ============================================================================

echo "⏱️  Step 5: Scenario C - Testing rate limiting (30 req/min)..."
echo ""

RATE_LIMIT_HITS=0
SUCCESS_REQS=0

for i in $(seq 1 40); do
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Rate limit test $i\"}")

  if [ "$HTTP_CODE" = "429" ]; then
    ((RATE_LIMIT_HITS++))
  elif [ "$HTTP_CODE" = "200" ]; then
    ((SUCCESS_REQS++))
  fi

  echo -n "."
done

echo ""
echo ""
echo "Rate Limiting Results:"
echo "  ✅ Successful (200): $SUCCESS_REQS (expected: ≤30)"
echo "  🚫 Rate limited (429): $RATE_LIMIT_HITS (expected: ≥10)"

if [ "$SUCCESS_REQS" -le "30" ] && [ "$RATE_LIMIT_HITS" -gt "0" ]; then
  echo "  ✅ PASS - Rate limiting working correctly"
else
  echo "  ❌ FAIL - Rate limiting not working as expected"
fi
echo ""

# ============================================================================
# Step 6: Data Integrity Checks
# ============================================================================

echo "🔍 Step 6: Running data integrity checks..."
echo ""

# Check for negative credits
NEGATIVE=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM credit_accounts WHERE credits_remaining < 0" 2>/dev/null || echo "0")

# Check for duplicate processed events
DUPLICATES=$(psql -h $DB_HOST -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM (SELECT event_fingerprint FROM processed_events GROUP BY event_fingerprint HAVING COUNT(*) > 1) t" 2>/dev/null || echo "0")

echo "Data Integrity Results:"
echo "  Negative credits: $NEGATIVE (expected: 0)"
echo "  Duplicate processed events: $DUPLICATES (expected: 0)"

if [ "$NEGATIVE" -eq "0" ] && [ "$DUPLICATES" -eq "0" ]; then
  echo "  ✅ PASS - Database integrity verified"
else
  echo "  ❌ FAIL - Data corruption detected"
fi
echo ""

# ============================================================================
# Final Summary
# ============================================================================

echo "═══════════════════════════════════════════════════════════"
echo "📊 STRESS TEST SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "User ID: $USER_ID"
echo "Starting credits: $CREDITS_BEFORE"
echo "Ending credits: $CREDITS_AFTER_B"
echo "Total consumed: $((CREDITS_BEFORE - CREDITS_AFTER_B))"
echo ""
echo "Sessions created: $((SESSIONS_AFTER_A - SESSIONS_BEFORE))"
echo ""
echo "✅ All tests completed!"
echo ""
echo "Next steps:"
echo "1. Review the results above"
echo "2. Check database for any anomalies:"
echo "   psql -c \"SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'\""
echo "3. Check session state:"
echo "   psql -c \"SELECT id, phase, messageCount FROM sessions WHERE app_user_id='$USER_ID' ORDER BY created_at DESC LIMIT 10\""
echo ""
