# 12-02 Summary

Decoupled large PDF imports from the synchronous upload request by adding:

- shared PDF import orchestration in `src/lib/profile/pdf-import.ts`
- persisted PDF import jobs in `src/lib/profile/pdf-import-jobs.ts`
- async status polling route in `src/app/api/profile/upload/status/[jobId]/route.ts`
- dual-path upload behavior in `src/app/api/profile/upload/route.ts`
- staged modal polling UX in `src/components/resume/resume-builder.tsx`

Added persistence support:

- `pdf_import_jobs` Prisma model in `prisma/schema.prisma`
- migration `prisma/migrations/20260414_async_pdf_import_jobs.sql`

Verification:

- `pnpm vitest run src/app/api/profile/upload/route.test.ts src/app/api/profile/upload/status/[jobId]/route.test.ts src/components/resume/resume-builder.test.tsx`
- `pnpm tsc --noEmit`
