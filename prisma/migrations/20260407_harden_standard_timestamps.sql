ALTER TABLE public.users
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.user_auth_identities
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.credit_accounts
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.user_quotas
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.sessions
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.messages
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.api_usage
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.processed_events
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN processed_at SET DEFAULT NOW();

ALTER TABLE public.billing_checkouts
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.customer_billing_info
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.job_applications
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.cv_versions
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.resume_targets
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE OR REPLACE FUNCTION create_cv_version_record(
  p_session_id TEXT,
  p_snapshot JSONB,
  p_source public.cv_version_source,
  p_target_resume_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_session_id TEXT;
  v_created_version public.cv_versions%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found for CV version creation', p_session_id;
  END IF;

  IF p_target_resume_id IS NOT NULL THEN
    SELECT session_id
    INTO v_target_session_id
    FROM public.resume_targets
    WHERE id = p_target_resume_id;

    IF v_target_session_id IS NULL THEN
      RAISE EXCEPTION 'Resume target % not found for CV version creation', p_target_resume_id;
    END IF;

    IF v_target_session_id <> p_session_id THEN
      RAISE EXCEPTION 'Resume target % does not belong to session %', p_target_resume_id, p_session_id;
    END IF;
  END IF;

  INSERT INTO public.cv_versions (
    id,
    session_id,
    target_resume_id,
    snapshot,
    source,
    created_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_session_id,
    p_target_resume_id,
    p_snapshot,
    p_source,
    NOW()
  )
  RETURNING *
  INTO v_created_version;

  RETURN jsonb_build_object(
    'id', v_created_version.id,
    'session_id', v_created_version.session_id,
    'target_resume_id', v_created_version.target_resume_id,
    'snapshot', v_created_version.snapshot,
    'source', v_created_version.source,
    'created_at', v_created_version.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_resume_target_with_version(
  p_session_id TEXT,
  p_user_id TEXT,
  p_target_job_description TEXT,
  p_derived_cv_state JSONB,
  p_gap_analysis JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target public.resume_targets%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.sessions
  WHERE
    id = p_session_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found for user %', p_session_id, p_user_id;
  END IF;

  INSERT INTO public.resume_targets (
    id,
    session_id,
    target_job_description,
    derived_cv_state,
    gap_analysis,
    generated_output,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_session_id,
    p_target_job_description,
    p_derived_cv_state,
    p_gap_analysis,
    NULL,
    NOW(),
    NOW()
  )
  RETURNING *
  INTO v_target;

  PERFORM 1
  FROM create_cv_version_record(
    p_session_id,
    p_derived_cv_state,
    'target-derived',
    v_target.id
  );

  RETURN jsonb_build_object(
    'id', v_target.id,
    'session_id', v_target.session_id,
    'target_job_description', v_target.target_job_description,
    'derived_cv_state', v_target.derived_cv_state,
    'gap_analysis', v_target.gap_analysis,
    'generated_output', v_target.generated_output,
    'created_at', v_target.created_at,
    'updated_at', v_target.updated_at
  );
END;
$$;
