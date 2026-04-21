# 61-01 Summary

- Confirmed the `ResumeGeneration.updatedAt` Prisma field uses `@updatedAt` and the base table migration already defines `updated_at` as `NOT NULL DEFAULT now()`.
- Updated `createPendingResumeGeneration(...)` to write `updated_at` explicitly during direct Supabase inserts instead of depending only on the DB default.
- Added a focused regression proving the create insert payload includes `updated_at` while preserving existing duplicate-idempotency reuse behavior.
- Validation passed with `npm run typecheck` and `npx vitest run "src/lib/db/resume-generations.test.ts"`.
