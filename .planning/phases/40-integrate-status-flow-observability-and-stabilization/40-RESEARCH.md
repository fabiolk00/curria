# Phase 40: Integrate status flow, observability, and stabilization - Research

**Researched:** 2026-04-16  
**Domain:** Durable job status integration, brownfield dashboard polling, and async observability hardening  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

No `40-CONTEXT.md` exists for this phase. Planning must rely on `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `AGENTS.md`, `CLAUDE.md`, and the current codebase only. [VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/STATE.md][VERIFIED: .planning/phases directory]

### Locked Decisions
- None captured in a phase-local CONTEXT artifact. [VERIFIED: .planning/phases directory]

### Claude's Discretion
- Choose the narrowest brownfield-safe status surface that consumes the frozen Phase 37-39 job contracts without reopening them. [VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/STATE.md]

### Deferred Ideas (OUT OF SCOPE)
- User-facing cancel or retry controls for background jobs remain deferred until after the durable async flow is proven correct. [VERIFIED: .planning/REQUIREMENTS.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | UI and operators can query or stream job status, stage, progress, and terminal completion or failure state for ATS, targeting, and artifact work. [VERIFIED: .planning/REQUIREMENTS.md] | Reuse `JobStatusSnapshot` as the canonical read model, add a generic user-scoped job-status route, project session-scoped job snapshots into the workspace payload, and enrich artifact polling with latest artifact-job state. [VERIFIED: src/types/jobs.ts][VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/hooks/use-session-documents.ts] |
| TEST-01 | Regression coverage proves sync chat behavior, async dispatch, worker success and failure paths, snapshot consistency, and safe async integration under the new execution model. [VERIFIED: .planning/REQUIREMENTS.md] | Extend the existing Vitest route/component suite instead of creating a second test harness; the key gaps are a generic jobs route test and a polling-hook or workspace-client status test. [VERIFIED: vitest.config.ts][VERIFIED: package.json][VERIFIED: src/app/api/agent/route.sse.test.ts][VERIFIED: src/lib/agent/request-orchestrator.test.ts][VERIFIED: src/app/api/file/[sessionId]/route.test.ts][VERIFIED: src/components/dashboard/session-documents-panel.test.tsx] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly widens scope. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over new feature breadth. [VERIFIED: CLAUDE.md]
- Keep route handlers thin, validate external input with `zod`, and prefer structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: CLAUDE.md][VERIFIED: src/lib/observability/structured-log.ts]
- Treat `cvState` as canonical resume truth, `agentState` as operational context only, and keep `generatedOutput` as artifact metadata rather than async lifecycle truth. [VERIFIED: CLAUDE.md][VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/app/api/session/[id]/route.ts]
- Preserve dispatcher and `ToolPatch` patterns when changing agent flows. [VERIFIED: CLAUDE.md]

## Summary

Phase 40 is an integration and stabilization phase, not a contract-design phase: Phase 37 already froze `JobStatusSnapshot`, `JobType`, `JobStatus`, and durable refs, Phase 38 moved `/api/agent` to a lightweight orchestrator, and Phase 39 moved ATS, targeting, and artifact work behind same-app durable processors. [VERIFIED: .planning/ROADMAP.md][VERIFIED: src/types/jobs.ts]

The main remaining gap is status-consumer drift. `/api/session/[id]/generate` already returns `jobId` and optional `inProgress`, but `GenerateResumeResponse`, `resume-workspace`, `use-session-documents`, `session-documents-panel`, and `GET /api/session/[id]` still behave as if generation is synchronous and `generatedOutput` alone is enough to explain async progress. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/dashboard.ts][VERIFIED: src/components/dashboard/resume-workspace.tsx][VERIFIED: src/hooks/use-session-documents.ts][VERIFIED: src/components/dashboard/session-documents-panel.tsx][VERIFIED: src/app/api/session/[id]/route.ts]

There is already a proven brownfield pattern to follow: the profile-import flows use authenticated polling routes, keep status reads user-scoped, and return small JSON payloads that the UI can poll safely. Phase 40 should apply that same pattern to durable ATS, targeting, and artifact jobs while keeping `/api/agent` SSE transport-focused instead of making it the source of truth for all background status. [VERIFIED: src/app/api/profile/status/[jobId]/route.ts][VERIFIED: src/app/api/profile/upload/status/[jobId]/route.ts][VERIFIED: src/app/api/agent/route.sse.test.ts]

**Primary recommendation:** Add one canonical durable-job read path (`GET /api/jobs/[jobId]`) plus a session-scoped `jobs` projection and artifact-status enrichment, then wire the existing dashboard polling UX to those surfaces instead of inventing a second status model. [VERIFIED: src/types/jobs.ts][VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/components/resume/resume-builder.tsx]

## Standard Stack

### Core

| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Next.js App Router | Repo `14.2.3`; latest npm `16.2.4` published `2026-04-15T22:33:47.905Z` | Own the authenticated route surfaces for session, file, and new jobs status endpoints. | The app is already a Next.js 14 monolith and this phase is brownfield integration, not a framework-upgrade phase. [VERIFIED: package.json][VERIFIED: npm registry][VERIFIED: CLAUDE.md] |
| `@/types/jobs` | Repo-local | Canonical async read/write contract for job type, status, stage, progress, and terminal refs. | Phase 37 already froze this contract; Phase 40 should consume it unchanged. [VERIFIED: src/types/jobs.ts][VERIFIED: .planning/ROADMAP.md] |
| Zod | Repo `3.23.8`; latest npm `4.3.6` published `2026-01-22T19:14:35.382Z` | Keep any new route params or query/body inputs validated at the HTTP boundary. | Project rules explicitly require `zod` at external boundaries, and the generate route already follows that pattern. [VERIFIED: package.json][VERIFIED: npm registry][VERIFIED: CLAUDE.md][VERIFIED: src/app/api/session/[id]/generate/route.ts] |
| Vitest | Repo `1.6.0`; latest npm `4.1.4` published `2026-04-09T07:36:52.741Z` | Extend the existing regression suite around routes, orchestrator behavior, hooks, and dashboard components. | The repo already has the exact tests Phase 40 needs to build on. [VERIFIED: package.json][VERIFIED: npm registry][VERIFIED: vitest.config.ts] |

### Supporting

| Library / Module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `@/lib/jobs/repository` | Repo-local | User-scoped job reads, creation, claim fencing, and terminal writes. | Use for the new status query surfaces instead of raw Supabase queries. [VERIFIED: src/lib/jobs/repository.ts] |
| `@/lib/observability/structured-log` | Repo-local | Structured JSON logs with consistent event names and fields. | Use for dispatch/status/runtime observability on every edited backend surface. [VERIFIED: src/lib/observability/structured-log.ts][VERIFIED: CLAUDE.md] |
| `@/lib/dashboard/workspace-client` | Repo-local | Centralized browser-side fetch layer for workspace/status APIs. | Extend here rather than scattering `fetch` calls across components. [VERIFIED: src/lib/dashboard/workspace-client.ts] |
| Existing profile status routes | Repo-local precedent | Brownfield polling pattern for authenticated status reads. | Mirror this shape for durable jobs rather than inventing websocket-only UI flows. [VERIFIED: src/app/api/profile/status/[jobId]/route.ts][VERIFIED: src/app/api/profile/upload/status/[jobId]/route.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Authenticated route polling plus session refresh | New websocket or realtime channel for all background jobs | That would widen scope, add infrastructure, and conflict with the current brownfield pattern where only `/api/agent` uses SSE. [VERIFIED: src/app/api/agent/route.ts][VERIFIED: src/app/api/profile/status/[jobId]/route.ts][VERIFIED: .planning/ROADMAP.md] |
| `JobStatusSnapshot` as the shared status DTO | Per-route bespoke status payloads | The repo already shows type drift between the generate route and dashboard types; adding more bespoke DTOs will make that worse. [VERIFIED: src/types/jobs.ts][VERIFIED: src/types/dashboard.ts][VERIFIED: src/app/api/session/[id]/generate/route.ts] |
| Extending existing dashboard client/hook patterns | Introducing a second client-side async-status store | The client is intentionally shallow and session state is server-authoritative. [VERIFIED: AGENTS.md][VERIFIED: src/lib/dashboard/workspace-client.ts] |

**Installation:**

```bash
# No new packages expected for Phase 40
```

**Version verification:** The phase can stay on the repo-pinned stack. Verified reference points are `next@14.2.3` in repo versus `16.2.4` latest on npm, `vitest@1.6.0` in repo versus `4.1.4` latest on npm, and `zod@3.23.8` in repo versus `4.3.6` latest on npm. Phase 40 should not combine a status-flow refactor with dependency upgrades. [VERIFIED: package.json][VERIFIED: npm registry][VERIFIED: CLAUDE.md]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── app/api/jobs/[jobId]/route.ts          # Canonical durable-job status read
├── app/api/session/[id]/route.ts          # Workspace payload enriched with session job snapshots
├── app/api/file/[sessionId]/route.ts      # Artifact availability plus latest artifact-job status summary
├── lib/jobs/repository.ts                 # User-scoped job query helpers
├── lib/dashboard/workspace-client.ts      # Typed browser fetch helpers for new status surfaces
├── hooks/use-session-documents.ts         # Artifact polling that can distinguish generating vs failed vs ready
└── components/dashboard/                  # Brownfield workspace and documents UI consumers
```

