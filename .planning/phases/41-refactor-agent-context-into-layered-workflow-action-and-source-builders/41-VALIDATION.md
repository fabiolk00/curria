---
phase: 41
slug: refactor-agent-context-into-layered-workflow-action-and-source-builders
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 41 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run typecheck && npx vitest run src/lib/agent/context-builder.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/rewrite-section.test.ts src/lib/agent/tools/validate-rewrite.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | ~60 seconds |

## Sampling Rate

- After every task commit: run the quick run command.
- After every plan wave: run `npm test`.
- Before phase closeout: full suite must be green.

## Per-Task Verification Map

| Task ID | Requirement | Test Type | Automated Command | Status |
|---------|-------------|-----------|-------------------|--------|
| 41-01-01 | CTX-01 | unit + integration | `npx vitest run src/lib/agent/context-builder.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts` | pending |
| 41-01-02 | CTX-02 | unit | `npx vitest run src/lib/agent/context-builder.test.ts` | pending |
| 41-01-03 | TEST-02 | pipeline + unit | `npx vitest run src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/rewrite-section.test.ts src/lib/agent/tools/validate-rewrite.test.ts` | pending |
| 41-01-04 | CTX-01 / CTX-02 / TEST-02 | integration | `npm run typecheck && npx vitest run src/lib/agent/context-builder.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/rewrite-section.test.ts src/lib/agent/tools/validate-rewrite.test.ts` | pending |

## Wave 0 Requirements

- [ ] Add tests for inspectable context debug metadata.
- [ ] Update streaming prompt regression for the action-aware compatibility wrapper.
- [ ] Update rewrite-path tests so shared base/workflow/source guardrails are asserted explicitly.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm lightweight chat still feels concise while rewrite flows remain rich and grounded. | TEST-02 | Automated tests prove contract shape, not subjective response feel. | Run a lightweight chat turn and a rewrite-oriented turn in the app and compare the response shape. |

## Validation Sign-Off

- [ ] All tasks have automated verification or explicit Wave 0 dependencies
- [ ] Sampling continuity is maintained
- [ ] No watch-mode commands are used
- [x] `nyquist_compliant: true` is set in frontmatter
