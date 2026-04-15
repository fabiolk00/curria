# CurrIA

## What This Is

CurrIA is an AI-powered resume optimization platform for Brazilian job seekers. It now ships the core funnel for profile seeding, conversational analysis, deterministic ATS enhancement, deterministic target-job rewriting, artifact generation, and paid usage, with the latest milestone focused on making that flow reliable, observable, and safer to operate.

## Core Value

A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## Current State

**Shipped version:** `v1.1 Agent Reliability and Response Continuity` on 2026-04-15.

**What is now true:**
- live `/api/agent` traffic exposes provenance and follows a documented parity contract
- resume-only flows run a deterministic ATS-enhancement pipeline
- resume-plus-job flows run a deterministic target-job rewrite pipeline
- `/dashboard/resume/new` branches by context instead of forcing ATS only
- OpenAI and PDF ingestion paths have stronger resilience and clearer failure modes
- security, billing, file-access, and JSON persistence boundaries are more explicit and test-backed

## Current Milestone: v1.2 Code Hygiene and Dead Code Reduction

**Goal:** Reduce dead code, dependency drift, and maintenance noise without breaking runtime-critical brownfield behavior.

**Target features:**
- dead-code tooling baseline for imports, unused exports, orphan files, and unused dependencies
- staged cleanup flow for imports, locals, exports, files, and packages
- safer long-term enforcement in lint, TypeScript, editor workflow, and CI without tripping on Next.js or dynamic-runtime false positives

## Next Milestone Goals

- make dead code and dependency drift visible through repo-native tooling
- remove low-risk unused code in stages instead of one broad churn-heavy sweep
- decide which enforcement rules are safe to turn into ongoing gates after cleanup

<details>
<summary>Archived milestone focus: v1.1 Agent Reliability and Response Continuity</summary>

**Goal:** Prove what code and model configuration the live `/api/agent` route is serving, eliminate truncation-driven repetition, and verify that the final user-visible transcript stays trustworthy end to end.

**Target features:**
- Deployment and runtime evidence that identifies the live agent route version, selected model, and recovery path for a real request.
- Dialog-turn hardening so requests like `reescreva` produce an actual rewrite or a non-repetitive continuation instead of reusing the vacancy bootstrap.
- End-to-end transcript and SSE verification that proves the user-visible chat output matches the backend recovery behavior.
- Operator replay tooling that captures release headers, SSE events, and final assistant text for the representative vacancy -> `reescreva` incident flow.

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
- [x] Phase 3: Billing settlement, replay safety, and dashboard credit totals are validated end-to-end with live evidence.
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

### Active

- [ ] The repo exposes a safe dead-code detection toolchain for imports, exports, orphan files, and dependencies.
- [ ] Unused imports and low-risk unused locals can be removed automatically or near-automatically in agreed scopes.
- [ ] Unused exports, orphan files, and packages can be inventoried and reduced with manual verification for dynamic runtime seams.
- [ ] Sustained code-hygiene enforcement is documented and wired into lint, TypeScript, editor, or CI flows only after the repo is clean enough to support it.

### Out of Scope

- Broad new feature breadth before the next milestone is defined
- Carrying forward archived v1.1 requirement scope without a fresh planning pass
- Bulk deletion of suspected dead runtime seams without manual validation
- Forcing global `noUnusedLocals` and `noUnusedParameters` immediately before cleanup reduces current brownfield noise

## Context

- The codebase is a Next.js 14 App Router monolith with Clerk auth, Supabase/Postgres persistence, Prisma migrations, OpenAI agent orchestration, Asaas billing, and LinkdAPI profile import.
- v1.0 hardened launch-critical configuration, browser verification, billing settlement validation, and structured observability around the existing funnel.
- v1.1 extended that baseline into deterministic ATS and target-job resume pipelines, smart dashboard generation entrypoints, stronger resilience, and explicit persistence contracts.
- The system now depends on documented versioning and repository boundaries to keep `cvState` canonical while operational JSON remains explicit and test-backed.
- The repo already has ESLint, Prettier, TypeScript, Vitest, and Playwright, so this milestone should extend the current quality baseline instead of introducing a parallel toolchain.
- Next.js routes, dynamic imports, string-driven handlers, and background-job seams can produce false positives in dead-code tools, so cleanup must stay staged and review-driven.

## Constraints

- **Tech stack**: Stay within Next.js 14, React 18, TypeScript, Clerk, Supabase/Postgres, Prisma, OpenAI, Asaas, and the existing docs/testing toolchain.
- **Reliability**: Preserve canonical `cvState`, billing safety, and trusted artifact delivery when evolving resume flows.
- **Verification**: New milestone work should continue to land with explicit route-level, pipeline-level, or browser-level proof.
- **Scope discipline**: Start the next milestone from explicit priorities instead of letting the archived v1.1 scope leak forward.
- **Cleanup safety**: Never delete code automatically just because a static tool flags it; validate runtime seams first.
- **Brownfield churn**: Prefer staged hygiene improvements over one global formatting or enforcement cliff.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus v1.1 on agent reliability and response continuity before new product breadth | The most visible live issue was user trust erosion from repeated or truncated agent replies | Good |
| Continue phase numbering from 5 | Preserves continuity with the shipped v1.0 roadmap and keeps milestone history easy to follow | Good |
| Require end-to-end transcript proof, not only loop-level tests | The user-facing bug was about what appeared in chat, so backend correctness alone was not enough | Good |
| Move critical resume transformation logic out of optional chat decisions and into deterministic backend pipelines | Reliability and export correctness matter more than conversational flexibility for ATS and target-job generation | Good |
| Keep canonical resume truth in `cvState` and use `agentState` only as operational context | Preserves durable product truth while allowing orchestration metadata to evolve faster | Good |
| Favor route-level security and billing proof plus explicit non-claims over implicit confidence in external RLS or provider behavior | Brownfield safety improved more from concrete proof boundaries than from hand-wavy guarantees | Good |
| Treat dead-code cleanup as staged repository hygiene instead of one-shot mass deletion | This repo has enough dynamic and framework-specific seams that automated cleanup needs guardrails | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone**:
1. Review current shipped state
2. Validate whether Core Value still holds
3. Start the next milestone from fresh requirements
4. Archive prior roadmap and requirements before expanding scope again

---
*Last updated: 2026-04-15 after starting milestone v1.2*