### Pattern 1: Canonical Job Snapshot Read Model

**What:** Expose `JobStatusSnapshot` unchanged as the durable status source for ATS, targeting, and artifact jobs. [VERIFIED: src/types/jobs.ts]  
**When to use:** Any route or client code that needs queued/running/completed/failed status, stage, progress, or terminal refs. [VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: src/types/jobs.ts]  
**Example:**

```typescript
// Source: src/types/jobs.ts
export type JobStatusSnapshot = {
  jobId: string
  type: JobType
  status: JobStatus
  stage?: string
  progress?: JobProgress
  dispatchInputRef: JobInputRef
  terminalResultRef?: JobResultRef
  terminalErrorRef?: JobErrorRef
}
```

### Pattern 2: Read-Only Authenticated Polling Routes

**What:** Keep status reads cheap and authenticated. The profile import routes already prove the repo's preferred pattern: authenticate, scope by app user, load status, return a small JSON payload. [VERIFIED: src/app/api/profile/status/[jobId]/route.ts][VERIFIED: src/app/api/profile/upload/status/[jobId]/route.ts]  
**When to use:** New generic job-status reads and workspace/document polling. [VERIFIED: src/components/resume/resume-builder.tsx][VERIFIED: src/hooks/use-session-documents.ts]  
**Example:**

