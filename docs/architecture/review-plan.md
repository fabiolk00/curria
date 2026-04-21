# Review Plan

This review plan exists to preserve critical product rules, route boundaries, approved chokepoints, preview or signing or replay invariants, architecture governance, and stable external behavior.

The main regressions this plan is designed to catch are:

- silent regression in critical routes
- real signed URL emission outside approved chokepoints
- preview lock reinterpretation in the wrong layer
- `decision.ts` growing into a new semantic sink
- `response.ts` absorbing product policy
- `context.ts` becoming a hidden decision engine

## Scope

Apply this plan to any PR that touches:

- `src/app/api/session/**`
- `src/app/api/file/**`
- `src/app/api/profile/smart-generation/**`
- `src/lib/routes/**`
- `src/lib/resume-generation/**`
- `src/lib/generated-preview/**`
- `src/lib/cv/**`
- `src/lib/jobs/**`
- `src/lib/asaas/**`
- `src/lib/observability/**`

The enforced critical-route governance surface currently includes:

- `src/app/api/session/[id]/generate/route.ts`
- `src/app/api/file/[sessionId]/route.ts`
- `src/app/api/profile/smart-generation/route.ts`
- `src/app/api/session/[id]/compare/route.ts`
- `src/app/api/session/[id]/comparison/route.ts`
- `src/app/api/session/[id]/versions/route.ts`

Use it in three cadences:

- continuous PR review for critical changes
- weekly architecture review for hotspots and governance drift
- pre-launch or pre-release review for sensitive flows and proof-pack readiness

## Cadence

### Per Critical PR

- apply the route, policy, replay, and preview checklist
- validate approved chokepoints
- validate `npm run audit:route-architecture`, `npm run test:architecture-proof-pack`, and focused tests when the change is critical

### Weekly

- review hotspots
- review changes in `decision.ts`
- review new signed URL emitters
- review docs, watchlist, and scorecard consistency

### Pre-Launch

- run the proof pack
- review telemetry and residual risk
- review file route, replay, preview lock, and billing-sensitive flows

## Review Gates

Every critical change must pass these gates.

### Gate A - Public Contract Preserved

Ask:

- Did the HTTP payload change?
- Did a status code change?
- Did an error branch change?
- Did replay behavior change?
- Did preview lock behavior change?
- Did billing semantics change?

If yes, require explicit justification.

### Gate B - Chokepoint Respected

Ask:

- Do real signed URLs still come only from approved chokepoints?
- Is preview lock still interpreted only in approved layers?
- Is replay access still resolved only in approved resolvers?

If not, block the PR.

### Gate C - Layer Boundary Respected

Ask:

- Does `context.ts` only resolve request facts and typed context?
- Does `policy.ts` only allow or block?
- Does `decision.ts` orchestrate and normalize outcomes?
- Does `response.ts` only map to HTTP?

If not, request refactor before approval.

### Gate D - Proofability Preserved

Ask:

- Is the new branch covered by tests?
- Did `npm run audit:route-architecture` pass?
- Did `npm run test:architecture-proof-pack` pass in CI and stay green locally when applicable?
- Are invariants still exercised?

Without this, do not approve a critical change.

## Layer Review

### `context.ts`

Should do:

- auth
- ownership
- trust validation
- parse body and query
- load session, target, version, and artifact refs
- build typed context

Must not do:

- preview lock interpretation
- signed URL decision
- replay unlock logic
- billing or export availability decisions
- compare lock decision
- diff availability decision
- product gating beyond factual resolution

Review questions:

- Is this file resolving facts or deciding product semantics?
- Is it returning typed context or implicit outcomes?
- Is there a builder here that should live in a dedicated helper?
- Is it mixing parsing with business semantics?

Approve if:

- it is request-oriented
- it avoids semantic product branching

Request changes if:

- it starts inferring whether the user can or cannot do something
- it starts deciding preview or replay or availability semantics

### `policy.ts`

Should do:

- active export blocking
- reconciliation blocking
- explicit eligibility gates
- typed allow or block results

