# Phase 45: Improve billing transparency alerts and concurrency proof - Research

**Researched:** 2026-04-20
**Domain:** Billing transparency, billing alerting, and concurrency proof on top of the existing reservation-backed export flow [VERIFIED: codebase grep]
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- This phase builds directly on the reservation, ledger, and reconciliation model from Phase 44 without changing the core billing state machine.
- The goal is to make the current billing model more trustworthy and operable by improving three areas together:
  1. user-facing transparency for credit consumption
  2. operator-facing alerts and metrics for degraded billing states
  3. stronger concurrency and end-to-end proof for reservation and reconciliation behavior
- `credit_accounts` remains the fast balance view and `credit_reservations` plus `credit_ledger_entries` remain the billing audit trail.
- New user-facing history must be derived from the existing ledger and reservation data rather than introducing a second history source.
- Existing generate, file, and dashboard surfaces should be preserved and extended rather than replaced.
- Alerting should be actionable and tied to business-risk states such as `needs_reconciliation`, repeated finalize failures, and unusual reservation backlogs.
- Concurrency proof should include both repo-native automated tests and a staging-friendly load or E2E path that can reproduce reservation, release, and reconciliation transitions under stress.
- If some heavier operational tooling cannot be fully automated inside this repo, the phase should still land the scripts, docs, and workflow entrypoints needed for repeated staging verification.

### Claude's Discretion
- Choose the narrowest safe API and UI surface for exposing billing history to authenticated users.
- Decide whether the billing history should live under an existing authenticated dashboard route or a dedicated billing history route, as long as it is secure and understandable.
- Choose the most repo-native alerting and metrics shape available today; if a full external integration is too environment-specific, land structured metrics, thresholds, and clear operational hooks instead.
- Decide whether concurrency proof is best expressed through Vitest integration-style tests, dedicated scripts, k6/Artillery scenarios, or a mix, as long as the result is repeatable and meaningful.

### Deferred Ideas (OUT OF SCOPE)
- Replacing the current credits model with subscription-only export entitlements.
- Migrating billing truth to an external metering platform.
- Replacing the current artifact job runtime with a separately deployed queue system in this phase.
</user_constraints>

## Summary

Phase 44 already shipped the core backend primitives this phase must build on: `credit_reservations`, `credit_ledger_entries`, reservation RPC transitions, reconciliation helpers, route-stage exposure through `POST /api/session/[id]/generate`, `GET /api/file/[sessionId]`, and a minimal reconciliation notice in the dashboard documents panel. [VERIFIED: codebase grep] The main missing pieces are a user-scoped billing history read model, operator-facing alert/report surfaces tied to reservation risk states, and export-specific concurrency or staging proof that goes beyond single-request route tests. [VERIFIED: codebase grep]

The brownfield-safe implementation is to keep all existing generate/file/job routes and extend them in three narrow seams. [VERIFIED: codebase grep] First, add repository helpers that list ledger and reservation rows for an authenticated user so the UI can render a history derived from the existing audit trail. [ASSUMED] Second, extend current structured logs plus billing docs and staging scripts with actionable thresholds for `needs_reconciliation`, repeated finalize or release failures, and stale reserved holds. [ASSUMED] Third, add automated concurrency proof at the repository and route layer plus a repo-native staging harness modeled on the existing `scripts/stress-agent-route.ts` and current staging billing helpers. [VERIFIED: codebase grep]

The current settings and dashboard UI only expose balance, plan, and a localized reconciliation notice; they do not expose a durable ledger timeline or per-export billing history today. [VERIFIED: codebase grep] That makes the safest UX recommendation an additive authenticated billing-history section under the existing settings page, with a thin read-only API returning normalized ledger and reservation events for the current user. [ASSUMED]

**Primary recommendation:** Add a user-scoped ledger-history read path under existing authenticated settings surfaces, extend current log and docs-based billing alerts around reservation risk states, and prove concurrency with new Vitest route or repository races plus a `tsx`-based staging export stress harness instead of introducing new infrastructure. [ASSUMED]

## Project Constraints (from AGENTS.md)

