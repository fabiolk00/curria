# Phase 16: Security Boundary Verification and Access Audit - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** Roadmap phase definition plus direct inspection of middleware, webhook, auth-bypass, file-route, and server-only seams

<domain>
## Phase Boundary

This phase proves and hardens the effective protection model around CurrIA's most sensitive runtime seams:

- request gating in `src/middleware.ts`
- test-only auth bypass and app-user resolution
- public webhook routes and provider verification
- owned file and session access routes
- documented server-only secret and admin-client boundaries

The goal is not to add broad net-new product features. The goal is to turn partial confidence into committed evidence, fail-closed behavior, and route-level negative-path coverage that operators and future contributors can trust.

In scope:
- audit middleware allowlists, bypass paths, and unsupported-runtime behavior
- verify protected route behavior for owner, non-owner, unauthenticated, and invalid-bypass cases
- verify Clerk and Asaas webhook fail-closed behavior for missing headers, invalid signatures or tokens, and duplicate handling boundaries
- document which sensitive routes rely on app-code ownership checks versus server-only admin seams
- add or strengthen route-level tests where confidence is currently partial

Out of scope:
- billing settlement invariant redesign beyond what is needed to prove webhook boundary behavior
- full RLS or storage policy redesign
- broad auth UX changes
- large persistence-model changes
</domain>

<implementation_state>
## Current Implementation Observations

- `src/middleware.ts` already contains explicit public route and webhook handling branches plus E2E bypass-cookie support.
- `src/lib/auth/e2e-auth.ts` and `src/app/api/e2e/auth/route.ts` were hardened in Phase 13, but the remaining proof burden is end-to-end behavior through middleware and protected routes, not just local helper correctness.
- `src/app/api/webhook/clerk/route.ts` has explicit Svix header and signature validation with existing tests.
- `src/app/api/webhook/asaas/route.ts` and the related Asaas helpers already implement webhook parsing, idempotency, and failure logging, but this phase needs a clearer verification story for fail-closed route behavior and boundary ownership.
- `src/app/api/file/[sessionId]/route.ts` already uses ownership-aware session lookup and signed-URL generation, with regressions proving signed URLs are transient and non-owners are rejected.
- Session and route ownership seams were made easier to reason about in Phase 15 by shrinking `sessions.ts` into a facade and moving lifecycle logic into narrower modules.
- Secret-bearing provider clients (`supabase-admin`, `openai`, `asaas`) now declare explicit server-only boundaries, but the codebase still needs a tighter map of where route authorization ends and admin capability begins.
- Documentation already contains partial contract language in `docs/operations/secret-boundaries-and-e2e-auth.md`, `docs/architecture-overview.md`, and `docs/developer-rules/API_CONVENTIONS.md`; this phase should align those documents with executable proof instead of creating a new disconnected narrative.
</implementation_state>

<decisions>
## Implementation Decisions

### Proof First
- Treat this phase as an evidence and hardening phase, not a speculative redesign.
- Favor route-level verification and explicit boundary docs over abstract "security posture" statements.

### Boundary Model
- Separate each sensitive seam into one of three enforcement types:
  - middleware or auth resolution
  - route-level ownership or token checks
  - server-only admin or provider capability
- Every plan should clarify which type is authoritative for the seam it touches.

### Fail-Closed Requirement
- Unsupported runtime, invalid bypass cookie, missing webhook secret or token, bad signature, and cross-user file access must all fail closed.
- Happy-path coverage is not enough; negative-path tests are mandatory for this phase.

### Brownfield Constraint
- Preserve the current auth and billing architecture unless a narrow hardening change is needed to prove or fix the effective boundary.
- Prefer targeted docs and tests over sweeping rewrites.

### Verification Shape
- The final result should leave a committed boundary map that references real files and tests.
- If a boundary cannot be fully proven at the app layer because it depends on Supabase storage or RLS configuration, the plan must make that dependency explicit instead of implying stronger proof than the repo currently contains.
</decisions>

<canonical_refs>
## Canonical References

- `src/middleware.ts`
- `src/lib/auth/e2e-auth.ts`
- `src/lib/auth/app-user.ts`
- `src/app/api/e2e/auth/route.ts`
- `src/app/api/webhook/clerk/route.ts`
- `src/app/api/webhook/clerk/route.test.ts`
- `src/app/api/webhook/asaas/route.ts`
- `src/app/api/webhook/asaas/route.test.ts`
- `src/lib/asaas/webhook.ts`
- `src/lib/asaas/idempotency.ts`
- `src/app/api/file/[sessionId]/route.ts`
- `src/app/api/file/[sessionId]/route.test.ts`
- `src/app/api/session/[id]/route.ts`
- `src/app/api/session/[id]/versions/route.ts`
- `src/app/api/session/[id]/targets/route.ts`
- `src/lib/db/sessions.ts`
- `src/lib/db/session-lifecycle.ts`
- `src/lib/db/supabase-admin.ts`
- `docs/operations/secret-boundaries-and-e2e-auth.md`
- `docs/developer-rules/API_CONVENTIONS.md`
- `docs/architecture-overview.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `AGENTS.md`
</canonical_refs>

<specifics>
## Specific Ideas

- produce a single boundary matrix doc instead of scattering new security claims across many docs
- add middleware-focused tests or route-integration coverage that prove bypass-cookie and unsupported-runtime behavior at the seam users actually hit
- extend file-route regressions to make the enforcement ownership explicit: owned session lookup, target-variant selection, and no signed-URL persistence
- make webhook tests assert fail-closed behavior for missing or invalid verification inputs, not just processed payload behavior
</specifics>

---

*Phase: CURRIA-16-security-boundary-verification-and-access-audit*
*Context gathered: 2026-04-14 from roadmap scope and current security seams*
