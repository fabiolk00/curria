# Staging Environment Setup Guide

This document provides step-by-step instructions for provisioning and configuring a staging environment to run the Asaas billing validation plan.

---

## Overview

The staging environment must be:
- **Isolated** from production (separate database, separate credentials)
- **Deployed** with the latest billing code
- **Configured** with staging-only credentials
- **Verified** to be reachable before validation begins

---

## Prerequisites

- Access to infrastructure (Supabase, AWS, or equivalent)
- Ability to create databases and service accounts
- Access to Asaas sandbox environment
- Repository with latest billing code merged

---

## Step 1: Create Isolated Staging Database

### Option A: Supabase (Recommended for Quick Setup)

```bash
# 1. Go to Supabase console (https://supabase.com/dashboard)
# 2. Create new project:
#    - Name: curria-staging
#    - Region: same as production or closest
#    - Pricing: Free or Pro (based on load)

# 3. Once created, copy credentials from Settings > Database:
#    - Host: db.xxxxx.supabase.co
#    - User: postgres
#    - Password: [generated]
#    - Database: postgres
#    - Port: 5432

# 4. Build connection string:
STAGING_DB_URL="postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres"
```

### Option B: Self-Hosted PostgreSQL

```bash
# Create a new PostgreSQL instance for staging only
# Example: Docker
docker run -d \
  --name curria-staging-db \
  -e POSTGRES_PASSWORD=staging_password \
  -e POSTGRES_DB=curria_staging \
  -p 5433:5432 \
  postgres:15

# Connection string:
STAGING_DB_URL="postgresql://postgres:staging_password@localhost:5433/curria_staging"
```

**Verify connectivity:**
```bash
psql "$STAGING_DB_URL" -c "SELECT 1;"
# Expected: (1 row)
```

---

## Step 2: Deploy Billing Code to Staging

### 2.1: Deploy Application

```bash
# Deploy latest code to staging environment
# Method depends on your infrastructure (Docker, Vercel, Railway, etc.)

# For Vercel:
vercel deploy --prod --environment staging

# For Docker:
docker build -t curria:staging .
docker push registry.example.com/curria:staging
# Then update staging k8s/docker-compose to use staging tag

# Verify deployment:
curl -s "https://staging-curria.example.com/api/health" | jq .
# Should return healthy status
```

### 2.2: Apply Database Migration

```bash
# Run the billing migration on staging database
psql "$STAGING_DB_URL" -f prisma/migrations/billing_webhook_hardening.sql

# Verify migration applied:
psql "$STAGING_DB_URL" -c "
  SELECT tablename FROM pg_tables
  WHERE tablename IN ('billing_checkouts', 'processed_events', 'credit_accounts')
  ORDER BY tablename;"

# Expected output (3 rows):
# billing_checkouts
# credit_accounts
# processed_events

# Verify RPC functions exist:
psql "$STAGING_DB_URL" -c "
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE 'apply_billing_%';"

# Expected output (2 rows):
# apply_billing_credit_grant_event
# apply_billing_subscription_metadata_event
```

**If migration fails:**
```bash
# Check for syntax errors
psql "$STAGING_DB_URL" -f prisma/migrations/billing_webhook_hardening.sql 2>&1 | head -20

# If tables already exist, verify schema matches production
psql "$STAGING_DB_URL" -c "\d billing_checkouts"
```

---

## Step 3: Configure Staging Credentials

### 3.1: Create `.env.staging` File

```bash
# Create .env.staging in project root
cat > .env.staging <<'EOF'
# Staging Database
STAGING_DB_URL="postgresql://postgres:[password]@[host]:5432/[database]"

# Staging API (where the webhook endpoint is deployed)
STAGING_API_URL="https://staging-curria.example.com"

# Asaas Sandbox Credentials
STAGING_ASAAS_WEBHOOK_TOKEN="[sandbox-webhook-token-only]"
STAGING_ASAAS_ACCESS_TOKEN="[sandbox-api-token-only]"

# Optional: Staging-specific configuration
STAGING_LOG_LEVEL="debug"
STAGING_ENABLE_DETAILED_LOGGING="true"
EOF

# Protect credentials
chmod 600 .env.staging
```

### 3.2: Load Staging Credentials (for Agent Execution)

When running the validation agent, ensure staging credentials are available:

