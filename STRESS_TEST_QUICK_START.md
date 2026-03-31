# 🚀 Payment Stress Test - Quick Start Guide

## Pre-Test Checklist

- [ ] App is running: `npm run dev`
- [ ] You're logged in and have credits in the system
- [ ] You have access to Postgres (psql installed)
- [ ] You have these values from .env:
  - `ASAAS_WEBHOOK_TOKEN`
  - `DATABASE_URL` or `DIRECT_URL`

## Step 1: Get Your Credentials

### A. User ID (from database)
```bash
# Open psql and find your user ID:
psql $DATABASE_URL

SELECT id FROM users WHERE email = 'your-email@example.com';
# Copy the ID (format: usr_xxx or similar)
```

### B. Auth Token (from browser)
```javascript
// In browser console (F12):
localStorage.getItem('_ck_obj_Claims')
// Copy the whole token (starts with 'Bearer' or 'sk-')
```

### C. Other credentials
- Already in your `.env` file:
  - `ASAAS_WEBHOOK_TOKEN`
  - `DATABASE_URL`

---

## Step 2: Run the Stress Test

### Option A: Automated (All 4 Scenarios)
```bash
# Make script executable
chmod +x scripts/stress-test-setup.sh

# Run it
bash scripts/stress-test-setup.sh

# It will ask for your credentials, then run all tests
```

### Option B: Manual (Run Each Scenario)

#### Scenario A: Concurrent Session Creation
```bash
export AUTH_TOKEN="your-token"
export USER_ID="your-user-id"

# Create 10 sessions concurrently
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Test $i\"}" &
done
wait

# Check results
psql -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'"
# Should show: credits_remaining decreased by 10
```

#### Scenario B: Duplicate Webhook
```bash
export ASAAS_WEBHOOK_TOKEN="from-.env"
export USER_ID="your-user-id"
export DATABASE_URL="from-.env"

# Get credits before
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'"

# Send webhook 5 times
PAYLOAD='{
  "event": "PAYMENT_RECEIVED",
  "amount": 1990,
  "payment": {
    "id": "pay_test_'$(date +%s)'",
    "externalReference": "curria:v1:c:chk_test_'$(date +%s)'",
    "subscription": null,
    "amount": 1990
  }
}'

for i in {1..5}; do
  curl -X POST http://localhost:3000/api/webhook/asaas \
    -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" &
done
wait

sleep 2

# Check results
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='$USER_ID'"
# Should show: credits_remaining increased by 3 (not 15)
```

#### Scenario C: Rate Limiting
```bash
export AUTH_TOKEN="your-token"

# Send 40 requests
SUCCESS=0
BLOCKED=0

for i in {1..40}; do
  CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Test $i\"}")

  [ "$CODE" = "200" ] && ((SUCCESS++)) || ((BLOCKED++))
  echo -n "."
done

echo ""
echo "Success: $SUCCESS (expected ≤30)"
echo "Blocked (429): $BLOCKED (expected ≥10)"
```

---

## Step 3: Verify Results

### Check Credit Consumption
```bash
psql $DATABASE_URL -c "
  SELECT
    user_id,
    credits_remaining,
    (SELECT COUNT(*) FROM sessions WHERE app_user_id = credit_accounts.user_id) as session_count
  FROM credit_accounts
  WHERE user_id = 'your-user-id'
"
```

### Check for Data Corruption
```bash
# No negative credits
psql $DATABASE_URL -c "SELECT COUNT(*) FROM credit_accounts WHERE credits_remaining < 0"
# Expected: 0

# No duplicate webhooks
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM (
    SELECT event_fingerprint FROM processed_events
    GROUP BY event_fingerprint HAVING COUNT(*) > 1
  ) t
"
# Expected: 0

# All sessions have correct message count
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM sessions s
  WHERE s.messageCount != (SELECT COUNT(*) FROM messages WHERE session_id = s.id)
"
# Expected: 0
```

---

## Expected Results ✅

### Scenario A: Concurrent Sessions
- ✅ Credits decreased by exactly 10
- ✅ Exactly 10 sessions created
- ✅ No duplicates

### Scenario B: Duplicate Webhooks
- ✅ Credits increased by 3 (not 15)
- ✅ Only 1 processed_events row for that payment
- ✅ All duplicate requests returned 200 OK

### Scenario C: Rate Limiting
- ✅ First 30 requests succeeded
- ✅ Requests 31+ got 429 (Too Many Requests)
- ✅ After 1 minute, can send more requests

### Data Integrity
- ✅ No negative credits
- ✅ No duplicate events
- ✅ Message counts match

---

## Troubleshooting

### "Connection refused" on psql
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Try DIRECT_URL instead
DATABASE_URL="your-direct-url" psql ...
```

### "Unauthorized" on auth token
- Get fresh token from browser localStorage
- Format: `Bearer sk-...` or just the token itself

### "Rate limiter not working"
- Check Redis is running: `nc -zv localhost 6379`
- Check Upstash credentials in .env

### Credits not decreasing
- Verify user has credits to begin with
- Check logs: `npm run dev 2>&1 | grep -i credit`
- Check database: `psql -c "SELECT * FROM credit_accounts WHERE user_id='$USER_ID'"`

---

## Next Steps After Tests

1. **If all tests pass** ✅
   - Payment system is production-ready
   - Ready to add OpenAI API
   - Ready for real users

2. **If tests fail** ❌
   - Check logs for errors
   - Run integrity checks to find corruption
   - File a bug with the failing scenario details

---

## Help

**Want to understand what each test does?**
→ Read: `C:\Users\fabio\.claude\projects\C--CurrIA\memory\payment_stress_test_plan.md`

**Want more detailed analysis?**
→ Read: `C:\Users\fabio\.claude\projects\C--CurrIA\memory\post_payment_flow_and_redis.md`
