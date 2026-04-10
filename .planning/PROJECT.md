# CurrIA

## What This Is

CurrIA is an AI-powered resume optimization platform for Brazilian job seekers. It already ships the core funnel for profile seeding, conversational resume analysis, job-targeted rewriting, file generation, and paid usage, and the current milestone focuses on making the agent experience reliable under real dialog pressure after the launch-hardening baseline shipped.

## Core Value

A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## Current Milestone: v1.1 Agent Reliability and Response Continuity

**Goal:** Prove what code and model configuration the live `/api/agent` route is serving, eliminate truncation-driven repetition, and verify that the final user-visible transcript stays trustworthy end to end.

**Target features:**
- Deployment and runtime evidence that identifies the live agent route version, selected model, and recovery path for a real request.
- Dialog-turn hardening so requests like `reescreva` produce an actual rewrite or a non-repetitive continuation instead of reusing the vacancy bootstrap.
- End-to-end transcript and SSE verification that proves the user-visible chat output matches the backend recovery behavior.
- Operator replay tooling that captures release headers, SSE events, and final assistant text for the representative vacancy -> `reescreva` incident flow.

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

### Active

- None. Milestone v1.1 is fully satisfied and ready for archive.

### Out of Scope

- PDF and DOCX profile upload onboarding - still valuable, but secondary to fixing trust-eroding agent continuity in the existing funnel.
- New premium feature pillars or broad prompt redesign - this milestone is about reliability and debuggability of the current agent, not widening scope.
- Native mobile apps and non-Brazilian localization - not needed to diagnose or harden the current web agent experience.

## Context

- The existing codebase is a Next.js 14 App Router monolith with Clerk auth, Supabase/Postgres persistence, Prisma migrations, OpenAI agent orchestration, Asaas billing, and LinkdAPI profile import.
- v1.0 already hardened launch-critical configuration, browser verification, billing settlement validation, and structured observability around the existing funnel.
- Phase 5 proved the repo can identify the serving `/api/agent` build and model contract, and the parity check remains the first live incident step.
- Phase 6 hardened the backend seam behind the `reescreva` incident: terse rewrite follow-ups now preserve rewrite intent, stale bootstrap fragments can be replaced by better continuity text, and `dialog` plus `confirm` share one explicit resolved-model contract.
- Phase 7 closed the remaining risk by hardening transcript assembly, proving route-to-visible transcript continuity, adding a focused Chromium regression, and shipping an operator replay workflow for the representative incident.

## Constraints

- **Tech stack**: Stay within Next.js 14, React 18, TypeScript, Clerk, Supabase/Postgres, Prisma, OpenAI, Asaas, and the existing docs/testing toolchain - minimize architecture churn in a brownfield repo.
- **Deployment parity**: Any fix must make it obvious which commit, config, and model selection reached the live route - otherwise repeated-chat reports stay ambiguous.
- **Reliability**: Changes must preserve canonical `cvState`, persisted session history, and existing billing/session contracts while hardening the dialog flow.
- **Testing**: v1.0 already established Vitest plus Playwright as repo contracts, so agent fixes should land with route-level and transcript-level regression proof instead of local-only reasoning.
- **Scope**: This milestone should improve confidence in the current agent experience, not reopen launch-hardening work that is already validated or add major new product pillars.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus v1.1 on agent reliability and response continuity before new product breadth | The most visible live issue is user trust erosion from repeated or truncated agent replies, not missing surface area | Good |
| Continue phase numbering from 5 | Preserves continuity with the shipped v1.0 roadmap and keeps milestone history easy to follow | Good |
| Include milestone research before defining requirements | The issue spans deployment parity, model routing, truncation recovery, and transcript rendering, so a small research pass reduces guesswork | Good |
| Treat v1.0 launch hardening as the validated baseline | The next milestone should build on the shipped reliability work instead of re-planning it | Good |
| Require end-to-end transcript proof, not only loop-level tests | The user-facing bug is about what appears in chat, so backend correctness alone is not enough | Good |
| Treat terse rewrite requests as explicit rewrite intent during degraded dialog recovery | Short follow-ups like `reescreva` were the concrete live failure mode and needed a dedicated continuity path | Good |
| Let `dialog` and `confirm` inherit the resolved agent model unless `OPENAI_DIALOG_MODEL` is explicitly set | Avoids hidden stronger defaults and keeps runtime behavior aligned with the documented env contract | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements validated? -> Move to Validated with phase reference
2. Remaining blockers? -> Keep in Active
3. Decisions to log? -> Add to Key Decisions
4. Context drifted? -> Update What This Is and Context

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after completing Phase 7*
