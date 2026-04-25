# Phase 104: warn-before-job-target-generation-when-vacancy-match-is-weak - Research

**Researched:** 2026-04-25  
**Domain:** weak-fit confirmation UX over the existing chat-driven job-targeting flow  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Preserve the current chat-driven job-targeting flow and reuse the existing weak-fit logic instead of inventing a new scoring model.
- Prefer a small UI enhancement plus minimal route/typing exposure over broader agent-loop rewrites.
- Keep the backend realism-warning semantics as the fallback safety net.
- The modal should appear only when the user is about to generate a job-targeted resume and the stored fit state indicates a weak or override-required scenario.
- "Continuar mesmo assim" should let the user proceed from the modal with a single explicit confirmation action.

### Claude's Discretion
None provided in `104-CONTEXT.md`. [VERIFIED: codebase grep]

### Deferred Ideas (OUT OF SCOPE)
- No new scoring model or vacancy-fit heuristic.
- No redesign of the broader chat interface or resume workspace.
- No migration or persistence redesign.
- No removal of the existing backend realism-warning guard.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: CLAUDE.md]
- Treat PDF profile upload and other onboarding expansion work as deferred unless reprioritized. [VERIFIED: CLAUDE.md]
- Follow surrounding file style; newer frontend files often use double quotes while backend and service modules often use single quotes. [VERIFIED: CLAUDE.md]
- Use `@/*` imports, kebab-case filenames, camelCase functions, and named exports except where Next.js expects default exports. [VERIFIED: CLAUDE.md]
- Keep route handlers thin, validate external input with `zod`, and prefer structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only; preserve dispatcher and `ToolPatch` patterns when changing agent flows. [VERIFIED: CLAUDE.md]
- The app is a monolith with `src/app/**` as HTTP/page adapters and `src/lib/**` as domain logic; prefer small, test-backed changes over broad rewrites. [VERIFIED: CLAUDE.md]

## Summary

CurrIA already has the weak-fit decision and fallback enforcement on the server: `profile-review.ts` decides when a career-fit warning is required, `agent-loop.ts` persists warning/override markers in `agentState.phaseMeta`, and targeted generation is still blocked until the realism flow is satisfied. [VERIFIED: codebase grep]

The chat UI does not currently consume any weak-fit-specific state. `chat-interface.tsx` shows the `Aceito` CTA from `phase` plus ATS readiness, while the session snapshot route serializes `targetFitAssessment` and `gapAnalysis` but drops `phaseMeta`, so the client cannot tell whether override is still required for the current stored target. [VERIFIED: codebase grep]

