# Phase 39: Move ATS, targeting, and artifact work into async processors - Research

**Researched:** 2026-04-16
**Domain:** Brownfield durable-job execution, same-app async processors, and state-safe resume pipeline migration
**Confidence:** MEDIUM

<user_constraints>
## User Constraints

No phase-specific `39-CONTEXT.md` exists. Planning is therefore constrained by the locked milestone intent already recorded in `ROADMAP.md`, `REQUIREMENTS.md`, `AGENTS.md`, and `CLAUDE.md`. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `AGENTS.md`, `CLAUDE.md`]

### Locked Decisions

- ATS enhancement and target-job rewriting must run outside the request path without changing their current business logic, validation semantics, or output persistence behavior. [VERIFIED: `.planning/REQUIREMENTS.md`]
- Artifact generation must run outside the request path and keep traceability to the resume snapshot or version that produced the file. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/jobs/source-of-truth.ts`]
- Async failures must preserve the previous valid `optimizedCvState`, and preview plus generated output selection must keep following the correct effective source between `optimizedCvState` and canonical `cvState`. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/jobs/source-of-truth.ts`]
- Phase 39 builds on the Phase 37 durable job contracts and the Phase 38 orchestrator split; it must not invent a second job model or move the public `/api/agent` surface again. [VERIFIED: `.planning/ROADMAP.md`, `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/agent/async-dispatch.ts`]
- Preserve the existing brownfield product surface unless explicitly changing scope. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]

### Claude's Discretion

- Exact module layout for the processor runtime and per-job processor adapters, as long as it follows the repo's existing `src/lib/jobs/*` and `src/lib/agent/*` patterns. [VERIFIED: `src/lib/jobs`, `src/lib/agent`, `AGENTS.md`]
- Whether running-stage updates are implemented as a small repository helper or a runtime-local helper, as long as terminal writes stay fenced by claim ownership. [VERIFIED: `src/lib/jobs/repository.ts`]
- Whether artifact-route acknowledgements return only the existing `inProgress` contract or also add durable `jobId` metadata, as long as the route does not fabricate result refs or signed URLs. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `src/types/jobs.ts`, `src/lib/jobs/source-of-truth.ts`]

### Deferred Ideas (OUT OF SCOPE)

- Rich UI polling or status presentation for durable jobs belongs to Phase 40. [VERIFIED: `.planning/ROADMAP.md`]
- New ATS, targeting, billing, or resume-rewrite business rules are out of scope; this phase changes execution placement, not product semantics. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `AGENTS.md`]
- Replacing the same-app processing model with external queue infrastructure is out of scope for this phase. [VERIFIED: `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`, `.planning/ROADMAP.md`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOB-02 | ATS enhancement and target-job rewriting run outside the request path without changing their current business logic, validation semantics, or output persistence behavior. | The reusable business logic already exists in `runAtsEnhancementPipeline(...)` and `runJobTargetingPipeline(...)`; the missing piece is a durable processor runtime that claims jobs and invokes those pipelines outside the request path. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/agent/async-dispatch.ts`, `src/lib/jobs/repository.ts`] |
| ART-01 | Artifact generation runs outside the request path and records which resume snapshot or version produced each generated file. | `generateBillableResume(...)` already creates or reuses `resume_generations`, stores `sourceCvSnapshot`, and updates completed or failed generation records; the phase needs a processor wrapper plus durable route handoff, not a new generation engine. [VERIFIED: `src/lib/resume-generation/generate-billable-resume.ts`, `src/lib/db/resume-generations.ts`, `src/lib/jobs/source-of-truth.ts`] |
| STATE-01 | Async failures preserve the previous valid `optimizedCvState`, and preview plus generated outputs keep using the correct effective source between `optimizedCvState` and canonical `cvState`. | The current pipelines still clear `optimizedCvState` on some validation and `persist_version` failures, while the source-of-truth helper already defines the correct `target_derived -> optimized -> base` selection order that workers should follow. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/jobs/source-of-truth.ts`] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Keep route handlers thin, validate external input with `zod`, and use structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/app/api/session/[id]/generate/route.ts`]
- Treat `cvState` as canonical truth and `agentState` as operational context only. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/types/agent.ts`, `src/lib/jobs/source-of-truth.ts`]
- Preserve dispatcher and `ToolPatch` patterns when changing agent flows. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/lib/agent/tools/index.ts`, `src/lib/db/session-lifecycle.ts`]
- Prefer small, test-backed changes over broad rewrites because the repo already has large orchestration modules. [VERIFIED: `AGENTS.md`, `CLAUDE.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]
- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]

