# Phase 38: Refactor `/api/agent` into a lightweight orchestrator - Research

**Researched:** 2026-04-16
**Domain:** Brownfield request-boundary extraction, sync-vs-async execution routing, and durable-job dispatch handoff for the CurrIA agent route
**Confidence:** MEDIUM

<user_constraints>
## User Constraints

No phase-specific `38-CONTEXT.md` exists. Planning is therefore constrained by the locked milestone intent already recorded in `ROADMAP.md`, `REQUIREMENTS.md`, `AGENTS.md`, and `CLAUDE.md`. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `AGENTS.md`, `CLAUDE.md`]

### Locked Decisions

- Keep `/api/agent` as the public entry point; do not replace it with a new public route or change the main frontend entry surface. [VERIFIED: `.planning/ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`]
- Preserve lightweight chat as a synchronous streaming path with the current SSE UX shape and message ordering. [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`]
- Route heavy ATS enhancement, job targeting, and artifact generation work through explicit action classification and async dispatch instead of executing those flows inline in the request path. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `src/types/jobs.ts`]
- Preserve current session load-or-create behavior, target-job detection, and transcript persistence semantics while the route is being reduced to an orchestrator. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/app/api/agent/route.ts`, `src/lib/agent/agent-loop.ts`]
- Build on the frozen Phase 37 contracts instead of inventing new async lifecycle vocabulary or a second job model. [VERIFIED: `.planning/ROADMAP.md`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`]

### Claude's Discretion

- Exact module names for the extracted orchestrator and classification helpers, as long as they follow the repo's existing `src/lib/agent/*` style. [VERIFIED: `src/lib/agent`, `AGENTS.md`]
- Whether async acknowledgement stays text-only in Phase 38 or also emits a minimal server-side acceptance chunk, as long as the current client stream does not break and Phase 40 still owns richer status flow. [VERIFIED: `.planning/ROADMAP.md`, `src/components/dashboard/chat-interface.tsx`]
- How much of the current route timing and logging helpers live in the route wrapper versus the extracted orchestrator module, as long as structured logs and current HTTP or SSE behavior remain intact. [VERIFIED: `src/app/api/agent/route.ts`, `CLAUDE.md`]

### Deferred Ideas (OUT OF SCOPE)

- Worker execution logic for ATS enhancement, job targeting, and artifact generation; that belongs to Phase 39. [VERIFIED: `.planning/ROADMAP.md`]
- Full UI or polling status integration for durable jobs; that belongs to Phase 40. [VERIFIED: `.planning/ROADMAP.md`]
- New billing, entitlement, or resume-business-rule changes; this milestone changes execution model, not business semantics. [VERIFIED: `.planning/REQUIREMENTS.md`, `AGENTS.md`, `CLAUDE.md`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-01 | User can keep using `/api/agent` as the main entry point, with lightweight chat responses still streaming synchronously while heavy actions are acknowledged and dispatched asynchronously. | The route must stay public and SSE-based, while heavy branches now found in `runPreLoopSetup(...)` and confirmed-generation logic are classified and handed off through Phase 37 durable jobs instead of running inline. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`] |
| ORCH-02 | Session load or create, message persistence, action classification, and execution-mode routing remain behaviorally consistent after `/api/agent` is reduced to a lightweight orchestrator. | Session resolution, target detection, and timing live in the route today, while user-message persistence still begins inside `runAgentLoop(...)`; Phase 38 must extract those seams without losing transcript ordering or target/session continuity. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/app/api/agent/route.ts`, `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use internal app user IDs after the auth boundary; new orchestrator or dispatch code must keep session and job ownership scoped by app user ID, not Clerk subject IDs. [VERIFIED: `CLAUDE.md`, `src/lib/auth/app-user.ts`, `src/lib/jobs/repository.ts`]
- Keep route handlers thin, validate external input with `zod`, and use structured logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/app/api/agent/route.ts`]
- Treat `cvState` as canonical truth and `agentState` as operational context only; async handoff must point at source-of-truth refs, not create a second canonical state path in the route. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/lib/jobs/source-of-truth.ts`, `src/types/agent.ts`]
- Preserve dispatcher and `ToolPatch` patterns when agent flows change; the Phase 38 route refactor should reroute heavy execution, not reintroduce direct session mutation from route code. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/lib/agent/tools/index.ts`, `src/lib/db/session-lifecycle.ts`]
- Prefer small, test-backed changes over broad rewrites because the repo already has large orchestration modules. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/app/api/agent/route.ts`, `src/lib/agent/agent-loop.ts`]
- Preserve the brownfield product surface unless the user explicitly changes scope; planning should isolate the request boundary and async handoff without redesigning the chat UX. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `.planning/ROADMAP.md`]

## Summary

Phase 38 is not starting from an empty async design. Phase 37 already froze the shared `AgentActionType`, `ExecutionMode`, `JobType`, `JobStatusSnapshot`, durable dispatch payload shape, source-of-truth helpers, and generic `jobs` repository, but nothing in the current `/api/agent` path uses those contracts yet. The planning job is therefore to wire the existing route and agent code to the Phase 37 foundation without reopening the contract or changing the public route surface. [VERIFIED: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`]

The current route still owns too many responsibilities. `src/app/api/agent/route.ts` is 743 lines long and currently performs auth, rate limiting, Zod body validation, message preparation, session load-or-create, target-job detection, pre-loop side effects, SSE framing, and `runAgentLoop(...)` invocation in one file. Meanwhile `runPreLoopSetup(...)` still executes ATS enhancement and job-targeting pipelines inline, and `runAgentLoop(...)` still performs confirmed artifact generation inline after appending the user turn. Those are the exact seams Phase 38 has to separate. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

The most important non-obvious planning detail is transcript persistence. Today user-message persistence happens at the top of `runAgentLoop(...)`, not in the route. Any async-heavy branch that acknowledges and short-circuits before entering `runAgentLoop(...)` must therefore append the user turn and assistant acknowledgement itself, or the session transcript and message counts will drift away from what the user saw in chat. [VERIFIED: `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`, `.planning/REQUIREMENTS.md`]

**Primary recommendation:** keep `POST /api/agent` as a thin wrapper over an extracted orchestrator module, introduce one explicit action-classification plus async-dispatch layer that uses Phase 37 contracts, persist turns outside `runAgentLoop(...)` for async acknowledgements, and remove inline `runAtsEnhancementPipeline(...)`, `runJobTargetingPipeline(...)`, and confirmed-generation `generate_file` work from the request path while leaving actual worker execution to Phase 39. [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.3 | App Router route handlers and the existing `/api/agent` SSE boundary | Phase 38 must preserve the App Router route surface already in use, and Next.js 14 Route Handlers support Web `Request` and `Response` APIs for the current request shell. [VERIFIED: `npm ls next --depth=0`, `src/app/api/agent/route.ts`; CITED: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers] |
| OpenAI JS SDK | 6.34.0 | Existing synchronous chat streaming path used by the current agent runtime | The route must keep the current chat stream path intact while only heavy branches move to async dispatch. [VERIFIED: `npm ls openai --depth=0`, `src/lib/openai/chat.ts`, `src/lib/agent/agent-loop.ts`] |
| CurrIA Phase 37 job contracts and repository | workspace local | Frozen async action, execution-mode, and durable job handoff foundation | Phase 38 should consume `resolveExecutionMode(...)`, `JobType`, `JobStatusSnapshot`, and `createJob(...)` rather than inventing a second async routing contract. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md`] |
| Zod | 3.25.76 | Request validation at the route boundary | The route already validates request bodies with `BodySchema`, and project rules require `zod` at external boundaries. [VERIFIED: `npm ls zod --depth=0`, `src/app/api/agent/route.ts`, `AGENTS.md`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.103.0 | Durable job persistence through the existing repo job repository | Use through `src/lib/jobs/repository.ts`; Phase 38 should not introduce Prisma Client or a second runtime DB path for job dispatch. [VERIFIED: `npm ls @supabase/supabase-js --depth=0`, `src/lib/jobs/repository.ts`] |
| Prisma CLI | 5.22.0 | Schema contract already frozen in Phase 37 | Use only as the existing schema authority; Phase 38 should not reopen the job table shape unless execution reveals a real blocker. [VERIFIED: `npx prisma --version`, `prisma/schema.prisma`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-SUMMARY.md`] |
| Vitest | 1.6.1 | Route, orchestrator, and classification regression coverage | The repo already uses Vitest for route and library tests, including the current `/api/agent` route suites. [VERIFIED: `npm ls vitest --depth=0`, `vitest.config.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Thin route plus extracted orchestrator module | Keep `route.ts` monolithic and only insert `createJob(...)` calls inline | That would preserve the current tangle of auth, session, stream framing, and heavy-routing logic in one file, which is exactly the maintenance risk this phase is supposed to remove. [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`] |
| Phase 37 `JobType` and `resolveExecutionMode(...)` | A new route-local async classification enum | That would immediately reopen the contract Phase 37 just froze and create drift before Phase 39 workers exist. [VERIFIED: `src/types/jobs.ts`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md`] |
| Async acknowledgement plus durable job creation | Keeping ATS, job-targeting, or artifact generation inline until Phase 39 lands | That contradicts ORCH-01 and leaves `/api/agent` as the execution surface for the exact heavy flows the milestone is trying to remove from the request path. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`] |

**Installation:**

```bash
# No new runtime packages are recommended for Phase 38.
# Reuse the current workspace stack and the Phase 37 durable-job foundation.
npm install
```

**Version verification:** Registry checks on 2026-04-16 confirm the workspace is behind some latest releases, but this phase should stay on the current brownfield stack rather than combine a route refactor with package upgrades. [VERIFIED: `npm ls next openai vitest prisma zod @supabase/supabase-js --depth=0`; VERIFIED: npm registry]

- `next`: workspace `14.2.3` published `2024-04-24T17:12:07.762Z`; registry latest `16.2.4` published `2026-04-15T22:33:47.905Z`. [VERIFIED: `npm ls next --depth=0`; VERIFIED: npm registry]
- `openai`: workspace `6.34.0` published `2026-04-08T21:26:58.901Z`; registry latest is also `6.34.0`. [VERIFIED: `npm ls openai --depth=0`; VERIFIED: npm registry]
- `prisma`: workspace CLI `5.22.0` published `2024-11-05T15:34:05.135Z`; registry latest `7.7.0` published `2026-04-07T15:56:13.017Z`. [VERIFIED: `npx prisma --version`; VERIFIED: npm registry]
- `vitest`: workspace `1.6.1` published `2025-02-03T13:36:34.725Z`; registry latest `4.1.4` published `2026-04-09T07:36:52.741Z`. [VERIFIED: `npm ls vitest --depth=0`; VERIFIED: npm registry]
- `@supabase/supabase-js`: workspace `2.103.0` published `2026-04-09T06:57:22.849Z`; registry latest `2.103.3` published `2026-04-16T13:37:44.645Z`. [VERIFIED: `npm ls @supabase/supabase-js --depth=0`; VERIFIED: npm registry]
- `zod`: workspace `3.25.76` published `2025-07-08T09:10:18.684Z`; registry latest `4.3.6` published `2026-01-22T19:14:35.382Z`. [VERIFIED: `npm ls zod --depth=0`; VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure

```text
src/
|- app/api/agent/route.ts              # Thin POST wrapper only
|- lib/agent/request-orchestrator.ts   # Auth, session, timing, stream shell, sync-vs-async branch point
|- lib/agent/action-classification.ts  # Request/session -> AgentActionType/ExecutionMode decisions
|- lib/agent/async-dispatch.ts         # Durable job create/reuse + acknowledgement text
|- lib/agent/pre-loop-setup.ts         # Lightweight pre-loop preparation only
|- lib/agent/agent-loop.ts             # Sync chat loop only after heavy-path removal
`- lib/agent/agent-persistence.ts      # Shared user/assistant turn persistence helpers
```

This flat `src/lib/agent/*` layout matches the current repo style better than introducing a brand-new nested subsystem during a brownfield refactor. [VERIFIED: `src/lib/agent`, `AGENTS.md`]

### Pattern 1: Keep the route public, but move orchestration out of the file

**What:** Reduce `src/app/api/agent/route.ts` to a thin Next.js wrapper and move request timing, auth, rate limiting, body parsing, message preparation, session resolution, target detection, and stream branching into an extracted orchestrator module. [VERIFIED: `src/app/api/agent/route.ts`, `CLAUDE.md`, `.planning/ROADMAP.md`]

**When to use:** Immediately in Phase 38, because the current route file already mixes route-boundary work with execution decisions and stream lifecycle management. [VERIFIED: `src/app/api/agent/route.ts`]

**Example:**

```typescript
const stream = new ReadableStream({
  async start(controller) {
    // route-boundary stream shell
  },
})

return new Response(stream, { headers })
```

Pattern source: current `/api/agent` already uses a `ReadableStream`-backed SSE shell and Next.js 14 supports Route Handlers built on Web `Request` and `Response` primitives. [VERIFIED: `src/app/api/agent/route.ts`; CITED: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]

### Pattern 2: Classify heavy actions before entering the synchronous loop

**What:** Introduce one explicit classification layer that maps request plus session context into `chat`, `ats_enhancement`, `job_targeting`, or `artifact_generation`, then derives `sync` versus `async` using the Phase 37 contract. [VERIFIED: `src/types/jobs.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

**When to use:** At the route-orchestrator boundary, before deciding whether the request should enter `runAgentLoop(...)` or create or reuse a durable job and return an acknowledgement. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`]

**Example:**

```typescript
const executionMode = resolveExecutionMode(actionType)

if (executionMode === 'async') {
  // enqueue durable job
}
```

Pattern source: Phase 37 already froze `resolveExecutionMode(...)`; Phase 38 should consume it instead of re-deriving sync-versus-async logic ad hoc. [VERIFIED: `src/types/jobs.ts`]

### Pattern 3: Persist turns outside `runAgentLoop(...)` for async acknowledgements

**What:** Because `runAgentLoop(...)` currently appends the user turn before loading message history, any async-heavy short-circuit must explicitly append the user turn and acknowledgement text from the orchestrator layer or shared persistence helper. [VERIFIED: `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`]

**When to use:** For ATS enhancement, job targeting, and confirmed artifact-generation requests that now acknowledge and dispatch instead of entering the synchronous tool loop. [VERIFIED: `.planning/ROADMAP.md`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

**Example:**

```typescript
await appendUserTurn(session.id, userMessage)
await appendAssistantTurn(session.id, acknowledgementText)
```

Pattern source: the helper already exists; the refactor should reuse it rather than duplicate raw `appendMessage(...)` calls. [VERIFIED: `src/lib/agent/agent-persistence.ts`]

### Pattern 4: Keep target detection and session continuity ahead of async dispatch

**What:** Preserve current target-job detection, `analysis` phase advancement, and `agentState.targetJobDescription` updates before the sync-versus-async branch so both sync chat and async jobs inherit the same session truth. [VERIFIED: `src/app/api/agent/route.ts`]

**When to use:** On every request after session resolution and message preparation, before any durable job is created. [VERIFIED: `src/app/api/agent/route.ts`, `.planning/REQUIREMENTS.md`]

**Example:**

```typescript
const detection = detectTargetJobDescription(message)

await updateSession(session.id, {
  agentState: nextAgentState,
  phase: shouldAdvanceToAnalysis ? 'analysis' : undefined,
})
```

Pattern source: current route behavior. [VERIFIED: `src/app/api/agent/route.ts`]

### Anti-Patterns to Avoid

- **Leaving heavy work in `runPreLoopSetup(...)`:** If `runAtsEnhancementPipeline(...)` or `runJobTargetingPipeline(...)` stays there, the route is still doing heavy work inline even if the file gets shorter. [VERIFIED: `src/lib/agent/pre-loop-setup.ts`, `.planning/ROADMAP.md`]
- **Leaving confirmed generation in `runAgentLoop(...)`:** If `handleConfirmedGeneration(...)` still calls `create_target_resume` or `generate_file`, the biggest artifact path remains request-bound. [VERIFIED: `src/lib/agent/agent-loop.ts`, `.planning/ROADMAP.md`]
- **Bypassing transcript persistence on async branches:** If a heavy request never enters `runAgentLoop(...)`, the user turn will disappear from history unless the orchestrator appends it explicitly. [VERIFIED: `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`]
- **Inventing a second async status or dispatch contract:** Phase 37 already froze the vocabulary and repository shape; duplicating it in the route would create drift before Phase 39 starts. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`]
- **Moving worker semantics into this phase:** Phase 38 owns routing and handoff, not background execution business logic. [VERIFIED: `.planning/ROADMAP.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async execution classification | Route-local string checks scattered across `route.ts`, `pre-loop-setup.ts`, and `agent-loop.ts` | One extracted classification helper backed by `AgentActionType` and `resolveExecutionMode(...)` | The current code already duplicates heavy-path decisions across modules; this phase should centralize them once. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`, `src/types/jobs.ts`] |
| Durable heavy-work dispatch | New queue code or ad hoc DB writes in the route | `createJob(...)` plus `resolveEffectiveResumeSource(...)` from the Phase 37 foundation | The repo already has a generic job contract and repository; Phase 38 should finally consume it. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`] |
| Transcript persistence for async acknowledgements | Inline `appendMessage(...)` calls scattered through route code | Existing `appendUserTurn(...)` and `appendAssistantTurn(...)` helpers | Reusing the shared turn helpers keeps transcript behavior consistent with the sync loop. [VERIFIED: `src/lib/agent/agent-persistence.ts`, `src/lib/agent/agent-loop.ts`] |
| SSE response framing | A second custom event transport or bespoke client contract | The current SSE envelope with `sessionCreated`, `text`, `patch`, `done`, and `error` chunks | The frontend already consumes the existing stream shape; Phase 38 should preserve it while only changing the execution branch behind it. [VERIFIED: `src/types/agent.ts`, `src/app/api/agent/route.ts`, `src/components/dashboard/chat-interface.tsx`] |

**Key insight:** the Phase 38 risk is boundary drift, not lack of primitives. The repo already has the route, stream shell, transcript helpers, and durable jobs foundation; the planner should spend work on moving decision points to the right layer, not on inventing new infrastructure. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/agent/agent-persistence.ts`, `src/lib/jobs/repository.ts`, `.planning/ROADMAP.md`]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `sessions`, session messages, `resume_targets`, `resume_generations`, and Phase 37 `jobs` rows already exist as the runtime state surfaces this phase will read or write. No rename or backfill target was found; Phase 38 changes how new heavy requests are routed, not the stored table names. [VERIFIED: `prisma/schema.prisma`, `src/lib/db/sessions.ts`, `src/lib/db/session-messages.ts`, `src/lib/db/resume-generations.ts`, `src/lib/jobs/repository.ts`] | Code edits only; no data migration is required for existing rows. [VERIFIED: `.planning/ROADMAP.md`, `prisma/schema.prisma`] |
| Live service config | No route-specific external workflow configuration was found in repo-managed planning or runtime files for `/api/agent`; current heavy execution is in-process code, not an external worker service yet. [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`] | None in Phase 38; worker service or status-surface configuration is deferred to later phases. [VERIFIED: `.planning/ROADMAP.md`] |
| OS-registered state | None found; this phase does not rename executables, services, schedulers, or registered task names. [VERIFIED: `.planning/ROADMAP.md`, `package.json`] | None. [VERIFIED: `.planning/ROADMAP.md`] |
| Secrets/env vars | Existing auth, OpenAI, and database envs remain the same; the route refactor does not require a new secret or env-var name. [VERIFIED: `CLAUDE.md`, `src/lib/auth/app-user.ts`, `src/lib/openai/chat.ts`, `src/lib/db/supabase-admin.ts`] | None; keep using the current environment surface. [VERIFIED: `CLAUDE.md`] |
| Build artifacts | None found that embed `/api/agent` internals or job-routing names; this phase edits runtime code only. [VERIFIED: `package.json`, `src/app/api/agent/route.ts`] | None. [VERIFIED: `package.json`] |

## Common Pitfalls

### Pitfall 1: Async acknowledgement without transcript persistence

**What goes wrong:** A heavy request gets acknowledged and dispatched, but the user's message never lands in session history because the code path never enters `runAgentLoop(...)`. [VERIFIED: `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`]

**Why it happens:** The current user-turn append still happens inside `runAgentLoop(...)`, so any Phase 38 async branch that short-circuits before the loop must persist both sides of the visible exchange itself. [VERIFIED: `src/lib/agent/agent-loop.ts`, `src/lib/agent/agent-persistence.ts`]

**How to avoid:** Make the orchestrator own `appendUserTurn(...)` plus `appendAssistantTurn(...)` for async acknowledgements and keep the sync loop owning that seam only for requests that actually enter `runAgentLoop(...)`. [VERIFIED: `src/lib/agent/agent-persistence.ts`, `.planning/REQUIREMENTS.md`]

**Warning signs:** Session message lists, `messageCount`, and what the user saw in the chat UI stop matching after a heavy request. [VERIFIED: `src/lib/agent/agent-persistence.ts`, `src/components/dashboard/chat-interface.tsx`, `.planning/REQUIREMENTS.md`]

### Pitfall 2: Breaking early session propagation for new sessions

**What goes wrong:** A newly created session no longer reaches the client early enough, which can strand refresh recovery and break existing `sessionCreated` or `X-Session-Id` assumptions. [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`, `src/components/dashboard/chat-interface.tsx`]

**Why it happens:** The current client reads `X-Session-Id` as soon as `fetch(...)` resolves and also handles `sessionCreated` as the first SSE event for new sessions; that ordering is already covered by tests. [VERIFIED: `src/components/dashboard/chat-interface.tsx`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`]

**How to avoid:** Keep session resolution before branching, preserve the header plus `sessionCreated` semantics for new sessions, and regression-test async acknowledgement flows against the same ordering contract. [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`]

**Warning signs:** New heavy-action requests create a session in the database, but the chat UI refreshes into an empty or stale conversation because the session ID was not surfaced soon enough. [VERIFIED: `src/components/dashboard/chat-interface.tsx`, `src/app/api/agent/route.test.ts`]

### Pitfall 3: Classifying too much work as async

**What goes wrong:** Ordinary chat or deterministic lightweight dialog recovery gets routed into durable jobs, which would slow the UX and violate ORCH-01. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/types/jobs.ts`, `src/app/api/agent/route.sse.test.ts`]

**Why it happens:** The current route has many behavioral branches, but the Phase 37 contract only freezes four action classes and marks only `chat` as synchronous. The Phase 38 classifier must map current brownfield behavior onto that smaller contract carefully. [VERIFIED: `src/types/jobs.ts`, `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

**How to avoid:** Keep the classifier narrow: treat lightweight chat, deterministic resume-only recovery, and non-heavy dialog guidance as `chat`, and reserve async dispatch for ATS enhancement, job targeting, and artifact generation entry points only. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/types/jobs.ts`, `src/app/api/agent/route.sse.test.ts`]

**Warning signs:** Requests like `oi`, `reescreva`, or non-heavy dialog follow-ups stop returning streamed text immediately and instead produce only acknowledgements. [VERIFIED: `src/app/api/agent/route.sse.test.ts`, `src/app/api/agent/route.test.ts`]

### Pitfall 4: Dispatching durable jobs without the Phase 37 ownership and source-of-truth refs

**What goes wrong:** Jobs get created, but later workers or status readers cannot tell which snapshot or resume target they should use, or a user can accidentally see another user's jobs if route-scoped reads are not kept user-bound. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`]

**Why it happens:** The repository and source-of-truth helpers assume explicit `userId`, `idempotencyKey`, and `dispatchInputRef` values. The route does not have that wiring today because it still runs heavy work inline. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`, `src/app/api/agent/route.ts`]

**How to avoid:** Build dispatch input from app-user-scoped session state and `resolveEffectiveResumeSource(...)`, then create or reuse jobs through `createJob(...)` rather than raw table writes. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`, `CLAUDE.md`]

**Warning signs:** Async dispatch tests need to mock raw database writes, duplicate heavy requests create multiple queued rows, or job reads stop scoping by `user_id`. [VERIFIED: `src/lib/jobs/repository.ts`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-VALIDATION.md`]

### Pitfall 5: Shrinking the route file without actually removing heavy request-path work

**What goes wrong:** `route.ts` gets shorter, but `runPreLoopSetup(...)` and confirmed generation still execute ATS, targeting, or file generation inline, so request latency and failure semantics remain effectively unchanged. [VERIFIED: `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`, `.planning/ROADMAP.md`]

**Why it happens:** The heaviest branches are currently hidden behind helper calls, not only inside the route file itself. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

**How to avoid:** Make Phase 38 success criteria explicit around removing inline `runAtsEnhancementPipeline(...)`, `runJobTargetingPipeline(...)`, and confirmed-generation file creation from the request path, not just around extracting helpers. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`]

**Warning signs:** Route tests still prove heavy pipeline invocation on synchronous requests after the refactor, especially for `Aceito` and target-job rewrite flows. [VERIFIED: `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/pre-loop-setup.test.ts`]

## Code Examples

Verified patterns from the current repository APIs:

### Sync-versus-async branch from the frozen Phase 37 contract

```typescript
import { resolveExecutionMode } from '@/types/jobs'

const executionMode = resolveExecutionMode(actionType)

if (executionMode === 'async') {
  // create or reuse durable job and acknowledge
} else {
  // continue into the synchronous agent loop
}
```

Source: `resolveExecutionMode(...)` is the explicit Phase 37 seam for converting `AgentActionType` into `sync` or `async`. [VERIFIED: `src/types/jobs.ts`]

### Durable job creation using the source-of-truth resume ref

```typescript
import { createJob } from '@/lib/jobs/repository'
import { resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'

const resolvedSource = resolveEffectiveResumeSource(session, resumeTarget ?? null)

const { job, wasCreated } = await createJob({
  userId: session.userId,
  sessionId: session.id,
  resumeTargetId: resumeTarget?.id,
  type: 'job_targeting',
  idempotencyKey,
  stage: 'queued',
  dispatchInputRef: resolvedSource.ref,
})
```

Source: this is the actual repository plus source-of-truth API surface already shipped in Phase 37. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`]

### Shared transcript persistence for async acknowledgements

```typescript
import { appendAssistantTurn, appendUserTurn } from '@/lib/agent/agent-persistence'

await appendUserTurn(session.id, userMessage)
await appendAssistantTurn(session.id, acknowledgementText)
```

Source: the shared persistence helpers already wrap the session-message append seam and have direct unit coverage. [VERIFIED: `src/lib/agent/agent-persistence.ts`, `src/lib/agent/agent-persistence.test.ts`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route and helper code decide sync-versus-heavy execution ad hoc. | Phase 37 has already frozen `AgentActionType`, `JobType`, and `resolveExecutionMode(...)` as the canonical contract. | 2026-04-16 in Phase 37. [VERIFIED: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-SUMMARY.md`, `src/types/jobs.ts`] | Phase 38 should wire brownfield behavior into that contract instead of creating new enums or booleans. [VERIFIED: `.planning/ROADMAP.md`, `src/types/jobs.ts`] |
| Heavy ATS, targeting, and artifact work currently runs inside request-time helpers. | The milestone direction is to keep chat synchronous but move heavy work behind durable jobs. | v1.6 roadmap, active on 2026-04-16. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/agent-loop.ts`] | Phase 38 is the routing and dispatch handoff step; Phase 39 owns worker execution. [VERIFIED: `.planning/ROADMAP.md`] |
| Transcript persistence is implicitly coupled to the sync loop. | The repo already has a reusable `agent-persistence` seam for turns and patches. | Present in current workspace on 2026-04-16. [VERIFIED: `src/lib/agent/agent-persistence.ts`, `src/lib/agent/agent-persistence.test.ts`] | Async acknowledgement paths can stay transcript-consistent without duplicating raw session-message writes. [VERIFIED: `src/lib/agent/agent-persistence.ts`] |
| Status consumers historically looked at route-local SSE chunks and session fields only. | Phase 37 introduced `JobStatusSnapshot` as the canonical durable-job read model. | 2026-04-16 in Phase 37. [VERIFIED: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-SUMMARY.md`, `src/types/jobs.ts`] | Phase 38 can acknowledge and dispatch now without taking on full UI status integration; richer consumer surfaces stay in Phase 40. [VERIFIED: `.planning/ROADMAP.md`] |

**Deprecated or outdated:**

- Treating route extraction alone as sufficient. The milestone explicitly requires heavy execution to leave the request path, not just move to smaller helper files. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`]
- Introducing a route-local async status vocabulary. Phase 37 already froze durable job status and read-shape contracts. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`]

## Assumptions Log

All claims in this research were verified against local code, npm registry data, or official Next.js documentation in this session. No `[ASSUMED]` claims remain for planner confirmation. [VERIFIED: local workspace; VERIFIED: npm registry; CITED: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]

## Open Questions

1. **Should Phase 38 emit a dedicated async-accepted SSE chunk, or stay text-only?**
   - What we know: the current client handles known chunk types in a `switch` with no `default`, so an unknown chunk would be ignored rather than crash the UI. [VERIFIED: `src/components/dashboard/chat-interface.tsx`]
   - What's unclear: whether adding a new chunk type this early creates unnecessary surface area before Phase 40 owns status UX. [VERIFIED: `.planning/ROADMAP.md`]
   - Recommendation: keep Phase 38 acknowledgements text-only unless implementation shows a concrete blocker, and let Phase 40 own richer status or event contracts. [VERIFIED: `.planning/ROADMAP.md`, `src/components/dashboard/chat-interface.tsx`]

2. **How should Phase 38 classify `Aceito` when generation is reachable from more than one brownfield state?**
   - What we know: current tests cover both a confirm-step prompt and a direct dialog-path generation request when target context is already loaded. [VERIFIED: `src/app/api/agent/route.sse.test.ts`]
   - What's unclear: whether the classifier should normalize both states into one `artifact_generation` branch in a single helper or preserve state-specific guards around when dispatch is allowed. [VERIFIED: `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/agent-loop.ts`]
   - Recommendation: plan explicit regression coverage for both entry states and keep the classification helper pure, with any state gating handled by the orchestrator. [VERIFIED: `src/app/api/agent/route.sse.test.ts`, `.planning/REQUIREMENTS.md`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Planning scripts, tests, and route/library execution | Yes [VERIFIED: local shell] | `v24.14.0` [VERIFIED: local shell] | None needed |
| npm | Package scripts and registry verification | Yes [VERIFIED: local shell] | `11.9.0` [VERIFIED: local shell] | None needed |
| Vitest via `npx` | Route and orchestrator regression coverage | Yes [VERIFIED: local shell, `package.json`] | `1.6.1` [VERIFIED: local shell, `package.json`] | `npm test` calls the same framework. [VERIFIED: `package.json`] |
| Prisma CLI via `npx` | Schema-awareness and any follow-on route-dispatch verification that touches the Phase 37 job table | Yes [VERIFIED: local shell, `package.json`] | `5.22.0` [VERIFIED: local shell] | None needed |
| Live database credentials | Full DB-backed execution checks later in implementation | Not explicitly verified in the shell environment [VERIFIED: local shell] | Unknown | For planning, none required; unit and route tests are already mock-driven. [VERIFIED: `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/pre-loop-setup.test.ts`] |

**Missing dependencies with no fallback:**

- None for planning. [VERIFIED: local shell, `package.json`]

**Missing dependencies with fallback:**

- Live database credentials were not confirmed directly in shell output, but the core Phase 38 regression suites are mock-based and do not block planning or most implementation work. [VERIFIED: local shell, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/pre-loop-setup.test.ts`]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.1` [VERIFIED: local shell, `package.json`] |
| Config file | `vitest.config.ts` [VERIFIED: `vitest.config.ts`] |
| Quick run command | `npx vitest run src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts` [VERIFIED: `package.json`, `vitest.config.ts`, file tree] |
| Full suite command | `npm test` and `npm run typecheck` [VERIFIED: `package.json`] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORCH-01 | `/api/agent` keeps synchronous SSE chat for lightweight requests while heavy ATS, targeting, and artifact-generation requests are acknowledged and dispatched async. [VERIFIED: `.planning/REQUIREMENTS.md`] | Integration plus route regression [VERIFIED: `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`] | `npx vitest run src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts` [VERIFIED: file tree, `package.json`] | Yes, but must be expanded for async dispatch assertions. [VERIFIED: `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`] |
| ORCH-02 | Session load or create, message persistence, action classification, and execution-mode routing stay behaviorally consistent after extraction. [VERIFIED: `.planning/REQUIREMENTS.md`] | Unit plus integration [VERIFIED: `src/lib/agent/pre-loop-setup.test.ts`, `src/lib/agent/agent-persistence.test.ts`, `src/app/api/agent/route.test.ts`] | `npx vitest run src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts src/app/api/agent/route.test.ts` [VERIFIED: file tree, `package.json`] | Partially; a dedicated classifier or orchestrator suite does not exist yet. [VERIFIED: file tree] |

### Sampling Rate

- **Per task commit:** `npx vitest run src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts` [VERIFIED: `package.json`, `vitest.config.ts`]
- **Per wave merge:** `npm test` plus `npm run typecheck` [VERIFIED: `package.json`]
- **Phase gate:** Focused route and orchestration regressions green, then full non-E2E suite green before execution handoff closes. [VERIFIED: `.planning/config.json`, `package.json`]

### Wave 0 Gaps

- [ ] `src/lib/agent/action-classification.test.ts` - cover heavy-action detection, `AgentActionType`, and `resolveExecutionMode(...)` mapping for `Aceito`, target-job rewrites, and lightweight chat. [VERIFIED: file tree, `src/types/jobs.ts`, `src/app/api/agent/route.sse.test.ts`]
- [ ] `src/lib/agent/request-orchestrator.test.ts` or `src/lib/agent/async-dispatch.test.ts` - cover header or `sessionCreated` ordering, async acknowledgement persistence, and durable job create or reuse behavior without going through the full route wrapper. [VERIFIED: file tree, `src/app/api/agent/route.test.ts`, `src/lib/jobs/repository.ts`, `src/lib/agent/agent-persistence.ts`]
- [ ] Update `src/lib/agent/pre-loop-setup.test.ts` so it proves heavy-path classification no longer runs ATS or job-targeting inline in the request path. [VERIFIED: `src/lib/agent/pre-loop-setup.test.ts`, `.planning/ROADMAP.md`]

## Security Domain

Phase 38 changes request orchestration at an authenticated API boundary, so ASVS-aligned checks for authentication, session continuity, access control, and input validation are in scope. [VERIFIED: `.planning/config.json`, `src/app/api/agent/route.ts`, `src/lib/auth/app-user.ts`, `src/lib/jobs/repository.ts`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/auth/app-user.ts`] | `getCurrentAppUser(...)` before route work continues. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/auth/app-user.ts`] |
| V3 Session Management | Yes [VERIFIED: `src/app/api/agent/route.ts`, `src/components/dashboard/chat-interface.tsx`] | Server-side session load or create plus `X-Session-Id` and `sessionCreated` continuity. [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`] |
| V4 Access Control | Yes [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/jobs/repository.ts`] | App-user-scoped session lookup and job repository reads or writes keyed by `user_id`. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/jobs/repository.ts`, `CLAUDE.md`] |
| V5 Input Validation | Yes [VERIFIED: `src/app/api/agent/route.ts`, `AGENTS.md`] | Zod `BodySchema` at the route boundary. [VERIFIED: `src/app/api/agent/route.ts`] |
| V6 Cryptography | No new phase-specific cryptography work [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/agent/route.ts`] | Reuse existing platform and vendor-managed auth and transport; do not add custom crypto. [VERIFIED: `CLAUDE.md`, `AGENTS.md`] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user session or job access | Information Disclosure / Elevation of Privilege [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/jobs/repository.ts`] | Resolve the app user first, then scope session and durable-job operations by that user ID only. [VERIFIED: `src/app/api/agent/route.ts`, `src/lib/jobs/repository.ts`, `CLAUDE.md`] |
| Duplicate async dispatch from retries or repeated clicks | Tampering / Denial of Service [VERIFIED: `src/lib/jobs/repository.ts`, `src/components/dashboard/chat-interface.tsx`] | Require deterministic `idempotencyKey` values and route all heavy dispatch through `createJob(...)` dedupe behavior. [VERIFIED: `src/lib/jobs/repository.ts`] |
| Malformed request bodies at the public route boundary | Tampering [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`] | Keep JSON parsing failure handling and Zod request validation in the thin route wrapper. [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`] |
| Lost or double terminal writes once background work starts | Tampering [VERIFIED: `src/lib/jobs/repository.ts`] | Preserve repository claim fencing and terminal-write ownership semantics so Phase 39 workers inherit a safe persistence contract. [VERIFIED: `src/lib/jobs/repository.ts`] |
| Request-path abuse through repeated chat hits | Denial of Service [VERIFIED: `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`] | Keep `agentLimiter.limit(...)` and avoid moving heavy execution back into the request path. [VERIFIED: `src/app/api/agent/route.ts`, `.planning/ROADMAP.md`] |

## Sources

### Primary (HIGH confidence)

- Local repository files inspected on 2026-04-16: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `CLAUDE.md`, `package.json`, `vitest.config.ts`, `src/app/api/agent/route.ts`, `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/agent-loop.ts`, `src/lib/agent/pre-loop-setup.ts`, `src/lib/agent/pre-loop-setup.test.ts`, `src/lib/agent/agent-persistence.ts`, `src/lib/agent/agent-persistence.test.ts`, `src/types/agent.ts`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`, `src/components/dashboard/chat-interface.tsx`, `prisma/schema.prisma`. [VERIFIED: local workspace]
- Next.js 14 Route Handlers docs: `https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers` - checked Route Handler behavior and Web `Request` and `Response` support for the current stack. [CITED: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]
- npm registry queries run on 2026-04-16 for `next`, `openai`, `prisma`, `vitest`, `@supabase/supabase-js`, and `zod`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- None needed; the local codebase and primary docs were sufficient for this phase. [VERIFIED: local workspace]

### Tertiary (LOW confidence)

- None. [VERIFIED: local workspace]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - the recommended stack is almost entirely the current workspace plus Phase 37 contracts, and package versions were rechecked against the npm registry in this session. [VERIFIED: local workspace; VERIFIED: npm registry]
- Architecture: MEDIUM - the route seams and heavy-path boundaries are clear, but exact module naming and whether to add a dedicated async-accepted chunk remain implementation choices. [VERIFIED: `src/app/api/agent/route.ts`, `src/components/dashboard/chat-interface.tsx`, `.planning/ROADMAP.md`]
- Pitfalls: HIGH - the biggest failure modes are directly evidenced by current tests, current persistence seams, and the inline heavy branches still present in `pre-loop-setup` and `agent-loop`. [VERIFIED: `src/app/api/agent/route.test.ts`, `src/app/api/agent/route.sse.test.ts`, `src/lib/agent/pre-loop-setup.test.ts`, `src/lib/agent/agent-loop.ts`]

**Research date:** 2026-04-16 [VERIFIED: local environment]
**Valid until:** 2026-05-16 for planning purposes, unless the roadmap scope or Phase 37 contracts change first. [VERIFIED: `.planning/ROADMAP.md`, `src/types/jobs.ts`]
