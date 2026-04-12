---
title: CurrIA Testing Rules
audience: [developers]
related: [README.md, CODE_STYLE.md, ERROR_HANDLING.md]
status: current
updated: 2026-04-12
---

# Testing Rules

Back to [Developer Rules](./README.md) | [All Docs](../INDEX.md)

## Framework
- Unit and integration tests: Vitest
- Component tests: React Testing Library
- Browser tests: Playwright (`npm run test:e2e -- --project=chromium`)

## What must be tested when touched

### Agent tools
- success path
- invalid or failure path
- patch shape
- merge behavior for unrelated state

### Session state and dispatcher
- partial patch merge behavior
- persistence through `applyToolPatch()`
- in-memory session snapshot updates
- state-version normalization when relevant

### Billing and webhooks
- credit consumption and quota checks
- duplicate webhook delivery behavior
- failure retry behavior
- no double-credit regressions
- session creation and chat paths staying free
- idempotent resume-generation retries returning `creditsUsed: 0`
- unpaid or failed generations not exposing downloadable artifact URLs

### File generation
- reads canonical `cvState`
- persists only artifact metadata
- does not persist signed URLs
- bills only for successful AI-generated resume outcomes, not manual edits or plain export retries

### Browser funnel coverage
- guest access to protected dashboard routes redirects to `/login`
- manual profile setup saves canonical `cvState` fields and returns to `/dashboard`
- the dashboard funnel covers session creation, streamed agent completion, target outcome, preview readiness, and at least one successful artifact download
- browser assertions should prefer stable `data-testid` and `data-*` state hooks over marketing copy or timing-only expectations

## Current high-value coverage
- `src/lib/ats/score.test.ts`
- `src/lib/db/sessions.test.ts`
- `src/lib/db/cv-versions.test.ts`
- `src/lib/agent/tools/index.test.ts`
- `src/lib/agent/tools/rewrite-section.test.ts`
- `src/lib/agent/tools/generate-file.test.ts`
- `src/lib/agent/tools/gap-analysis.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `src/lib/resume-targets/create-target-resume.test.ts`
- `src/app/api/webhook/asaas/route.test.ts`
- `src/app/api/session/[id]/targets/route.test.ts`

## Additional Coverage Requirements
- CV version creation on trusted canonical state changes
- Gap analysis validation success and failure
- Target-derived resume isolation from base `cvState`
- Multiple targets coexisting for one session
- Ownership checks on session history and target routes

## Mocking rules
- Mock `@anthropic-ai/sdk` at the module level.
- Mock Supabase Storage and Supabase admin clients.
- Do not make real network or storage calls in tests.
- Prefer co-located tests near the code they validate.
- Playwright specs must use the shared `tests/e2e/fixtures/api-mocks.ts` helpers instead of live Clerk, Supabase, OpenAI, Asaas, or storage providers.
- Browser auth must go through the committed `POST /api/e2e/auth` seam guarded by `E2E_AUTH_ENABLED` and `E2E_AUTH_BYPASS_SECRET`.
- Keep the browser lane staging-safe: use deterministic mocked SSE payloads and same-origin test assets rather than live provider credentials.

## Naming
Use concrete behavioral names:

```ts
describe('rewriteSection', () => {
  it('updates only the targeted canonical cvState field', () => { ... })
  it('rejects malformed model output before persistence', () => { ... })
})
```

## CI expectation
Changes should pass:
- `npm run typecheck`
- `npm run audit:db-conventions`
- `npm test`
- `npm run test:e2e -- --project=chromium`
- `npm run lint`

## Schema Guardrails

Database-related changes must keep the automated schema guardrails green.

What they check:
- every created table is intentionally classified in `src/lib/db/schema-guardrails.ts`
- generic text primary keys keep a UUID default by the end of the migration chain
- mutable tables keep `created_at` and `updated_at` defaults by the end of the migration chain
- SQL functions that insert into managed tables include explicit `id` and timestamp columns

This guardrail runs in:
- `npm run audit:db-conventions`
- CI on every push and pull request