## Summary

Phase 39 is a runtime-placement phase, not a business-logic phase. The durable `jobs` table, shared job contracts, idempotent job creation, source-of-truth refs, and async dispatch entry point already exist from Phase 37 and Phase 38, but nothing currently starts or runs those jobs after `createJob(...)` returns. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts`, `src/lib/agent/async-dispatch.ts`]

The good news is that the heavy business logic is already reusable. ATS enhancement lives in `runAtsEnhancementPipeline(...)`, job targeting lives in `runJobTargetingPipeline(...)`, and artifact generation lives in `generateBillableResume(...)`, which already handles credit checks, `resume_generations` idempotency, `sourceCvSnapshot`, and terminal generation updates. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]

The main planning risk is state integrity, not processor mechanics. The current ATS and targeting pipelines still clear `optimizedCvState` on some failed validation and `persist_version` paths, which conflicts with `STATE-01`, and the current `/api/session/[id]/generate` route still performs artifact generation inline instead of handing it to the durable job foundation. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/app/api/session/[id]/generate/route.ts`, `.planning/REQUIREMENTS.md`]

The other scope risk is setup UX coupling. `user-data-page.tsx` expects `/api/profile/smart-generation` to return a successful `sessionId` immediately and then redirects straight to the compare screen, so broadening Phase 39 to convert that setup flow into a true async status flow would expand into UI contract work that Phase 40 is explicitly meant to absorb. [VERIFIED: `src/components/resume/user-data-page.tsx`, `.planning/ROADMAP.md`]

