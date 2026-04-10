# Phase 2 Research: Core Funnel Browser Verification

**Date:** 2026-04-10
**Phase:** 02-core-funnel-browser-verification

## Goal

Add reliable browser-level verification for CurrIA's highest-value funnel without depending on live Clerk, Supabase, OpenAI, Asaas, or storage behavior in CI.

## Evidence Collected

### No committed browser test stack exists yet

- `package.json` has Vitest and Testing Library scripts only.
- `vitest.config.ts` configures `jsdom` for unit and component coverage.
- `docs/developer-rules/TESTING.md` explicitly says no Playwright setup is committed today.
- `npm ls @playwright/test` returns empty, so Playwright is not installed as a direct dependency.

This is the clearest current gap against `QA-01`, `QA-02`, and `QA-03`.

### The protected funnel is real and already spans profile, chat, targets, and downloads

- `/dashboard/resumes/new` renders `src/components/resume/user-data-page.tsx`, which loads and saves the canonical profile through `GET` and `PUT /api/profile`.
- `/dashboard` renders `src/components/dashboard/resume-workspace.tsx`, which coordinates:
  - session bootstrap and refresh via `GET /api/session/[id]`
  - chat history via `GET /api/session/[id]/messages`
  - agent turns via `POST /api/agent`
  - artifact generation via `POST /api/session/[id]/generate`
  - artifact retrieval via `GET /api/file/[sessionId]`
- `src/app/api/session/[id]/targets/route.ts` confirms target resumes are a real persisted capability even though the UI exposes little explicit target chrome today.

### Auth is the main browser-planning constraint

- `src/middleware.ts` protects all authenticated UI routes through Clerk middleware.
- `src/app/(auth)/layout.tsx` redirects to `/login` when `getCurrentAppUser()` returns null.
- `src/lib/auth/app-user.ts` resolves the app user from Clerk server auth plus Supabase RPCs.

This means browser tests cannot simply route-mock frontend fetches; the app first needs a way to enter protected pages without live Clerk.

### The rest of the funnel is mock-friendly at the browser layer

Once the page is loaded, the critical client flows are already driven through fetch-based APIs:

- profile load/save in `user-data-page.tsx`
- workspace refresh and generation in `resume-workspace.tsx`
- chat streaming and session creation in `chat-interface.tsx`
- artifact preview and download in `session-documents-panel.tsx` and `preview-panel.tsx`

That makes Playwright route mocking practical for the high-risk APIs:

- `/api/profile`
- `/api/session/[id]`
- `/api/session/[id]/messages`
- `/api/agent` as `text/event-stream`
- `/api/file/[sessionId]`

### Current UI state is only partially observable for browser assertions

- There are useful roles and text labels such as `Salvar`, `Nova Conversa`, `Resume.docx`, and the chat placeholder.
- Some core outcomes are not cleanly exposed for stable browser assertions:
  - target resume creation mostly lives in session payloads instead of explicit UI affordances
  - workspace phase, target count, and generated-output readiness are not surfaced as stable selectors

Phase 2 should add minimal, non-UX-changing test hooks so browser specs can assert live workspace state instead of brittle copy.

### CI has no browser lane yet

`.github/workflows/ci.yml` currently runs:

- `npm run typecheck`
- `npm run audit:db-conventions`
- `npm run lint`
- `npm test`

There is no browser install step, no app startup, and no critical-path browser verification command.

## Recommended Test Architecture

### 1. Add Playwright directly and keep Chromium as the required CI proof

Phase 2 should install `@playwright/test`, commit `playwright.config.ts`, and add one repo command such as `npm run test:e2e`.

Use Chromium as the required proof path in CI. More browsers can be added later, but Phase 2 should optimize for reliable launch gating rather than breadth.

### 2. Introduce a tightly gated E2E auth seam instead of relying on live Clerk

The safest practical approach for this repo is a minimal test-only bypass:

