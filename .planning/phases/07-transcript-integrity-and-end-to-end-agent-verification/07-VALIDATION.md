---
phase: 07
slug: transcript-integrity-and-end-to-end-agent-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 07 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing Vitest component and route suites plus Playwright Chromium and TypeScript checks |
| **Config files** | `vitest.config.ts`, `playwright.config.ts`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` |
| **Quick run command** | `npm run typecheck` |
| **Primary targeted suite** | `npm test -- src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts` |
| **Browser regression** | `npm run test:e2e -- tests/e2e/chat-transcript.spec.ts --project=chromium` |
| **Static planning audit** | `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` |
| **Estimated runtime** | ~240 seconds for typecheck, focused Vitest, CLI help checks, and one focused Chromium spec |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After Wave 1:** Run the focused `ChatInterface` transcript tests
- **After Wave 2:** Run the real-route transcript integration suite plus the focused Chromium regression
- **Before phase verification:** Re-run the full focused verification bundle plus `state validate`
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | UX-01 | T-07-01 / T-07-02 | One request updates exactly one in-flight assistant bubble even when text, recoverable error, and done chunks all fire | unit | `npm test -- src/components/dashboard/chat-interface.test.tsx` | yes | pending |
| 07-01-02 | 01 | 1 | UX-01 | T-07-01 / T-07-02 | Session-history hydration and done-snapshot refetch do not overwrite a richer optimistic transcript with stale or shorter assistant content | unit | `npm test -- src/components/dashboard/chat-interface.test.tsx` | yes | pending |
| 07-02-01 | 02 | 2 | UX-01, QA-04 | T-07-03 | The real `/api/agent` route stream renders the same final assistant transcript the backend intended for degraded `dialog` flows | integration | `npm test -- src/components/dashboard/chat-interface.route-stream.test.tsx src/app/api/agent/route.sse.test.ts src/app/api/agent/route.model-selection.test.ts` | planned | pending |
| 07-02-02 | 02 | 2 | UX-01, QA-04 | T-07-03 | Chromium browser coverage catches repeated bootstrap text, duplicate assistant bubbles, and transcript instability after session hydration | browser | `npm run test:e2e -- tests/e2e/chat-transcript.spec.ts --project=chromium` | planned | pending |
| 07-03-01 | 03 | 3 | QA-04, QA-05 | T-07-04 | Operator replay tooling captures release headers, SSE sequence, and final assistant text for a scripted `reescreva` flow | unit + CLI | `npm test -- scripts/replay-agent-dialog.test.ts && npx tsx scripts/replay-agent-dialog.ts --help` | planned | pending |
| 07-03-02 | 03 | 3 | QA-04, QA-05 | T-07-03 / T-07-04 | Final docs and verification bundle tie route model selection, transcript rendering, browser proof, and replay evidence into one reproducible closeout flow | unit + browser + static audit | `npm run typecheck && npm test -- src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts && npm run test:e2e -- tests/e2e/chat-transcript.spec.ts --project=chromium && npx tsx scripts/replay-agent-dialog.ts --help && node .codex/get-shit-done/bin/gsd-tools.cjs state validate` | planned | pending |

*Status: pending, green, red, or flaky.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No extra harness is needed before execution.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real deployed vacancy -> `reescreva` flow produces one coherent visible assistant turn | UX-01, QA-05 | Requires live deployment parity and a representative production-like conversation | Run `npm run agent:parity -- --url <deployment> ...`, then replay one real vacancy -> `reescreva` flow with the transcript replay tooling from Plan 03 and capture the visible assistant result. |
| The visible transcript can be correlated with route provenance and fallback metadata | QA-04, QA-05 | Requires live headers, logs, and operator access | Capture release headers, request ID, SSE transcript, and final visible assistant bubble, then compare them with the replay guidance added in Phase 7 docs. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 300s for repo-local checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-10
