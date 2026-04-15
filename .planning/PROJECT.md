# CurrIA

## What This Is

CurrIA is an AI-powered resume optimization platform for Brazilian job seekers. It ships the core funnel for profile seeding, conversational analysis, deterministic ATS enhancement, deterministic target-job rewriting, artifact generation, and paid usage. The current brownfield baseline now includes smaller agent-runtime seams, stricter authenticated-route and billing trust boundaries, release-critical browser gates, and explicit non-E2E runtime profiling proof.

## Core Value

A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## Current State

**Latest shipped version:** `v1.4 Agent Core Modularization, Security Hardening, and Release Stability` shipped on 2026-04-15.

**What is now true:**
- live `/api/agent` traffic exposes provenance and follows a documented parity contract
- resume-only flows run a deterministic ATS-enhancement pipeline
- resume-plus-job flows run a deterministic target-job rewrite pipeline
- `/dashboard/resume/new` branches by context instead of forcing ATS only
- OpenAI and PDF ingestion paths have stronger resilience and clearer failure modes
- security, billing, file-access, and JSON persistence boundaries are more explicit and test-backed
- the repo now has a staged hygiene baseline for unused imports, dead exports, orphan files, and dependency review
- dead-code false positives are explicitly classified before deletion work, keeping framework and test entrypoints safe
- dependency hygiene and sustained enforcement are now documented, configured, and reflected in CI and contributor workflow
- the main agent route now exposes first-response timing evidence, earlier existing-session progress, reduced ATS chat blocking, deterministic continuation fast paths, and phase-specific runtime budgets
- adjacent generation, download, and import-status routes now emit clearer latency and degradation logs for operator debugging
- the agent runtime is split across dedicated seams for message preparation, vacancy detection, pre-loop setup, recovery, streaming, and persistence
- sensitive browser mutations and checkout now rely on canonical host and shared browser-trust validation rather than raw request origin
- long-vacancy generation is covered by a release-critical browser gate, and non-E2E runtime profiling is now exposed through one canonical local or CI command

## Current Milestone

No active milestone is defined yet.

**Status:** `v1.4` is archived. The next milestone should start from fresh requirements rather than extending the archived roadmap.

## Next Milestone Goals

- backfill or replace the missing verification layer that made `v1.4` audit-incomplete, especially if future archive quality matters
- decide whether the residual non-E2E runtime over the strict local 2-minute ceiling is acceptable debt or should become planned work
- define the next highest-leverage brownfield milestone from fresh requirements instead of carrying forward stale roadmap state

<details>
<summary>Archived milestone focus: v1.4 Agent Core Modularization, Security Hardening, and Release Stability</summary>

**Goal:** Make the agent core easier to change safely, tighten trust boundaries on authenticated and billing-sensitive routes, and raise generation and release stability before new feature breadth.

**Target features:**
- extract the core agent route and loop into smaller, testable services for message preparation, vacancy detection, pre-loop setup, retry and recovery, streaming, and persistence
- stop trusting raw request origin for checkout and external returns, and add explicit origin or CSRF enforcement for sensitive authenticated mutations
- fix the long vacancy generation regression, remove broken text encoding artifacts, and strengthen CI gates around workspace, preview, and release stability
- reduce structural non-E2E test runtime waste and expose repeatable runtime proof in CI

</details>

<details>
<summary>Archived milestone focus: v1.3 Agent Response Time and Runtime Performance</summary>

**Goal:** Make the agent feel faster everywhere the user notices it, with explicit priority on ATS enhancement and chat responsiveness.

**Target features:**
- latency instrumentation for the main agent request path
- faster first response in chat and ATS enhancement flows
- reduced synchronous request-path work
- runtime refactor that makes further latency optimization safer
- before or after performance proof and autonomous execution guidance

</details>

<details>
<summary>Archived milestone focus: v1.2 Code Hygiene and Dead Code Reduction</summary>

**Goal:** Reduce dead code, dependency drift, and maintenance noise without breaking runtime-critical brownfield behavior.

**Target features:**
- dead-code tooling baseline for imports, exports, orphan files, and unused dependencies
- staged cleanup flow for imports, locals, exports, files, and packages
- safer long-term enforcement in lint, TypeScript, editor workflow, and CI without tripping on Next.js or dynamic-runtime false positives

</details>

<details>
<summary>Archived milestone focus: v1.1 Agent Reliability and Response Continuity</summary>