**Primary recommendation:** add one same-app durable processor runtime on top of the existing `jobs` repository, wire Phase 38 async dispatch to start that runtime, reuse the current ATS, targeting, and artifact services inside typed processors, and make the pipeline failure paths preserve the last valid optimized state instead of clearing it. [VERIFIED: `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`, `src/lib/agent/async-dispatch.ts`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CurrIA durable job contracts and repository | workspace local | Canonical `JobType`, `JobStatusSnapshot`, idempotent create, claim, and fenced terminal write operations | This phase already depends on `createJob(...)`, `claimJob(...)`, `completeJob(...)`, and `failJob(...)`; adding a second worker persistence path would reopen Phase 37. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`] |
| ATS and job-targeting pipelines | workspace local | Existing heavy rewrite business logic | `runAtsEnhancementPipeline(...)` and `runJobTargetingPipeline(...)` already own validation, logging, and CV version persistence, so processors should call them rather than rebuild them. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`] |
| `generateBillableResume(...)` | workspace local | Existing artifact generation, billing, and `resume_generations` persistence | The service already captures snapshot lineage and idempotent generation semantics; Phase 39 should wrap it in a processor instead of bypassing it. [VERIFIED: `src/lib/resume-generation/generate-billable-resume.ts`, `src/lib/db/resume-generations.ts`] |
| Next.js Route Handlers | 14.2.3 in workspace | Current route surface for artifact requests and async handoff entry points | The brownfield app already uses App Router route handlers, and Phase 39 only needs thinner route-to-processor handoff, not a new HTTP layer. [VERIFIED: `package.json`, `src/app/api/session/[id]/generate/route.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.103.0 in workspace | Existing admin-client DB access for jobs, sessions, targets, and generation tables | Use through the current DB and repository helpers; do not add Prisma Client as a second runtime path here. [VERIFIED: `package.json`, `src/lib/db/supabase-admin.ts`, `src/lib/jobs/repository.ts`] |
| Prisma CLI | 5.22.0 in workspace | Existing schema authority for the already-created `jobs` table and related persistence | Use for schema reference only; Phase 39 should not introduce a new persistence model unless execution exposes a real blocker. [VERIFIED: `package.json`, `prisma/schema.prisma`, `prisma/migrations/20260416_generic_jobs_foundation.sql`] |
| Vitest | 1.6.1 in workspace | Focused regression coverage for runtime, processors, and route handoff | The repo already tests the Phase 37 repository and Phase 38 route split with Vitest. [VERIFIED: `package.json`, `vitest.config.ts`, `src/lib/jobs/repository.test.ts`, `src/app/api/agent/route.sse.test.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Same-app processor runtime triggered from the existing app | External queue or separate worker service | The repo already has same-app job patterns in `pdf-import-jobs.ts` and `linkedin/import-jobs.ts`, and adding new infrastructure would enlarge scope before the current durable contract is even exercised. [VERIFIED: `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`] |
| Reusing ATS, targeting, and artifact services | Rewriting processor-local business logic | That would violate `JOB-02` by changing the business rules during an execution-model refactor. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`] |
| Source-of-truth refs plus `resume_generation` result refs | Storing signed URLs or route-local snapshot metadata in jobs | Signed URLs are ephemeral and the repo already froze stable result refs in Phase 37. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `src/lib/jobs/source-of-truth.test.ts`] |

**Installation:**

```bash
# No new runtime packages are recommended for Phase 39.
npm install
```

**Version verification:** The active workspace already has the required stack for this phase and no new package introduction is recommended. [VERIFIED: `package.json`, `node --version`, `npm --version`, `npx prisma --version`]

- `next`: `14.2.3` in workspace. [VERIFIED: `package.json`]
- `openai`: `6.34.0` in workspace. [VERIFIED: `package.json`]
- `@supabase/supabase-js`: `2.103.0` in workspace. [VERIFIED: `package.json`]
- `prisma`: `5.22.0` in workspace. [VERIFIED: `package.json`, `npx prisma --version`]
- `vitest`: `1.6.1` in workspace. [VERIFIED: `package.json`]
- `zod`: `3.25.76` in workspace. [VERIFIED: `package.json`]

## Architecture Patterns

### Recommended Project Structure

```text
src/
|- app/api/session/[id]/generate/route.ts        # Thin auth/trust/body-validation + durable artifact dispatch
|- lib/jobs/runtime.ts                           # Claim, kickoff, processor dispatch, running-stage updates
|- lib/jobs/processors/ats-enhancement.ts        # ATS worker adapter
|- lib/jobs/processors/job-targeting.ts          # Job-targeting worker adapter
|- lib/jobs/processors/artifact-generation.ts    # Artifact worker adapter
|- lib/agent/async-dispatch.ts                   # Durable job create/reuse + runtime kickoff
|- lib/agent/ats-enhancement-pipeline.ts         # Existing ATS business logic, state-safe failure semantics
|- lib/agent/job-targeting-pipeline.ts           # Existing targeting business logic, state-safe failure semantics
`- lib/resume-generation/generate-billable-resume.ts
```

This keeps the new runtime close to the Phase 37 repository and keeps the heavy business logic in the existing modules that already own it. [VERIFIED: `src/lib/jobs`, `src/lib/agent`, `src/lib/resume-generation`]

### Pattern 1: Same-app runtime over the durable jobs repository

**What:** Add one runtime entry point that claims a queued or stale-running job, schedules processing with `queueMicrotask(...)`, dispatches by `JobType`, and persists completion or failure through the fenced repository methods. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`]

**When to use:** For all Phase 38 async job types: `ats_enhancement`, `job_targeting`, and `artifact_generation`. [VERIFIED: `src/types/jobs.ts`, `src/lib/agent/async-dispatch.ts`]

**Example:**

```typescript
const claimed = await claimJob({ jobId, userId, stage: 'starting' })
if (!claimed || claimed.status !== 'running') return claimed

queueMicrotask(() => {
  void processClaimedJob(claimed)
})
```

Source pattern: the repo already uses claim-then-process plus microtask kickoff for PDF import jobs. [VERIFIED: `src/lib/profile/pdf-import-jobs.ts`]

### Pattern 2: Processor adapters call existing business services

**What:** Each processor should be a thin adapter that loads its session or target context, invokes the existing business service, then maps success or failure into durable job refs and status updates. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]

**When to use:** For ATS, job targeting, and artifact jobs alike. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Example:** a targeting processor should call `runJobTargetingPipeline(session)` and then complete the job with a snapshot result ref instead of re-implementing rewrite logic. [VERIFIED: `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/jobs/source-of-truth.ts`]

### Pattern 3: Preserve last-good optimized state on failure

**What:** Validation and `persist_version` failures should still mark the run as failed, but they must not clear a previously valid `optimizedCvState`, `optimizedAt`, or related stable preview state. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]

**When to use:** Inside the ATS and job-targeting pipelines where failure branches currently write `optimizedCvState: undefined`. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]

### Pattern 4: Artifact processors must use source-of-truth refs, not route-local CV shortcuts

**What:** Artifact jobs should derive their source CV snapshot from `resolveEffectiveResumeSource(...)` or the durable job input ref, then complete with `buildResumeGenerationResultRef(...)` after `generateBillableResume(...)` finishes. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `src/lib/agent/tools/index.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]

