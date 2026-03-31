CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS processed_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_fingerprint TEXT,
  event_payload JSONB NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_quotas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE processed_events
  ADD COLUMN IF NOT EXISTS event_fingerprint TEXT;

ALTER TABLE processed_events
  ADD COLUMN IF NOT EXISTS event_payload JSONB;

ALTER TABLE processed_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE processed_events
SET event_fingerprint = event_id
WHERE event_fingerprint IS NULL;

ALTER TABLE processed_events
  ALTER COLUMN event_fingerprint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS processed_events_event_fingerprint_key
  ON processed_events(event_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS processed_events_event_id_event_type_key
  ON processed_events(event_id, event_type);

CREATE TABLE IF NOT EXISTS billing_checkouts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checkout_reference TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  asaas_link TEXT NULL,
  asaas_payment_id TEXT NULL,
  asaas_subscription_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_checkouts_paid_amount CHECK (amount_minor > 0),
  CONSTRAINT billing_checkouts_valid_plan CHECK (plan IN ('unit', 'monthly', 'pro')),
  CONSTRAINT billing_checkouts_valid_status CHECK (
    status IN ('pending', 'created', 'failed', 'paid', 'subscription_active', 'canceled')
  )
);

CREATE INDEX IF NOT EXISTS billing_checkouts_user_id_idx
  ON billing_checkouts(user_id);

CREATE INDEX IF NOT EXISTS billing_checkouts_user_id_status_idx
  ON billing_checkouts(user_id, status);

CREATE INDEX IF NOT EXISTS billing_checkouts_asaas_payment_id_idx
  ON billing_checkouts(asaas_payment_id);

CREATE INDEX IF NOT EXISTS billing_checkouts_asaas_subscription_id_idx
  ON billing_checkouts(asaas_subscription_id);

