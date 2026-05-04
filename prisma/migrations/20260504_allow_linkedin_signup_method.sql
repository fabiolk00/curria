ALTER TABLE public.user_auth_identities
  DROP CONSTRAINT IF EXISTS user_auth_identities_signup_method_check;

ALTER TABLE public.user_auth_identities
  ADD CONSTRAINT user_auth_identities_signup_method_check
  CHECK (signup_method IN ('email', 'google', 'linkedin', 'unknown'));

COMMENT ON COLUMN public.user_auth_identities.signup_method IS
  'Initial authentication method inferred from Clerk user.created external account metadata. Allowed values: email, google, linkedin, unknown.';