```typescript
// Source: src/app/api/profile/status/[jobId]/route.ts
const job = await getImportJob(jobId, appUser.id)
return NextResponse.json({
  jobId,
  status: job.status,
  errorMessage: job.status === 'failed' ? getSafeImportFailureMessage(job.error_message) : undefined,
})
```

### Pattern 3: Separate Lifecycle Truth from Artifact Availability

**What:** Keep download availability and job lifecycle related but distinct. `generatedOutput` and `/api/file/[sessionId]` should answer "is the artifact retrievable yet?", while the durable job snapshot answers "what is the async lifecycle doing right now?". [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/jobs.ts]  
**When to use:** Artifact panels, preview/download refresh, and route responses that currently collapse "still running" and "failed" into the same "not available" state. [VERIFIED: src/hooks/use-session-documents.ts][VERIFIED: src/components/dashboard/session-documents-panel.tsx]  

### Anti-Patterns to Avoid

- **Treating `generatedOutput` as the full async contract:** It can say `generating` or `ready`, but it does not contain `jobId`, stage, progress, or durable terminal refs. [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/types/jobs.ts]
- **Using `/api/agent` SSE as the canonical job-status source:** SSE is the chat transport, not the shared status read model for later polling/UI consumers. [VERIFIED: src/app/api/agent/route.ts][VERIFIED: src/app/api/agent/route.sse.test.ts]
- **Making generic status reads mutate runtime state:** The durable-job status route should be read-only; unlike the import flows, Phase 39 already starts runtime kickoff in dispatch paths. [VERIFIED: src/lib/agent/async-dispatch.ts][VERIFIED: src/lib/jobs/runtime.ts][VERIFIED: src/app/api/profile/status/[jobId]/route.ts]
- **Hiding terminal failures behind "files unavailable":** The current file hook cannot distinguish queued from failed because `/api/file/[sessionId]` only returns URLs and `available`. [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/hooks/use-session-documents.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async lifecycle vocabulary | Route-specific status enums and ad hoc DTOs | `JobStatusSnapshot` plus the existing job ref types | The frozen contract already covers job type, stage, progress, and terminal refs. [VERIFIED: src/types/jobs.ts] |
| Status storage in the browser | A second client-side async-status store or reducer tree | Server-authoritative polling through `workspace-client`, session payloads, and a dedicated jobs route | The app keeps session state server-side and the client shallow by design. [VERIFIED: AGENTS.md][VERIFIED: src/lib/dashboard/workspace-client.ts] |
| Backend logging | Raw `console.log` strings or per-file custom JSON wrappers | `logInfo`, `logWarn`, `logError`, and `serializeError` | The repo already standardizes JSON log shape and the project rules explicitly prefer it. [VERIFIED: src/lib/observability/structured-log.ts][VERIFIED: CLAUDE.md] |
| Artifact status guesses | Inference from missing signed URLs alone | `/api/file/[sessionId]` plus latest artifact-job status metadata | The current hook conflates "still generating" and "failed" because the route omits lifecycle metadata. [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/hooks/use-session-documents.ts] |

**Key insight:** The most concrete existing regression is contract drift: the backend already acknowledges async artifact work with `jobId` and optional `inProgress`, while the typed dashboard client and workspace UI still assume a synchronous success path. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/dashboard.ts][VERIFIED: src/components/dashboard/resume-workspace.tsx]