```bash
# Option 1: Source before running
export $(cat .env.staging | xargs)

# Option 2: Pass directly to agent invocation
STAGING_DB_URL="..." STAGING_API_URL="..." STAGING_ASAAS_WEBHOOK_TOKEN="..." \
  npm run agent:validate-billing

# Option 3: In CI/CD, add staging secrets to environment
# (GitHub Actions, GitLab CI, etc.)
```

---

## Step 4: Verify Staging Environment

Run these verification checks before proceeding to validation:

### 4.1: Database Connectivity

```bash
psql "$STAGING_DB_URL" -c "
  SELECT
    'Database' as check_type,
    'OK' as status,
    NOW() as timestamp;"

# Expected: 1 row with OK status
```

### 4.2: API Reachability

```bash
curl -s -I "https://staging-curria.example.com/api/health" | head -1

# Expected: HTTP/2 200 or HTTP/1.1 200
```

### 4.3: Webhook Token Present

```bash
echo "STAGING_ASAAS_WEBHOOK_TOKEN: ${STAGING_ASAAS_WEBHOOK_TOKEN:0:10}..."

# Expected: Non-empty token starting shown
```

### 4.4: Schema Verification

```bash
psql "$STAGING_DB_URL" -c "
  SELECT
    'Schema Check' as check_type,
    COUNT(*) as table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND tablename IN ('billing_checkouts', 'credit_accounts', 'user_quotas', 'processed_events');
  "

# Expected: table_count = 4
```

### 4.5: RPC Functions Verification

```bash
psql "$STAGING_DB_URL" -c "
  \df+ apply_billing*"

# Expected: Both RPC functions listed with their signatures
```

### Complete Verification Script

```bash
#!/bin/bash

echo "=== Staging Environment Verification ==="

# Load credentials
source .env.staging

# Check 1: Database
echo -n "Database connectivity... "
if psql "$STAGING_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✓ OK"
else
  echo "✗ FAILED"
  exit 1
fi

# Check 2: API
echo -n "API reachability... "
if curl -s -o /dev/null -w "%{http_code}" "$STAGING_API_URL/api/health" | grep -q "200"; then
  echo "✓ OK"
else
  echo "✗ FAILED"
  exit 1
fi

# Check 3: Token
echo -n "Webhook token present... "
if [ -n "$STAGING_ASAAS_WEBHOOK_TOKEN" ]; then
  echo "✓ OK"
else
  echo "✗ FAILED"
  exit 1
fi

# Check 4: Schema
echo -n "Database schema... "
COUNT=$(psql "$STAGING_DB_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = 'public'
  AND tablename IN ('billing_checkouts', 'credit_accounts', 'user_quotas', 'processed_events');")
if [ "$COUNT" = "4" ]; then
  echo "✓ OK ($COUNT tables)"
else
  echo "✗ FAILED (found $COUNT tables, expected 4)"
  exit 1
fi

# Check 5: RPC Functions
echo -n "RPC functions... "
FUNC_COUNT=$(psql "$STAGING_DB_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE 'apply_billing_%';")
if [ "$FUNC_COUNT" = "2" ]; then
  echo "✓ OK ($FUNC_COUNT functions)"
else
  echo "✗ FAILED (found $FUNC_COUNT functions, expected 2)"
  exit 1
fi

echo ""
echo "=== All Checks Passed ==="
echo "Staging environment is ready for validation."
```

**Save as `scripts/verify-staging.sh` and run:**
```bash
chmod +x scripts/verify-staging.sh
./scripts/verify-staging.sh
```

---

## Step 5: Prepare Test Data

Before running validation, initialize clean test state:

```bash
# Create or reset test user
psql "$STAGING_DB_URL" <<'SQL'
-- Delete any existing test data
DELETE FROM billing_checkouts WHERE user_id = 'usr_staging_001';
DELETE FROM credit_accounts WHERE user_id = 'usr_staging_001';
DELETE FROM user_quotas WHERE user_id = 'usr_staging_001';
DELETE FROM users WHERE id = 'usr_staging_001';

-- Create fresh test user
INSERT INTO users (id, email, created_at, updated_at)
VALUES ('usr_staging_001', 'staging-test@curria.test', NOW(), NOW());

-- Create initial credit account
INSERT INTO credit_accounts (id, user_id, credits_remaining, created_at, updated_at)
VALUES ('cred_staging_001', 'usr_staging_001', 5, NOW(), NOW());

-- Verify
SELECT 'Test data ready:' as status;
SELECT * FROM users WHERE id = 'usr_staging_001';
SELECT * FROM credit_accounts WHERE user_id = 'usr_staging_001';
SQL
```

