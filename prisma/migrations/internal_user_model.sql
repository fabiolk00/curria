CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  display_name TEXT NULL,
  primary_email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_auth_identities_provider_subject_key
  ON user_auth_identities(provider, provider_subject);

CREATE INDEX IF NOT EXISTS user_auth_identities_user_id_idx
  ON user_auth_identities(user_id);

CREATE TABLE IF NOT EXISTS credit_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_accounts_user_id_idx
  ON credit_accounts(user_id);

CREATE TEMP TABLE source_user_ids AS
SELECT DISTINCT source_user_id
FROM (
  SELECT user_id AS source_user_id FROM user_quotas
  UNION
  SELECT user_id AS source_user_id FROM sessions
  UNION
  SELECT user_id AS source_user_id FROM api_usage
) AS source_users
WHERE source_user_id IS NOT NULL
  AND source_user_id <> '';

CREATE TEMP TABLE existing_legacy_user_mappings AS
SELECT DISTINCT
  source.source_user_id AS legacy_user_id,
  identity.user_id AS app_user_id
FROM source_user_ids AS source
JOIN user_auth_identities AS identity
  ON identity.provider = 'clerk'
 AND identity.provider_subject = source.source_user_id;

CREATE TEMP TABLE new_legacy_user_mappings AS
SELECT
  source.source_user_id AS legacy_user_id,
  'usr_' || encode(digest('clerk:' || source.source_user_id, 'sha256'), 'hex') AS app_user_id
FROM source_user_ids AS source
LEFT JOIN existing_legacy_user_mappings AS existing_mapping
  ON existing_mapping.legacy_user_id = source.source_user_id
LEFT JOIN users AS existing_user
  ON existing_user.id = source.source_user_id
WHERE existing_mapping.legacy_user_id IS NULL
  AND existing_user.id IS NULL;

CREATE TEMP TABLE legacy_user_mappings AS
SELECT legacy_user_id, app_user_id
FROM existing_legacy_user_mappings
UNION
SELECT legacy_user_id, app_user_id
FROM new_legacy_user_mappings;

INSERT INTO users (id, status, created_at, updated_at)
SELECT
  app_user_id,
  'active',
  NOW(),
  NOW()
FROM new_legacy_user_mappings
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_auth_identities (
  id,
  user_id,
  provider,
  provider_subject,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::TEXT,
  app_user_id,
  'clerk',
  legacy_user_id,
  NOW(),
  NOW()
FROM legacy_user_mappings
ON CONFLICT (provider, provider_subject) DO NOTHING;

UPDATE sessions AS session
SET user_id = mapping.app_user_id
FROM legacy_user_mappings AS mapping
WHERE session.user_id = mapping.legacy_user_id;

UPDATE user_quotas AS app_quota
SET
  plan = CASE
    WHEN app_quota.plan = 'free' AND legacy_quota.plan <> 'free' THEN legacy_quota.plan
    ELSE app_quota.plan
  END,
  credits_remaining = GREATEST(app_quota.credits_remaining, legacy_quota.credits_remaining),
  asaas_customer_id = COALESCE(app_quota.asaas_customer_id, legacy_quota.asaas_customer_id),
  asaas_subscription_id = COALESCE(app_quota.asaas_subscription_id, legacy_quota.asaas_subscription_id),
  renews_at = COALESCE(app_quota.renews_at, legacy_quota.renews_at),
  updated_at = NOW()
FROM user_quotas AS legacy_quota
JOIN legacy_user_mappings AS mapping
  ON mapping.legacy_user_id = legacy_quota.user_id
WHERE app_quota.user_id = mapping.app_user_id
  AND legacy_quota.user_id <> mapping.app_user_id;

DELETE FROM user_quotas AS legacy_quota
USING legacy_user_mappings AS mapping
JOIN user_quotas AS app_quota
  ON app_quota.user_id = mapping.app_user_id
WHERE legacy_quota.user_id = mapping.legacy_user_id
  AND legacy_quota.user_id <> mapping.app_user_id;

UPDATE user_quotas AS quota
SET user_id = mapping.app_user_id
FROM legacy_user_mappings AS mapping
LEFT JOIN user_quotas AS app_quota
  ON app_quota.user_id = mapping.app_user_id
WHERE quota.user_id = mapping.legacy_user_id
  AND quota.user_id <> mapping.app_user_id
  AND app_quota.user_id IS NULL;

UPDATE api_usage AS usage
SET user_id = mapping.app_user_id
FROM legacy_user_mappings AS mapping
WHERE usage.user_id = mapping.legacy_user_id;

INSERT INTO credit_accounts (
  id,
  user_id,
  credits_remaining,
  created_at,
  updated_at
)
SELECT
  'cred_' || mapping.app_user_id,
  mapping.app_user_id,
  COALESCE(quota.credits_remaining, 0),
  NOW(),
  NOW()
FROM legacy_user_mappings AS mapping
LEFT JOIN user_quotas AS quota
  ON quota.user_id = mapping.app_user_id
ON CONFLICT (user_id) DO NOTHING;

DROP TABLE legacy_user_mappings;
DROP TABLE new_legacy_user_mappings;
DROP TABLE existing_legacy_user_mappings;
DROP TABLE source_user_ids;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_user_id_fkey'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_quotas_user_id_fkey'
  ) THEN
    ALTER TABLE user_quotas
      ADD CONSTRAINT user_quotas_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_usage_user_id_fkey'
  ) THEN
    ALTER TABLE api_usage
      ADD CONSTRAINT api_usage_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

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
  ON CONFLICT (user_id) DO NOTHING;

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
  ON CONFLICT (user_id) DO NOTHING;

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
