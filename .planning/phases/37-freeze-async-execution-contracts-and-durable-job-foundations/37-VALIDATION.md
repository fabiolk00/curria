---
phase: 37
slug: freeze-async-execution-contracts-and-durable-job-foundations
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run src/lib/jobs/contracts.test.ts src/lib/jobs/repository.test.ts src/lib/jobs/source-of-truth.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npx vitest run src/lib/jobs/contracts.test.ts src/lib/jobs/repository.test.ts src/lib/jobs/source-of-truth.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | JOB-01 | T-37-01 / T-37-02 / T-37-03 | Shared job contracts freeze sync-vs-async action classification, explicit type/status/stage/progress, canonical `JobStatusSnapshot` read shape, typed terminal refs, and required dispatch idempotency keys without turning job rows into canonical resume truth. | unit | `npx vitest run src/lib/jobs/contracts.test.ts src/lib/jobs/source-of-truth.test.ts` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | JOB-01 | T-37-01 / T-37-02 | Durable job repository enforces user-scoped reads, required idempotency-key create behavior, claim/reclaim safety, canonical status snapshot mapping, and ownership-fenced terminal writes. | unit | `npx vitest run src/lib/jobs/repository.test.ts` | ❌ W0 | ⬜ pending |
| 37-01-03 | 01 | 1 | JOB-01 | T-37-02 | The committed SQL migration artifact applies cleanly and the live database schema stays aligned after schema edits, so verification does not stop at type-only false positives. | smoke | `npx prisma db execute --file prisma/migrations/20260416_generic_jobs_foundation.sql --schema prisma/schema.prisma && npx prisma db push` | ✅ | ⬜ pending |
| 37-01-04 | 01 | 1 | JOB-01 | T-37-01 / T-37-02 / T-37-03 | Contract, repository, user-scoped read, duplicate-dispatch, and source-selection regressions stay covered together before the phase is considered complete. | integration | `npm run typecheck && npx vitest run src/lib/jobs/contracts.test.ts src/lib/jobs/repository.test.ts src/lib/jobs/source-of-truth.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/jobs/contracts.test.ts` — covers shared `AgentActionType`, `SyncActionType`, `ExecutionMode`, `JobType`, `JobStatus`, `JobStatusSnapshot`, required dispatch `idempotencyKey`, and typed input/result/error refs.
- [ ] `src/lib/jobs/repository.test.ts` — covers user-scoped create/read/list behavior, rejection of missing idempotency keys, idempotency-key dedupe, canonical status snapshot mapping, claim/reclaim/complete/fail/cancel transitions, and `claimed_at` fencing.
- [ ] `src/lib/jobs/source-of-truth.test.ts` — covers `optimizedCvState ?? cvState` source selection and artifact snapshot/result ref construction.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm the committed SQL migration file applies and the aligned schema now contains the generic `jobs` table, lifecycle columns, and idempotency-key uniqueness expected by the app environment. | JOB-01 | Requires the real configured `DATABASE_URL` / Supabase-backed database target used during execution. | Run `npx prisma db execute --file prisma/migrations/20260416_generic_jobs_foundation.sql --schema prisma/schema.prisma && npx prisma db push`, then inspect the target database or Prisma introspection output to confirm the `jobs` table, lifecycle columns, and `(user_id, type, idempotency_key)` uniqueness rule exist. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
