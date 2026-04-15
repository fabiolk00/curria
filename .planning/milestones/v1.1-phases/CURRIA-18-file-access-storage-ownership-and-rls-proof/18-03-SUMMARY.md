# 18-03 Summary

Published the final storage and RLS proof layer for the repo.

Added `docs/operations/storage-and-rls-proof.md`, which separates:

- what the repo proves for route ownership and transient signed URLs
- what the repo does not prove because it depends on Supabase Storage policy or RLS outside the repository
- how service-role access should be interpreted during future reviews

Also aligned `docs/operations/security-boundary-audit.md` and `docs/developer-rules/API_CONVENTIONS.md` so future contributors do not conflate signed URL delivery, admin-client access, and authorization.

Verification:

- `rg -n "What the repo proves|What the repo does not prove|RLS|signed URL|service-role" docs/operations/storage-and-rls-proof.md docs/operations/security-boundary-audit.md docs/operations/secret-boundaries-and-e2e-auth.md`
- `rg -n "/api/file/\\[sessionId\\]|signed URLs are a delivery mechanism|RLS|authorization" docs/developer-rules/API_CONVENTIONS.md docs/operations/security-boundary-audit.md`
