---
phase: 01-contract-alignment-and-fail-fast-guards
plan: "02"
subsystem: infra
tags: [env, webhooks, redis, upstash, clerk, openai, asaas, supabase, vitest]
requires:
  - phase: 01-01
    provides: Canonical provider env names and committed templates for the launch contract
provides:
  - Explicit fail-fast guards for OpenAI, Asaas, Supabase, and Clerk webhook configuration
  - Lazy Redis-backed limiter initialization that keeps tests import-safe
  - Regression coverage for missing launch-critical env paths and optional LinkdAPI behavior
affects: [phase-1-plan-03, webhooks, rate-limiting, staging-validation]
tech-stack:
  added: []
  patterns:
    - Per-module required-env guards with consistent error wording
    - Lazy construction for Redis-backed clients and rate limiters
key-files:
  created:
    - src/lib/asaas/client.test.ts
    - src/lib/rate-limit.test.ts
    - src/lib/db/supabase-admin.test.ts
    - src/app/api/webhook/clerk/route.test.ts
  modified:
    - src/lib/openai/client.ts
    - src/lib/asaas/client.ts
    - src/lib/rate-limit.ts
    - src/lib/db/supabase-admin.ts
    - src/app/api/webhook/asaas/route.ts
    - src/app/api/webhook/clerk/route.ts
    - src/lib/openai/client.test.ts
    - src/app/api/webhook/asaas/route.test.ts
    - src/lib/linkedin/linkdapi.test.ts
key-decisions:
  - "Use local required-env helpers inside the touched modules instead of introducing a shared config subsystem in Phase 1."
  - "Validate Redis and webhook secrets lazily so tests can import the modules safely while runtime paths still fail with exact env names."
patterns-established:
  - "Launch-critical provider code throws Missing required environment variable <NAME> for <component> when a guarded path is invoked."
  - "Optional integrations like LinkdAPI remain import-safe and only fail on the feature path that actually needs them."
requirements-completed: [OPS-01, OPS-02]
duration: 10 min
completed: 2026-04-10
---

# Phase 1 Plan 2: Fail-Fast Provider Contract Summary

**Launch-critical provider paths now reject missing configuration explicitly, and the regression suite locks that behavior in.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-10T03:23:54Z
- **Completed:** 2026-04-10T03:33:56Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Removed the OpenAI fallback key, replaced non-null env assertions with explicit guards, and required a dedicated Asaas webhook token.
- Moved Redis-backed limiter and Clerk webhook setup behind lazy accessors so modules stay import-safe while runtime calls still fail fast.
- Added focused Vitest coverage for missing OpenAI, Asaas, Supabase, Upstash, Clerk, and LinkdAPI contract edges.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace permissive provider fallbacks with explicit non-test guards** - `c99e1b8` (`fix`)
2. **Task 2: Add focused Vitest coverage for the hardened contract** - `702f031` (`test`)

## Files Created/Modified

- `src/lib/openai/client.ts` - OpenAI client now requires `OPENAI_API_KEY` explicitly.
- `src/lib/asaas/client.ts` - Asaas requests now require `ASAAS_ACCESS_TOKEN` before any fetch call.
- `src/lib/rate-limit.ts` - Upstash Redis and limiter instances now initialize lazily with actionable errors.
- `src/lib/db/supabase-admin.ts` - Supabase admin client now reports the exact missing env name.
- `src/app/api/webhook/asaas/route.ts` - Asaas webhook auth now requires `ASAAS_WEBHOOK_TOKEN` and returns a structured config error when absent.
- `src/app/api/webhook/clerk/route.ts` - Clerk webhook path now validates Redis and `CLERK_WEBHOOK_SECRET` lazily.
- `src/lib/openai/client.test.ts` - Added missing-key regression for OpenAI.
- `src/lib/asaas/client.test.ts` - Added missing-token regression for Asaas client calls.
- `src/lib/rate-limit.test.ts` - Added lazy-import and missing-Upstash-env regressions.
- `src/lib/db/supabase-admin.test.ts` - Added exact missing-env regressions for Supabase admin.
- `src/app/api/webhook/asaas/route.test.ts` - Added missing webhook-token route coverage.
- `src/app/api/webhook/clerk/route.test.ts` - Added missing-config and duplicate-delivery coverage for Clerk webhook handling.
- `src/lib/linkedin/linkdapi.test.ts` - Added regression that LinkdAPI remains optional until fetch execution.

## Decisions Made

- Keep the Phase 1 hardening local to the touched modules instead of introducing a shared env validation layer.
- Treat dedicated webhook secrets as first-class requirements rather than falling back to broader API credentials.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The new rate-limit tests initially modeled missing-env failures as rejected promises, but the implementation throws synchronously before the async limiter call is created. The tests were adjusted to match the real control flow without changing runtime behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `01-03`, with the live runtime contract and fail-fast behavior now concrete enough to document precisely.
- Staging and production docs can now reference exact webhook and Redis requirements without hedging around silent fallbacks.

---
*Phase: 01-contract-alignment-and-fail-fast-guards*
*Completed: 2026-04-10*
