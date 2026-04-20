# Phase 44: Implement credit reservation, ledger, and billing reconciliation - Research

**Researched:** 2026-04-20
**Domain:** Credit reservation, billing ledgering, reconciliation, and export observability in CurrIA's async artifact pipeline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- This phase upgrades the current post-render credit consumption model into a reservation-backed billing flow for resume export generation.
- The scope includes three tightly related concerns that should be designed together:
  1. credit reservation before expensive render work
  2. durable ledger/audit records for credit movements
  3. reconciliation and observability for degraded or partially failed billing paths
- Reservation should use an explicit state machine rather than one long database transaction. The expected model is short atomic steps such as `reserve`, `finalize`, and `release`.
- Existing brownfield product behavior should remain as stable as possible: users still request generation through the current route and job surfaces, and the meaning of a paid export should stay "1 credit = 1 export".
- `credit_accounts` can remain the fast balance view if needed, but a ledger trail must become the auditable record of billing movements and reservation lifecycle.
- Billing correctness is more important than breadth. If the full user-facing credits dashboard cannot be landed safely in the same phase, backend reservation, ledger, and operator visibility take priority.
- Reservation, finalization, release, and reconciliation must all be idempotent and keyed to the generation intent so retries do not duplicate holds, consumption, or refunds.
- The design must not rely on `resume_generations` as the sole financial source of truth. Billing must remain diagnosable even when generation-history persistence is degraded.
- Logs and metrics should become explicit enough to distinguish reservation failures, render failures after reservation, finalize failures, release failures, and reconciliation gaps.

### Claude's Discretion
- Choose the narrowest brownfield-safe schema and service surface that achieves reservation plus ledger correctness.
- Decide whether ledger records live in one table or a minimal pair of tables as long as the model stays auditable and easy to reconcile.
- Decide whether reconciliation starts as an in-app periodic worker, an admin command, or a lightweight repair routine, as long as the path is testable and operationally useful.
- Add only the user-facing credit transparency that can be supported safely by the backend model landed in this phase.

### Deferred Ideas (OUT OF SCOPE)
- Full billing analytics dashboards beyond the minimum user/operator credit history needed for trust and debugging.
- Replacing Asaas or redesigning subscription plan semantics.
- Broader monetization changes unrelated to export reservation and auditability.
</user_constraints>

## Summary

The current export pipeline already has durable jobs, idempotent job creation, `resume_generations`, and a one-row `credit_consumptions` proof table, but it still spends credits after `generateFile()` succeeds, so expensive rendering can happen before the economic mutation is locked in. [VERIFIED: codebase grep] The relevant path is `POST /api/session/[id]/generate` -> durable `artifact_generation` job -> `processArtifactGenerationJob()` -> `generateBillableResume()` -> `consumeCreditForGeneration()`, and that path explicitly logs separate render-vs-billing failures today. [VERIFIED: codebase grep]

The brownfield-safe upgrade is to add a reservation-ledger layer under the existing route and job contracts instead of redesigning the public API or overloading `resume_generations` with accounting authority. [VERIFIED: codebase grep] Keep `credit_accounts` as the fast runtime balance, make a new ledger the financial source of truth, and drive it with a short state machine keyed by generation intent: `reserved` -> `finalized` or `released`. [VERIFIED: codebase grep]

The safest implementation is a minimal pair of billing tables plus RPC-backed transitions: one intent table for the reservation lifecycle and one append-only ledger table for movements. [ASSUMED] That preserves the existing artifact-first product surface while making reconciliation possible even when `resume_generations` persistence, target metadata persistence, or job terminal refs degrade. [VERIFIED: codebase grep]

**Primary recommendation:** Add `credit_reservations` plus append-only `credit_ledger_entries`, switch artifact jobs to `reserve -> render -> finalize/release`, and add a repairable reconciliation loop keyed by the job/generation idempotency contract. [ASSUMED]

## Project Constraints (from AGENTS.md)

