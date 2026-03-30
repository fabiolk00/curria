# Quick Start: Execute Billing Validation

**Time to complete**: 1-2 hours (including staging setup)

---

## Prerequisites

You need:
1. Staging database (PostgreSQL)
2. Staging API deployment (with billing code)
3. `.env.staging` file (credentials)
4. `psql` and `curl` available in bash
5. Asaas sandbox webhook token

---

## Step-by-Step Execution

### Step 0: Prepare Staging Environment

**Option A: Use Supabase (fastest)**
```bash
# 1. Go to https://supabase.com/dashboard
# 2. Create new project "curria-staging"
# 3. Copy database credentials
# 4. Note the host, password, database name
```

**Option B: Use Docker (easiest local)**
```bash
docker run -d \
  --name curria-staging-db \
  -e POSTGRES_PASSWORD=staging_password \
  -e POSTGRES_DB=curria_staging \
  -p 5433:5432 \
  postgres:15
```

### Step 1: Create `.env.staging` File

```bash
cat > .env.staging <<'EOF'
# Staging Database (replace with actual values)
STAGING_DB_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/YOUR_DB"

# Staging API URL (where billing code is deployed)
STAGING_API_URL="https://staging-curria.example.com"

# Asaas Sandbox Token (from Asaas dashboard)
STAGING_ASAAS_WEBHOOK_TOKEN="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EOF
```

### Step 2: Verify Connectivity

```bash
# Load environment
export $(cat .env.staging | xargs)

# Test database connection
psql "$STAGING_DB_URL" -c "SELECT 1;"
# Expected: (1 row)

# Test API reachability
curl -s -I "$STAGING_API_URL" | head -1
# Expected: HTTP 200 or 404 (not 502/503)
```

### Step 3: Apply Migrations

```bash
# Apply billing migrations to staging database
psql "$STAGING_DB_URL" -f prisma/migrations/billing_webhook_hardening.sql

# Verify tables exist
psql "$STAGING_DB_URL" -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'billing_checkouts', 'credit_accounts', 'processed_events',
    'user_quotas', 'resume_targets', 'cv_versions'
  );"
# Expected: 6 rows
```

### Step 4: Run Validation

```bash
# Execute validation script from docs/execute-billing-validation.md
# Follow each phase in order:

# Phase 0: Safety Check
echo "=== PHASE 0: Safety Check ==="
psql "$STAGING_DB_URL" -c "SELECT current_database() as database, current_user as user;"
# Expected: staging database, not production

# Phase 1-3: Verification
echo "=== PHASES 1-3: Environment & Schema Verification ==="
# (See execute-billing-validation.md for detailed queries)

# Phase 4: End-to-End Scenarios
echo "=== PHASE 4: End-to-End Scenarios ==="
# Create test user and run 7 billing scenarios
# (See execute-billing-validation.md for detailed steps)

# Phase 5: Debugging Playbook
echo "=== PHASE 5: Ops Playbook ==="
# Collect SQL queries for ops team
```

### Step 5: Generate Report

```bash
# Create markdown report with results
# Include:
# - Safety check results (PASS/FAIL)
# - Schema verification results (PASS/FAIL)
# - Scenario results (PASS/FAIL/PARTIAL for each)
# - Recommendation (PROCEED / PARTIAL / STOP)

# See docs/execute-billing-validation.md "Final Report" section for template
```

---

## Critical Checks (STOP If Any Fail)

```bash
# Check 1: Not production
psql "$STAGING_DB_URL" -c "SELECT current_database();"
# STOP if contains "production" or "prod"

# Check 2: All tables exist
psql "$STAGING_DB_URL" -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'billing_checkouts', 'credit_accounts', 'processed_events',
    'user_quotas', 'resume_targets', 'cv_versions'
  );"
# STOP if not 6 rows

# Check 3: All functions exist
psql "$STAGING_DB_URL" -c "
  SELECT COUNT(*) FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name IN (
    'apply_billing_credit_grant_event',
    'apply_billing_subscription_metadata_event',
    'apply_session_patch_with_version',
    'create_cv_version_record',
    'create_resume_target_with_version'
  );"
# STOP if not 5 rows

# Check 4: Webhook token exists
echo "${STAGING_ASAAS_WEBHOOK_TOKEN:0:10}..."
# STOP if empty

# Check 5: API reachable
curl -s -I "$STAGING_API_URL/api/health" | head -1
# STOP if 502 or 503
```

