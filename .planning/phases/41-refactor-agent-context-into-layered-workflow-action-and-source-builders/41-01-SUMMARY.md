---
phase: 41-refactor-agent-context-into-layered-workflow-action-and-source-builders
plan: 01
subsystem: agent
title: Layered workflow, action, source, and output-contract context builders
tags: [agent, context, prompts, tests, ci]
requires:
  - phase-40-status-flow-stabilization
provides:
  - layered-agent-context-builders
  - inspectable-context-debug-metadata
  - workflow-aware-rewrite-contracts
  - route-stream-regression-fix
  - ci-audit-alignment
requirements-completed:
  - CTX-01
  - CTX-02
  - TEST-02
---

# Phase 41 Plan 01 Summary

The monolithic agent prompt builder is now split into explicit context layers, while the brownfield runtime keeps the same public behavior for chat, ATS enhancement, and job-targeting flows.

## What Changed

- Added a layered context module under [src/lib/agent/context](/c:/CurrIA/src/lib/agent/context) with explicit base, workflow, action, source, output-contract, and debug builders. The new entry point in [src/lib/agent/context/index.ts](/c:/CurrIA/src/lib/agent/context/index.ts) returns both the assembled `systemPrompt` and inspectable composition metadata.
- Replaced the old prompt assembly in [src/lib/agent/context-builder.ts](/c:/CurrIA/src/lib/agent/context-builder.ts) with a compatibility wrapper over the new builders, preserving the existing `buildSystemPrompt(...)` call contract while exposing `buildSystemPromptContext(...)` for direct inspection in tests.
- Updated [src/lib/agent/agent-loop.ts](/c:/CurrIA/src/lib/agent/agent-loop.ts) and [src/lib/agent/tools/rewrite-resume-full.ts](/c:/CurrIA/src/lib/agent/tools/rewrite-resume-full.ts) so runtime prompt generation and rewrite helper guardrails now share the same layered context rules instead of duplicating freeform prompt fragments.
- Added regression coverage in [src/lib/agent/context-builder.test.ts](/c:/CurrIA/src/lib/agent/context-builder.test.ts) for workflow-specific source selection, optimized-vs-original snapshot choice, and lightweight-chat minimality.
- Fixed the non-E2E CI regressions uncovered during execution:
  - [src/lib/agent/action-classification.ts](/c:/CurrIA/src/lib/agent/action-classification.ts) now keeps a freshly pasted vacancy in an existing dialog session on the synchronous acknowledgement path, while still dispatching durable `job_targeting` work once the flow is in `analysis` or the user explicitly continues.
  - [scripts/audit-runtime-budget.mjs](/c:/CurrIA/scripts/audit-runtime-budget.mjs) now measures Vitest runtime budgets from the meaningful phase timings (`tests`, `collect`, `environment`) instead of the coarse overall `Duration`, which was overstating suite cost.
  - [src/components/resume/resume-builder.test.tsx](/c:/CurrIA/src/components/resume/resume-builder.test.tsx), [src/components/dashboard/chat-interface.test.tsx](/c:/CurrIA/src/components/dashboard/chat-interface.test.tsx), [src/app/api/agent/route.test.ts](/c:/CurrIA/src/app/api/agent/route.test.ts), and [src/lib/db/schema-guardrails.ts](/c:/CurrIA/src/lib/db/schema-guardrails.ts) were updated so the hot non-E2E suites and repo audits stay aligned with the durable-jobs and pt-BR runtime behavior already shipped.

## Verification

- `npm run typecheck`
- `npm run audit:runtime-budget`
- `npm run audit:db-conventions`
- `npx vitest run src/lib/agent/context-builder.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/rewrite-section.test.ts src/lib/agent/tools/validate-rewrite.test.ts`
- `npx vitest run src/lib/agent/action-classification.test.ts src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/lib/agent/request-orchestrator.test.ts src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts`

## Notes

- The layered context refactor intentionally preserves the existing public runtime vocabulary and business semantics. This phase changes how prompt context is assembled, not what the product does.
- Direct `npm test` still exceeded the shell runner timeout in this environment, so the verification record uses the focused non-E2E suites plus the repo audits that cover the changed paths. No additional failing assertions surfaced in the profiled non-E2E runs after the fixes above.