## Common Pitfalls

### Pitfall 1: Backend and frontend status contracts drift apart

**What goes wrong:** The route returns async acknowledgement data that the dashboard types and UI do not model. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/dashboard.ts]  
**Why it happens:** Phase 39 changed the route contract, but Phase 40 is the first phase explicitly tasked with wiring status consumers. [VERIFIED: .planning/ROADMAP.md]  
**How to avoid:** Update `GenerateResumeResponse`, workspace/session payload types, and route tests first, before adding UI logic. [VERIFIED: src/types/dashboard.ts][VERIFIED: src/app/api/session/[id]/generate/route.test.ts]  
**Warning signs:** Success copy appears immediately after a 202 response, or components only check `generatedOutput.status === 'ready'`. [VERIFIED: src/components/dashboard/resume-workspace.tsx][VERIFIED: src/lib/dashboard/workspace-client.ts]

### Pitfall 2: Transport gets confused with source of truth

**What goes wrong:** Chat SSE or download polling becomes the de facto job status system. [VERIFIED: src/app/api/agent/route.sse.test.ts][VERIFIED: src/hooks/use-session-documents.ts]  
**Why it happens:** Those transports already exist and are tempting to extend instead of adding one canonical durable-job read surface. [VERIFIED: src/app/api/agent/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts]  
**How to avoid:** Keep `/api/agent` SSE transport-focused, keep `/api/file` availability-focused, and make durable job snapshots the single lifecycle truth. [VERIFIED: src/app/api/agent/route.ts][VERIFIED: src/types/jobs.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts]  
**Warning signs:** New code invents another status shape or makes generic status polling call `startDurableJobProcessing(...)`. [VERIFIED: src/lib/jobs/runtime.ts]

### Pitfall 3: Artifact failures stay invisible in the dashboard

**What goes wrong:** Users see no file URL, but they also do not see whether generation is still running or failed. [VERIFIED: src/hooks/use-session-documents.ts][VERIFIED: src/components/dashboard/session-documents-panel.tsx]  
**Why it happens:** `/api/file/[sessionId]` currently returns only `docxUrl`, `pdfUrl`, and `available`. [VERIFIED: src/app/api/file/[sessionId]/route.ts]  
**How to avoid:** Include latest artifact-job status metadata in the file response or pair the hook with a generic job-status fetch. [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/types/jobs.ts]  
**Warning signs:** The panel remains empty during generation and on failure, or retry UI appears only for network errors. [VERIFIED: src/components/dashboard/session-documents-panel.tsx][VERIFIED: src/components/dashboard/session-documents-panel.test.tsx]

