CREATE OR REPLACE FUNCTION update_resume_target_with_version(
  p_session_id TEXT,
  p_user_id TEXT,
  p_target_id TEXT,
  p_derived_cv_state JSONB
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

  UPDATE public.resume_targets
  SET
    derived_cv_state = p_derived_cv_state,
    updated_at = now()
  WHERE
    id = p_target_id
    AND session_id = p_session_id
  RETURNING *
  INTO v_target;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Resume target % not found for session %', p_target_id, p_session_id;
  END IF;

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