- enable only when an explicit env flag such as `E2E_AUTH_ENABLED=true` is present
- require a secret such as `E2E_AUTH_BYPASS_SECRET`
- use a signed cookie issued by a test-only bootstrap route
- teach `src/middleware.ts` and `src/lib/auth/app-user.ts` to trust that cookie only in E2E mode
- leave normal Clerk behavior untouched in every other environment

This keeps protected pages reachable in browser tests while avoiding fragile dependence on Clerk network behavior in CI.

### 3. Mock launch-critical APIs in Playwright instead of standing up live providers

For Phase 2, browser tests should verify the user journey, not external provider correctness. The browser suite should therefore route-mock:

- profile load and save
- session snapshot refresh
- message history
- agent SSE output, including `sessionCreated`, streamed text, and `done`
- artifact URL resolution
- downloadable asset URLs

This keeps CI deterministic and aligns directly with `QA-03`.

### 4. Add small test hooks where the current UI hides important state

Targeted `data-testid` or `data-state-*` markers should be added to:

- profile save surface
- workspace root metadata
- generated-output readiness surface
- preview/download controls

The hooks should reflect real component state, not fixture-only branches.

### 5. Keep live billing and provider validation out of this phase

Asaas settlement behavior belongs to Phase 3, and observability hardening belongs to Phase 4. Phase 2 should stay focused on browser confidence for:

- auth boundary
- profile setup or edit
- session creation
- agent interaction
- target creation outcome
- artifact delivery

## Recommended Plan Split

### Wave 1

- `02-01`: Install Playwright, add reusable E2E fixtures, and create the gated auth seam.

This is the prerequisite for every other browser plan.

### Wave 2

- `02-02`: Add stable browser assertions and implement the launch-critical journey specs.

This depends on Wave 1 because the specs need both the auth seam and the shared mock helpers.

### Wave 3

- `02-03`: Wire the browser suite into CI and contributor docs.

This depends on both earlier plans so CI and docs can point at the actual committed commands, env flags, and spec files.

## Risks and Constraints

- A careless auth bypass would be a real security risk. The seam must be disabled by default, secret-gated, and impossible to activate accidentally in production.
- Browser route mocking can drift from route contracts. The mock helpers should mirror the real response shapes returned by `src/app/api/profile/route.ts`, `src/app/api/session/[id]/route.ts`, `src/app/api/agent/route.ts`, and `src/app/api/file/[sessionId]/route.ts`.
- The target resume capability is real in backend payloads but not strongly surfaced in the current UI. Browser coverage should add stable assertions for target state rather than redesigning the product surface.
- The profile flow should cover manual editing, not LinkdAPI import. LinkedIn import remains optional and provider-backed, so it is the wrong dependency for a reliable CI gate.
- Because no dedicated `02-CONTEXT.md` exists, this plan is intentionally anchored to roadmap scope, requirements, and code evidence only.

## Validation Architecture

### Automated proof

1. Playwright Chromium suite:
   - guest redirect plus authenticated entry
   - manual profile setup or edit
   - new-session chat turn through mocked SSE
   - target resume outcome assertion
   - artifact preview or download assertion
2. Targeted Vitest coverage for the E2E auth seam and any touched component selectors.
3. `npm run typecheck` before every wave-complete judgment.
4. CI integration that installs Chromium, starts the app, and runs the browser suite with mocked providers.

### Manual or external proof

1. One human smoke pass in staging should confirm that real Clerk sign-in still reaches the authenticated workspace after the test-only seam is added.
2. One human smoke pass in staging should confirm that a real generated artifact still previews or downloads correctly once a valid session exists.

These stay manual because Phase 2 intentionally avoids live-provider behavior in CI.

### Success signal for Phase 2

Phase 2 can be considered complete only when all of the following are true:

- protected pages can be entered in browser tests without live Clerk
- the browser suite covers profile setup, session creation, agent interaction, target outcome, and artifact delivery
- the suite is deterministic under mocked providers
- CI runs the browser suite and fails clearly when the funnel regresses