**Goal:** Prove what code and model configuration the live `/api/agent` route is serving, eliminate truncation-driven repetition, and verify that the final user-visible transcript stays trustworthy end to end.

**Target features:**
- deployment and runtime evidence that identifies the live agent route version, selected model, and recovery path for a real request
- dialog-turn hardening so requests like `reescreva` produce an actual rewrite or a non-repetitive continuation instead of reusing the vacancy bootstrap
- end-to-end transcript and SSE verification that proves the user-visible chat output matches the backend recovery behavior
- operator replay tooling that captures release headers, SSE events, and final assistant text for the representative vacancy to `reescreva` incident flow

</details>

## Requirements

### Validated

- [x] User can authenticate, reach the workspace, and resume intended flows after login or signup.
- [x] User can seed a canonical profile from LinkedIn or manual editing and reuse it in new sessions.
- [x] User can run conversational resume analysis and section rewriting against persisted session state.
- [x] User can create job-targeted resume variants without overwriting the base resume.
- [x] User can generate DOCX and PDF resume artifacts from current resume state.
- [x] Paid usage can be enforced through credit-backed session creation and Asaas billing flows.
- [x] Paid users can track job applications inside the dashboard.
- [x] Phase 1: Runtime, CI, and operator docs share the same provider contract and fail fast on missing critical configuration.
- [x] Phase 2: Browser verification covers auth, manual profile setup, session creation, target outcome, preview readiness, artifact delivery, and CI gating for the core funnel.
- [x] Phase 3: Billing settlement, replay safety, and dashboard credit totals are validated end to end with live evidence.
- [x] Phase 4: Production debugging is fast enough to diagnose agent, billing, session, file, webhook, and profile import failures, and the core funnel now surfaces safer actionable error states.
- [x] Phase 5: `/api/agent` now exposes release provenance, a safe parity CLI and runbook exist, and automated coverage protects the runtime evidence contract.
- [x] Phase 6: Dialog follow-ups now preserve rewrite intent, degraded recovery avoids stale vacancy-bootstrap repetition, and `dialog` plus `confirm` share one explicit model-routing contract.
- [x] Phase 7: The visible chat transcript now stays coherent through recovery paths, route-to-UI and Chromium transcript regressions are committed, and operators can replay the representative incident with provenance-aware evidence.
- [x] Phase 8: Resume-only sessions now run deterministic ATS enhancement with persisted optimized snapshots and export-aware versioning.
- [x] Phase 9: ATS enhancement now has section-aware retries, stronger validation, and structured observability.
- [x] Phase 10: Resume-plus-job sessions now run deterministic target-job rewriting with targeting plans, factual validation, and target-linked persistence.
- [x] Phase 11: `/dashboard/resume/new` now chooses ATS enhancement or target-job adaptation by context through one smart generation entrypoint.
- [x] Phase 12: OpenAI and PDF import paths now fail more safely through circuit-breaker protections and async PDF processing.
- [x] Phase 13: LGPD handling, secret boundaries, and the E2E auth bypass now have stronger contracts and verification.
- [x] Phase 14: TypeScript-aware quality gates and test visibility are documented and enforced at a useful baseline.
- [x] Phase 15: Session persistence is split across narrower internal modules instead of one large orchestration file.
- [x] Phase 16: Middleware, webhook, and file-access security boundaries now have committed fail-closed proof.
- [x] Phase 17: Billing settlement, replay, and webhook invariants now have focused regression proof.
- [x] Phase 18: File-access ownership and storage or RLS boundary claims are now explicitly separated and documented.
- [x] Phase 19: High-value JSON persistence seams now have an explicit contract matrix and narrower typed repository boundaries.
- [x] Phase 20: The repo exposes a safe dead-code detection toolchain for imports, exports, orphan files, and dependencies.
- [x] Phase 21: Unused imports and low-risk unused locals can be removed automatically or near-automatically in agreed scopes.
- [x] Phase 22: Unused exports, orphan files, and packages can be inventoried and reduced with manual verification for dynamic runtime seams.
- [x] Phase 23: Sustained code-hygiene enforcement is documented and wired into lint, TypeScript, editor, or CI flows only after the repo is clean enough to support it.
- [x] Phase 24: The repo can measure request-stage latency for user-visible agent flows, including first SSE emission and first useful assistant response timing.
- [x] Phase 25: Chat interactions respond faster in practice through reduced blocking work before visible output.
- [x] Phase 26: ATS enhancement flows complete faster by removing or deferring non-essential synchronous work without compromising canonical state or billing safety.
- [x] Phase 27: The milestone ended with before or after latency proof, focused regression verification, and autonomous execution guidance that keeps future work aligned to response-time priorities.
- [x] Phase 28: The agent route front half now delegates message preparation, vacancy detection, and pre-loop setup through smaller services with targeted regression proof.
- [x] Phase 29: Recovery, streaming, and persistence now live behind narrower runtime seams with direct handoff tests.
- [x] Phase 30: Checkout and sensitive authenticated mutations now enforce canonical-host or trusted-browser boundaries with committed regression proof.
- [x] Phase 31: Long-vacancy generation and release-critical browser stability are protected by committed regression and CI gates.
- [x] Phase 31.1: Non-E2E runtime defaults, artificial delay removal, and CI-visible profiling proof now exist, with residual runtime debt explicitly documented.

