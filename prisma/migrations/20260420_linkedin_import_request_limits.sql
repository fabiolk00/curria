CREATE INDEX IF NOT EXISTS idx_linkedin_import_jobs_user_created_at
  ON public.linkedin_import_jobs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_linkedin_import_job(
  p_user_id TEXT,
  p_linkedin_url TEXT
)
RETURNS TABLE (id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_job_id TEXT;
  v_total_requests INTEGER;
  v_recent_requests INTEGER;
  v_oldest_recent_request TIMESTAMPTZ;
  v_retry_after_seconds INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('linkedin_import:' || p_user_id, 0));

  SELECT plan
  INTO v_plan
  FROM public.user_quotas
  WHERE user_id = p_user_id;

  v_plan := COALESCE(v_plan, 'free');

  IF v_plan = 'free' THEN
    SELECT COUNT(*)
    INTO v_total_requests
    FROM public.linkedin_import_jobs
    WHERE user_id = p_user_id;

    IF v_total_requests >= 1 THEN
      RAISE EXCEPTION 'FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_REACHED';
    END IF;
  ELSE
    SELECT COUNT(*), MIN(created_at)
    INTO v_recent_requests, v_oldest_recent_request
    FROM public.linkedin_import_jobs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '1 hour';

    IF v_recent_requests >= 2 THEN
      v_retry_after_seconds := GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM ((v_oldest_recent_request + INTERVAL '1 hour') - NOW())))::INTEGER
      );

      RAISE EXCEPTION 'PAID_LINKEDIN_IMPORT_RATE_LIMIT_REACHED'
        USING DETAIL = v_retry_after_seconds::TEXT;
    END IF;
  END IF;

  INSERT INTO public.linkedin_import_jobs (
    id,
    user_id,
    linkedin_url,
    status,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_user_id,
    p_linkedin_url,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING linkedin_import_jobs.id INTO v_job_id;

  RETURN QUERY SELECT v_job_id;
END;
$$;
