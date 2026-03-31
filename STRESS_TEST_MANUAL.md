# 💡 Stress Test - Manual Approach (Simplest)

If you don't want to run bash scripts, here's how to manually test each scenario:

---

## Prerequisites (2 min setup)

1. **Have these values ready:**
   ```
   User ID: usr_xxx (from database)
   Auth Token: Bearer sk-xxx (from browser localStorage)
   Webhook Token: from .env ASAAS_WEBHOOK_TOKEN
   Database URL: from .env
   ```

2. **Open 3 terminals:**
   - Terminal 1: Running `npm run dev` (app)
   - Terminal 2: Running `psql` (database)
   - Terminal 3: Running `curl` commands

---

## Scenario A: Concurrent Sessions (10 min)

### What We're Testing
"When 10 users create sessions at the same time, do credits deduct correctly?"

### The Test

**Terminal 2 - Check initial credits:**
```bash
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='usr_xxx'"
# Note the number (e.g., 50)
```

**Terminal 3 - Run 10 concurrent requests:**
```bash
# Copy and paste this entire block:

for i in {1..10}; do
  curl -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer sk-xxx" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Concurrent test $i\"}" &
done

wait
echo "Done!"
```

**Terminal 2 - Check final credits:**
```bash
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='usr_xxx'"
# Should be exactly 10 less than before
```

**Check results:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) as sessions_created FROM sessions WHERE app_user_id='usr_xxx'"
# Should show: 10
```

### Expected Outcome ✅
- Credits: 50 → 40 (exactly -10)
- Sessions: 10 created
- No errors in app logs

### If It Fails ❌
- Check logs: see "credit.consume_failed" error?
- Check database: any sessions with null user_id?
- Try again with smaller concurrent count (5 instead of 10)

---

## Scenario B: Duplicate Webhooks (10 min)

### What We're Testing
"If Asaas sends the same payment webhook 5 times, does the user get 5x credits or 1x credits?"

### The Test

**Terminal 2 - Check initial credits:**
```bash
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='usr_xxx'"
# Note the number (e.g., 40)
```

**Terminal 3 - Send same webhook 5 times:**
```bash
# Get timestamp for unique ID
TIMESTAMP=$(date +%s)

# Copy and paste this entire block:

for i in {1..5}; do
  curl -X POST http://localhost:3000/api/webhook/asaas \
    -H "asaas-access-token: whsec_xxx" \
    -H "Content-Type: application/json" \
    -d '{
      "event": "PAYMENT_RECEIVED",
      "amount": 1990,
      "payment": {
        "id": "pay_dup_'$TIMESTAMP'",
        "externalReference": "curria:v1:c:chk_dup_'$TIMESTAMP'",
        "subscription": null,
        "amount": 1990
      }
    }' &
done

wait
echo "Done!"
```

**Terminal 2 - Check final credits:**
```bash
psql $DATABASE_URL -c "SELECT credits_remaining FROM credit_accounts WHERE user_id='usr_xxx'"
# Should be exactly 3 more (unit plan = 3 credits)
# NOT 15 more (5 x 3)
```

**Check deduplication:**
```bash
psql $DATABASE_URL -c "
  SELECT COUNT(DISTINCT event_fingerprint) as unique_events
  FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  AND created_at > NOW() - INTERVAL '1 minute'
"
# Should show: 1 (only one event was actually processed)
```

### Expected Outcome ✅
- Credits: 40 → 43 (exactly +3, not +15)
- Unique events: 1 (all 5 were deduplicated)
- All 5 curl responses: 200 OK

### If It Fails ❌
- Credits went to 55 (5×3)? Idempotency is broken
- Check Redis: is it storing dedup keys?
- Check logs: are webhooks being rejected before processing?

---

## Scenario C: Rate Limiting (10 min)

### What We're Testing
"Can a user only make 30 requests per minute? Does the 31st request get blocked?"

### The Test

**Terminal 3 - Send 40 requests and count successes:**
```bash
# Copy and paste this entire block:

SUCCESS=0
BLOCKED=0

for i in {1..40}; do
  CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://localhost:3000/api/agent \
    -H "Authorization: Bearer sk-xxx" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Rate limit test $i\"}")

  if [ "$CODE" = "200" ]; then
    ((SUCCESS++))
    echo -n "✓"
  elif [ "$CODE" = "429" ]; then
    ((BLOCKED++))
    echo -n "X"
  else
    echo -n "?"
  fi
done

echo ""
echo ""
echo "Results:"
echo "  ✓ Success (200): $SUCCESS (expected: ≤30)"
echo "  X Blocked (429): $BLOCKED (expected: ≥10)"
```

### Expected Outcome ✅
- Success: 30 or less
- Blocked: 10 or more
- No 500 errors

### If It Fails ❌
- All 40 succeeded? Rate limiter is broken
- All 40 blocked? Rate limiter is too strict
- Check Redis connection in logs

---

## Scenario D: Data Integrity Check (5 min)

### What We're Testing
"Did our aggressive testing corrupt the database?"

### Terminal 2 - Run all checks:

```bash
echo "=== Check 1: No negative credits ==="
psql $DATABASE_URL -c "SELECT COUNT(*) FROM credit_accounts WHERE credits_remaining < 0"
# Expected: 0

echo ""
echo "=== Check 2: No duplicate processed events ==="
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM (
    SELECT event_fingerprint FROM processed_events
    GROUP BY event_fingerprint HAVING COUNT(*) > 1
  ) t
"
# Expected: 0

echo ""
echo "=== Check 3: Session message counts match ==="
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM sessions s
  WHERE s.messageCount != (
    SELECT COALESCE(COUNT(*), 0) FROM messages WHERE session_id = s.id
  )
"
# Expected: 0

echo ""
echo "=== Check 4: User balance is correct ==="
psql $DATABASE_URL -c "SELECT user_id, credits_remaining FROM credit_accounts WHERE user_id='usr_xxx'"
# Should match your manual calculations
```

### Expected Outcome ✅
All 4 checks return 0 or match your expectations

---

## Quick Summary Table

| Scenario | Command | Expected | Pass/Fail |
|----------|---------|----------|-----------|
| A: Concur Sessions | 10 concurrent POST /api/agent | -10 credits | ✓ |
| B: Duplicate Webhook | 5x same PAYMENT_RECEIVED | +3 credits (not +15) | ✓ |
| C: Rate Limiting | 40 requests in <1 sec | 30 success, 10 blocked | ✓ |
| D: Data Integrity | Run 4 SQL checks | All 0 rows | ✓ |

---

## If Everything Passes ✅

Your payment system is rock solid!

Next steps:
1. Add OpenAI API key to .env
2. Test the full chat loop
3. Generate files
4. Move to production

---

## If Something Fails ❌

1. **Check logs:** `npm run dev 2>&1 | grep -i error`
2. **Check database state:**
   ```bash
   psql $DATABASE_URL
   \d  # List all tables
   SELECT * FROM credit_accounts WHERE user_id='usr_xxx';
   SELECT * FROM sessions WHERE app_user_id='usr_xxx' ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM processed_events ORDER BY created_at DESC LIMIT 5;
   ```
3. **Describe the failure** with:
   - Which scenario failed?
   - What was expected vs actual?
   - What do the logs say?
4. **We can debug from there**

---

## Pro Tips 💡

1. **Test in order (A→B→C→D)** - Each builds confidence
2. **Open two psql sessions** - One for checks, one for queries
3. **Keep app logs visible** - Watch for errors in real-time
4. **Take screenshots** of results - Helps debug later
5. **Test with small numbers first** - 2 concurrent, not 10

---

## Time Estimate
- All 4 scenarios: ~30-40 minutes total
- Just the important ones (A, C): ~15 minutes

Ready to start? Pick a scenario above and go! 🚀
