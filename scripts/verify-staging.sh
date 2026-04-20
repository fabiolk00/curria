#!/bin/bash

set -euo pipefail

ENV_TEMPLATE=".env.staging.example"
ENV_FILE=".env.staging"
REQUIRED_MIGRATIONS=(
  "prisma/migrations/billing_webhook_hardening.sql"
  "prisma/migrations/20260406_align_asaas_webhook_contract.sql"
  "prisma/migrations/20260406_fix_billing_checkout_timestamp_defaults.sql"
  "prisma/migrations/20260407_persist_billing_display_totals.sql"
  "prisma/migrations/20260407_harden_text_id_generation.sql"
  "prisma/migrations/20260407_harden_standard_timestamps.sql"
  "prisma/migrations/20260412_resume_generation_billing.sql"
  "prisma/migrations/20260420_credit_reservation_ledger.sql"
)

echo "======================================================================"
echo "  Staging Environment Verification"
echo "======================================================================"
echo ""

REQUIRED_COMMANDS=(
  "curl"
  "npx"
)

HAS_PSQL=0

echo "Checking required shell tools..."
echo ""

for command_name in "${REQUIRED_COMMANDS[@]}"; do
  if command -v "$command_name" > /dev/null 2>&1; then
    echo "Found: $command_name"
  else
    echo "Missing required command: $command_name"
    echo "Install it first, then rerun this script from Bash (WSL, Git Bash, or another POSIX shell)."
    exit 1
  fi
done

if command -v "psql" > /dev/null 2>&1; then
  echo "Found: psql"
  HAS_PSQL=1
else
  echo "Optional: psql not found"
  echo "Using the Supabase admin fallback is allowed when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are populated."
fi

echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: $ENV_FILE not found."
  echo ""
  echo "Create it from the committed template first:"
  echo "  cp $ENV_TEMPLATE $ENV_FILE"
  echo "  # Then edit $ENV_FILE with your staging credentials"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "Checking required staging environment variables..."
echo ""

REQUIRED_VARS=(
  "STAGING_API_URL"
  "STAGING_ASAAS_WEBHOOK_TOKEN"
  "STAGING_ASAAS_ACCESS_TOKEN"
)

MISSING_VARS=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "Missing: $var"
    MISSING_VARS=$((MISSING_VARS + 1))
  else
    echo "Set: $var"
  fi
done

DB_MODE=""
if [ -n "${STAGING_DB_URL:-}" ] && [ "$HAS_PSQL" -eq 1 ]; then
  echo "Set: STAGING_DB_URL"
  DB_MODE="psql"
elif [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Set: NEXT_PUBLIC_SUPABASE_URL"
  echo "Set: SUPABASE_SERVICE_ROLE_KEY"
  DB_MODE="supabase_admin"
else
  echo "Missing database access for preflight."
  echo "Provide STAGING_DB_URL with psql, or populate NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the Supabase admin fallback."
  MISSING_VARS=$((MISSING_VARS + 1))
fi

if [ "$MISSING_VARS" -gt 0 ]; then
  echo ""
  echo "$MISSING_VARS required staging variables are missing."
  echo "Update $ENV_FILE so it matches $ENV_TEMPLATE."
  exit 1
fi

echo ""
echo "======================================================================"
echo "  Database Connectivity Check"
echo "======================================================================"
echo ""

if [ "$DB_MODE" = "psql" ]; then
  if psql "$STAGING_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "Database is reachable through psql."
  else
    echo "Cannot connect to the staging database."
    echo "Check STAGING_DB_URL and verify the database is reachable from this machine."
    exit 1
  fi
else
  echo "psql unavailable; database checks will use the Supabase admin fallback."
fi

echo ""
echo "======================================================================"
echo "  Database Schema Check"
echo "======================================================================"
echo ""

if [ "$DB_MODE" = "psql" ]; then
  TABLES_FOUND=$(psql "$STAGING_DB_URL" -t -A -c "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('billing_checkouts', 'credit_accounts', 'user_quotas', 'processed_events', 'credit_reservations', 'credit_ledger_entries');
  ")

  if [ "$TABLES_FOUND" = "6" ]; then
    echo "Billing tables exist (6/6)."
  else
    echo "Expected billing tables are missing ($TABLES_FOUND/6 found)."
    echo "Apply the current billing migrations before retrying:"
    for migration in "${REQUIRED_MIGRATIONS[@]}"; do
      echo "  - $migration"
    done
    exit 1
  fi

  RPC_COUNT=$(psql "$STAGING_DB_URL" -t -A -c "
    SELECT COUNT(*) FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('apply_billing_credit_grant_event', 'apply_billing_subscription_metadata_event', 'reserve_credit_for_generation_intent', 'finalize_credit_reservation', 'release_credit_reservation');
  ")

  if [ "$RPC_COUNT" = "5" ]; then
    echo "Billing RPC functions exist (5/5)."
  else
    echo "Billing RPC functions are missing ($RPC_COUNT/5 found)."
    echo "Re-apply the migration sequence documented above."
    exit 1
  fi
else
  echo "Running fallback schema and user checks through Supabase admin..."
  npx tsx scripts/check-staging-billing-state.ts --healthcheck --preflight-user usr_staging_001 --env-file "$ENV_FILE"
fi

echo ""
echo "======================================================================"
echo "  API Reachability Check"
echo "======================================================================"
echo ""

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_API_URL%/}" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "404" ]; then
  echo "Staging API is reachable (HTTP $HTTP_STATUS)."
else
  echo "Staging API is not reachable (HTTP $HTTP_STATUS)."
  echo "Check STAGING_API_URL and verify the current build is deployed."
  exit 1
fi

echo ""
echo "======================================================================"
echo "  Asaas Credentials Check"
echo "======================================================================"
echo ""

WEBHOOK_PREVIEW="${STAGING_ASAAS_WEBHOOK_TOKEN:0:10}..."
ACCESS_PREVIEW="${STAGING_ASAAS_ACCESS_TOKEN:0:10}..."
echo "Webhook token present: $WEBHOOK_PREVIEW"
echo "Access token present:  $ACCESS_PREVIEW"

echo ""
echo "======================================================================"
echo "  Test User Check"
echo "======================================================================"
echo ""

if [ "$DB_MODE" = "psql" ]; then
  TEST_USER_EXISTS=$(psql "$STAGING_DB_URL" -t -A -c "
    SELECT COUNT(*) FROM users WHERE id = 'usr_staging_001';
  ")

  if [ "$TEST_USER_EXISTS" = "1" ]; then
    echo "Test user exists (usr_staging_001)."
  else
    echo "Test user usr_staging_001 does not exist yet."
    echo "Create it with the SQL block from docs/staging/SETUP_GUIDE.md before running scenarios."
  fi
else
  echo "Test user check was included in the Supabase admin fallback output above."
fi

echo ""
echo "======================================================================"
echo "  VERIFICATION COMPLETE"
echo "======================================================================"
echo ""
echo "All preflight checks passed."
echo "Next step: use the committed Phase 3 helpers described in scripts/README.md and docs/staging/VALIDATION_PLAN.md."
