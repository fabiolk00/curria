UPDATE user_quotas AS quota
SET credits_remaining = GREATEST(COALESCE(quota.credits_remaining, 0), account.credits_remaining)
FROM credit_accounts AS account
WHERE account.user_id = quota.user_id
  AND account.credits_remaining > COALESCE(quota.credits_remaining, 0);

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
  v_checkout_status TEXT;
  v_user_plan TEXT;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_event_fingerprint IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'Billing event fingerprint and type are required.';
  END IF;

  IF p_event_type NOT IN ('PAYMENT_SETTLED', 'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_RENEWED') THEN
    RAISE EXCEPTION 'Unsupported billing credit event type: %', p_event_type;
  END IF;

  IF p_checkout_reference IS NULL AND p_asaas_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Either checkout_reference or asaas_subscription_id must be provided.';
  END IF;

  IF p_event_type IN ('PAYMENT_SETTLED', 'SUBSCRIPTION_STARTED') AND p_checkout_reference IS NULL THEN
    RAISE EXCEPTION 'checkout_reference is required for % events.', p_event_type;
  END IF;

  IF p_event_type IN ('SUBSCRIPTION_STARTED', 'SUBSCRIPTION_RENEWED')
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
    SELECT plan, amount_minor, status
    INTO v_checkout_plan, v_checkout_amount, v_checkout_status
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

    IF p_event_type IN ('PAYMENT_SETTLED', 'SUBSCRIPTION_STARTED')
      AND v_checkout_status <> 'created' THEN
      RAISE EXCEPTION 'Checkout % must be in created status for % events (got %).',
        p_checkout_reference, p_event_type, v_checkout_status;
    END IF;
  END IF;

  IF p_asaas_subscription_id IS NOT NULL THEN
    IF p_event_type = 'SUBSCRIPTION_RENEWED' THEN
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
    ELSIF p_event_type = 'SUBSCRIPTION_STARTED' THEN
      SELECT plan
      INTO v_user_plan
      FROM user_quotas
      WHERE asaas_subscription_id = p_asaas_subscription_id
        AND user_id = p_app_user_id;

      IF v_user_plan IS NOT NULL AND v_user_plan <> p_plan THEN
        RAISE EXCEPTION 'Plan mismatch for subscription %: expected %, got %',
          p_asaas_subscription_id, v_user_plan, p_plan;
      END IF;
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
    credits_remaining,
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
    v_new_balance,
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
    credits_remaining = EXCLUDED.credits_remaining,
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