### Pitfall 4: Logs are present but not diagnosable

**What goes wrong:** Status, dispatch, and worker logs exist, but they cannot be correlated because they omit `jobId`, `sessionId`, `type`, or stage. [VERIFIED: src/lib/observability/structured-log.ts][VERIFIED: src/app/api/session/[id]/generate/route.ts]  
**Why it happens:** New route and runtime code may log success/failure without a shared field set or event naming scheme. [VERIFIED: src/lib/observability/structured-log.ts]  
**How to avoid:** Log every edited async surface with event name plus `jobId`, `sessionId`, `resumeTargetId`, `type`, `status`, `stage`, and `latencyMs` where applicable. [VERIFIED: src/lib/observability/structured-log.ts][VERIFIED: CLAUDE.md]  
**Warning signs:** A failed job can be seen in the database, but there is no matching route/runtime log line that identifies the job. [VERIFIED: src/lib/jobs/repository.ts][VERIFIED: src/lib/jobs/runtime.ts]

## Code Examples

Verified patterns from the codebase:

### Durable Artifact Acknowledgement

```typescript
// Source: src/app/api/session/[id]/generate/route.ts
if (job.status === 'queued' || job.status === 'running') {
  return NextResponse.json(buildSuccessResponseBody({
    job,
    scope: body.data.scope,
    targetId: target?.id,
    inProgress: true,
  }), { status: 202 })
}
```

This already proves the route contract is async-first, even though the dashboard types have not caught up yet. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/dashboard.ts]

### Existing Polling Status Route Pattern

```typescript
// Source: src/app/api/profile/upload/status/[jobId]/route.ts
let job = await getPdfImportJob(params.jobId, appUser.id)

if (job.status === 'pending' || job.status === 'processing') {
  job = await startPdfImportJobProcessing(params.jobId, appUser.id)
}

return NextResponse.json({
  jobId: job.id,
  status: job.status,
  errorMessage: job.status === 'failed' ? job.error_message ?? undefined : undefined,
})
```

Phase 40 should reuse the "small, authenticated, pollable JSON route" part of this pattern, but not the "start work on read" part for generic durable jobs. [VERIFIED: src/app/api/profile/upload/status/[jobId]/route.ts][VERIFIED: src/lib/jobs/runtime.ts]

### Structured Logging Helper

```typescript
// Source: src/lib/observability/structured-log.ts
export function logInfo(event: string, fields: LogFields = {}): void {
  logEvent('info', event, fields)
}
```

