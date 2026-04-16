---
phase: 38
slug: refactor-api-agent-into-a-lightweight-orchestrator
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 38 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run src/lib/agent/action-classification.test.ts src/lib/agent/request-orchestrator.test.ts src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npx vitest run src/lib/agent/action-classification.test.ts src/lib/agent/request-orchestrator.test.ts src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | ORCH-01 / ORCH-02 | T-38-02 / T-38-04 | Action classification keeps lightweight chat synchronous, heavy ATS/targeting/artifact requests async, and durable dispatch uses Phase 37 idempotent job creation plus source-of-truth refs. | unit | `npx vitest run src/lib/agent/action-classification.test.ts` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | ORCH-01 / ORCH-02 | T-38-01 / T-38-03 | The thin route and extracted orchestrator preserve auth, session load/create, `X-Session-Id`, `sessionCreated`, target detection, and text-only async acknowledgement ordering. | unit + integration | `npx vitest run src/lib/agent/request-orchestrator.test.ts src/app/api/agent/route.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 38-01-03 | 01 | 1 | ORCH-01 / ORCH-02 | T-38-02 / T-38-03 / T-38-04 | Heavy ATS/job-targeting/artifact work no longer runs inline in `pre-loop-setup` or `agent-loop`, and async acknowledgement paths persist transcript turns before completing the request. | unit + integration | `npx vitest run src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts src/app/api/agent/route.sse.test.ts` | ✅ | ⬜ pending |
| 38-01-04 | 01 | 1 | ORCH-01 / ORCH-02 | T-38-01 / T-38-02 / T-38-03 / T-38-04 | Focused orchestration regressions stay green together before the phase closes, proving sync chat parity and async handoff behavior under the same route surface. | integration | `npm run typecheck && npx vitest run src/lib/agent/action-classification.test.ts src/lib/agent/request-orchestrator.test.ts src/lib/agent/pre-loop-setup.test.ts src/lib/agent/agent-persistence.test.ts src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/agent/action-classification.test.ts` - covers `AgentActionType` mapping, `resolveExecutionMode(...)`, `Aceito` generation classification, target-job rewrite classification, and sync-chat fallbacks.
- [ ] `src/lib/agent/request-orchestrator.test.ts` - covers app-user auth, session load/create, target detection, `X-Session-Id`, `sessionCreated`, and text-only async acknowledgement ordering.
- [ ] Update `src/lib/agent/pre-loop-setup.test.ts` - proves ATS enhancement and job-targeting no longer execute inline in the request path.
- [ ] Update `src/app/api/agent/route.test.ts` and `src/app/api/agent/route.sse.test.ts` - prove `/api/agent` keeps sync chat streaming while heavy actions acknowledge and dispatch through durable jobs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm the browser-visible chat UX still feels immediate for lightweight prompts while heavy prompts return an acknowledgement instead of hanging on inline work. | ORCH-01 | Automated route tests prove protocol behavior, but not subjective UX pacing in the real client. | Run the app, send a lightweight chat prompt, then send a heavy ATS/targeting/generation trigger and confirm the first still streams normally while the second acknowledges without inline pipeline delay. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