**Primary recommendation:** expose one server-derived weak-fit confirmation checkpoint through the existing session workspace snapshot, gate the `Aceito` CTA with the existing `AlertDialog` wrapper, and add one explicit modal continue intent that confirms override and continues generation in one turn while leaving the current textual backend warning intact as fallback safety. [VERIFIED: codebase grep] [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | repo `14.2.3`; npm latest `16.2.4` (modified 2026-04-18) | Keep using the existing App Router session snapshot route and dashboard wiring. | Phase 104 should reuse the existing route surface instead of adding a parallel endpoint or transport. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| `react` | repo `18.3.1`; npm latest `19.2.5` (modified 2026-04-24) | Hold local modal open state and CTA gating inside the existing client chat component. | `ChatInterface` is already a client component with local phase/readiness state, so the modal belongs in the same interaction seam. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| `@radix-ui/react-alert-dialog` via `src/components/ui/alert-dialog.tsx` | repo `1.1.15`; npm latest `1.1.15` (modified 2025-12-24) | Accessible confirmation modal with built-in focus trap, cancel/action semantics, and keyboard behavior. | Radix documents `AlertDialog` as a modal that interrupts the user and expects a response, which matches this weak-fit confirmation exactly better than a generic `Dialog`. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: codebase grep] [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | repo `1.6.0`; npm latest `4.1.5` (modified 2026-04-23) | Existing unit/integration test runner for agent loop, route handlers, and chat UI. | Use for route, agent-loop, and UI regression coverage in this phase. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| `@testing-library/react` | repo `16.3.2`; npm latest `16.3.2` (modified 2026-01-19) | Existing DOM-level interaction testing for `ChatInterface` and workspace components. | Use for modal open/cancel/continue assertions and POST-prevention checks. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `AlertDialog` | `Dialog` | `Dialog` would work visually, but `AlertDialog` has the correct confirmation semantics for an interruptive decision point and already exposes `Cancel`/`Action` parts. [VERIFIED: codebase grep] [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog] |
| Session snapshot as canonical modal source | Patch-only client state | Patch-only control would miss reload/resume cases and would overload the persisted-patch stream with UI-only semantics. [VERIFIED: codebase grep] |

**Installation:**
```bash
# None. Reuse dependencies already present in package.json.
```

**Version verification:**  
- `next`: npm latest `16.2.4`, registry modified `2026-04-18T23:43:24.763Z`. Repo stays on `14.2.3` for this brownfield phase. [VERIFIED: npm registry] [VERIFIED: package.json]  
- `react`: npm latest `19.2.5`, registry modified `2026-04-24T16:35:06.177Z`. Repo stays on `18.3.1` for this brownfield phase. [VERIFIED: npm registry] [VERIFIED: package.json]  
- `@radix-ui/react-alert-dialog`: npm latest `1.1.15`, registry modified `2025-12-24T01:25:34.169Z`. Repo already uses that version. [VERIFIED: npm registry] [VERIFIED: package.json]  
- `vitest`: npm latest `4.1.5`, registry modified `2026-04-23T10:30:15.171Z`. Repo stays on `1.6.0` for this phase. [VERIFIED: npm registry] [VERIFIED: package.json]  
- `@testing-library/react`: npm latest `16.3.2`, registry modified `2026-01-19T10:59:08.691Z`. Repo already uses that version. [VERIFIED: npm registry] [VERIFIED: package.json]

## Architecture Patterns

### Recommended Project Structure
```text
src/
|-- lib/agent/profile-review.ts               # derive server-side weak-fit checkpoint from existing helpers
|-- app/api/session/[id]/route.ts             # expose the checkpoint in the session snapshot
|-- components/dashboard/resume-workspace.tsx # pass snapshot-derived checkpoint into chat
`-- components/dashboard/chat-interface.tsx   # gate "Aceito" with AlertDialog and explicit continue action
```

### Pattern 1: Server-Derived Confirmation Checkpoint
**What:** Derive one compact UI contract from the existing server realism helpers instead of teaching the client to recompute weak fit from raw fields. [VERIFIED: codebase grep]  
**When to use:** Any time the client needs to know whether generation for the current stored target job should be blocked behind a weak-fit confirmation. [VERIFIED: codebase grep]  
**Recommendation:** Reuse the existing `CareerFitCheckpoint` type in `src/types/agent.ts` as the snapshot-facing contract, or add an equivalently narrow derived object; do not expose raw `phaseMeta` alone as the long-term UI API. [VERIFIED: codebase grep]

**Example:**
```typescript
// Source pattern: src/app/api/session/[id]/route.ts + src/lib/agent/profile-review.ts
const careerFitCheckpoint = buildCareerFitCheckpoint(session)

return NextResponse.json({
  session: {
    ...existingSessionPayload,
    agentState: {
      ...existingAgentStatePayload,
      careerFitCheckpoint,
    },
  },
})
```

### Pattern 2: Snapshot-Canonical, Not Patch-Only
**What:** Drive the modal from the existing session workspace snapshot, not from streaming patch deltas alone. [VERIFIED: codebase grep]  
**When to use:** Initial page load, reload/resume, session switching, and post-turn state reconciliation. [VERIFIED: codebase grep]  
**Why:** `ResumeWorkspace` already owns `/api/session/[id]` on mount and after completed turns, while `ChatInterface` currently only consumes `/messages` on mount and a thin local snapshot on `done`; a patch-only design would create a second non-canonical state channel for the same guard. [VERIFIED: codebase grep]

**Example:**
```tsx
// Source pattern: src/components/dashboard/resume-workspace.tsx
<ChatInterface
  sessionId={sessionId}
  weakFitCheckpoint={workspace?.session.agentState.careerFitCheckpoint}
  onAgentTurnCompleted={(payload) => {
    setSessionId(payload.sessionId)
    void refreshWorkspace(payload.sessionId)
  }}
/>
```

### Pattern 3: Single Explicit Modal Continue Action
**What:** The modal action should send one explicit continue intent that the server interprets as "confirm override and continue generation now." [VERIFIED: codebase grep]  
**When to use:** Only when the current stored target is weak and the server-derived checkpoint is pending. [VERIFIED: codebase grep]  
**Recommendation:** Add an intent such as `Continuar mesmo assim` in `agent-intents.ts`, then handle it in `agent-loop.ts` by confirming the override and immediately entering the existing generation path. Do not auto-chain two hidden client messages like `"Entendo, mas quero continuar"` then `"Aceito"`. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid
- **Client-side weak-fit recomputation:** Rebuilding the warning condition in React from `targetFitAssessment` or `gapAnalysis` would miss the existing family/seniority mismatch logic inside `requiresCareerFitWarning(...)`. [VERIFIED: codebase grep]
- **Patch-only modal control:** `createPatchChunk(...)` currently mirrors persisted patches; forcing derived UI-only confirmation state into that seam increases coupling and breaks reload safety. [VERIFIED: codebase grep]
- **Two-request client choreography:** Sending one override message and then auto-sending `Aceito` from the browser is more fragile than one explicit server-recognized continue action and creates a noisier transcript. [VERIFIED: codebase grep]
- **Removing the transcript fallback:** Direct `/api/agent` calls must still hit the existing warning guard when the modal is bypassed or stale. [VERIFIED: codebase grep]

## Likely Files To Change

- `src/lib/agent/profile-review.ts` - add a derived `buildCareerFitCheckpoint(...)` helper next to the existing weak-fit helpers. [VERIFIED: codebase grep]
- `src/app/api/session/[id]/route.ts` and `src/app/api/session/[id]/route.test.ts` - serialize and test the snapshot-facing checkpoint. [VERIFIED: codebase grep]
- `src/types/dashboard.ts` - add the checkpoint to the session workspace contract used by the dashboard client. [VERIFIED: codebase grep]
- `src/components/dashboard/resume-workspace.tsx` and `src/components/dashboard/resume-workspace.test.tsx` - pass the checkpoint into chat instead of making chat become a second snapshot owner. [VERIFIED: codebase grep]
- `src/components/dashboard/chat-interface.tsx`, `src/components/dashboard/chat-interface.test.tsx`, and `src/components/dashboard/chat-interface.route-stream.test.tsx` - add modal state, CTA interception, cancel/continue behavior, and transcript-safe assertions. [VERIFIED: codebase grep]
- `src/lib/agent/agent-intents.ts`, `src/lib/agent/agent-loop.ts`, and `src/lib/agent/streaming-loop.test.ts` - recognize the explicit modal continue action and keep the current warning fallback intact. [VERIFIED: codebase grep]

## Testing Blast Radius

- **UI unit blast radius:** `chat-interface.test.tsx` will need new cases for "weak fit opens modal instead of POST", cancel leaves transcript untouched, and continue sends the new explicit action. [VERIFIED: codebase grep]
- **Route serialization blast radius:** `route.test.ts` will need coverage for the new checkpoint field on both weak-fit and cleared/confirmed states. [VERIFIED: codebase grep]
- **Agent behavior blast radius:** `streaming-loop.test.ts` already covers warning issuance, blocked `Aceito`, and override confirmation, so it is the correct seam for the new combined continue intent. [VERIFIED: codebase grep]
- **Real route/browserless integration blast radius:** `chat-interface.route-stream.test.tsx` should cover the real `/api/agent` path so the modal continue flow stays aligned with the route stream and message transcript. [VERIFIED: codebase grep]
- **Parent wiring blast radius:** `resume-workspace.test.tsx` will need mock-prop updates if `ChatInterface` receives a new checkpoint prop. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation modal semantics | Custom portal, overlay, focus trap, escape handling, and action/cancel buttons | Existing `AlertDialog` wrapper in `src/components/ui/alert-dialog.tsx` | Radix already ships the correct confirmation semantics, focus management, screen-reader labeling, and controlled open-state support. [VERIFIED: codebase grep] [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog] |
| Weak-fit decision logic | New client thresholds or a new vacancy-match score | Existing server helpers in `profile-review.ts` plus current `targetFitAssessment` / `gapAnalysis` data | The existing server logic already covers weak gap analysis plus role-family and seniority mismatches. [VERIFIED: codebase grep] |
| Continue flow choreography | Hidden dual-message client automation | One explicit continue intent handled in `agent-loop.ts` | One server-recognized intent is easier to test, keeps transcript behavior deterministic, and still preserves the fallback warning path for bypassed clients. [VERIFIED: codebase grep] |

**Key insight:** keep the weak-fit modal as a UX layer over an existing server guard, not as a new decision engine. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Exposing Raw `phaseMeta` Without A Derived UI Contract
**What goes wrong:** The client receives timestamps and target-job strings but still has to reverse-engineer whether confirmation is pending. [VERIFIED: codebase grep]  
**Why it happens:** `phaseMeta` is persistence-oriented state, not a stable UI contract. [VERIFIED: codebase grep]  
**How to avoid:** Expose a narrow derived checkpoint such as `careerFitCheckpoint` from the session snapshot route. [VERIFIED: codebase grep]  
**Warning signs:** Multiple client helpers start comparing `careerFitWarningTargetJobDescription`, `careerFitOverrideConfirmedAt`, and `targetJobDescription` manually. [VERIFIED: codebase grep]

### Pitfall 2: Letting The Modal Depend On Stream Patches
**What goes wrong:** Reloaded sessions, restored tabs, or workspace-driven refreshes lose the modal state because no patch is replayed. [VERIFIED: codebase grep]  
**Why it happens:** Patches are transient stream events; the durable source of truth is the session snapshot route. [VERIFIED: codebase grep]  
**How to avoid:** Make the snapshot canonical, and only use streaming completion updates as an optimization if needed. [VERIFIED: codebase grep]  
**Warning signs:** The modal works immediately after a turn but disappears after refresh even though the server still requires override. [VERIFIED: codebase grep]

### Pitfall 3: Shipping A "Continue" Button That Still Needs Manual `Aceito`
**What goes wrong:** The user clicks `Continuar mesmo assim`, receives another assistant acknowledgement, and then still has to click `Aceito` separately. [VERIFIED: codebase grep]  
**Why it happens:** The current backend treats explicit override confirmation and generation approval as separate messages. [VERIFIED: codebase grep]  
**How to avoid:** Add one explicit continue intent that confirms override and immediately continues generation in the same turn. [VERIFIED: codebase grep]  
**Warning signs:** Tests pass for override persistence but the transcript still needs a second user action before `generate_file` runs. [VERIFIED: codebase grep]

### Pitfall 4: Over-Gating Non-Targeted Flows
**What goes wrong:** The modal appears for ATS enhancement or sessions with no stored target vacancy. [VERIFIED: codebase grep]  
**Why it happens:** The gating condition ignores the existing "current target job present" requirement. [VERIFIED: codebase grep]  
**How to avoid:** Only surface the checkpoint when a stored target job exists and the server says confirmation is required for that target. [VERIFIED: codebase grep]  
**Warning signs:** `Aceito` is blocked in sessions that are not doing job targeting. [VERIFIED: codebase grep]

## Code Examples

Verified patterns from official and repo sources:

### Accessible Confirmation Modal
```tsx
// Source: src/components/ui/alert-dialog.tsx
// Source: https://www.radix-ui.com/primitives/docs/components/alert-dialog
<AlertDialog open={weakFitModalOpen} onOpenChange={setWeakFitModalOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Essa vaga parece fraca para o seu perfil atual</AlertDialogTitle>
      <AlertDialogDescription>{checkpoint.summary}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={() => void handleWeakFitContinue()}>
        Continuar mesmo assim
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Snapshot-Owned Chat Gating
```tsx
// Source pattern: src/components/dashboard/resume-workspace.tsx
const weakFitCheckpoint = workspace?.session.agentState.careerFitCheckpoint

<ChatInterface
  sessionId={sessionId}
  weakFitCheckpoint={weakFitCheckpoint}
  onAgentTurnCompleted={(payload) => {
    setSessionId(payload.sessionId)
    void refreshWorkspace(payload.sessionId)
  }}
/>
```

### Single Explicit Continue Intent
```typescript
// Source pattern: src/lib/agent/agent-intents.ts + src/lib/agent/agent-loop.ts
if (isWeakFitContinueRequest(userMessage) && hasPendingCareerFitOverride(session)) {
  await confirmCareerFitOverride(session)
  return yield* handleConfirmedGeneration({ session, requestId, signal })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Transcript-only weak-fit warning followed by a manual override phrase and then a later `Aceito`. [VERIFIED: codebase grep] | Server-derived checkpoint in chat plus a real confirmation modal, while keeping the transcript warning as backend fallback. [VERIFIED: codebase grep] [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog] | Planned in Phase 104 on 2026-04-25. [VERIFIED: codebase grep] | Removes the confusing extra manual round-trip without weakening server protection. [VERIFIED: codebase grep] |

**Deprecated/outdated:**
- Patch-only modal state ownership. [VERIFIED: codebase grep]
- Client-side weak-fit heuristics that duplicate `profile-review.ts`. [VERIFIED: codebase grep]
- Two hidden browser-sent messages to simulate one explicit user choice. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Extending `AgentDoneChunk` for the checkpoint is probably unnecessary if `ResumeWorkspace` snapshot refresh lands fast enough after completed turns. [ASSUMED] | Open Questions | Low - the fallback guard still protects correctness, but UX could briefly race before snapshot refresh. |

## Open Questions

1. **Should the derived checkpoint also be added to `AgentDoneChunk`?**
   - What we know: `ResumeWorkspace` already refreshes the full session snapshot on `onAgentTurnCompleted`, and `ChatInterface` does not currently own the canonical workspace snapshot. [VERIFIED: codebase grep]
   - What's unclear: whether QA will see a real click-race between `done` and the refreshed workspace prop on slow networks. [ASSUMED]
   - Recommendation: plan snapshot-first, and only extend `AgentDoneChunk` if manual QA demonstrates that the race is real. [VERIFIED: codebase grep]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` repo `1.6.0` + `@testing-library/react` repo `16.3.2`. [VERIFIED: package.json] |
| Config file | `vitest.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | `npx vitest run src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/lib/agent/streaming-loop.test.ts src/app/api/session/[id]/route.test.ts src/components/dashboard/resume-workspace.test.tsx` [VERIFIED: package.json] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P104-UI | Weak-fit generate click opens the modal instead of POSTing immediately. [VERIFIED: codebase grep] | unit | `npx vitest run src/components/dashboard/chat-interface.test.tsx` [VERIFIED: package.json] | YES |
| P104-SNAPSHOT | Session snapshot exposes the derived weak-fit checkpoint to the dashboard client. [VERIFIED: codebase grep] | route | `npx vitest run src/app/api/session/[id]/route.test.ts` [VERIFIED: package.json] | YES |
| P104-FALLBACK | Direct `Aceito` or generate requests still hit the existing server realism warning when confirmation was not explicitly granted. [VERIFIED: codebase grep] | unit/integration | `npx vitest run src/lib/agent/streaming-loop.test.ts` [VERIFIED: package.json] | YES |
| P104-CONTINUE | Modal continue performs one explicit action and reaches the protected generation path. [VERIFIED: codebase grep] | integration | `npx vitest run src/components/dashboard/chat-interface.route-stream.test.tsx src/lib/agent/streaming-loop.test.ts` [VERIFIED: package.json] | YES |
| P104-WORKSPACE | Workspace passes snapshot state into chat without breaking existing session refresh behavior. [VERIFIED: codebase grep] | unit | `npx vitest run src/components/dashboard/resume-workspace.test.tsx` [VERIFIED: package.json] | YES |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/dashboard/chat-interface.test.tsx src/lib/agent/streaming-loop.test.ts src/app/api/session/[id]/route.test.ts` [VERIFIED: package.json]
- **Per wave merge:** `npx vitest run src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/lib/agent/streaming-loop.test.ts src/app/api/session/[id]/route.test.ts src/components/dashboard/resume-workspace.test.tsx` [VERIFIED: package.json]
- **Phase gate:** `npm test` before `/gsd-verify-work`. [VERIFIED: package.json]

### Wave 0 Gaps
- [ ] `src/components/dashboard/chat-interface.test.tsx` - add modal open/cancel/continue coverage. [VERIFIED: codebase grep]
- [ ] `src/components/dashboard/chat-interface.route-stream.test.tsx` - add real-route continue coverage. [VERIFIED: codebase grep]
- [ ] `src/app/api/session/[id]/route.test.ts` - add checkpoint serialization coverage. [VERIFIED: codebase grep]
- [ ] `src/components/dashboard/resume-workspace.test.tsx` - update the `ChatInterface` mock if a checkpoint prop is added. [VERIFIED: codebase grep]
- [ ] `src/lib/agent/streaming-loop.test.ts` - add the combined explicit continue-intent regression. [VERIFIED: codebase grep]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Keep `getCurrentAppUser()` and AI chat access checks on `/api/session/[id]` and `/api/agent`; the modal must not become a client-only gate. [VERIFIED: codebase grep] |
| V3 Session Management | no | This phase does not change Clerk/session token mechanics. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Preserve `getSession(params.id, appUser.id)` ownership checks on the snapshot route. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Reuse the existing string-message body validation on `/api/agent`; if a new explicit continue phrase is used, it should still flow through the current validated message field rather than a new unvalidated payload flag. [VERIFIED: codebase grep] |
| V6 Cryptography | no | No new crypto requirements are introduced in this phase. [VERIFIED: codebase grep] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypass of the modal by POSTing directly to `/api/agent` | Tampering | Keep the existing server-side weak-fit warning and override checks in `agent-loop.ts` as the final gate. [VERIFIED: codebase grep] |
| IDOR against `/api/session/[id]` | Information Disclosure | Preserve authenticated ownership checks before returning the checkpoint or any session data. [VERIFIED: codebase grep] |
| Unsafe modal copy rendering | XSS | Render server-derived checkpoint strings as plain React text; do not introduce `dangerouslySetInnerHTML`. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)
- `src/lib/agent/profile-review.ts` - existing weak-fit detection, override helpers, and warning text. [VERIFIED: codebase grep]
- `src/lib/agent/agent-loop.ts` - current generation gating, warning issuance, and override flow. [VERIFIED: codebase grep]
- `src/components/dashboard/chat-interface.tsx` - current `Aceito` CTA logic and local stream handling. [VERIFIED: codebase grep]
- `src/components/dashboard/resume-workspace.tsx` - canonical dashboard snapshot owner on mount and completed turns. [VERIFIED: codebase grep]
- `src/app/api/session/[id]/route.ts` - current session snapshot serialization behavior. [VERIFIED: codebase grep]
- `src/types/agent.ts` and `src/types/dashboard.ts` - current type seams plus the unused `CareerFitCheckpoint` type. [VERIFIED: codebase grep]
- https://www.radix-ui.com/primitives/docs/components/alert-dialog - confirmation-dialog semantics and controlled-open behavior. [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog]
- npm registry checks for `next`, `react`, `@radix-ui/react-alert-dialog`, `vitest`, and `@testing-library/react`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- https://nextjs.org/docs/app/api-reference/file-conventions/route - current App Router route-handler conventions; useful only as background because the concrete route shape is already verified in-code. [CITED: https://nextjs.org/docs/app/api-reference/file-conventions/route]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all recommended libraries already exist in the repo and registry versions were checked directly. [VERIFIED: package.json] [VERIFIED: npm registry]
- Architecture: HIGH - the relevant server/client seams, missing snapshot field, and current override behavior are all directly evidenced in the code and tests. [VERIFIED: codebase grep]
- Pitfalls: HIGH - each pitfall is grounded in the current chat, route, and agent-loop contracts. [VERIFIED: codebase grep]

**Research date:** 2026-04-25  
**Valid until:** 2026-05-25