Use this helper layer for all new status and observability work rather than adding ad hoc logging formats. [VERIFIED: src/lib/observability/structured-log.ts][VERIFIED: CLAUDE.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heavy artifact generation lived in the request path and could be treated like an immediate success. [VERIFIED: .planning/ROADMAP.md] | `/api/session/[id]/generate` now durably dispatches work and can return `202` with `jobId` and `inProgress`. [VERIFIED: src/app/api/session/[id]/generate/route.ts] | Phase 39, completed 2026-04-16. [VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/STATE.md] | UI types and status copy must align to async acknowledgement instead of synchronous completion. [VERIFIED: src/types/dashboard.ts][VERIFIED: src/components/dashboard/resume-workspace.tsx] |
| Status polling existed only for LinkedIn and PDF profile-import jobs. [VERIFIED: src/app/api/profile/status/[jobId]/route.ts][VERIFIED: src/app/api/profile/upload/status/[jobId]/route.ts] | Durable ATS, targeting, and artifact jobs now share a generic contract, but there is still no generic read route or workspace projection for them. [VERIFIED: src/types/jobs.ts][VERIFIED: src/app/api/session/[id]/route.ts] | Contracts were frozen in Phase 37; workers shipped in Phase 39. [VERIFIED: .planning/ROADMAP.md] | Phase 40 should add read surfaces, not redefine lifecycle types. [VERIFIED: src/types/jobs.ts][VERIFIED: .planning/ROADMAP.md] |

**Deprecated or outdated:**

- `GenerateResumeResponse` without `jobId` and `inProgress` is stale relative to the live route contract. [VERIFIED: src/types/dashboard.ts][VERIFIED: src/app/api/session/[id]/generate/route.ts]
- `isGeneratedOutputReady(...)` as the only base-output status check is insufficient for queued/running/failed async work. [VERIFIED: src/lib/dashboard/workspace-client.ts][VERIFIED: src/types/jobs.ts]

## Assumptions Log

All claims in this research were verified or cited from the current repo or npm registry. No additional user confirmation is required before planning.

## Open Questions

1. **Should the workspace consume only a dedicated job route, or also receive job snapshots in `GET /api/session/[id]`?**
   - What we know: `resume-workspace.tsx` already refreshes the full workspace payload after mutations and after agent turns, while `session-documents-panel.tsx` operates independently from just a `sessionId`. [VERIFIED: src/components/dashboard/resume-workspace.tsx][VERIFIED: src/components/dashboard/session-documents-panel.tsx]
   - What's unclear: whether one shared session payload is enough for every consumer, or whether exact `jobId` polling also needs a dedicated route. [VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/session/[id]/generate/route.ts]
   - Recommendation: plan both. Use `GET /api/jobs/[jobId]` as the canonical exact-status read and add a `jobs` array to the session workspace payload for brownfield components that already refresh the session. [VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/types/jobs.ts]

2. **Should `/api/file/[sessionId]` stay download-only, or also expose artifact lifecycle metadata?**
   - What we know: the current hook and documents panel only call `/api/file/[sessionId]`, and they cannot distinguish generating from failed. [VERIFIED: src/hooks/use-session-documents.ts][VERIFIED: src/components/dashboard/session-documents-panel.tsx][VERIFIED: src/app/api/file/[sessionId]/route.ts]
   - What's unclear: how much new status copy the existing sidebar should show versus leaving richer lifecycle detail to the workspace. [VERIFIED: src/components/dashboard/session-documents-panel.tsx][VERIFIED: src/components/dashboard/resume-workspace.tsx]
   - Recommendation: keep `/api/file/[sessionId]` availability-focused, but extend it with latest artifact-job status summary fields instead of a full second DTO. [VERIFIED: src/app/api/file/[sessionId]/route.ts][VERIFIED: src/types/jobs.ts]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next route tests, typecheck, helper scripts | Yes | `v24.14.0` | - |
| npm | `npm run typecheck`, `vitest run`, git-doc workflow scripts | Yes | `11.9.0` | - |
| Git | Commit planning artifacts | Yes | `2.53.0.windows.2` | - |

No new external services or CLIs are required for this phase; Phase 40 is repo-local code and test work on top of already-implemented async infrastructure. [VERIFIED: package.json][VERIFIED: .planning/ROADMAP.md]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.0` in repo. [VERIFIED: package.json] |
| Config file | `vitest.config.ts`. [VERIFIED: vitest.config.ts] |
| Quick run command | `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx`. [VERIFIED: package.json][VERIFIED: file existence checks] |
| Full suite command | `npm test`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | UI and operators can read job status, stage, progress, and terminal state across ATS, targeting, and artifact flows. [VERIFIED: .planning/REQUIREMENTS.md] | Route + component integration | `npx vitest run src/app/api/session/[id]/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/app/api/jobs/[jobId]/route.test.ts` | Existing: session/file/workspace/panel yes; jobs route no. [VERIFIED: file existence checks] |
| TEST-01 | Sync chat parity, async dispatch, worker success/failure, and snapshot consistency remain green. [VERIFIED: .planning/REQUIREMENTS.md] | Route + orchestrator integration | `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/app/api/jobs/[jobId]/route.test.ts` | Existing except jobs route test. [VERIFIED: file existence checks] |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/app/api/jobs/[jobId]/route.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/jobs/[jobId]/route.test.ts` - covers the new canonical durable-job status route for `OBS-01`.
- [ ] `src/hooks/use-session-documents.test.tsx` or `src/lib/dashboard/workspace-client.test.ts` - covers artifact-status polling branches that the panel test currently mocks away. [VERIFIED: src/components/dashboard/session-documents-panel.test.tsx][VERIFIED: file existence checks]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | `getCurrentAppUser()` at every route boundary. [VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts] |
| V3 Session Management | Yes | Clerk-authenticated request boundary plus internal app-user resolution. [VERIFIED: CLAUDE.md][VERIFIED: src/lib/auth/app-user.ts] |
| V4 Access Control | Yes | User-scoped session/job reads and app-user-owned resource checks. [VERIFIED: src/lib/jobs/repository.ts][VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts] |
| V5 Input Validation | Yes | `zod` for new route/query/body parsing where applicable. [VERIFIED: CLAUDE.md][VERIFIED: src/app/api/session/[id]/generate/route.ts] |
| V6 Cryptography | Yes | Reuse Node `crypto` and existing signed artifact helpers; do not invent custom signing or hashing semantics. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guessable `jobId` or `sessionId` leading to cross-tenant status reads | Information Disclosure / Elevation of Privilege | Scope every job and session read by internal app user ID and return `404` for missing or foreign resources. [VERIFIED: src/lib/jobs/repository.ts][VERIFIED: src/app/api/session/[id]/route.ts][VERIFIED: src/app/api/file/[sessionId]/route.ts] |
| Read paths mutate runtime state and amplify poll traffic | Denial of Service / Tampering | Keep generic durable-job status routes read-only; only dispatch and kickoff paths should start work. [VERIFIED: src/lib/jobs/runtime.ts][VERIFIED: src/lib/agent/async-dispatch.ts] |
| Failure payloads leak too much internal detail | Information Disclosure | Map terminal errors to safe route responses and keep raw failure context in structured logs. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/lib/observability/structured-log.ts] |
| Stale workers or duplicate retries hide the real terminal state | Tampering / Repudiation | Continue using repository claim fencing and durable terminal refs; status routes should report the fenced terminal snapshot instead of recomputing state. [VERIFIED: src/lib/jobs/repository.ts][VERIFIED: src/lib/jobs/runtime.ts] |

