# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Vitest 1.6.0
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest `expect`
- `@testing-library/jest-dom` for DOM assertions in `vitest.setup.ts`

**Run Commands:**
```bash
npm test                     # Run all tests once
npm run test:watch          # Interactive watch mode
npx vitest run --coverage   # Coverage view is not fully wired in package scripts today
```

## Test File Organization

**Location:**
- Tests are co-located with the code they validate across `src/app/**`, `src/components/**`, `src/hooks/**`, and `src/lib/**`.

**Naming:**
- `*.test.ts` for service/domain modules
- `*.test.tsx` for components, hooks, and page/layout tests

**Structure:**
```text
src/lib/db/sessions.ts
src/lib/db/sessions.test.ts
src/app/api/checkout/route.ts
src/app/api/checkout/route.test.ts
src/components/auth/login-form.tsx
src/components/auth/login-form.test.tsx
```

Current repo shape:
- About 254 source files under `src/`
- About 73 committed test files under `src/`

## Test Structure

**Suite Organization:**
```ts
describe('manualEditSection', () => {
  it('updates only the intended canonical section', async () => {
    const result = await manualEditSection({
      section: 'skills',
      value: ['TypeScript', 'PostgreSQL'],
    })

    expect(result.output.success).toBe(true)
  })
})
```

**Patterns:**
- Use `beforeEach()` to clear mocks and restore default env/runtime assumptions.
- Use builder helpers like `buildSession()` or `baseCvState` inside the test file rather than a global fixture package.
- Assert route responses directly with `NextRequest` and JSON decoding in API tests.

## Mocking

**Framework:** Vitest `vi`

**Patterns:**
```ts
const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}))

vi.mock('@/lib/asaas/client', () => ({
  asaas: { post: mockPost },
}))
```

**What to Mock:**
- External providers and SDKs: Clerk, OpenAI, Asaas, Supabase admin/storage, Upstash
- Browser-only APIs in tests, for example `ResizeObserver` in `vitest.setup.ts`
- Streaming helpers, as in `src/lib/agent/__tests__/mock-openai-stream.ts`

**What NOT to Mock:**
- Pure merge/state helpers like `mergeToolPatch()` in `src/lib/db/sessions.ts`
- Simple serialization/normalization logic when unit tests can exercise the real implementation cheaply

## Fixtures and Factories

**Test Data:**
```ts
function buildSession(): Session {
  return {
    id: 'sess_123',
    phase: 'dialog',
    cvState: { ... },
    agentState: { parseStatus: 'parsed', rewriteHistory: {} },
    generatedOutput: { status: 'idle' },
  }
}
```

**Location:**
- Usually inline inside the test file, for example `src/lib/db/sessions.test.ts` and `src/lib/agent/streaming-loop.test.ts`
- Shared stream fixtures live in `src/lib/agent/__tests__/mock-openai-stream.ts`

## Coverage

**Requirements:** No numeric coverage threshold is enforced today.

**View Coverage:**
```bash
npx vitest run --coverage
```

If coverage reporting is needed in CI, add the provider explicitly before relying on this command.

## Test Types

**Unit Tests:**
- Core business logic, patch merging, schema guards, parsers, and generators under `src/lib/**`

**Integration Tests:**
- Route handlers and dispatcher behavior, such as `src/app/api/checkout/route.test.ts`, `src/app/api/agent/route.test.ts`, and `src/lib/agent/tools/index.test.ts`

**E2E Tests:**
- Not detected. No Playwright or Cypress setup is committed.

## Common Patterns

**Async Testing:**
```ts
const events = []
for await (const event of runAgentLoop({ ...params })) {
  events.push(event)
}
expect(events.at(-1)).toMatchObject({ type: 'done' })
```

**Error Testing:**
```ts
await expect(applyToolPatchWithVersion(session, patch, 'rewrite'))
  .rejects.toThrow('Failed to apply tool patch transactionally')
```

**UI Testing:**
- Use `render`, `screen`, `userEvent`, `waitFor`, and `renderHook` from Testing Library, as seen in `src/components/auth/login-form.test.tsx` and `src/hooks/use-session-cv-state.test.tsx`.

**CI Expectation:**
- `.github/workflows/ci.yml` runs `npm run typecheck`, `npm run audit:db-conventions`, `npm run lint`, and `npm test`.

---

*Testing analysis: 2026-04-09*