---

## Step 6: Execute Staging Validation

Once all preconditions are met:

```bash
# Load staging credentials
source .env.staging

# Option 1: Via Agent (recommended)
npm run agent:validate-billing

# Option 2: Manual execution
# Follow docs/staging-validation-plan.md scenarios manually

# Option 3: CI/CD pipeline
# Add to GitHub Actions / GitLab CI:
name: Staging Validation
on: [workflow_dispatch]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run staging validation
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}
          STAGING_API_URL: ${{ secrets.STAGING_API_URL }}
          STAGING_ASAAS_WEBHOOK_TOKEN: ${{ secrets.STAGING_ASAAS_WEBHOOK_TOKEN }}
        run: npm run agent:validate-billing
```

---

## Troubleshooting

### Database Connection Fails

```bash
# Check connection string format
echo "STAGING_DB_URL=$STAGING_DB_URL"

# Verify host is reachable
psql -h [host] -U postgres -d postgres -c "SELECT 1;"

# Check firewall rules
nc -zv [host] 5432

# For Supabase: Ensure IP whitelist includes your machine
```

### Migration Fails

```bash
# Check migration syntax
psql "$STAGING_DB_URL" < prisma/migrations/billing_webhook_hardening.sql 2>&1

# If tables exist but differ from production, check schema:
psql "$STAGING_DB_URL" -c "\d billing_checkouts"
psql "$STAGING_DB_URL" -c "\d credit_accounts"

# Drop and re-create if needed (CAREFUL: staging only!)
psql "$STAGING_DB_URL" <<'SQL'
DROP TABLE IF EXISTS processed_events CASCADE;
DROP TABLE IF EXISTS billing_checkouts CASCADE;
DROP FUNCTION IF EXISTS apply_billing_credit_grant_event;
DROP FUNCTION IF EXISTS apply_billing_subscription_metadata_event;
SQL

# Re-run migration
psql "$STAGING_DB_URL" -f prisma/migrations/billing_webhook_hardening.sql
```

### API Not Reachable

```bash
# Check deployment status
# (Vercel, Docker, K8s, etc.)

# Test from staging server
curl -v "https://staging-curria.example.com/api/health"

# Check firewall rules and DNS
nslookup staging-curria.example.com
ping staging-curria.example.com
```

### Webhook Token Missing

```bash
# Verify Asaas sandbox account
# Go to: https://sandbox.asaas.com/settings

# Copy webhook token from Asaas dashboard
# Set in .env.staging:
STAGING_ASAAS_WEBHOOK_TOKEN="[copied from Asaas]"

# Verify it's loaded
echo $STAGING_ASAAS_WEBHOOK_TOKEN
```

---

## Cleanup After Validation

After validation completes:

```bash
# Option 1: Keep test data for future runs
# (recommended if revalidating)

# Option 2: Clean up test user
psql "$STAGING_DB_URL" <<'SQL'
DELETE FROM billing_checkouts WHERE user_id = 'usr_staging_001';
DELETE FROM credit_accounts WHERE user_id = 'usr_staging_001';
DELETE FROM user_quotas WHERE user_id = 'usr_staging_001';
DELETE FROM users WHERE id = 'usr_staging_001';
SQL
```

---

## Success Criteria

Staging is ready when:

- ✅ Database is isolated from production
- ✅ Migration applied and verified
- ✅ All 5 verification checks pass
- ✅ Test user created with initial credits
- ✅ Credentials are in `.env.staging`
- ✅ All team members with access have credentials
- ✅ CI/CD can access staging environment
- ✅ Staging validation agent can be executed

---

## Next Steps

Once staging is ready:

1. Run verification script: `./scripts/verify-staging.sh`
2. Execute validation agent: `npm run agent:validate-billing`
3. Review validation report: `docs/staging-validation-report.md`
4. If PROCEED: deploy to production
5. If STOP: fix issues, re-validate

---

## Support

For issues during staging setup:

1. Check troubleshooting section above
2. Review logs from deployment tool (Vercel, Docker, K8s)
3. Verify all environment variables are set
4. Re-run verification script to identify blocker
5. Contact platform team if infrastructure issue