## Sources

### Primary (HIGH confidence)

- `CLAUDE.md` - project constraints, route/logging conventions, brownfield scope rules.
- `.planning/ROADMAP.md` - Phase 40 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - `OBS-01` and `TEST-01`.
- `.planning/STATE.md` - current milestone/phase state and planning guidance.
- `src/types/jobs.ts` - frozen durable job contracts.
- `src/lib/jobs/repository.ts` - user-scoped durable job persistence helpers.
- `src/app/api/session/[id]/generate/route.ts` - current async artifact acknowledgement contract.
- `src/app/api/session/[id]/route.ts` - current workspace payload shape.
- `src/app/api/file/[sessionId]/route.ts` - current artifact polling shape.
- `src/lib/dashboard/workspace-client.ts` - current browser fetch contract and ready-state helper.
- `src/types/dashboard.ts` - stale dashboard response types.
- `src/components/dashboard/resume-workspace.tsx` - current synchronous generation assumptions.
- `src/hooks/use-session-documents.ts` - current file polling behavior.
- `src/components/dashboard/session-documents-panel.tsx` - current document UI state handling.
- `src/app/api/profile/status/[jobId]/route.ts` and `src/app/api/profile/upload/status/[jobId]/route.ts` - existing polling route precedents.
- `src/lib/observability/structured-log.ts` - structured logging helper.
- `vitest.config.ts` and `package.json` - test framework and commands.

### Secondary (MEDIUM confidence)

- npm registry metadata for `next`, `vitest`, and `zod` - current latest versions and publish timestamps. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phase 40 can stay entirely on the existing repo stack and the key versions were verified against npm. [VERIFIED: package.json][VERIFIED: npm registry]
- Architecture: HIGH - The repo already contains the exact backend/frontend seams that need to be wired together, and the missing pieces are explicit. [VERIFIED: src/app/api/session/[id]/generate/route.ts][VERIFIED: src/types/dashboard.ts][VERIFIED: src/app/api/session/[id]/route.ts]
- Pitfalls: HIGH - The main regressions are directly visible in current code and tests, not inferred from generic advice. [VERIFIED: src/hooks/use-session-documents.ts][VERIFIED: src/components/dashboard/resume-workspace.tsx][VERIFIED: src/components/dashboard/session-documents-panel.test.tsx]

**Research date:** 2026-04-16  
**Valid until:** 2026-05-16 for repo-local planning assumptions; re-check npm registry if dependency upgrades become in scope.