CREATE OR REPLACE FUNCTION apply_billing_credit_grant_event(
  p_app_user_id TEXT,
  p_plan TEXT,
  p_credits INTEGER,
  p_amount_minor INTEGER DEFAULT NULL,
  p_checkout_reference TEXT DEFAULT NULL,
  p_asaas_subscription_id TEXT DEFAULT NULL,
  p_renews_at TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_event_fingerprint TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_event_payload JSONB DEFAULT NULL,
  p_is_renewal BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_checkout_plan TEXT;
  v_checkout_amount INTEGER;
  v_user_plan TEXT;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_event_fingerprint IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'Billing event fingerprint and type are required.';
  END IF;

  IF p_checkout_reference IS NULL AND p_asaas_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Either checkout_reference or asaas_subscription_id must be provided.';
  END IF;

  IF p_event_type IN ('PAYMENT_RECEIVED', 'SUBSCRIPTION_CREATED') AND p_checkout_reference IS NULL THEN
    RAISE EXCEPTION 'checkout_reference is required for % events.', p_event_type;
  END IF;

  IF p_event_type IN ('SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_DELETED')
    AND p_asaas_subscription_id IS NULL THEN
    RAISE EXCEPTION 'asaas_subscription_id is required for % events.', p_event_type;
  END IF;

  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Invalid credit grant: credits must be positive.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_event_fingerprint));

  IF EXISTS (
    SELECT 1
    FROM processed_events
    WHERE event_fingerprint = p_event_fingerprint
  ) THEN
    RETURN 'duplicate';
  END IF;

  IF p_checkout_reference IS NOT NULL THEN
    SELECT plan, amount_minor
    INTO v_checkout_plan, v_checkout_amount
    FROM billing_checkouts
    WHERE checkout_reference = p_checkout_reference
      AND user_id = p_app_user_id;

    IF v_checkout_plan IS NULL THEN
      RAISE EXCEPTION 'Checkout record not found: %', p_checkout_reference;
    END IF;

    IF v_checkout_plan <> p_plan THEN
      RAISE EXCEPTION 'Checkout mismatch for %: expected plan %, got %',
        p_checkout_reference, v_checkout_plan, p_plan;
    END IF;

    IF p_amount_minor IS NULL OR v_checkout_amount <> p_amount_minor THEN
      RAISE EXCEPTION 'Checkout amount mismatch for %: expected %, got %',
        p_checkout_reference, v_checkout_amount, p_amount_minor;
    END IF;
  END IF;

  -- For SUBSCRIPTION_RENEWED and SUBSCRIPTION_CANCELED, validate the subscription already exists.
  -- For SUBSCRIPTION_CREATED, trust the checkout record and let the upsert persist the new subscription.
  IF p_asaas_subscription_id IS NOT NULL
    AND p_event_type NOT IN ('SUBSCRIPTION_CREATED') THEN
    SELECT plan
    INTO v_user_plan
    FROM user_quotas
    WHERE asaas_subscription_id = p_asaas_subscription_id
      AND user_id = p_app_user_id;

    IF v_user_plan IS NULL THEN
      RAISE EXCEPTION 'User quota record not found for subscription %', p_asaas_subscription_id;
    END IF;

    IF v_user_plan <> p_plan THEN
      RAISE EXCEPTION 'Plan mismatch for subscription %: expected %, got %',
        p_asaas_subscription_id, v_user_plan, p_plan;
    END IF;
  END IF;

  SELECT credits_remaining
  INTO v_current_balance
  FROM credit_accounts
  WHERE user_id = p_app_user_id
  FOR UPDATE;

  IF v_current_balance IS NOT NULL AND v_current_balance < 0 THEN
    RAISE WARNING 'Anomaly: negative existing balance for user % (%).',
      p_app_user_id, v_current_balance;
    RAISE EXCEPTION 'Negative existing balance detected for user %', p_app_user_id;
  END IF;

  -- For subscription renewals: replace the balance with the plan credits
  -- For plan changes/initial purchases: add to existing balance (carryover)
  IF p_is_renewal THEN
    v_new_balance := p_credits;
  ELSE
    v_new_balance := COALESCE(v_current_balance, 0) + p_credits;
  END IF;

  IF v_new_balance < 0 THEN
    RAISE WARNING 'Anomaly: credit grant would result in negative balance for user % (% -> %).',
      p_app_user_id, COALESCE(v_current_balance, 0), v_new_balance;
    RAISE EXCEPTION 'Credit grant would result in negative balance.';
  END IF;

  IF v_new_balance > 1000000 THEN
    RAISE WARNING 'Anomaly: credit grant would exceed max balance for user % (% -> %).',
      p_app_user_id, COALESCE(v_current_balance, 0), v_new_balance;
    RAISE EXCEPTION 'Credit grant would exceed max balance.';
  END IF;

  INSERT INTO credit_accounts (
    id,
    user_id,
    credits_remaining,
    created_at,
    updated_at
  )
  VALUES (
    'cred_' || p_app_user_id,
    p_app_user_id,
    v_new_balance,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    credits_remaining = EXCLUDED.credits_remaining,
    updated_at = NOW();

  INSERT INTO user_quotas (
    id,
    user_id,
    plan,
    asaas_subscription_id,
    renews_at,
    status,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_app_user_id,
    p_plan,
    p_asaas_subscription_id,
    p_renews_at,
    p_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan = CASE
      WHEN user_quotas.asaas_subscription_id IS NOT NULL
        AND EXCLUDED.asaas_subscription_id IS NULL
      THEN user_quotas.plan
      ELSE EXCLUDED.plan
    END,
    asaas_subscription_id = COALESCE(EXCLUDED.asaas_subscription_id, user_quotas.asaas_subscription_id),
    renews_at = CASE
      WHEN EXCLUDED.asaas_subscription_id IS NULL THEN user_quotas.renews_at
      ELSE EXCLUDED.renews_at
    END,
    status = CASE
      WHEN EXCLUDED.asaas_subscription_id IS NULL THEN user_quotas.status
      ELSE EXCLUDED.status
    END,
    updated_at = NOW();

  INSERT INTO processed_events (
    id,
    event_id,
    event_fingerprint,
    event_type,
    event_payload,
    processed_at,
    created_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_event_fingerprint,
    p_event_fingerprint,
    p_event_type,
    p_event_payload,
    NOW(),
    NOW()
  );

  RETURN 'processed';
END;
$$;

CREATE OR REPLACE FUNCTION apply_billing_subscription_metadata_event(
  p_app_user_id TEXT,
  p_plan TEXT,
  p_checkout_reference TEXT DEFAULT NULL,
  p_asaas_subscription_id TEXT DEFAULT NULL,
  p_renews_at TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_event_fingerprint TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_event_payload JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_checkout_plan TEXT;
  v_user_plan TEXT;
BEGIN
  IF p_event_fingerprint IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'Billing event fingerprint and type are required.';
  END IF;

  IF p_checkout_reference IS NULL AND p_asaas_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Either checkout_reference or asaas_subscription_id must be provided.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_event_fingerprint));

  IF EXISTS (
    SELECT 1
    FROM processed_events
    WHERE event_fingerprint = p_event_fingerprint
  ) THEN
    RETURN 'duplicate';
  END IF;

  IF p_checkout_reference IS NOT NULL THEN
    SELECT plan
    INTO v_checkout_plan
    FROM billing_checkouts
    WHERE checkout_reference = p_checkout_reference
      AND user_id = p_app_user_id;

    IF v_checkout_plan IS NULL THEN
      RAISE EXCEPTION 'Checkout record not found: %', p_checkout_reference;
    END IF;

    IF v_checkout_plan <> p_plan THEN
      RAISE EXCEPTION 'Checkout mismatch for %: expected plan %, got %',
        p_checkout_reference, v_checkout_plan, p_plan;
    END IF;
  END IF;

  IF p_asaas_subscription_id IS NOT NULL THEN
    SELECT plan
    INTO v_user_plan
    FROM user_quotas
    WHERE asaas_subscription_id = p_asaas_subscription_id
      AND user_id = p_app_user_id;

    IF v_user_plan IS NULL THEN
      RAISE EXCEPTION 'User quota record not found for subscription %', p_asaas_subscription_id;
    END IF;

    IF v_user_plan <> p_plan THEN
      RAISE EXCEPTION 'Plan mismatch for subscription %: expected %, got %',
        p_asaas_subscription_id, v_user_plan, p_plan;
    END IF;
  END IF;

  INSERT INTO user_quotas (
    id,
    user_id,
    plan,
    asaas_subscription_id,
    renews_at,
    status,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_app_user_id,
    p_plan,
    p_asaas_subscription_id,
    p_renews_at,
    p_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan = EXCLUDED.plan,
    asaas_subscription_id = COALESCE(EXCLUDED.asaas_subscription_id, user_quotas.asaas_subscription_id),
    renews_at = EXCLUDED.renews_at,
    status = EXCLUDED.status,
    updated_at = NOW();

  INSERT INTO processed_events (
    id,
    event_id,
    event_fingerprint,
    event_type,
    event_payload,
    processed_at,
    created_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_event_fingerprint,
    p_event_fingerprint,
    p_event_type,
    p_event_payload,
    NOW(),
    NOW()
  );

  RETURN 'processed';
END;
$$;

GRANT EXECUTE ON FUNCTION apply_billing_credit_grant_event(
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION apply_billing_credit_grant_event(
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN
) TO service_role;

GRANT EXECUTE ON FUNCTION apply_billing_subscription_metadata_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION apply_billing_subscription_metadata_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;
