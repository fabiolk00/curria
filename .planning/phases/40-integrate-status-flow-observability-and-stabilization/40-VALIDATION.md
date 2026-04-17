---
phase: 40
slug: integrate-status-flow-observability-and-stabilization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 40 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/hooks/use-session-documents.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~55 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/hooks/use-session-documents.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 55 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | OBS-01 | T-40-01 / T-40-02 | Generic durable-job reads and session-scoped job projections stay user-scoped, preserve the frozen `JobStatusSnapshot` contract, and do not invent new lifecycle vocabulary. | route + contract | `npx vitest run src/app/api/jobs/[jobId]/route.test.ts src/app/api/session/[id]/route.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 40-01-02 | 01 | 1 | OBS-01 / TEST-01 | T-40-02 / T-40-04 | Workspace and document polling surfaces distinguish queued, running, failed, and ready states without treating a 202 durable ack as synchronous success. | component + hook | `npx vitest run src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/hooks/use-session-documents.test.tsx` | ✅ / ✅ / ❌ W0 | ⬜ pending |
| 40-01-03 | 01 | 1 | OBS-01 | T-40-03 / T-40-05 | Dispatch, runtime, and status surfaces log consistent job correlation fields and status routes remain read-only and retry-safe. | route + integration | `npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/file/[sessionId]/route.test.ts src/app/api/jobs/[jobId]/route.test.ts` | ✅ / ✅ / ✅ / ❌ W0 | ⬜ pending |
| 40-01-04 | 01 | 1 | TEST-01 | T-40-01 / T-40-02 / T-40-03 / T-40-04 / T-40-05 | Sync chat parity, async job acknowledgement, worker terminal status handling, and artifact consistency all stay green together before the phase closes. | integration | `npm run typecheck && npx vitest run src/app/api/agent/route.sse.test.ts src/lib/agent/request-orchestrator.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/session/[id]/route.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/hooks/use-session-documents.test.tsx` | Mixed; see W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/jobs/[jobId]/route.test.ts` - proves generic durable-job status reads are authenticated, user-scoped, and contract-stable.
- [ ] `src/hooks/use-session-documents.test.tsx` - proves artifact polling distinguishes generating, failed, and ready states instead of relying on missing URLs alone.
- [ ] Update `src/app/api/session/[id]/route.test.ts` - proves the workspace payload now includes session-scoped durable job snapshots.
- [ ] Update `src/app/api/file/[sessionId]/route.test.ts` - proves the file route returns artifact availability plus latest artifact-job status summary without hiding terminal failures.
- [ ] Update `src/components/dashboard/resume-workspace.test.tsx` - proves 202 durable acknowledgements no longer map to unconditional success copy.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm the dashboard shows a generation-in-progress state before the file becomes downloadable, then transitions cleanly to ready or failed without a page reload. | OBS-01 | Automated tests can prove the route and component branches, but not the full perceived pacing of the real browser flow. | Run the app, start a base resume generation, observe the queued/running state in the workspace or documents surface, then confirm the UI transitions to ready or failed once the job finishes. |
| Confirm chat streaming still feels synchronous for lightweight chat while heavy actions hand off to durable jobs. | TEST-01 | Automated tests prove the route contract but not the end-user pacing under a live app session. | Run the app, send a lightweight chat message, then trigger an ATS or targeting action and confirm text streaming remains normal while the background job status appears separately. |

---

## Validation Sign-Off

- [ ] All tasks have automated verification or explicit Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing test references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
