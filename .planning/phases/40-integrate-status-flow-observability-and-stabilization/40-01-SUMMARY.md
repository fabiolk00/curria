---
phase: 40-integrate-status-flow-observability-and-stabilization
plan: 01
subsystem: jobs
title: Durable status surfaces, dashboard polling, and async observability
tags: [jobs, dashboard, api, observability, vitest]
requires:
  - phase-38-orchestrator-handoff
  - phase-39-durable-processors
provides:
  - canonical-job-status-route
  - session-scoped-job-projection
  - artifact-lifecycle-polling
  - workspace-durable-acknowledgement-tracking
  - correlated-async-logs
requirements-completed:
  - OBS-01
  - TEST-01
---

# Phase 40 Plan 01 Summary

Durable async execution is now visible to both the brownfield dashboard and operators through canonical status reads, artifact lifecycle polling, and structured dispatch-to-runtime logs.

## What Changed

- Added [src/app/api/jobs/[jobId]/route.ts](/c:/CurrIA/src/app/api/jobs/[jobId]/route.ts) plus [src/app/api/jobs/[jobId]/route.test.ts](/c:/CurrIA/src/app/api/jobs/[jobId]/route.test.ts) as the canonical user-scoped durable job read surface. It returns the frozen `JobStatusSnapshot` contract unchanged and stays strictly read-only.
- Extended [src/lib/jobs/repository.ts](/c:/CurrIA/src/lib/jobs/repository.ts) and [src/app/api/session/[id]/route.ts](/c:/CurrIA/src/app/api/session/[id]/route.ts) so workspace reads now project a top-level `jobs` array, with aligned browser contracts in [src/types/dashboard.ts](/c:/CurrIA/src/types/dashboard.ts) and [src/lib/dashboard/workspace-client.ts](/c:/CurrIA/src/lib/dashboard/workspace-client.ts).
- Updated [src/app/api/file/[sessionId]/route.ts](/c:/CurrIA/src/app/api/file/[sessionId]/route.ts) so artifact reads now return `available` plus durable lifecycle fields such as `generationStatus`, `jobId`, `stage`, `progress`, and safe failure messages, while still serving signed URLs when a last valid PDF exists.
- Updated [src/hooks/use-session-documents.ts](/c:/CurrIA/src/hooks/use-session-documents.ts), [src/hooks/use-session-documents.test.tsx](/c:/CurrIA/src/hooks/use-session-documents.test.tsx), [src/components/dashboard/session-documents-panel.tsx](/c:/CurrIA/src/components/dashboard/session-documents-panel.tsx), and [src/components/dashboard/session-documents-panel.test.tsx](/c:/CurrIA/src/components/dashboard/session-documents-panel.test.tsx) so the sidebar can distinguish generating, failed, and ready artifact states instead of disappearing when no URL is present yet.
- Updated [src/components/dashboard/resume-workspace.tsx](/c:/CurrIA/src/components/dashboard/resume-workspace.tsx), [src/components/dashboard/workspace-side-panel.tsx](/c:/CurrIA/src/components/dashboard/workspace-side-panel.tsx), and [src/components/dashboard/resume-workspace.test.tsx](/c:/CurrIA/src/components/dashboard/resume-workspace.test.tsx) so base-file generation acknowledgements keep the returned `jobId`, show in-progress copy, and poll the session workspace until that exact durable job reaches a terminal state.
- Added correlated async observability in [src/lib/agent/async-dispatch.ts](/c:/CurrIA/src/lib/agent/async-dispatch.ts) and [src/lib/jobs/runtime.ts](/c:/CurrIA/src/lib/jobs/runtime.ts) so dispatch, runtime completion, and runtime failure logs all carry the durable identifiers needed to trace one job across boundaries.

## Verification

- `npm run typecheck`
- `npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/hooks/use-session-documents.test.tsx`

## Notes

- The async status flow stays transport-agnostic in this phase: polling routes remain read-only, and `/api/agent` SSE behavior for lightweight chat remains unchanged.
- The resume-workspace regression suite still emits a pre-existing Radix dialog ref warning when the rewrite-failure modal renders, but the focused validation commands pass green.