- Preserve the existing brownfield product surface unless scope explicitly changes. [VERIFIED: codebase grep]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: codebase grep]
- Stay within Next.js 14 App Router, React 18, TypeScript, Clerk, Supabase/Postgres, Prisma, OpenAI, Asaas, Upstash, Tailwind CSS, and Vitest plus Testing Library. [VERIFIED: codebase grep]
- Keep route handlers thin, validate external input with `zod`, and prefer structured logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: codebase grep]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: codebase grep]
- Prefer small, test-backed changes over broad rewrites in sensitive billing and runtime paths. [VERIFIED: codebase grep]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | Repo pin `14.2.3`; latest npm `16.2.4` updated `2026-04-18` [VERIFIED: npm registry] | Keep authenticated billing-history reads and dashboard rendering in the existing App Router monolith. [VERIFIED: codebase grep] | The current billing UI already lives in authenticated App Router pages, so Phase 45 should extend those surfaces instead of adding a separate service. [VERIFIED: codebase grep] |
| `@supabase/supabase-js` | Repo pin `^2.43.0`; latest npm `2.103.3` updated `2026-04-17` [VERIFIED: npm registry] | Continue reading reservations, ledger rows, sessions, and jobs through the current admin-client repository pattern. [VERIFIED: codebase grep] | All current billing repositories and reconciliation helpers already use Supabase table and RPC access at runtime. [VERIFIED: codebase grep] |
| Prisma schema + SQL migrations | Repo pin `^5.14.0` [VERIFIED: codebase grep] | Keep schema changes limited to additive indexes or read-shape support if needed. [VERIFIED: codebase grep] | Phase 44 already created the billing tables in SQL migration `20260420_credit_reservation_ledger.sql`; Phase 45 should avoid a schema reset. [VERIFIED: codebase grep] |
| Structured logs via `logInfo` / `logWarn` / `logError` | Repo-local helpers [VERIFIED: codebase grep] | Emit machine-readable billing-risk events and retain the current diagnostics style. [VERIFIED: codebase grep] | Current generate, file, jobs, optional billing info, and reconciliation code already depend on these helpers. [VERIFIED: codebase grep] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | Repo pin `^1.6.0`; latest npm `4.1.4` updated `2026-04-09` [VERIFIED: npm registry] | Extend repository, route, and reconciliation tests for export races and stale-hold repair logic. [VERIFIED: codebase grep] | Use for unit and integration-style proof around idempotency, duplicate dispatch, and user-history normalization. [ASSUMED] |
| `@playwright/test` | Repo pin `^1.59.1`; latest npm `1.59.1` updated `2026-04-20` [VERIFIED: npm registry] | Keep one browser-level proof that billing history and reconciliation messaging remain visible and safe in the authenticated UI. [ASSUMED] | Use for one or two release-critical authenticated UX proofs only, not for load generation. [ASSUMED] |
| `tsx` | Repo pin `^4.21.0`; latest npm `4.21.0` updated `2025-11-30` [VERIFIED: npm registry] | Implement a repo-native export concurrency or staging stress harness without adding a new load-test dependency. [ASSUMED] | Reuse the existing script pattern already used by `replay-staging-asaas.ts`, `check-staging-billing-state.ts`, and `stress-agent-route.ts`. [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Settings-page billing history card plus thin authenticated API [ASSUMED] | A brand-new `/billing/history` route [ASSUMED] | A dedicated route is viable, but the existing settings page already presents credits and account data, so adding history there is the narrowest brownfield-safe surface. [VERIFIED: codebase grep] |
| `tsx`-based export stress harness plus Vitest races [ASSUMED] | k6 or Artillery [ASSUMED] | External load tools would add install and CI surface that the repo does not currently carry, while a `tsx` harness matches current repo-native script practice. [VERIFIED: codebase grep] |
| Extend current structured logs and SQL docs [ASSUMED] | External metrics backend integration [ASSUMED] | The phase context allows hooks instead of a full integration, and the repo already ships doc and script driven operator workflows. [VERIFIED: codebase grep] |

**Installation:**
```bash
npm install
```

**Version verification:** Recommended package versions were verified with `npm view` on 2026-04-20. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── app/(auth)/settings/            # Existing authenticated account surface for billing history UI
├── app/api/billing/                # Thin authenticated read-only history endpoints if needed
├── components/dashboard/           # Reuse billing cards, notices, and tables
├── lib/db/                         # User-scoped ledger and reservation read-model helpers
├── lib/asaas/                      # Reconciliation, alert/report helpers, optional billing data loaders
└── lib/observability/              # Existing structured log sink

scripts/
├── check-staging-billing-state.ts  # Existing staging snapshot helper
├── replay-staging-asaas.ts         # Existing webhook replay helper
└── stress-export-generation.ts     # Recommended new export-specific staging or local stress harness [ASSUMED]
```

### Pattern 1: Derive user history from the existing audit trail
**What:** Build the user-facing ledger from `credit_ledger_entries` joined with reservation and job context instead of creating a second billing-history table. [VERIFIED: codebase grep]  
**When to use:** For any authenticated history UI or API that explains export credit movement. [ASSUMED]  
**Example:**
```typescript
// Source pattern to extend: src/lib/db/credit-reservations.ts
export async function listCreditLedgerEntriesForUser(input: {
  userId: string
  limit?: number
}): Promise<CreditLedgerEntry[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('credit_ledger_entries')
    .select('*')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50)

  if (error) {
    throw new Error(`Failed to load user credit ledger: ${error.message}`)
  }

  return (data ?? []).map(mapCreditLedgerEntryRow)
}
```
Only intent-scoped ledger reads exist today through `getCreditLedgerEntriesForIntent()`, so Phase 45 needs a user-scoped read helper before the UI can show history. [VERIFIED: codebase grep]

### Pattern 2: Keep existing generate and file surfaces, but enrich their billing detail
**What:** Preserve `POST /api/session/[id]/generate`, `GET /api/file/[sessionId]`, and `GET /api/jobs/[jobId]` while adding richer billing context instead of a new export status surface. [VERIFIED: codebase grep]  
**When to use:** For current polling flows and reconciliation messaging. [VERIFIED: codebase grep]  
**Example:**
```typescript
// Source: src/app/api/file/[sessionId]/route.ts
return NextResponse.json({
  docxUrl: null,
  pdfUrl: signedUrls.pdfUrl,
  available: true,
  generationStatus,
  jobId: latestArtifactJob?.jobId,
  stage: latestArtifactJob?.stage,
  progress: latestArtifactJob?.progress,
  errorMessage,
  reconciliation,
})
```
This route already returns billing-adjacent reconciliation detail, so the phase should extend the same DTO family rather than create a parallel polling contract. [VERIFIED: codebase grep]

### Pattern 3: Put billing transparency UI in existing authenticated account surfaces
**What:** Add a billing-history section to the authenticated settings page and keep the sidebar or documents panel focused on summary state. [ASSUMED]  
**When to use:** For the first user-facing transparency release. [ASSUMED]  
**Example:** The settings page already renders credits, plan-upgrade actions, and account identifiers, while the sidebar shows only the current balance and the documents panel shows only one reconciliation notice. [VERIFIED: codebase grep] That makes settings the lowest-risk location for a ledger table or timeline. [ASSUMED]

### Pattern 4: Treat alerts as repo-native metrics plus thresholds
**What:** Emit structured warning events and pair them with committed SQL or script thresholds in docs and staging helpers instead of depending on an environment-specific external monitoring stack. [ASSUMED]  
**When to use:** For `needs_reconciliation`, repeated finalize or release failures, stale `reserved` rows, and mismatches between artifacts and billing settlement. [ASSUMED]  
**Example:** Current billing monitoring and runbook docs already define SQL checks and operator entrypoints for checkout billing; Phase 45 should add analogous checks for reservation backlog and reconciliation drift. [VERIFIED: codebase grep]

### Pattern 5: Model export concurrency proof on existing stress and staging helpers
**What:** Reuse the repo’s `tsx`-script style for export stress proof instead of introducing a new toolchain. [VERIFIED: codebase grep]  
**When to use:** For repeated staging verification and for a local or test-environment concurrency harness. [ASSUMED]  
**Example:** `scripts/stress-agent-route.ts` already handles concurrency, artifacts, and repeatable output formatting, while `scripts/check-staging-billing-state.ts` already snapshots billing tables with a Supabase-admin fallback when `psql` is unavailable. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- **Creating a second billing-history source:** The phase context explicitly requires user history to derive from the existing ledger and reservation data. [VERIFIED: codebase grep]
- **Replacing current generate/file/dashboard surfaces:** The context explicitly says to preserve and extend them. [VERIFIED: codebase grep]
- **Using only logs for user transparency:** Logs are operator evidence, but users need authenticated history derived from ledger rows. [ASSUMED]
- **Adding a load tool the repo does not already carry unless existing scripts are insufficient:** The current repo already has `tsx`, Playwright, and stress-script patterns available. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User export billing history | A new mutable “billing_history” table [ASSUMED] | Read-model helpers over `credit_ledger_entries` plus optional reservation joins. [ASSUMED] | The audit trail already exists and the phase explicitly forbids a second truth source. [VERIFIED: codebase grep] |
| Alert transport | A bespoke in-app notification subsystem [ASSUMED] | Structured log events plus documented SQL thresholds and scriptable operator hooks. [ASSUMED] | The repo already operates billing alerts through logs, docs, and staging scripts. [VERIFIED: codebase grep] |
| Export concurrency testing | Manual click testing only [ASSUMED] | Vitest race tests plus a `tsx` stress harness and one Playwright verification slice. [ASSUMED] | Current tests already cover single-request reservation semantics, but not stressed duplicate-dispatch or backlog behavior. [VERIFIED: codebase grep] |
| Status duplication | A second export-status endpoint [ASSUMED] | Extend `generate`, `file`, and `jobs` route payloads where needed. [ASSUMED] | Those surfaces already expose `stage`, `progress`, and reconciliation state. [VERIFIED: codebase grep] |

**Key insight:** Phase 45 should add read models and proof around the billing system that already exists, not redesign the billing system again. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Showing only raw ledger entry names to users
**What goes wrong:** Users see `reservation_hold` or `reservation_finalize` with no business explanation. [ASSUMED]  
**Why it happens:** The current ledger model is an internal audit shape, not a localized product copy shape. [VERIFIED: codebase grep]  
**How to avoid:** Add a presentation-layer mapper that turns ledger and reservation states into localized event labels such as “Crédito reservado para exportação”, “Exportação concluída e cobrada”, and “Reserva liberada após falha”. [ASSUMED]  
**Warning signs:** UI strings mirror raw enum names or job stage identifiers. [ASSUMED]

### Pitfall 2: Mixing balance truth with history truth
**What goes wrong:** A history view can imply the balance should be recomputed from only export ledger entries and confuse users when subscription grants are not shown there. [ASSUMED]  
**Why it happens:** `credit_accounts` remains the fast balance view, while Phase 44’s ledger entries currently only cover export reservation transitions. [VERIFIED: codebase grep]  
**How to avoid:** Present the history explicitly as “recent export credit activity” unless subscription or manual-adjustment rows are also added to the same feed. [ASSUMED]  
**Warning signs:** History totals do not reconcile to the visible current balance in obvious ways. [ASSUMED]

### Pitfall 3: Alerting on `needs_reconciliation` without age or volume thresholds
**What goes wrong:** Operators get noisy alerts for short-lived transient states that auto-repair quickly. [ASSUMED]  
**Why it happens:** The current reconciliation flow can mark a pending repair before the repair routine runs. [VERIFIED: codebase grep]  
**How to avoid:** Alert on stale or repeated patterns, for example reservations still `reserved` or `needs_reconciliation` after a time threshold, or multiple finalize failures in a rolling window. [ASSUMED]  
**Warning signs:** Frequent warnings with no operator action required. [ASSUMED]

### Pitfall 4: Proving idempotency only at the repository layer
**What goes wrong:** Tests pass for `reserve -> finalize/release`, but concurrent route dispatch still creates confusing retry or backlog behavior. [ASSUMED]  
**Why it happens:** Current repository tests cover transition semantics, and route tests cover only single duplicate flows. [VERIFIED: codebase grep]  
**How to avoid:** Add route-level duplicate-dispatch tests and a script that issues concurrent export requests against the same session and target. [ASSUMED]  
**Warning signs:** Multiple jobs or repeated 202/409 patterns without clear proof that only one hold was created. [ASSUMED]

### Pitfall 5: Assuming the existing staging verifier runs everywhere
**What goes wrong:** The plan assumes `bash` and `psql` are available when they are not. [VERIFIED: codebase grep]  
**Why it happens:** `scripts/verify-staging.sh` is bash-based, and this environment does not currently have a usable `bash` command or `psql` installed. [VERIFIED: codebase grep]  
**How to avoid:** Keep the current Supabase-admin fallback path and add Windows- or Node-friendly entrypoints for any new export-stress proof. [ASSUMED]  
**Warning signs:** Staging verification instructions depend on shell features that the current workstation cannot execute. [VERIFIED: codebase grep]

## Code Examples

Verified patterns from current code:

### Reconciliation detail already propagates through the download route
```typescript
// Source: src/app/api/file/[sessionId]/route.ts
function resolveArtifactReconciliation(
  latestArtifactJob: JobStatusSnapshot | null,
  errorMessage?: string,
) {
  if (!latestArtifactJob) {
    return undefined
  }

  if (latestArtifactJob.stage === 'needs_reconciliation') {
    return {
      required: true,
      status: 'pending' as const,
      reason: errorMessage,
    }
  }

  if (latestArtifactJob.status === 'failed' && latestArtifactJob.stage === 'release_credit') {
    return {
      required: true,
      status: 'pending' as const,
      reason: errorMessage,
    }
  }

  return undefined
}
```
This is the current brownfield-safe pattern for surfacing billing risk without blocking file access. [VERIFIED: codebase grep]

### Generate route already blocks unsafe retries while billing is still reconciling
```typescript
// Source: src/app/api/session/[id]/generate/route.ts
if (
  !body.data.clientRequestId
  && !createdJob.wasCreated
  && isBillingReconciliationPending(createdJob.job)
) {
  return NextResponse.json({
    success: false,
    code: 'BILLING_RECONCILIATION_PENDING',
    error: 'Previous generation billing is still being reconciled.',
  }, { status: 409 })
}
```
Phase 45 should keep this safety behavior and prove it under concurrent retries. [VERIFIED: codebase grep]

### Repository already exposes intent-scoped ledger reads
```typescript
// Source: src/lib/db/credit-reservations.ts
export async function getCreditLedgerEntriesForIntent(input: {
  userId: string
  generationIntentKey: string
}): Promise<CreditLedgerEntry[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('credit_ledger_entries')
    .select('*')
    .eq('user_id', input.userId)
    .eq('generation_intent_key', input.generationIntentKey)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load credit ledger entries for generation intent: ${error.message}`)
  }

  return (data ?? []).map((row) => mapCreditLedgerEntryRow(row as CreditLedgerEntryRow))
}
```
Phase 45 should add the same pattern at the user scope rather than inventing new storage. [VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Export billing was post-render credit consumption tied mainly to `resume_generations`. [VERIFIED: codebase grep] | Export billing now reserves, finalizes, releases, and reconciles through `credit_reservations` and `credit_ledger_entries`. [VERIFIED: codebase grep] | Phase 44 completed on `2026-04-20`. [VERIFIED: codebase grep] | Phase 45 can focus on transparency, alerts, and proof instead of redoing the state machine. [VERIFIED: codebase grep] |
| Billing observability focused on checkout and webhook events. [VERIFIED: codebase grep] | Export routes now expose billing-adjacent stages such as `reserve_credit`, `release_credit`, and `needs_reconciliation`. [VERIFIED: codebase grep] | Phase 44. [VERIFIED: codebase grep] | Operator docs and alerts need to catch up to the newer reservation-specific risk states. [ASSUMED] |
| No export-specific user history surface existed. [VERIFIED: codebase grep] | The authenticated UI currently shows only balance summary and one reconciliation notice in the documents panel. [VERIFIED: codebase grep] | Current repo state on `2026-04-20`. [VERIFIED: codebase grep] | The next safe step is a read-only history section, not a balance redesign. [ASSUMED] |

**Deprecated/outdated:**

- Treating billing transparency as only “current credits remaining” is outdated for this phase because the repo now has reservation and ledger evidence that users and operators cannot yet inspect easily. [VERIFIED: codebase grep]
- Treating staging proof as webhook-only is outdated because export reservation behavior now needs repeatable stress or E2E validation too. [VERIFIED: codebase grep]

## Open Questions (RESOLVED)

1. **Should the first user-facing history show only export reservation events, or also billing grants from subscriptions and one-time purchases?**
   - RESOLVED: ship “recent export credit activity” first.
   - Why: the current ledger table only covers reservation hold, finalize, and release events, so exposing export activity preserves one truthful source without implying a full account ledger that the repo does not currently store. [VERIFIED: codebase grep]

2. **Should the history API be a dedicated route or be folded into optional billing-info loading?**
   - RESOLVED: add a dedicated authenticated read-only history route.
   - Why: `loadOptionalBillingInfo()` already returns plan and balance metadata and intentionally degrades safely for broad layout consumers; keeping the timeline payload separate preserves the current settings and dashboard load path. [VERIFIED: codebase grep]

3. **How far should automated staging proof go in this phase?**
   - RESOLVED: require both repo-local automated race coverage and one staging-friendly export stress path.
   - Why: the phase context explicitly calls for both automated proof and a repeatable staging workflow, and the repo already has the script patterns needed to support that split. [VERIFIED: codebase grep]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime, `tsx` scripts, tests. [VERIFIED: codebase grep] | ✓ [VERIFIED: codebase grep] | `v24.14.0` [VERIFIED: codebase grep] | — |
| npm | Package scripts and registry verification. [VERIFIED: codebase grep] | ✓ [VERIFIED: codebase grep] | `11.9.0` [VERIFIED: codebase grep] | — |
| `curl.exe` | Staging HTTP verification and replay helpers. [VERIFIED: codebase grep] | ✓ [VERIFIED: codebase grep] | `8.18.0` release `2026-01-07` [VERIFIED: codebase grep] | — |
| `bash` | Existing `scripts/verify-staging.sh`. [VERIFIED: codebase grep] | ✗ from the current shell session [VERIFIED: codebase grep] | — | Use `check-staging-billing-state.ts`, `replay-staging-asaas.ts`, and any new export-stress helper directly from Node when possible. [ASSUMED] |
| `psql` | Direct DB-backed staging snapshots in the existing helper. [VERIFIED: codebase grep] | ✗ [VERIFIED: codebase grep] | — | Use the built-in Supabase admin fallback already implemented in `check-staging-billing-state.ts`. [VERIFIED: codebase grep] |

**Missing dependencies with no fallback:**

- None for repo-local implementation work. [VERIFIED: codebase grep]

**Missing dependencies with fallback:**

- `bash` is missing or unusable in this shell, but most new proof work can be exposed through `tsx` entrypoints. [VERIFIED: codebase grep]
- `psql` is missing, but the current staging-state helper already supports Supabase admin fallback with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. [VERIFIED: codebase grep]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest repo pin `^1.6.0`; Playwright repo pin `^1.59.1`. [VERIFIED: npm registry] |
| Config file | `vitest.config.ts`; Playwright config is repo-present through current test scripts. [VERIFIED: codebase grep] |
| Quick run command | `npm test -- src/lib/db/credit-reservations.test.ts src/lib/asaas/reconciliation.test.ts src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts` [ASSUMED] |
| Full suite command | `npm test` and `npm run test:e2e` when the phase lands browser proof. [VERIFIED: codebase grep] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P45-01 [ASSUMED] | Authenticated users can inspect recent export credit activity derived from the existing ledger and reservations. [ASSUMED] | unit/server | `npm test -- src/lib/db/credit-reservations.test.ts` [ASSUMED] | `src/lib/db/credit-reservations.test.ts` exists and should be expanded. [VERIFIED: codebase grep] |
| P45-02 [ASSUMED] | Existing generate, file, and jobs polling surfaces expose actionable reconciliation and billing-stage detail without breaking current clients. [ASSUMED] | route | `npm test -- src/app/api/session/[id]/generate/route.test.ts src/app/api/file/[sessionId]/route.test.ts src/app/api/jobs/[jobId]/route.test.ts` [ASSUMED] | All three files exist. [VERIFIED: codebase grep] |
| P45-03 [ASSUMED] | Duplicate or concurrent export requests do not create double holds or unsafe retry behavior. [ASSUMED] | unit/integration | `npm test -- src/lib/resume-generation/generate-billable-resume.test.ts src/lib/db/credit-reservations.test.ts` [ASSUMED] | Both files exist but need explicit concurrent-dispatch cases. [VERIFIED: codebase grep] |
| P45-04 [ASSUMED] | Stale reserved and reconciliation states can be reproduced and inspected through a repeatable staging or load path. [ASSUMED] | script/manual | `npx tsx scripts/stress-export-generation.ts ...` [ASSUMED] | New file needed. [ASSUMED] |
| P45-05 [ASSUMED] | Billing history and reconciliation messaging remain visible in the authenticated UI. [ASSUMED] | component/e2e | `npm test -- src/hooks/use-session-documents.test.tsx src/components/dashboard/session-documents-panel.test.tsx` and one Playwright spec if added. [ASSUMED] | Existing hook and component tests exist. [VERIFIED: codebase grep] |

### Sampling Rate

- **Per task commit:** Run the targeted Vitest set for repositories and routes touched in the task. [ASSUMED]
- **Per wave merge:** Run all billing-focused Vitest files plus any new export-stress script in dry-run or mocked mode. [ASSUMED]
- **Phase gate:** Billing-focused Vitest set green, one authenticated UI proof green, and one staging-friendly export proof artifact captured. [ASSUMED]

### Wave 0 Gaps

- [ ] Add user-scoped ledger or reservation list tests in `src/lib/db/credit-reservations.test.ts`. [ASSUMED]
- [ ] Add route tests for any new billing-history endpoint or settings loader. [ASSUMED]
- [ ] Add duplicate-concurrency cases that simulate simultaneous generate calls against the same session or target. [ASSUMED]
- [ ] Add `scripts/stress-export-generation.ts` or equivalent repo-native export stress harness. [ASSUMED]
- [ ] Update staging docs to cover export reservation stress and reconciliation evidence, not just webhook settlement. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes [ASSUMED] | Reuse `getCurrentAppUser()` for all history and status surfaces. [VERIFIED: codebase grep] |
| V3 Session Management | yes [ASSUMED] | Keep history and status access inside existing authenticated routes and pages. [ASSUMED] |
| V4 Access Control | yes [ASSUMED] | Scope any ledger or reservation reads by `user_id`; never expose cross-user reservation or job data. [ASSUMED] |
| V5 Input Validation | yes [VERIFIED: codebase grep] | Validate any new query params or pagination cursors with `zod` at the route boundary. [ASSUMED] |
| V6 Cryptography | no material change [ASSUMED] | Reuse existing signed-URL and auth mechanisms; do not add new custom crypto. [VERIFIED: codebase grep] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user billing-history disclosure [ASSUMED] | Information Disclosure [ASSUMED] | User-scoped repository queries and authenticated route guards. [ASSUMED] |
| Replay-driven double-hold or double-release confusion [ASSUMED] | Tampering [ASSUMED] | Keep idempotent reservation transitions and prove duplicate-dispatch behavior in tests. [VERIFIED: codebase grep] |
| Operator blind spots for unresolved billing drift [ASSUMED] | Repudiation [ASSUMED] | Structured warning events, stale-state thresholds, and scriptable evidence capture. [ASSUMED] |
| UI treating internal stage strings as trusted business copy [ASSUMED] | Information Disclosure [ASSUMED] | Map internal statuses to curated PT-BR labels in the presentation layer. [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The first user-facing surface should be an additive settings-page history section rather than a new standalone route. | Summary / Architecture Patterns | Planner could under-scope routing work if product wants a dedicated billing page immediately. |
| A2 | A `tsx`-based export stress harness is preferable to adding k6 or Artillery in this repo. | Standard Stack / Architecture Patterns | Planner may miss a stronger external load tool requirement if ops explicitly wants one. |
| A3 | The initial user-facing feed can be labeled as export credit activity unless purchase and renewal history is also added. | Common Pitfalls / Open Questions | Users may expect full billing history and be confused by an export-only feed. |
| A4 | Current alerting should stay repo-native through logs, docs, and scripts unless an environment-specific integration is already mandated. | Summary / Architecture Patterns | Planner may not prepare enough integration work if external alert sinks are required in production. |
| A5 | A new `scripts/stress-export-generation.ts` should be the preferred staging-proof entrypoint. | Recommended Project Structure / Validation Architecture | Another proof vehicle may fit better if the team prefers Playwright or API-level fixtures only. |

## Sources

### Primary (HIGH confidence)

- [package.json](C:/CurrIA/package.json) - current runtime and test stack pins. [VERIFIED: codebase grep]
- [src/lib/asaas/quota.ts](C:/CurrIA/src/lib/asaas/quota.ts) - balance reads, optional billing info inputs, and reservation wrappers. [VERIFIED: codebase grep]
- [src/lib/db/credit-reservations.ts](C:/CurrIA/src/lib/db/credit-reservations.ts) - reservation and ledger repositories. [VERIFIED: codebase grep]
- [src/lib/db/credit-reservations.test.ts](C:/CurrIA/src/lib/db/credit-reservations.test.ts) - existing repository proof for reserve/finalize/release and ledger reads. [VERIFIED: codebase grep]
- [src/lib/asaas/reconciliation.ts](C:/CurrIA/src/lib/asaas/reconciliation.ts) and [src/lib/asaas/reconciliation.test.ts](C:/CurrIA/src/lib/asaas/reconciliation.test.ts) - current repair logic and proof. [VERIFIED: codebase grep]
- [src/lib/resume-generation/generate-billable-resume.ts](C:/CurrIA/src/lib/resume-generation/generate-billable-resume.ts) and [src/lib/resume-generation/generate-billable-resume.test.ts](C:/CurrIA/src/lib/resume-generation/generate-billable-resume.test.ts) - current reservation-backed export behavior and route-safe failure handling. [VERIFIED: codebase grep]
- [src/app/api/session/[id]/generate/route.ts](C:/CurrIA/src/app/api/session/[id]/generate/route.ts) and [src/app/api/session/[id]/generate/route.test.ts](C:/CurrIA/src/app/api/session/[id]/generate/route.test.ts) - current generate route surface and reconciliation retry blocking. [VERIFIED: codebase grep]
- [src/app/api/file/[sessionId]/route.ts](C:/CurrIA/src/app/api/file/[sessionId]/route.ts) and [src/app/api/file/[sessionId]/route.test.ts](C:/CurrIA/src/app/api/file/[sessionId]/route.test.ts) - current file polling DTO and reconciliation detail. [VERIFIED: codebase grep]
- [src/app/api/jobs/[jobId]/route.ts](C:/CurrIA/src/app/api/jobs/[jobId]/route.ts) - existing job status surface. [VERIFIED: codebase grep]
- [src/hooks/use-session-documents.ts](C:/CurrIA/src/hooks/use-session-documents.ts), [src/hooks/use-session-documents.test.tsx](C:/CurrIA/src/hooks/use-session-documents.test.tsx), [src/components/dashboard/session-documents-panel.tsx](C:/CurrIA/src/components/dashboard/session-documents-panel.tsx), and [src/components/dashboard/session-documents-panel.test.tsx](C:/CurrIA/src/components/dashboard/session-documents-panel.test.tsx) - current client-side billing notice propagation. [VERIFIED: codebase grep]
- [src/app/(auth)/settings/page.tsx](C:/CurrIA/src/app/(auth)/settings/page.tsx), [src/app/(auth)/dashboard/page.tsx](C:/CurrIA/src/app/(auth)/dashboard/page.tsx), and [src/components/dashboard/sidebar.tsx](C:/CurrIA/src/components/dashboard/sidebar.tsx) - current authenticated billing UI shape. [VERIFIED: codebase grep]
- [docs/billing/MONITORING.md](C:/CurrIA/docs/billing/MONITORING.md) and [docs/billing/OPS_RUNBOOK.md](C:/CurrIA/docs/billing/OPS_RUNBOOK.md) - current operator alert/runbook approach. [VERIFIED: codebase grep]
- [docs/staging/VALIDATION_PLAN.md](C:/CurrIA/docs/staging/VALIDATION_PLAN.md), [scripts/check-staging-billing-state.ts](C:/CurrIA/scripts/check-staging-billing-state.ts), [scripts/replay-staging-asaas.ts](C:/CurrIA/scripts/replay-staging-asaas.ts), [scripts/verify-staging.sh](C:/CurrIA/scripts/verify-staging.sh), and [scripts/stress-agent-route.ts](C:/CurrIA/scripts/stress-agent-route.ts) - current proof and stress-script patterns. [VERIFIED: codebase grep]
- `npm view next @supabase/supabase-js vitest @playwright/test tsx` - current registry versions and modified dates. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- [.planning/PROJECT.md](C:/CurrIA/.planning/PROJECT.md), [.planning/ROADMAP.md](C:/CurrIA/.planning/ROADMAP.md), [.planning/STATE.md](C:/CurrIA/.planning/STATE.md), [.planning/REQUIREMENTS.md](C:/CurrIA/.planning/REQUIREMENTS.md), and [45-CONTEXT.md](C:/CurrIA/.planning/phases/CURRIA-45-improve-billing-transparency-alerts-and-concurrency-proof/45-CONTEXT.md) - current phase scope and constraints. [VERIFIED: codebase grep]
- [44-RESEARCH.md](C:/CurrIA/.planning/phases/CURRIA-44-implement-credit-reservation-ledger-and-billing-reconciliati/44-RESEARCH.md) - previous-phase design baseline. [VERIFIED: codebase grep]

### Tertiary (LOW confidence)

- None. [VERIFIED: codebase grep]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - recommendations stay inside the existing repo stack and versions were verified from package.json and the npm registry. [VERIFIED: codebase grep]
- Architecture: HIGH - the current billing, jobs, file, UI, docs, and script seams were read directly in the codebase. [VERIFIED: codebase grep]
- Pitfalls: MEDIUM - the current gaps are clear in code, but the exact UX wording and alert thresholds still require product or operator judgment. [VERIFIED: codebase grep]

**Research date:** 2026-04-20 [VERIFIED: codebase grep]  
**Valid until:** 2026-05-20 for repo-shape guidance; re-check package freshness sooner if dependency upgrades become part of planning. [VERIFIED: npm registry]