---

## Running Scenario 1 (Example)

Complete example of running one scenario:

```bash
# Load environment
export $(cat .env.staging | xargs)

# Create test user with initial credits
psql "$STAGING_DB_URL" <<'SQL'
INSERT INTO users (id, email, created_at, updated_at)
VALUES ('usr_staging_001', 'test@staging.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_001', 'usr_staging_001', 5, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL

# Step 1: Create checkout
CHECKOUT_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}')

CHECKOUT_REF=$(echo "$CHECKOUT_RESPONSE" | grep -oP '"checkoutReference":"?\K[^"]*')
echo "Checkout reference: $CHECKOUT_REF"

# Step 2: Send PAYMENT_RECEIVED webhook
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
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
  }"

# Step 3: Verify credits increased
psql "$STAGING_DB_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"
# Expected: credits_remaining = 8 (was 5, added 3)

# Step 4: Test idempotency (replay webhook)
curl -s -X POST "$STAGING_API_URL/api/webhook/asaas" \
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
  }"

# Step 5: Verify no double-grant
psql "$STAGING_DB_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"
# Expected: still 8 (no double-grant)

echo "SCENARIO 1: PASS"
```

---

## Troubleshooting

### Database Connection Failed
```bash
# Check connection string
echo "$STAGING_DB_URL"

# Test basic connectivity
psql -c "SELECT 1;" --host=YOUR_HOST --user=postgres
```

### Migration Failed
```bash
# Check migration SQL for syntax errors
psql "$STAGING_DB_URL" -f prisma/migrations/billing_webhook_hardening.sql 2>&1 | head -20

# Check if tables already exist
psql "$STAGING_DB_URL" -c "\d billing_checkouts"
```

### Webhook Returns 400
```bash
# Verify externalReference format
# Should be: curria:v1:u:USER_ID:c:CHECKOUT_REF
echo "curria:v1:u:usr_staging_001:c:$CHECKOUT_REF"

# Verify checkout was created
psql "$STAGING_DB_URL" -c "SELECT * FROM billing_checkouts ORDER BY created_at DESC LIMIT 1;"
```

### Credits Didn't Increase
```bash
# Check processed_events for error
psql "$STAGING_DB_URL" -c "
  SELECT event_id, event_type, error_message FROM processed_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  ORDER BY created_at DESC LIMIT 1;"

# Check credit_accounts current balance
psql "$STAGING_DB_URL" -c "
  SELECT user_id, credits_remaining FROM credit_accounts
  WHERE user_id = 'usr_staging_001';"
```

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/execute-billing-validation.md` | **Full validation script** (follow this!) |
| `docs/staging-setup-guide.md` | Setup guide with more details |
| `docs/billing-validation-status-report.md` | Status report and overview |
| `.env.staging.example` | Credentials template |
| `prisma/migrations/billing_webhook_hardening.sql` | Database migrations |

---

## Success Criteria

✅ All checks pass when:
- All 5 safety checks PASS
- All 7 scenarios PASS
- No idempotency issues (no double-grants)
- No critical blockers found

❌ STOP when:
- Environment is production
- Schema incomplete
- Double-grant occurs
- Overflow not enforced
- Cancellation reduces credits

---

## Next Steps

1. **Setup**: 30-45 minutes
   - Create staging database
   - Apply migrations
   - Deploy code to staging

2. **Validation**: 15-20 minutes
   - Run all phases and scenarios
   - Verify results

3. **Report**: 5-10 minutes
   - Document findings
   - Make recommendation

4. **Deploy**: After validation passes
   - Notify stakeholders
   - Deploy to production
   - Monitor closely

---

## Questions?

- Setup help: See `docs/staging-setup-guide.md`
- Validation details: See `docs/execute-billing-validation.md`
- Operations: See `docs/billing-ops-runbook.md`
- Architecture: See `CLAUDE.md`
