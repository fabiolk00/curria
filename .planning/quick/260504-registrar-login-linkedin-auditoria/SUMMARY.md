# Summary

LinkedIn OAuth/OIDC signups are now classified as `linkedin` in the Clerk webhook and persisted to `user_auth_identities.signup_method` for internal audit.

## Files changed
- src/app/api/webhook/clerk/route.ts
- src/app/api/webhook/clerk/route.test.ts
- src/types/user.ts
- prisma/migrations/20260504_allow_linkedin_signup_method.sql

## Database
- Applied migration with `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260504_allow_linkedin_signup_method.sql`.

## Validation
- npx vitest run src/app/api/webhook/clerk/route.test.ts: passed
- npm run typecheck: passed
- npm run audit:copy-regression: passed
- npm run lint: passed