**When to use:** In `/api/session/[id]/generate` handoff and the artifact processor. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `src/lib/agent/tools/index.ts`]

### Anti-Patterns to Avoid

- **No-op durable dispatch:** creating jobs in `dispatchAsyncAction(...)` without actually starting a processor leaves Phase 39 unfinished. [VERIFIED: `src/lib/agent/async-dispatch.ts`]
- **Processor-local rewrite logic:** duplicating ATS, targeting, or generation logic in job handlers would violate `JOB-02`. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]
- **Destructive failure writes:** clearing `optimizedCvState` on failed async runs would violate `STATE-01`. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]
- **Signed URLs as durable result state:** signed artifact URLs expire and are not the frozen Phase 37 source-of-truth contract. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `src/lib/jobs/source-of-truth.test.ts`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generic job execution model | New queue or worker persistence model | `createJob(...)`, `claimJob(...)`, `completeJob(...)`, `failJob(...)`, and a thin same-app runtime wrapper | The contract and table are already frozen and tested. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/repository.test.ts`] |
| ATS or targeting worker logic | New processor-specific rewrite engines | `runAtsEnhancementPipeline(...)` and `runJobTargetingPipeline(...)` | These modules already own retry, validation, logging, and CV version persistence. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`] |
| Artifact persistence and billing | Direct `generateFile(...)` calls from routes or workers | `generateBillableResume(...)` | The service already owns quota checks, generation idempotency, `sourceCvSnapshot`, and `resume_generations` updates. [VERIFIED: `src/lib/resume-generation/generate-billable-resume.ts`] |
| Output lineage metadata | Route-local JSON blobs or signed URLs in jobs | `dispatchInputRef`, `buildSnapshotResultRef(...)`, and `buildResumeGenerationResultRef(...)` | The repo already froze stable durable refs for status consumers and later UI surfaces. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `src/types/jobs.ts`] |

**Key insight:** Phase 39 does not need a new worker architecture. It needs one thin runtime to connect the already-frozen durable job contract to the already-existing heavy business services. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | The affected persisted surfaces are `jobs`, `sessions.agent_state`, `sessions.generated_output`, `resume_targets.generated_output`, `resume_generations`, and `cv_versions`. [VERIFIED: `prisma/schema.prisma`, `src/lib/jobs/repository.ts`, `src/lib/db/sessions.ts`, `src/lib/db/resume-targets.ts`, `src/lib/db/resume-generations.ts`, `src/lib/db/cv-versions.ts`] | Code edits only; no rename or one-time data migration is evident from the phase scope. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`] |
| Live service config | No repo-visible external worker service or queue configuration exists for these pipelines; the only repo-visible cron surface is cleanup. [VERIFIED: `src/app/api/cron/cleanup/route.ts`, `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`] | None for Phase 39; keep processing in-app. [VERIFIED: `.planning/ROADMAP.md`] |
| OS-registered state | None found in repo-visible scripts or service descriptors. [VERIFIED: `package.json`, `.github/workflows/ci.yml`] | None. [VERIFIED: `package.json`] |
| Secrets/env vars | Existing OpenAI, Supabase, Prisma/DB, Asaas, Upstash, Clerk, and LinkdAPI surfaces remain the same; this phase does not require a new secret name or rename. [VERIFIED: `package.json`, `CLAUDE.md`, `src/lib/db/supabase-admin.ts`, `src/lib/openai/chat.ts`] | None. [VERIFIED: `CLAUDE.md`] |
| Build artifacts | No installed package or generated artifact naming issue was found for this phase. [VERIFIED: `package.json`] | None. [VERIFIED: `package.json`] |

## Common Pitfalls

### Pitfall 1: Starting durable jobs without a processor kickoff

**What goes wrong:** Jobs remain forever `queued` because `dispatchAsyncAction(...)` currently stops after `createJob(...)`. [VERIFIED: `src/lib/agent/async-dispatch.ts`]

**Why it happens:** There is no runtime today that calls `claimJob(...)` or dispatches a processor after job creation. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/jobs/repository.test.ts`]