- Preserve the existing brownfield product surface unless scope explicitly changes. [VERIFIED: codebase grep]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: codebase grep]
- Stay within Next.js 14 App Router, React 18, TypeScript, Clerk, Supabase/Postgres, Prisma, OpenAI, Asaas, Upstash, Tailwind, and Vitest plus Testing Library. [VERIFIED: codebase grep]
- Keep route handlers thin, validate external input with `zod`, and prefer structured logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: codebase grep]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: codebase grep]
- Prefer small, test-backed changes over broad rewrites in sensitive billing and runtime paths. [VERIFIED: codebase grep]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | Repo pin `14.2.3`; latest npm `16.2.4` updated `2026-04-18` [VERIFIED: npm registry] | App Router HTTP boundary for `POST /api/session/[id]/generate`, `/api/file/[sessionId]`, and webhooks. [VERIFIED: codebase grep] | Brownfield-safe route changes stay inside the existing Next.js monolith; do not upgrade the framework in this phase. [VERIFIED: codebase grep] |
| TypeScript | Repo pin `5.4.5`; latest npm `6.0.3` updated `2026-04-16` [VERIFIED: npm registry] | Domain typing for job refs, generation records, and billing DTOs. [VERIFIED: codebase grep] | Existing route, DB, and job contracts are already type-driven. [VERIFIED: codebase grep] |
| `@supabase/supabase-js` | Repo pin `^2.43.0`; latest npm `2.103.3` updated `2026-04-17` [VERIFIED: npm registry] | Admin client for table reads and RPC-backed mutations. [VERIFIED: codebase grep] | Current billing and job persistence already rely on Supabase table + RPC access instead of Prisma Client at runtime. [VERIFIED: codebase grep] |
| Prisma schema + SQL migrations | Prisma repo pin `^5.14.0` [VERIFIED: codebase grep] | Schema declaration plus hand-authored SQL migrations for billing/job tables and RPCs. [VERIFIED: codebase grep] | Existing billing evolution already lands through SQL migrations such as `20260412_resume_generation_billing.sql` and `20260416_generic_jobs_foundation.sql`. [VERIFIED: codebase grep] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | Repo pin `^3.23.8`; latest npm `4.3.6` updated `2026-01-25` [VERIFIED: npm registry] | Validate new admin or repair-route inputs if any are added. [VERIFIED: codebase grep] | Use at route boundaries only; do not build ad hoc validators. [VERIFIED: codebase grep] |
| Vitest | Repo pin `^1.6.0`; latest npm `4.1.4` updated `2026-04-09` [VERIFIED: npm registry] | Regression coverage for repository, route, and runtime seams. [VERIFIED: codebase grep] | The repo already has focused tests for `quota`, job runtime, and session generate routes. [VERIFIED: codebase grep] |
| Structured logs (`logInfo` / `logWarn` / `logError`) | Repo-local observability helpers. [VERIFIED: codebase grep] | Stage-aware export and billing diagnostics. [VERIFIED: codebase grep] | Reuse the existing event-style logs; add reservation/finalize/release/reconcile events instead of a new observability stack. [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `credit_reservations` + append-only ledger [ASSUMED] | Reusing only `resume_generations` + `credit_consumptions` [VERIFIED: codebase grep] | Current tables cannot prove `reserved` vs `released` vs `finalized`, and Phase 44 explicitly forbids making `resume_generations` the sole financial truth. [VERIFIED: codebase grep] |
| `credit_accounts` as cached balance + ledger as authority [ASSUMED] | Ledger-only balance reads [ASSUMED] | Ledger-only reads simplify authority but would widen brownfield blast radius across current quota reads. [VERIFIED: codebase grep] |
| RPC-backed transition helpers [ASSUMED] | Multi-step app-side table updates [ASSUMED] | Existing billing correctness already depends on RPCs for atomic mutation and dedupe, so keeping state transitions in Postgres is more consistent and safer. [VERIFIED: codebase grep] |

**Installation:**
```bash
npm install
```

**Version verification:** Current repo pins and latest registry versions were verified with `npm view` on 2026-04-20. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── lib/asaas/                  # Billing/account primitives and RPC wrappers
├── lib/db/                     # Table repositories for reservations, ledger, generations, jobs
├── lib/jobs/processors/        # Artifact processor keeps orchestration thin
├── app/api/session/[id]/...    # Route triggers durable work only
└── app/api/...                 # Optional repair/admin endpoint only if needed
```

### Pattern 1: Keep route -> job -> processor layering
**What:** Keep `POST /api/session/[id]/generate` responsible for auth, trust, input validation, idempotent job creation, and optimistic `"generating"` state only. [VERIFIED: codebase grep]  
**When to use:** For every export request, including retries. [VERIFIED: codebase grep]  
**Example:**
```typescript
// Source: src/app/api/session/[id]/generate/route.ts
const createdJob = await createJob({
  userId: appUser.id,
  sessionId: session.id,
  resumeTargetId: target?.id,
  type: 'artifact_generation',
  idempotencyKey: primaryIdempotencyKey,
  stage: 'queued',
  dispatchInputRef: effectiveSource.ref,
})
```
This boundary already exists and should stay stable while billing moves behind the processor. [VERIFIED: codebase grep]

### Pattern 2: Make billing a sub-state machine inside artifact processing
**What:** Introduce explicit processor stages such as `reserve_credit`, `render_artifact`, `finalize_credit`, `release_credit`, and `reconcile_pending`. [ASSUMED]  
**When to use:** Inside `processArtifactGenerationJob()` and any repair routine. [VERIFIED: codebase grep]  
**Example:**
```typescript
// Source shape to preserve: src/lib/jobs/processors/artifact-generation.ts
const reservation = await reserveCreditForGeneration({
  userId: job.userId,
  jobId: job.jobId,
  sessionId: session.id,
  resumeTargetId: target?.id,
  generationType,
  idempotencyKey: job.idempotencyKey,
})

if (!reservation.ok) return reservationFailure(...)

const result = await generateFile(...)

if (result.output.success) {
  await finalizeCreditReservation({ reservationId: reservation.id, ... })
} else {
  await releaseCreditReservation({ reservationId: reservation.id, ... })
}
```
This fits the existing durable job pattern better than one long DB transaction across rendering and storage. [VERIFIED: codebase grep]

### Pattern 3: Separate financial authority from artifact history
**What:** `resume_generations` should continue tracking export history and output paths, while new billing tables own reservation state and ledger entries. [VERIFIED: codebase grep]  
**When to use:** For all accounting decisions and reconciliation. [VERIFIED: codebase grep]  
**Example:** Treat `resume_generations.id` as a useful foreign link, not the only authority for whether a credit is held, spent, or released. [ASSUMED]

### Pattern 4: Preserve artifact-first user semantics, but not artifact-first accounting
**What:** Continue returning success when the artifact exists, but record whether billing finalized cleanly or needs reconciliation. [VERIFIED: codebase grep]  
**When to use:** When render succeeds but finalize persistence fails. [VERIFIED: codebase grep]  
**Example:** Today Phase 43 allows success without a trusted `resumeGenerationId` when artifact persistence degrades. [VERIFIED: codebase grep] Phase 44 should extend that idea by marking the financial record as `needs_reconciliation` instead of silently depending on late generic fallback. [ASSUMED]

### Anti-Patterns to Avoid
- **Using `resume_generations.status` as accounting truth:** Phase context explicitly rejects this, and current degraded paths can bypass or partially persist generation history. [VERIFIED: codebase grep]
- **Holding one SQL transaction open across render/upload work:** The phase context explicitly asks for short atomic steps, and current rendering already spans storage operations. [VERIFIED: codebase grep]
- **Keeping the fallback generic `consumeCredit()` path as a normal success mode:** That fallback exists for schema drift safety today, but Phase 44 should replace it with explicit reservation/ledger states so operators can diagnose degraded outcomes. [VERIFIED: codebase grep]
- **Encoding reservation state only in `jobs.stage` or `generatedOutput.status`:** Those are runtime UX/processing fields, not auditable billing records. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic credit reserve/finalize/release | App-side read-modify-write sequences | Postgres RPC transitions over `credit_accounts` + billing tables [ASSUMED] | The repo already relies on RPCs for atomic credit spend and webhook dedupe; app-side sequences would reintroduce race windows. [VERIFIED: codebase grep] |
| Balance derivation for hot paths | Recomputing balance from ledger on every request [ASSUMED] | Keep `credit_accounts` as the cached runtime balance view. [VERIFIED: codebase grep] | `checkUserQuota()` and billing UI reads already depend on `credit_accounts`. [VERIFIED: codebase grep] |
| Duplicate suppression | New ad hoc retry tokens | Reuse the existing durable job idempotency key and generation intent key. [VERIFIED: codebase grep] | `jobs` already dedupe on `(user_id, type, idempotency_key)` and the route derives the key from source snapshot plus scope. [VERIFIED: codebase grep] |
| Reconciliation visibility | Manual SQL-only incident handling | Repo-native reconciliation routine plus structured logs/runbook queries. [ASSUMED] | Billing docs already expect repeatable operator workflows and diagnostic SQL. [VERIFIED: codebase grep] |

**Key insight:** The repo already has the right orchestration seam; what is missing is a first-class financial seam. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Reserving by `resume_generation_id` only
**What goes wrong:** Reservation cannot be diagnosed if `resume_generations` creation or completion drifts. [VERIFIED: codebase grep]  
**Why it happens:** Current billing ties spend to `resume_generation_id` through `credit_consumptions.resume_generation_id`. [VERIFIED: codebase grep]  
**How to avoid:** Key reservation on generation intent derived from the durable job idempotency contract, and link `resume_generation_id` only as optional evidence. [ASSUMED]  
**Warning signs:** Successful artifacts with missing or optional `resumeGenerationId`, or reconciliation cases where job success exists but generation persistence does not. [VERIFIED: codebase grep]

### Pitfall 2: Double-holding on retry after failed finalize
**What goes wrong:** A replay can reserve again when the first reservation already exists but completion metadata is degraded. [ASSUMED]  
**Why it happens:** Current retries derive from the same job idempotency key unless the route intentionally creates a retry nonce for failed/cancelled jobs without a client request id. [VERIFIED: codebase grep]  
**How to avoid:** Make reservation transitions idempotent by `generation_intent_key`, and classify retry-with-same-intent as lookup/reconcile rather than new hold. [ASSUMED]  
**Warning signs:** Multiple open reservations or more than one negative ledger entry for the same intent. [ASSUMED]

### Pitfall 3: Releasing after artifact success because finalize failed
**What goes wrong:** User gets a paid artifact but balance is restored incorrectly. [ASSUMED]  
**Why it happens:** Release logic may look only at job terminal failure rather than actual render/storage outcome. [ASSUMED]  
**How to avoid:** Finalize/release decisions must be based on persisted stage evidence: artifact render result, storage paths, and reservation status. [ASSUMED]  
**Warning signs:** Reservation rows in `reserved` for completed jobs, or release entries linked to completed artifacts. [ASSUMED]

### Pitfall 4: Hiding degraded finance state behind `generatedOutput.status`
**What goes wrong:** UX says `"ready"` while operators cannot tell whether billing finalized or needs repair. [VERIFIED: codebase grep]  
**Why it happens:** `generatedOutput` models artifact lifecycle, not accounting lifecycle. [VERIFIED: codebase grep]  
**How to avoid:** Add separate billing stage logs and optional job metadata/result refs for reservation state. [ASSUMED]  
**Warning signs:** Logs only show `generation_failed` or `billing_failed` without reservation/finalize/release detail. [VERIFIED: codebase grep]

## Code Examples

Verified patterns from current code:

### Durable generation idempotency
```typescript
// Source: src/app/api/session/[id]/generate/route.ts
const primaryIdempotencyKey = buildArtifactJobIdempotencyKey({
  session,
  target: target ?? undefined,
  targetId: target?.id,
  clientRequestId: body.data.clientRequestId,
})
```
This is the right intent key to extend into reservation identity. [VERIFIED: codebase grep]

### Owner-fenced terminal job writes
```typescript
// Source: src/lib/jobs/repository.ts
await completeJob({
  jobId: job.jobId,
  userId: job.userId,
  ownerClaimedAt: job.claimedAt,
  stage: outcome.stage,
  resultRef: outcome.resultRef,
})
```
Reservation finalize/release updates should preserve the same owner-fencing mindset for job state, even if the billing RPC itself keys by reservation id. [VERIFIED: codebase grep]

### Existing post-render spend point to replace
```typescript
// Source: src/lib/resume-generation/generate-billable-resume.ts
const generationResult = await generateFile(...)
const creditConsumed = await consumeCreditForGeneration(
  input.userId,
  resumeGeneration.id,
  generationType,
)
```
Phase 44 should move spend certainty to a reservation created before `generateFile()` and convert this call site into finalize-or-release. [VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session creation consumed credits for agent use. [VERIFIED: codebase grep] | Export generation now uses `resume_generations` + `credit_consumptions` and job-driven artifact billing. [VERIFIED: codebase grep] | Landed by `20260412_resume_generation_billing.sql` and later async-job work. [VERIFIED: codebase grep] | Artifact export already has idempotent spend proof, but still spends after render instead of reserving first. [VERIFIED: codebase grep] |
| Synchronous route carried heavy work. [VERIFIED: codebase grep] | `artifact_generation` runs through durable jobs created by `POST /api/session/[id]/generate`. [VERIFIED: codebase grep] | Landed by `20260416_generic_jobs_foundation.sql` and current route/runtime code. [VERIFIED: codebase grep] | Reservation logic belongs in the durable processor, not in the route. [VERIFIED: codebase grep] |

**Deprecated/outdated:**
- Treating `consumeCreditForGeneration()` as the full billing model is outdated for this phase because it only proves a final spend row and cannot express reservation or release. [VERIFIED: codebase grep]
- Using generic `consumeCredit()` fallback as a steady-state export path is outdated once Phase 44 lands; keep it only as temporary rollout fallback if absolutely necessary. [ASSUMED]

## Data Model Recommendation

### Recommended tables
| Table | Purpose | Key columns | Notes |
|-------|---------|-------------|-------|
| `credit_reservations` [ASSUMED] | One row per generation intent reservation lifecycle. [ASSUMED] | `id`, `user_id`, `generation_intent_key`, `job_id`, `session_id`, `resume_target_id`, `resume_generation_id nullable`, `type`, `status`, `credits_reserved`, `reserved_at`, `finalized_at`, `released_at`, `reconciliation_status`, `failure_reason`, `metadata`. [ASSUMED] | Unique on `generation_intent_key`; mutable state row for lifecycle. [ASSUMED] |
| `credit_ledger_entries` [ASSUMED] | Append-only audit log of all economic and reservation movements. [ASSUMED] | `id`, `user_id`, `reservation_id nullable`, `entry_type`, `direction`, `amount`, `balance_after nullable`, `idempotency_key`, `reason`, `metadata`, timestamps. [ASSUMED] | One append-only trail keeps incident review and future user-visible history simple. [ASSUMED] |

### Recommended statuses
| Entity | Values | Why |
|--------|--------|-----|
| `credit_reservations.status` | `reserved`, `finalized`, `released`, `needs_reconciliation` [ASSUMED] | Expresses the short state machine requested by the phase. [VERIFIED: codebase grep] |
| `credit_reservations.reconciliation_status` | `clean`, `pending`, `repaired`, `manual_review` [ASSUMED] | Separates operational repair state from the business reservation outcome. [ASSUMED] |
| `credit_ledger_entries.entry_type` | `reservation_hold`, `reservation_finalize`, `reservation_release`, `billing_grant`, `manual_adjustment`, `reconciliation_adjustment` [ASSUMED] | Covers this phase without redesigning subscription semantics. [ASSUMED] |

### Why not just extend `credit_consumptions`

`credit_consumptions` is unique per `resume_generation_id` and only records a final spend count, so it cannot model open holds, releases, or reconciliation gaps. [VERIFIED: codebase grep] Extending it would either overload a spend-proof table into a mutable lifecycle record or force nullable states onto a table whose current shape assumes a single successful consumption per generation. [VERIFIED: codebase grep]

## Idempotency Strategy

1. Use the existing durable job idempotency key as the canonical `generation_intent_key`. [VERIFIED: codebase grep]
2. Make `reserve_credit_for_generation_intent()` idempotent on that key and return the existing reservation row when called again. [ASSUMED]
3. Make `finalize_credit_reservation()` idempotent on `reservation_id` or `generation_intent_key`; second calls should no-op if already finalized. [ASSUMED]
4. Make `release_credit_reservation()` idempotent on the same key; second calls should no-op if already released. [ASSUMED]
5. Require finalize/release RPCs to reject contradictory transitions cleanly, for example `finalize` after `released`, and mark the row `needs_reconciliation` instead of mutating silently. [ASSUMED]
6. Keep `resume_generation.idempotency_key` for generation-history lookup, but do not make it the only finance dedupe key. [VERIFIED: codebase grep]

## Reconciliation Design

### Recommended first version

Start with an in-app periodic repair routine plus a scriptable/manual entrypoint, not a brand-new external worker system. [ASSUMED] The repo already supports cron-style maintenance routes and operator runbooks for billing state, so a lightweight `reconcileCreditReservations()` routine is the narrowest extension. [VERIFIED: codebase grep]

### Repair targets
| Case | Detection | Action |
|------|-----------|--------|
| Reservation exists, job failed/cancelled, status still `reserved`. [ASSUMED] | Join `credit_reservations` to `jobs` by `job_id`. [ASSUMED] | Release reservation and append `reservation_release` ledger entry. [ASSUMED] |
| Job completed, artifact paths exist, reservation still `reserved`. [ASSUMED] | Join reservation to `resume_generations`, `jobs.terminal_result_ref`, and session/target `generatedOutput`. [VERIFIED: codebase grep] | Finalize reservation. [ASSUMED] |
| Ledger balance drift vs `credit_accounts`. [ASSUMED] | Compare sum of ledger entries to cached balance. [ASSUMED] | Flag `manual_review` or append explicit reconciliation adjustment after operator confirmation. [ASSUMED] |
| Legacy Phase 43 fallback path consumed via generic credit RPC with no reservation. [VERIFIED: codebase grep] | Search logs for `billing.consume_credit_for_generation_fallback` and missing reservation row. [VERIFIED: codebase grep] | Treat as rollout-only compatibility path and record operator-visible gap. [ASSUMED] |

### Observability requirements

Add explicit log events for `billing.credit_reserved`, `billing.credit_reservation_failed`, `billing.credit_finalized`, `billing.credit_finalize_failed`, `billing.credit_released`, `billing.credit_release_failed`, and `billing.credit_reconciliation_gap_detected`. [ASSUMED] The repo already uses structured logs for job and billing stage outcomes, so this extends an established pattern rather than inventing a new one. [VERIFIED: codebase grep]

## Migration Strategy

1. Add schema first: new reservation and ledger tables, indexes, and RPCs; do not switch runtime yet. [ASSUMED]
2. Keep `credit_accounts` writes inside the new RPCs so fast balance reads remain unchanged. [ASSUMED]
3. Ship repository wrappers in `src/lib/db/` and `src/lib/asaas/` for reservation reserve/finalize/release/reconcile. [ASSUMED]
4. Update `generateBillableResume()` so the normal path is `reserve -> render -> finalize/release`; keep the old fallback only behind explicit degraded handling during rollout. [ASSUMED]
5. Update the artifact processor and job stage strings to surface reservation lifecycle. [ASSUMED]
6. Extend operator docs/monitoring SQL to inspect reservation rows and ledger entries before removing legacy fallbacks. [ASSUMED]
7. Only after production confidence, consider backfilling historical `credit_consumptions` into ledger history if user-visible credit history is needed. [ASSUMED]

**Brownfield note:** No existing public route contract needs to change for phase completion. [VERIFIED: codebase grep]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js routes, Vitest, Prisma tooling. [VERIFIED: codebase grep] | ✓ [VERIFIED: codebase grep] | `v24.14.0` [VERIFIED: codebase grep] | — |
| npm | Package scripts and registry verification. [VERIFIED: codebase grep] | ✓ [VERIFIED: codebase grep] | `11.9.0` [VERIFIED: codebase grep] | — |
| Postgres/Supabase schema access | SQL migrations and RPC execution. [VERIFIED: codebase grep] | Unknown from this session. [VERIFIED: codebase grep] | — | Planner should assume DB access is required at execution time. [ASSUMED] |

**Missing dependencies with no fallback:**
- None proven missing in this session, but live DB access must exist before applying migration or validating RPC behavior. [ASSUMED]

**Missing dependencies with fallback:**
- None. [VERIFIED: codebase grep]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest repo pin `^1.6.0`; config present in `vitest.config.ts`. [VERIFIED: codebase grep] |
| Config file | `vitest.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | `npm test -- src/lib/asaas/quota.test.ts src/lib/jobs/runtime.test.ts src/app/api/session/[id]/generate/route.test.ts` [ASSUMED] |
| Full suite command | `npm test` [VERIFIED: codebase grep] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PH44-01 [ASSUMED] | Reserve one credit before render and dedupe same intent. [ASSUMED] | unit | `npm test -- src/lib/asaas/quota.test.ts src/lib/db/credit-reservations.test.ts` [ASSUMED] | `credit-reservations.test.ts` missing. [ASSUMED] |
| PH44-02 [ASSUMED] | Finalize or release idempotently after processor outcome. [ASSUMED] | unit | `npm test -- src/lib/jobs/processors/artifact-generation.test.ts src/lib/jobs/runtime.test.ts` [ASSUMED] | artifact processor test likely needs expansion or creation. [ASSUMED] |
| PH44-03 [ASSUMED] | Route and file polling preserve current UX while exposing billing stages. [ASSUMED] | route | `npm test -- src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts` [ASSUMED] | both files exist. [VERIFIED: codebase grep] |
| PH44-04 [ASSUMED] | Reconciliation repairs reserved-but-terminal mismatches without double charge. [ASSUMED] | unit/integration | `npm test -- src/lib/asaas/reconciliation.test.ts` [ASSUMED] | missing. [ASSUMED] |

### Sampling Rate
- **Per task commit:** `npm test -- src/lib/asaas/quota.test.ts src/lib/jobs/runtime.test.ts src/app/api/session/[id]/generate/route.test.ts` [ASSUMED]
- **Per wave merge:** `npm test -- src/app/api/file/[sessionId]/route.test.ts src/lib/jobs/repository.test.ts src/lib/asaas/quota.test.ts` [ASSUMED]
- **Phase gate:** `npm test` plus targeted migration/RPC verification in a DB-backed environment. [ASSUMED]

### Wave 0 Gaps
- [ ] `src/lib/db/credit-reservations.test.ts` for reserve/finalize/release repository semantics. [ASSUMED]
- [ ] `src/lib/asaas/reconciliation.test.ts` for repair classification and no-double-adjustment guarantees. [ASSUMED]
- [ ] `src/lib/jobs/processors/artifact-generation.test.ts` if processor-level reservation stage behavior is not already covered elsewhere. [ASSUMED]
- [ ] DB-backed verification script or SQL checklist for new RPCs and ledger invariants. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes [ASSUMED] | Existing `getCurrentAppUser()` route auth boundary. [VERIFIED: codebase grep] |
| V3 Session Management | yes [ASSUMED] | Existing trusted mutation checks and app-user scoped lookups. [VERIFIED: codebase grep] |
| V4 Access Control | yes [ASSUMED] | Scope reservation and ledger reads/writes by `user_id`, `session_id`, and trusted service-role RPC boundaries. [ASSUMED] |
| V5 Input Validation | yes [VERIFIED: codebase grep] | Continue route-body validation with `zod`. [VERIFIED: codebase grep] |
| V6 Cryptography | no direct change [ASSUMED] | Reuse existing webhook token validation and signed URL generation; do not hand-roll new crypto. [VERIFIED: codebase grep] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Double-spend or double-release through retry races. [ASSUMED] | Tampering [ASSUMED] | RPC-backed idempotent transitions and unique `generation_intent_key`. [ASSUMED] |
| Cross-user reservation mutation. [ASSUMED] | Elevation of Privilege [ASSUMED] | Keep all reservation writes behind service-role RPCs and user-scoped route checks. [ASSUMED] |
| Replay of failed finalize/release calls. [ASSUMED] | Repudiation [ASSUMED] | Append-only ledger plus immutable timestamps and idempotent transition checks. [ASSUMED] |
| Silent accounting drift after degraded persistence. [ASSUMED] | Repudiation [ASSUMED] | Explicit `needs_reconciliation` state and structured log alerts. [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Use two new tables, `credit_reservations` and `credit_ledger_entries`, instead of extending existing billing tables only. | Data Model Recommendation | Migration scope may be larger than necessary if one-table design would suffice. |
| A2 | Reservation/finalize/release should be implemented as Postgres RPCs rather than app-side sequences. | Standard Stack / Don't Hand-Roll | App code may need more orchestration if RPC use is not acceptable in this codebase. |
| A3 | First reconciliation version should be an in-app periodic routine plus manual/script entrypoint. | Reconciliation Design | Planner may under-scope ops needs if a stronger scheduler is required immediately. |
| A4 | New job stages should explicitly include reservation/finalize/release states. | Architecture Patterns | UI or polling surfaces may need adaptation if current stage vocabulary is intentionally hidden. |
| A5 | Proposed PH44 requirement IDs and new test file names are planning aids, not existing locked requirement IDs. | Validation Architecture | Planner must replace them with the final requirement mapping if official IDs are created elsewhere. |

## Open Questions

1. **Should historical `credit_consumptions` be backfilled into the new ledger in Phase 44 or deferred?**
   What we know: existing docs already treat `resume_generations` plus `credit_consumptions` as current export proof. [VERIFIED: codebase grep]
   What's unclear: whether user/operator credit history needs full historical continuity on day one. [ASSUMED]
   Recommendation: defer backfill unless user-facing credit history is in scope for the same phase. [ASSUMED]

2. **Should reconciliation run automatically on cron, on read, or only manually at first?**
   What we know: the repo already has cron-style maintenance routes and billing ops documentation. [VERIFIED: codebase grep]
   What's unclear: whether the team wants automatic repair or only detection plus operator action initially. [ASSUMED]
   Recommendation: implement deterministic detection plus a callable repair routine; schedule it only if operational appetite exists. [ASSUMED]

## Sources

### Primary (HIGH confidence)
- `src/lib/resume-generation/generate-billable-resume.ts` - current post-render billing, idempotency, and degraded persistence behavior. [VERIFIED: codebase grep]
- `src/app/api/session/[id]/generate/route.ts` - current durable artifact job dispatch and route contract. [VERIFIED: codebase grep]
- `src/lib/jobs/processors/artifact-generation.ts` - processor seam where reservation should live. [VERIFIED: codebase grep]
- `src/lib/jobs/repository.ts` and `src/lib/jobs/runtime.ts` - durable job idempotency and owner-fenced terminal writes. [VERIFIED: codebase grep]
- `src/lib/asaas/quota.ts` - current credit source-of-truth helpers and fallback spend logic. [VERIFIED: codebase grep]
- `src/lib/db/resume-generations.ts` - generation persistence model and idempotency lookup. [VERIFIED: codebase grep]
- `prisma/schema.prisma` - current schema for `credit_accounts`, `resume_generations`, `credit_consumptions`, and `jobs`. [VERIFIED: codebase grep]
- `prisma/migrations/20260412_resume_generation_billing.sql` - current generation billing RPC/table contract. [VERIFIED: codebase grep]
- `prisma/migrations/20260416_generic_jobs_foundation.sql` - current jobs table contract. [VERIFIED: codebase grep]
- `docs/billing/OPS_RUNBOOK.md` and `docs/billing/MONITORING.md` - existing operator expectations and diagnostic queries. [VERIFIED: codebase grep]
- `npm view next/react/typescript/zod/vitest/@supabase/supabase-js` - current registry versions and modified dates. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, and `44-CONTEXT.md` - project and phase constraints. [VERIFIED: codebase grep]

### Tertiary (LOW confidence)
- None. [VERIFIED: codebase grep]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - this phase stays on the existing monolith/runtime stack and versions were verified against package.json plus npm registry. [VERIFIED: codebase grep]
- Architecture: HIGH - route, job, processor, and current billing flow were inspected directly in code. [VERIFIED: codebase grep]
- Pitfalls: MEDIUM - code evidence shows current failure modes, but some proposed reservation failure cases depend on the new design. [VERIFIED: codebase grep]

**Research date:** 2026-04-20  
**Valid until:** 2026-05-20 for repo-structure guidance; re-check npm/package freshness sooner if dependency upgrades become part of planning. [VERIFIED: npm registry]
