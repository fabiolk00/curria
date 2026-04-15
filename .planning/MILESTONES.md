# Milestones

## v1.4 Agent Core Modularization, Security Hardening, and Release Stability (Shipped: 2026-04-15)

**Phases completed:** 5 phases, 13 plans, 13 tasks

**Key accomplishments:**

- Extracted the front half of the brownfield agent path into explicit services for message preparation, vacancy detection, and pre-loop setup with direct regression coverage.
- Extracted recovery, streaming, and persistence out of the oversized agent loop so the runtime now has narrower handoff seams and direct seam-level tests.
- Hardened checkout and high-value authenticated mutations around canonical-host and shared browser-trust validation while preserving the intended Asaas webhook contract.
- Stabilized the repeated long-vacancy browser flow, removed remaining release-facing encoding regressions, and promoted core-funnel plus long-vacancy checks into an explicit release-critical E2E gate.
- Reduced structural non-E2E test waste by scoping `jsdom`, removing production retry sleeps from tests, and exposing one canonical runtime profiling command in CI.

**Known gaps:**

- `v1.4` was archived with accepted audit debt because phases `28`, `29`, `30`, `31`, and `31.1` do not yet have formal `VERIFICATION.md` artifacts.
- The full non-E2E suite still exceeded a strict local 2-minute ceiling after the `31.1` optimizations, even though the largest artificial costs were removed.

---

## v1.3 Agent Response Time and Runtime Performance (Shipped: 2026-04-15)

**Phases completed:** 4 phases, 10 plans, 10 tasks

**Key accomplishments:**

- Established request-stage latency visibility for the main agent route, including first-response and first-useful-output timing evidence.
- Reduced blocking work before visible user value in chat and ATS enhancement flows without weakening canonical state or billing guarantees.
- Broke the runtime into earlier intent and budget seams so deterministic fast paths and lower-cost continuation behavior are now possible.
- Added route-level latency and degradation logging to adjacent generation, download, and import-status paths, then closed the milestone with operator guidance and performance proof artifacts.

**Known gaps:**

- The core agent runtime is still too large in a few central files to be comfortably unit tested or evolved without additional extraction work.
- Some authenticated and billing-related route boundaries still need stronger trust-source validation and regression proof.
- Workspace and long-vacancy generation reliability still need focused release gating beyond the latency milestone.

---

## v1.2 Code Hygiene and Dead Code Reduction (Shipped: 2026-04-14)

**Phases completed:** 4 phases, 12 plans, 12 tasks

**Key accomplishments:**

- Added a repo-native hygiene baseline with committed scripts for unused imports, dead exports, orphan files, and dependency review.
- Documented repo-specific false-positive guardrails for Next.js routes, dynamic imports, string-driven handlers, middleware, and background-job style flows before any deletion work.
- Confirmed the approved low-risk cleanup slices were already clean, while also restoring missing validation dependencies so `typecheck` and Vitest matched the actual repo test stack.
- Published a reviewed dead-code inventory that separated framework and test noise from true deletion candidates, then removed only the small subset of code proven dead.
- Closed the milestone with a configured dependency hygiene inventory, an explicit sustained enforcement boundary, and CI and contributor docs aligned to the realistic brownfield baseline.

**Known gaps:**

- No standalone `v1.2` milestone audit file was produced before archive.
- Global `noUnusedLocals` and `noUnusedParameters` enforcement remains intentionally deferred because the repo has not yet proven it can sustain that gate without brownfield noise.

---

## v1.1 Agent Reliability and Response Continuity (Shipped: 2026-04-15)

**Phases completed:** 15 phases, 45 plans, 72 tasks

**Key accomplishments:**

- Proved live `/api/agent` provenance and shipped operator parity tooling so runtime drift can be diagnosed from real requests instead of guesswork.
- Hardened dialog continuity for terse rewrite follow-ups like `reescreva`, then verified transcript integrity from backend SSE through the user-visible chat.
- Added deterministic ATS enhancement and target-job rewrite pipelines that analyze, rewrite, validate, persist, and export optimized resumes without relying on optional chat decisions.
- Unified `/dashboard/resume/new` into a smart entrypoint that branches between ATS enhancement and target-job adaptation with clearer setup UX.
- Added OpenAI timeout, retry, and circuit-breaker protection, plus async PDF import jobs, to reduce cascading failures in resume flows.
- Closed the milestone with LGPD and secret-boundary hardening, billing and webhook invariant proof, file-access and RLS boundary proof, and stronger JSON persistence contracts.

**Known gaps:**

- No standalone `v1.1` milestone audit file was produced before archive. The milestone was closed with committed phase summaries and focused verification, but without a separate `/gsd-audit-milestone` artifact.

---

## v1.0 Launch Hardening for the Core Funnel (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 12 plans, 28 tasks

**Key accomplishments:**

- Committed env templates and repo boundary docs now advertise one canonical launch-critical configuration contract.
- Launch-critical provider paths now reject missing configuration explicitly, and the regression suite locks that behavior in.
- Production and staging operators now have one synchronized runbook flow for the hardened billing contract and its proof commands.
- Playwright is now committed and the protected dashboard can be entered in browser tests without live Clerk, Supabase, or OpenAI dependencies.
- The launch-critical browser journeys are now committed, deterministic, and asserted through stable UI state instead of timing guesses.
- The browser suite is now part of the repo contract: it has a dedicated CI job and top-level contributor guidance instead of living as a local-only workflow.
- CurrIA now has committed staging replay and billing snapshot tooling, plus aligned operator docs for the settlement-validation wave.
- Phase 3 now has real end-to-end billing proof, not just local tests. The live matrix passed across one-time settlement, recurring activation and renewal, cancellation, duplicate replay, and partial-success reconciliation.
- The live billing matrix did not prove a runtime bug, so Phase 3 closed with no billing-logic remediation. The only follow-up was a small replay-helper fix to make live commands honor the committed scenario defaults.
- CurrIA now emits structured diagnostics on the remaining fragile server edges, and authenticated pages no longer hide billing-read degradation behind raw console noise.
- CurrIA now distinguishes temporary launch-funnel failures from true empty states, and LinkedIn import errors are safe and actionable instead of opaque.
- CurrIA now ends the launch-hardening milestone with a committed operator handoff: the logging guide matches the real JSON payload, the production checklist names the actual proof commands, and the release decision is explicit.

---