### Active

- [ ] Define the next milestone from fresh requirements after reviewing the residual `v1.4` audit and runtime debt.

### Out of Scope

- broad onboarding expansion such as PDF profile upload unless it becomes required to unblock the current hardening work
- a full product-surface redesign while the milestone is focused on architecture, safety, and release reliability
- provider swaps or billing-model redesigns instead of hardening the existing brownfield integrations
- speculative cleanup unrelated to agent maintainability, trust boundaries, or generation stability

## Context

- The codebase is a Next.js 14 App Router monolith with Clerk auth, Supabase/Postgres persistence, Prisma migrations, OpenAI agent orchestration, Asaas billing, and LinkdAPI profile import.
- v1.0 hardened launch-critical configuration, browser verification, billing settlement validation, and structured observability around the existing funnel.
- v1.1 extended that baseline into deterministic ATS and target-job resume pipelines, smart dashboard generation entrypoints, stronger resilience, and explicit persistence contracts.
- v1.2 established a staged code-hygiene baseline with explicit brownfield guardrails.
- v1.3 established latency evidence, reduced visible blocking work, tightened runtime budgets, and hardened adjacent performance-sensitive routes.
- The next cycle should build on the new runtime slices from v1.3 instead of reopening broad feature scope.
- The repo already has ESLint, Prettier, TypeScript, Vitest, and Playwright, so the milestone should deepen focused proof rather than introduce a separate toolchain.

## Constraints

- **Tech stack**: Stay within Next.js 14, React 18, TypeScript, Clerk, Supabase/Postgres, Prisma, OpenAI, Asaas, and the existing docs and testing toolchain.
- **Canonical state**: Preserve `cvState` as product truth and keep `agentState` operational only, even while extracting agent services.
- **Security**: Fail closed on authenticated and billing-sensitive route mutations, external return handling, and trust-boundary validation.
- **Release safety**: Prefer targeted regressions and CI gates over ad hoc manual confidence for generation and preview flows.
- **Brownfield discipline**: Favor small, test-backed extractions and hardening slices rather than broad rewrites.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus v1.4 on agent modularization, trust-boundary hardening, and release stability before new feature breadth | The current highest leverage is making critical brownfield flows safer to evolve and safer to trust | Good |
| Continue phase numbering from 27 | Preserves continuity across milestones and keeps roadmap history readable | Good |
| Treat the v1.3 runtime refactor as a starting seam, not a finished architecture | The agent path is still too large to test and evolve confidently in place | Good |
| Replace raw-origin trust with canonical host configuration and explicit origin or CSRF checks | Sensitive mutations and billing flows should not depend on untrusted request metadata | Good |
| Raise CI and regression gates around workspace, preview, and long vacancy generation before expanding scope | Operational confidence depends on catching user-visible release regressions before deployment | Good |
| Default non-E2E tests to `node` and use named profiling proof in CI | The suite should expose runtime waste early without paying browser cost where DOM is unnecessary | Good |
| Archive `v1.4` with explicit audit debt instead of implying a clean audit pass | The implementation shipped, but the missing verification layer should stay visible in project history | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if it drifted.

**After each milestone**:
1. Review current shipped state.
2. Validate whether Core Value still holds.
3. Start the next milestone from fresh requirements.
4. Archive prior roadmap and requirements before expanding scope again.

---
*Last updated: 2026-04-15 after completing milestone v1.4*
