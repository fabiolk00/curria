CREATE OR REPLACE FUNCTION get_or_create_app_user(
  p_provider TEXT,
  p_provider_subject TEXT
)
RETURNS TABLE (
  user_id TEXT,
  user_status TEXT,
  user_created_at TIMESTAMPTZ,
  user_updated_at TIMESTAMPTZ,
  identity_id TEXT,
  identity_provider TEXT,
  identity_provider_subject TEXT,
  credit_account_id TEXT,
  credit_account_credits_remaining INTEGER,
  credit_account_created_at TIMESTAMPTZ,
  credit_account_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  candidate_user_id TEXT;
  resolved_user_id TEXT;
BEGIN
  candidate_user_id := 'usr_' || encode(
    digest(p_provider || ':' || p_provider_subject, 'sha256'),
    'hex'
  );

  SELECT identity.user_id
  INTO resolved_user_id
  FROM user_auth_identities AS identity
  WHERE identity.provider = p_provider
    AND identity.provider_subject = p_provider_subject
  LIMIT 1;

  IF resolved_user_id IS NULL THEN
    INSERT INTO users (
      id,
      status,
      created_at,
      updated_at
    )
    VALUES (
      candidate_user_id,
      'active',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_auth_identities (
      id,
      user_id,
      provider,
      provider_subject,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid()::TEXT,
      candidate_user_id,
      p_provider,
      p_provider_subject,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_subject) DO NOTHING;

    SELECT identity.user_id
    INTO resolved_user_id
    FROM user_auth_identities AS identity
    WHERE identity.provider = p_provider
      AND identity.provider_subject = p_provider_subject
    LIMIT 1;
  END IF;

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve app user for provider % and subject %.',
      p_provider,
      p_provider_subject;
  END IF;

  INSERT INTO credit_accounts (
    id,
    user_id,
    credits_remaining,
    created_at,
    updated_at
  )
  VALUES (
    'cred_' || resolved_user_id,
    resolved_user_id,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT ON CONSTRAINT credit_accounts_user_id_key DO NOTHING;

  INSERT INTO user_quotas (
    id,
    user_id,
    plan,
    asaas_customer_id,
    asaas_subscription_id,
    renews_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    resolved_user_id,
    'free',
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT ON CONSTRAINT user_quotas_user_id_key DO NOTHING;

  RETURN QUERY
  SELECT
    user_record.id::TEXT,
    user_record.status::TEXT,
    user_record.created_at::TIMESTAMPTZ,
    user_record.updated_at::TIMESTAMPTZ,
    identity.id::TEXT,
    identity.provider::TEXT,
    identity.provider_subject::TEXT,
    account.id::TEXT,
    account.credits_remaining::INTEGER,
    account.created_at::TIMESTAMPTZ,
    account.updated_at::TIMESTAMPTZ
  FROM users AS user_record
  JOIN user_auth_identities AS identity
    ON identity.user_id = user_record.id
   AND identity.provider = p_provider
   AND identity.provider_subject = p_provider_subject
  JOIN credit_accounts AS account
    ON account.user_id = user_record.id
  WHERE user_record.id = resolved_user_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_app_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_app_user(TEXT, TEXT) TO service_role;