Must not do:

- create jobs
- sign URLs
- persist state
- build final HTTP payloads

Review questions:

- Is policy only blocking, or already executing work?
- Is there any side effect?
- Is precedence between blockers explicit?
- Are blocking responses covered by tests?

Approve if:

- policy is explicit and side-effect free

Request changes if:

- it becomes a mini orchestrator

### `decision.ts`

Should do:

- orchestration
- flow execution
- terminal outcome normalization
- replay-aware execution
- integration between focused helpers

Must not do:

- parse raw request data
- construct `NextResponse`
- hide side effects so deeply that the flow becomes opaque
- become a black box with no explicit order

Review questions:

- Is this file coordinating or accumulating too much responsibility?
- Is execution order clear?
- Should a new subdomain move to a helper?
- Is it mixing reuse, retry, persistence, payload shaping, and preview semantics in one place?

Approve if:

- it remains readable as a coordinator
- adjacent helpers own focused responsibilities

Request changes if:

- it becomes a new hotspot
- it grows without submodules
- it mixes too many unrelated rules

### `response.ts`

Should do:

- map `decision.kind` to HTTP
- use exhaustive unions
- use `assertNever` when appropriate
- preserve the public contract shape

Must not do:

- read raw state to decide behavior
- sign URLs outside approved decision kinds
- reinterpret preview lock
- infer product semantics from current plan or raw data
- rebuild permissions

Review questions:

- Is there any branch here based on raw state?
- Is only `artifact_available` emitting a real URL?
- Does `response.ts` depend on explicit decisions or still infer behavior?
- If a new decision kind is added, does this break early?

Approve if:

- it is a pure mapper

Request changes if:

- response starts thinking instead of mapping

## Critical Domain Review

### Billing and Export

Verify:

- `reserve -> render -> finalize/release -> reconcile` is preserved
- replay does not reinterpret historical locks
- upgrade does not unlock old artifacts
- real signed URLs require explicit permission
- degraded persistence does not invalidate an already ready artifact
- file route still respects historical preview lock

Ask:

- Did any chokepoint change?
- Was any signing helper called from a new place?
- Is replay still viewer-aware?
- Does the proof pack cover the change?

### Preview Lock and Free Trial

Verify:

- `generatedOutput.previewAccess` and patch preview access stay consistent
- timeline does not return real snapshots when locked
- compare does not return real diff when locked
- file route locked path still serves only locked preview
- replay locked after upgrade still stays locked
- DOCX is protected just like PDF

Ask:

- Is there any new path to real content?
- Can any metadata reconstruct real content?
- Are new invariants required?

### Jobs and Runtime

Verify:

- web routes do not execute heavy jobs inline
- worker still owns bounded retry and runtime caps
- active export guard is preserved
- route decision layer does not duplicate runtime ownership

Ask:

- Did the route push retry semantics into the wrong place?
- Does runtime still own retry and backoff?
- Are worker and route responsibilities still separated?

### Session, Versions, and Compare

Verify:

- preview-aware sanitization stays centralized
- locked compare does not generate diff
- locked versions do not carry snapshots
- routes do not enrich payloads with raw state unnecessarily

Ask:

- Is sanitization still central?
- Are new routes using the right helpers?
- Is there any new ref-type bypass?

## Hotspot Review

Review at least these modules weekly:

- `src/lib/routes/smart-generation/decision.ts`
- `src/lib/routes/session-generate/decision.ts`
- `src/lib/routes/file-access/response.ts`
- `src/lib/routes/session-compare/decision.ts`
- `src/lib/routes/session-versions/decision.ts`

Observe:

- total lines
- number of responsibilities
- import count
- number of mocks required by tests
- change frequency
- unrelated semantic mixing

Ask:

- Did this file become harder to understand this week?
- Should a helper have been extracted?
- Is there a new branch that does not belong here?
- Should `hotspot-watchlist.md` be updated?

## Governance Review

Always verify:

