# Quick Task 260420-lnk Summary

## What changed

- Added an atomic Postgres RPC in [prisma/migrations/20260420_linkedin_import_request_limits.sql](/abs/path/C:/CurrIA/prisma/migrations/20260420_linkedin_import_request_limits.sql) to enforce LinkedIn import request limits per user under a transaction-scoped advisory lock.
- Enforced the business rule as:
  - `free`: 1 lifetime LinkedIn import request
  - `unit`, `monthly`, `pro`: 2 LinkedIn import requests per rolling hour
- Updated [src/lib/linkedin/import-jobs.ts](/abs/path/C:/CurrIA/src/lib/linkedin/import-jobs.ts) to create jobs through the limiting RPC and map DB limit rejections to a controlled `LinkedInImportLimitError`.
- Updated [src/app/api/profile/extract/route.ts](/abs/path/C:/CurrIA/src/app/api/profile/extract/route.ts) to return `429` with a user-facing message and `Retry-After` when the hourly paid limit is hit.
- Documented the new limits in [docs/linkedin-profile-feature.md](/abs/path/C:/CurrIA/docs/linkedin-profile-feature.md).

## Review and fix notes

- Initial app-only limit checks were replaced with DB-enforced gating after review because concurrent requests from the same user could otherwise overshoot the monetary limit.
- Route and job tests were updated to match the final control flow where the limit is enforced during job creation.

## Verification

- `npx vitest run src/lib/linkedin/import-limits.test.ts src/lib/linkedin/import-jobs.test.ts src/app/api/profile/extract/route.test.ts`
- `npm run typecheck`
- Result: all targeted tests passed and TypeScript compile passed.
