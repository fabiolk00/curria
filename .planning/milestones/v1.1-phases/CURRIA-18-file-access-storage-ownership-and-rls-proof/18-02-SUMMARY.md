# 18-02 Summary

Audited the server-only storage seams and strengthened the proof around service-role and signed-URL helpers.

Added focused coverage that now proves:

- `getSupabaseAdminClient()` trims env values and caches the admin client instance
- signed URL creation can be exercised through an injected storage seam
- signed URL minting fails closed when storage cannot produce a URL

Aligned `docs/operations/secret-boundaries-and-e2e-auth.md` so the repo now says explicitly that the service-role seam is a capability seam, not an authorization proof, and that signed URLs are delivery-only.

Verification:

- `pnpm tsc --noEmit`
- `pnpm vitest run src/lib/db/supabase-admin.test.ts src/lib/agent/tools/generate-file.test.ts`