**How to avoid:** Wire async dispatch and the artifact route to a shared same-app runtime entry point immediately after job creation or reuse. [VERIFIED: `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts`]

**Warning signs:** New jobs appear in the `jobs` table but no `claimedAt`, `startedAt`, or terminal refs ever change. [VERIFIED: `src/types/jobs.ts`, `src/lib/jobs/repository.ts`]

### Pitfall 2: Clearing the last good optimized state on failure

**What goes wrong:** A failed async rewrite removes the previously valid optimized snapshot and degrades preview or downstream artifact selection. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]

**Why it happens:** Current validation and `persist_version` failure branches still write `optimizedCvState: undefined`. [VERIFIED: `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`]

**How to avoid:** Preserve prior stable optimized fields in failure branches and only update run metadata, validation output, and failure status. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Warning signs:** Failed ATS or targeting runs leave the session with no optimized state even though a prior successful rewrite existed. [VERIFIED: `.planning/REQUIREMENTS.md`]

### Pitfall 3: Artifact processors using the wrong source snapshot

**What goes wrong:** Generated files drift from the preview source because the route or worker uses base `cvState` when the correct source is optimized or target-derived. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `.planning/REQUIREMENTS.md`]

**Why it happens:** The durable contract already encodes source-of-truth refs, but the current synchronous route still performs artifact generation inline and hides source selection inside request-bound logic. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `src/lib/agent/tools/index.ts`]

**How to avoid:** Create artifact jobs with `dispatchInputRef` from `resolveEffectiveResumeSource(...)` and complete them with `buildResumeGenerationResultRef(...)`. [VERIFIED: `src/lib/jobs/source-of-truth.ts`, `src/lib/agent/tools/index.ts`]

**Warning signs:** `/api/file/[sessionId]` serves a file that does not match the most recent previewed optimized or target-derived content. [VERIFIED: `src/app/api/file/[sessionId]/route.ts`, `.planning/REQUIREMENTS.md`]

### Pitfall 4: Expanding Phase 39 into setup UX contract work

**What goes wrong:** The phase balloons from worker execution into new status UX and setup-flow rewrites. [VERIFIED: `.planning/ROADMAP.md`, `src/components/resume/user-data-page.tsx`]

**Why it happens:** The setup screen expects `/api/profile/smart-generation` to succeed immediately with a `sessionId` and then redirects to the compare page. [VERIFIED: `src/components/resume/user-data-page.tsx`]

