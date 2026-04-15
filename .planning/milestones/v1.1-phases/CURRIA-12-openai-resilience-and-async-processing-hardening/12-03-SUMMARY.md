# 12-03 Summary

Closed the observability and regression loop for the new degraded paths by:

- documenting operator signals in `docs/operations/openai-resilience-and-pdf-import.md`
- extending cron cleanup to include PDF import jobs in `src/app/api/cron/cleanup/route.ts`
- adding focused regression coverage for cleanup, queued PDF states, completed and failed PDF outcomes, and breaker behavior

Verification:

- `pnpm vitest run src/app/api/cron/cleanup/route.test.ts src/lib/openai/chat.test.ts src/app/api/profile/upload/route.test.ts src/app/api/profile/upload/status/[jobId]/route.test.ts src/components/resume/resume-builder.test.tsx`
- `pnpm tsc --noEmit`