- `npm run audit:route-architecture`
- `npm run test:architecture-proof-pack`
- `npm run typecheck`

Also review whether:

- the audit script still matches the real architecture
- new chokepoints appeared without documentation
- the PR template is being respected
- `approved-chokepoints.md` still matches real code
- `architecture-scorecard.md` is still coherent

Ask:

- Is there a new signed URL emitter?
- Is there a new preview lock interpreter?
- Is there a new replay access resolver?
- Was it documented and approved?

## Living Documentation Review

Every weekly or phase review should check:

- `docs/architecture/route-policy-boundaries.md`
- `docs/architecture/route-review-checklist.md`
- `docs/architecture/hotspot-watchlist.md`
- `docs/architecture/architecture-scorecard.md`
- `docs/architecture/approved-chokepoints.md`
- `docs/operations/signed-url-ttl-review.md`
- `docs/operations/route-architecture-incident-drill.md`

Rule:

- architectural docs that do not match code are debt
- when drift is found, fix it in the same PR or phase

## Critical PR Flow

Use this flow for any important PR.

### Step 1 - Scope Scan

Answer:

- Which project areas does this PR touch?
- Does it touch a critical route?
- Does it touch a chokepoint?
- Does it touch replay?
- Does it touch file route?
- Does it touch preview lock?
- Does it touch billing or export?

### Step 2 - Boundary Scan

Answer:

- Did it put logic in `response.ts`?
- Did it put semantics in `context.ts`?
- Did it inline policy in the route?
- Did it create a new signed URL emitter?

### Step 3 - Behavior Scan

Answer:

- Did it change the external contract?
- Did it change precedence?
- Did it change replay?
- Did it change historical lock?
- Did it change availability semantics?

### Step 4 - Test Scan

Answer:

- Is there a small seam test?
- Is the route still covered?
- Is the transverse critical test still green?
- Is the proof pack still passing?

### Step 5 - Governance Scan

Answer:

- Did the audit pass?
- Do chokepoint docs need update?
- Does the hotspot watchlist need update?
- Does the scorecard change?

## Weekly Review Plan

Every week:

- run audit, proof pack, and typecheck
- review the two main hotspots
- review whether new chokepoints appeared
- review recent PRs that touched critical routes
- review the most sensitive architecture metrics:
  - locked preview responses
  - artifact available responses
  - replay locked after upgrade
- review whether docs, watchlist, and scorecard still match code

## Pre-Launch Review Plan

Before launch, run this closed set:

### Tests

- `npm run audit:route-architecture`
- `npm run test:architecture-proof-pack`
- `npm run typecheck`

### Manual Review

- generate route
- file route
- smart-generation route
- versions route
- compare route
- signed URL chokepoints
- preview lock policy docs
- route incident drill docs
- TTL residual risk acceptance

### Mandatory Questions

- Is there any real signed URL outside an approved chokepoint?
- Is there any replay path that can reinterpret historical lock?
- Is any authenticated surface returning real content during locked preview?
- Is any `response.ts` inferring product semantics?
- Is there any new hotspot outside the watchlist?

## Approval Criteria

Approve a critical change only if:

- boundaries are respected
- chokepoints are preserved
- invariants are maintained
- tests are green
- audit is green
- proof pack is green
- docs are updated when needed

Block a critical change if:

- there is a new signed URL emitter outside approved chokepoints
- preview lock is reinterpreted inline
- `response.ts` starts deciding product rules again
- `context.ts` starts deciding product semantics
- `decision.ts` grows without justification or split
- a critical route bypasses the pattern
- docs and chokepoints drift from code

## Review Output Format

Use this output format for critical reviews:

### Review Summary

- objective of the PR or phase
- areas touched
- risk level

### Boundary Review

- context: ok or issue
- policy: ok or issue
- decision: ok or issue
- response: ok or issue

### Critical Flow Review

- billing and export
- preview lock
- replay
- file delivery
- versions and compare

### Governance Review

- audit
- proof pack
- docs
- chokepoints

### Verdict

- approve
- approve with follow-up
- request changes
