# Fix 13 pre-existing test failures across 4 test suites

## Summary

13 tests are failing across 4 test suites. These failures predate the import-jobs lease/reclaim work and are unrelated to it.

The `schema-guardrails.test.ts` failure was already fixed by classifying `linkedin_import_jobs` and `user_profiles` in `TABLE_CONVENTIONS`.

## Failing suites

### `src/app/api/webhook/asaas/route.test.ts` (8 failures)

All 8 webhook route tests fail with `TypeError: Failed to parse URL from /pipeline` — the Upstash Redis rate limiter tries to make a real HTTP call in the jsdom test environment. The webhook route now applies `webhookLimiter` after token verification, and the test mock doesn't cover it.

**Fix:** Mock `webhookLimiter` (or the Upstash Redis module) in the webhook route test setup.

### `src/app/api/cron/cleanup/route.test.ts` (3 failures)

Tests don't account for the LinkedIn import job cleanup step added alongside the webhook event cleanup. The mock setup only covers the RPC call, not the `cleanupOldImportJobs` import.

**Fix:** Mock `@/lib/linkedin/import-jobs` in the cron cleanup test and verify both cleanup paths.

### `src/lib/db/sessions.test.ts` (1 failure)

`persists stateVersion = 1 for new sessions` fails because `seedCvStateFromProfile()` queries `user_profiles`, which isn't in the Supabase mock's `from()` handler.

**Fix:** Add `user_profiles` table handling to the mock Supabase `from()` in the sessions test.

### `src/app/api/agent/route.test.ts` (1 failure)

`persists a pasted job description into agentState before the agent loop starts` — related to `persistDetectedTargetJobDescription` being moved inside the SSE stream for new sessions.

**Fix:** Update the test expectation to match the new call timing.

## Context

These failures were observed during the import-jobs lease/reclaim work but are caused by earlier changes (webhook rate limiting, profile seeding, cron cleanup expansion, agent route SSE restructuring, DB schema additions). They were intentionally not bundled with the lease/reclaim commit to keep that slice focused.