**How to avoid:** Keep Phase 39 focused on durable processor execution and the already-async request surfaces; defer richer setup-flow async UX to Phase 40 unless the plan explicitly accepts UI work. [VERIFIED: `.planning/ROADMAP.md`, `src/components/resume/user-data-page.tsx`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 39 should keep `/api/profile/smart-generation` and `/api/profile/ats-enhancement` on their current setup UX contract unless the plan explicitly absorbs UI/status work. [ASSUMED] | Summary / Common Pitfalls | The phase may need additional route and UI tasks before execution if setup-flow async migration is unexpectedly in scope. |
| A2 | Freshly queued artifact-job acknowledgements may not need a synchronous `resumeGenerationId` as long as the route keeps a stable acceptance contract and later status surfaces can resolve the job. [ASSUMED] | User Constraints / Open Questions | If the existing client or downstream APIs require `resumeGenerationId` immediately, the artifact dispatch design will need a different handoff shape. |

## Open Questions

1. **Should Phase 39 migrate the profile setup generation routes or keep them on the existing synchronous UX?**
   - What we know: the setup page immediately expects `success` plus `sessionId` from `/api/profile/smart-generation` and then redirects to compare. [VERIFIED: `src/components/resume/user-data-page.tsx`]
   - What's unclear: whether product scope for this phase accepts the compare-page or setup-flow status work that true async migration would introduce. [ASSUMED]
   - Recommendation: keep Phase 39 focused on worker execution behind the already-async surfaces unless the user explicitly widens scope. [ASSUMED]

2. **Should the job repository gain a first-class running-stage update helper?**
   - What we know: the repository exposes create, get, list, claim, complete, fail, and cancel, but not a running progress update API. [VERIFIED: `src/lib/jobs/repository.ts`]
   - What's unclear: whether execution will be cleaner with a repository-level `updateRunningJob(...)` helper or a runtime-local fenced update helper. [ASSUMED]
   - Recommendation: allow the implementation to choose the smaller change, but require ownership-fenced running updates either way. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TypeScript runtime, tests, local scripts | Yes. [VERIFIED: `node --version`] | `v24.14.0`. [VERIFIED: `node --version`] | None needed. |
| npm | Test and workspace commands | Yes. [VERIFIED: `npm --version`] | `11.9.0`. [VERIFIED: `npm --version`] | None needed. |
| Prisma CLI | Schema inspection and any DB-shape validation | Yes. [VERIFIED: `npx prisma --version`] | `5.22.0`. [VERIFIED: `npx prisma --version`] | None needed. |
| Vitest | Focused regression coverage | Yes. [VERIFIED: `package.json`, `vitest.config.ts`] | `1.6.1` in workspace. [VERIFIED: `package.json`] | None needed. |

**Missing dependencies with no fallback:**

- None identified for planning. [VERIFIED: `node --version`, `npm --version`, `npx prisma --version`, `package.json`]

**Missing dependencies with fallback:**

- None identified for planning. [VERIFIED: `node --version`, `npm --version`, `npx prisma --version`, `package.json`]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.1. [VERIFIED: `package.json`, `vitest.config.ts`] |
| Config file | `vitest.config.ts`. [VERIFIED: `vitest.config.ts`] |
| Quick run command | `npm run typecheck && npx vitest run src/lib/jobs/runtime.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/source-of-truth.test.ts "src/app/api/session/[id]/generate/route.test.ts" src/app/api/agent/route.sse.test.ts`. [VERIFIED: existing test layout; ASSUMED: new `src/lib/jobs/runtime.test.ts`] |
| Full suite command | `npm test`. [VERIFIED: `package.json`] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOB-02 | ATS and targeting jobs run through durable processors and preserve current business logic. [VERIFIED: `.planning/REQUIREMENTS.md`] | unit + integration | `npx vitest run src/lib/jobs/runtime.test.ts src/lib/agent/tools/pipeline.test.ts src/app/api/agent/route.sse.test.ts` | `runtime.test.ts` missing, others exist. [VERIFIED: `src/lib/agent/tools/pipeline.test.ts`, `src/app/api/agent/route.sse.test.ts`; ASSUMED: new `src/lib/jobs/runtime.test.ts`] |
| ART-01 | Artifact generation is dispatched durably and records snapshot or version lineage through `resume_generations`. [VERIFIED: `.planning/REQUIREMENTS.md`] | unit + route integration | `npx vitest run src/lib/jobs/runtime.test.ts src/lib/resume-generation/generate-billable-resume.test.ts "src/app/api/session/[id]/generate/route.test.ts"` | `runtime.test.ts` missing, others exist. [VERIFIED: `src/lib/resume-generation/generate-billable-resume.test.ts`, `src/app/api/session/[id]/generate/route.test.ts`; ASSUMED: new `src/lib/jobs/runtime.test.ts`] |
| STATE-01 | Failed async rewrites preserve last-good optimized state and artifact selection uses the effective source. [VERIFIED: `.planning/REQUIREMENTS.md`] | unit | `npx vitest run src/lib/agent/tools/pipeline.test.ts src/lib/jobs/source-of-truth.test.ts` | Both exist. [VERIFIED: `src/lib/agent/tools/pipeline.test.ts`, `src/lib/jobs/source-of-truth.test.ts`] |

### Wave 0 Gaps

- [ ] `src/lib/jobs/runtime.test.ts` - covers claim-safe kickoff, stale reclaim, processor dispatch, and terminal fencing for all durable job types. [ASSUMED]
- [ ] Update `src/lib/agent/tools/pipeline.test.ts` - proves failed ATS and target-job runs preserve the previous valid `optimizedCvState`. [VERIFIED: existing file at `src/lib/agent/tools/pipeline.test.ts`; ASSUMED: new assertions]
- [ ] Update `src/app/api/session/[id]/generate/route.test.ts` - proves artifact requests return durable acceptance instead of inline generation execution. [VERIFIED: existing file at `src/app/api/session/[id]/generate/route.test.ts`; ASSUMED: new assertions]
- [ ] Update `src/app/api/agent/route.sse.test.ts` - proves heavy chat-triggered dispatch now starts runtime kickoff rather than stopping at job creation. [VERIFIED: existing file at `src/app/api/agent/route.sse.test.ts`; ASSUMED: new assertions]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `src/lib/auth/app-user.ts`] | Keep route entry points behind `getCurrentAppUser()`. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`] |
| V3 Session Management | No new session-management behavior in this phase. [VERIFIED: `.planning/ROADMAP.md`, `src/app/api/session/[id]/generate/route.ts`] | Reuse existing auth/session stack unchanged. [VERIFIED: `AGENTS.md`, `CLAUDE.md`] |
| V4 Access Control | Yes. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/db/sessions.ts`, `src/lib/db/resume-targets.ts`] | Keep every job, session, and target load scoped by internal app `userId`. [VERIFIED: `src/lib/jobs/repository.ts`, `src/lib/db/sessions.ts`] |
| V5 Input Validation | Yes. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `AGENTS.md`] | Keep route bodies on `zod` schemas and treat job metadata as internal-only. [VERIFIED: `src/app/api/session/[id]/generate/route.ts`, `src/types/jobs.ts`] |
| V6 Cryptography | No new crypto design beyond existing hash-based idempotency keys. [VERIFIED: `src/lib/agent/async-dispatch.ts`] | Reuse Node `crypto` for stable fingerprints; do not hand-roll anything stronger. [VERIFIED: `src/lib/agent/async-dispatch.ts`] |

