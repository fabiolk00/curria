---
phase: 39
slug: move-ats-targeting-and-artifact-work-into-async-processors
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 39 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run src/lib/jobs/runtime.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/source-of-truth.test.ts "src/app/api/session/[id]/generate/route.test.ts" src/app/api/agent/route.sse.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~50 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npx vitest run src/lib/jobs/runtime.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/source-of-truth.test.ts "src/app/api/session/[id]/generate/route.test.ts" src/app/api/agent/route.sse.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | JOB-02 / ART-01 | T-39-02 / T-39-04 | Durable job kickoff claims at most one owner, fences terminal writes, and dispatches the correct processor for ATS, targeting, and artifact jobs. | unit | `npx vitest run src/lib/jobs/runtime.test.ts` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 1 | JOB-02 / STATE-01 | T-39-02 / T-39-05 | ATS and targeting processors reuse existing business logic while failed validation or persist-version paths preserve the previous valid optimized state. | unit + integration | `npx vitest run src/lib/agent/tools/pipeline.test.ts src/app/api/agent/route.sse.test.ts` | ✅ / ✅ | ⬜ pending |
| 39-01-03 | 01 | 1 | ART-01 / STATE-01 | T-39-03 / T-39-04 | Artifact generation is dispatched durably, keeps effective snapshot selection, and records resume-generation lineage instead of signed URLs. | unit + route integration | `npx vitest run src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/source-of-truth.test.ts "src/app/api/session/[id]/generate/route.test.ts"` | ✅ / ✅ / ✅ | ⬜ pending |
| 39-01-04 | 01 | 1 | JOB-02 / ART-01 / STATE-01 | T-39-01 / T-39-02 / T-39-03 / T-39-04 / T-39-05 | Focused runtime, pipeline, source-of-truth, and route handoff regressions all stay green together before the phase closes. | integration | `npm run typecheck && npx vitest run src/lib/jobs/runtime.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/source-of-truth.test.ts "src/app/api/session/[id]/generate/route.test.ts" src/app/api/agent/route.sse.test.ts` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/jobs/runtime.test.ts` - covers same-app kickoff, stale reclaim, processor dispatch, and owner-fenced terminal writes.
- [ ] Update `src/lib/agent/tools/pipeline.test.ts` - proves failed ATS and target-job runs preserve the previous valid `optimizedCvState`.
- [ ] Update `src/app/api/session/[id]/generate/route.test.ts` - proves the route returns durable acceptance instead of inline `generate_file` execution and keeps auth/trust/career-fit gates intact.
- [ ] Update `src/app/api/agent/route.sse.test.ts` - proves heavy agent dispatch now starts runtime kickoff instead of stopping at job creation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm a heavy chat-triggered rewrite still acknowledges immediately while the job later completes through the durable runtime. | JOB-02 | Automated tests prove the contract, but not user-perceived pacing in the real app. | Run the app, trigger an ATS or targeting flow from chat, confirm the acknowledgement arrives immediately, then verify the resulting session state updates after processing completes. |
| Confirm generated artifact download still matches the most recent previewed effective source. | ART-01 / STATE-01 | Automated tests can prove source selection and lineage, but not the full browser-visible compare/download flow. | Generate an optimized or target-derived resume, request artifact generation, and verify the downloaded file content matches the previewed version. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
