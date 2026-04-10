# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Use kebab-case for most modules, for example `src/lib/agent/context-builder.ts`, `src/lib/asaas/event-handlers.ts`, and `src/components/dashboard/chat-interface.tsx`.
- Keep Next.js entry files on framework names: `src/app/(auth)/dashboard/page.tsx`, `src/app/api/agent/route.ts`, `src/app/(auth)/layout.tsx`.
- Keep tests co-located with `*.test.ts` or `*.test.tsx`, such as `src/lib/db/sessions.test.ts` and `src/components/auth/login-form.test.tsx`.

**Functions:**
- Use camelCase for helpers and exported functions: `getCurrentAppUser`, `createCheckoutLink`, `buildSystemPrompt`, `applyToolPatchWithVersion`.

**Variables:**
- Use camelCase for runtime state and local values: `appUser`, `requestId`, `targetJobDescription`, `availableCredits`.
- Use UPPER_SNAKE_CASE for constants that are effectively configuration: `AGENT_CONFIG`, `MODEL_CONFIG`, `LOCKED_TRACKER_MESSAGE`, `TOLERANCE_SECONDS`.

**Types:**
- Prefer PascalCase for types and schemas: `Session`, `ResumeTarget`, `ToolPatch`, `BodySchema`.
- The codebase generally prefers `type` aliases for domain shapes, with occasional `interface` usage for component props and local view models.

## Code Style

**Formatting:**
- No Prettier config is committed. Follow the surrounding file instead of reformatting unrelated code.
- Newer UI files such as `src/components/dashboard/chat-interface.tsx` and `src/components/resume/visual-resume-editor.tsx` use double quotes.
- Most backend/service files such as `src/lib/db/sessions.ts` and `src/app/api/checkout/route.ts` use single quotes.

**Linting:**
- ESLint uses `next/core-web-vitals` from `.eslintrc.json`.
- Type safety is stricter than linting: `tsconfig.json` enables `strict`, `noEmit`, and the `@/*` alias.

## Import Organization

**Order:**
1. Framework or package imports, such as `next/server`, `react`, `zod`, `openai`, or `vitest`
2. Internal `@/` imports
3. Type-only imports where useful, often grouped near related module imports

**Path Aliases:**
- Use `@/*` from `tsconfig.json` for app code.
- Do not import through raw `src/...` paths.

Example from the current style:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession } from '@/lib/db/sessions'
```

## Error Handling

**Patterns:**
- Validate external input with `safeParse()` before running business logic, as in `src/app/api/checkout/route.ts` and `src/app/api/session/[id]/manual-edit/route.ts`.
- Return structured tool failures with stable codes from `src/lib/agent/tool-errors.ts`.
- Preserve route-level JSON error shape: `{ error: ... }` or `{ success: false, code, error }`.

Example:

```ts
const body = BodySchema.safeParse(await req.json())
if (!body.success) {
  return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
}
```

## Logging

**Framework:** Structured JSON logging via `src/lib/observability/structured-log.ts`, with legacy `console.*` still present in some routes and components.

**Patterns:**
- Prefer `logInfo`, `logWarn`, and `logError` in server-side business logic such as `src/lib/agent/agent-loop.ts` and `src/lib/asaas/event-handlers.ts`.
- When touching older server modules that still use `console.error`, prefer migrating them toward the structured logger instead of introducing more ad-hoc logging.

## Comments

**When to Comment:**
- Use comments to explain invariants, security boundaries, retry behavior, or multi-step workflows.
- Good examples exist in `src/app/api/agent/route.ts`, `src/lib/asaas/quota.ts`, and `src/lib/linkedin/import-jobs.ts`.

**JSDoc/TSDoc:**
- Sparse. The codebase prefers plain inline comments and section banners over formal TSDoc.

## Function Design

**Size:** Keep route handlers thin where practical, then move orchestration into domain modules under `src/lib/**`.

**Parameters:** Pass explicit objects for multi-field operations, for example `createTargetResumeVariant({ sessionId, userId, baseCvState, targetJobDescription })` in `src/lib/resume-targets/create-target-resume.ts`.

**Return Values:** Prefer typed result objects over tuples; routes and tools frequently return discriminated success/failure payloads.

## Module Design

**Exports:** Prefer named exports for helpers and service modules. Default exports are mostly reserved for Next.js pages/layouts and some React components.

**Barrel Files:** Limited use. Keep modules discoverable through direct imports unless a dispatcher-style entry point adds value, as in `src/lib/agent/tools/index.ts`.

**State Boundaries:**
- Treat `cvState` as canonical resume truth.
- Treat `agentState` as operational context only.
- Persist tool-originated mutations through `ToolPatch` and the dispatcher instead of mutating session state directly.

---

*Convention analysis: 2026-04-09*