## Sources

### Primary (HIGH confidence)

- `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` - Phase 39 goal and requirement IDs.
- `AGENTS.md` and `CLAUDE.md` - project constraints and brownfield guardrails.
- `src/types/jobs.ts`, `src/lib/jobs/repository.ts`, `src/lib/jobs/source-of-truth.ts` - durable job contracts and source-of-truth rules.
- `src/lib/agent/async-dispatch.ts` - current dispatch seam and current no-op-after-create limitation.
- `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts` - current heavy rewrite business logic and failure-state behavior.
- `src/lib/resume-generation/generate-billable-resume.ts` - artifact generation, lineage, and idempotency behavior.
- `src/app/api/session/[id]/generate/route.ts` - current inline artifact request path.
- `src/lib/profile/pdf-import-jobs.ts`, `src/lib/linkedin/import-jobs.ts` - existing same-app async claim-and-process patterns.
- `src/components/resume/user-data-page.tsx` - current setup-flow UX coupling.

### Secondary (MEDIUM confidence)

- `package.json`, `vitest.config.ts`, `node --version`, `npm --version`, `npx prisma --version` - current local execution environment and test tooling.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - the phase reuses installed workspace tooling and local brownfield services rather than introducing new infrastructure. [VERIFIED: `package.json`, `src/lib/jobs/repository.ts`, `src/lib/resume-generation/generate-billable-resume.ts`]
- Architecture: MEDIUM - the existing processor primitives and business services are clear, but the exact artifact acceptance contract and running-progress helper shape still have design discretion. [VERIFIED: `src/lib/jobs/repository.ts`, `src/app/api/session/[id]/generate/route.ts`; ASSUMED: final acceptance shape]
- Pitfalls: HIGH - the main risks are already visible in current code paths and requirement text. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/agent/async-dispatch.ts`]

**Research date:** 2026-04-16
**Valid until:** 2026-05-16
