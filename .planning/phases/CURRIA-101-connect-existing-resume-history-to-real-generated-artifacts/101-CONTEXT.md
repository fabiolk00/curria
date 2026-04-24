# Phase 101 Context

## User Goal

Connect the existing `Currículos recentes` UI to real generated-resume history without redesigning the page from scratch.

The phase must cover:

- durable persistence support for history metadata
- source-kind differentiation for `chat`, `ats_enhancement`, and `target_job`
- authenticated read API with `page` and `limit`
- protected PDF download behavior
- viewer/open behavior that reuses existing compare/preview routes when possible
- integration of the existing history layout with real data
- focused service, API, and UI tests

## Existing UI Direction To Preserve

The repo already contains a dedicated history page and card components:

- `src/app/(auth)/dashboard/resumes-history/page.tsx`
- `src/components/resume/generated-resume-history-page.tsx`
- `src/components/resume/generated-resume-history.tsx`
- `src/components/resume/generated-resume-card.tsx`

Preserve as much of the current visual direction as possible:

- light dashboard background
- white rounded cards
- document icon area
- status badge placement
- footer timestamp area
- open arrow action
- card grid

Only replace mock/static content with real mapped data and add the missing states/actions.

## Existing Backend Seams Already In The Repo

- `resume_generations` already exists as the billing-aware durable export table.
- `generateBillableResume(...)` already owns idempotent creation/update for generation rows.
- `/api/file/[sessionId]` already enforces ownership and returns safe artifact access data.
- `/dashboard/resume/compare/[sessionId]` already exists as the reusable viewer/open route.
- Chat generations already carry a distinct idempotency-key prefix: `generation:{sessionId}:chat:{scope}:...`.
- Smart profile generations already carry distinct prefixes such as `profile-ats:` and `profile-target:`.

## Brownfield Constraints

- Do not replace the current billing or replay architecture.
- Keep `resume_generations.type` stable for billing concerns; history-source semantics may need a separate metadata seam.
- Do not expose raw storage paths, bucket names, or another user's session IDs.
- Reuse `/api/file/[sessionId]` and existing compare/preview seams wherever possible.
- Keep route handlers thin and validate external input with `zod`.
- Preserve `generatedOutput` as artifact metadata only; do not move mutable UI state there.

## Files Already Inspected

- `prisma/schema.prisma`
- `prisma/migrations/20260412_resume_generation_billing.sql`
- `src/lib/db/resume-generations.ts`
- `src/lib/resume-generation/generate-billable-resume.ts`
- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/generate-file-intake.ts`
- `src/lib/routes/file-access/context.ts`
- `src/lib/routes/file-access/decision.ts`
- `src/lib/routes/file-access/response.ts`
- `src/lib/routes/session-comparison/decision.ts`
- `src/components/resume/generated-resume-history*.tsx`
- `src/lib/generated-resume-mock.ts`

## Product Rules For This Phase

- show at most the latest 6 history items
- paginate 4 cards per page
- support `completed`, `processing`, and `failed` card states
- only show PDF download when an artifact is available
- viewer/open should use the existing compare route when `sessionId` exists
- loading, empty, and error states must be explicit
