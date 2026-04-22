# Quick Task 260422-r9y - Audit and reduce DB query count in generate_file export flow

## Query Map

| Stage | DB access | Helper | Notes |
|---|---|---|---|
| request context | yes | `getSession`, `getResumeTargetForSession` | route/context level reads before dispatch |
| lookup_completed_generation | yes | `getLatestCompletedResumeGenerationForScope` | required replay/idempotency check |
| lookup_idempotent_generation | yes | `getResumeGenerationByIdempotencyKey` | required only when idempotency key exists |
| lookup_latest_version | yes or skipped | `getLatestCvVersionForScope` | now skipped when trusted preflight metadata is already available in the same request |
| check quota | yes | `checkUserQuota` | kept for current UX/billing semantics |
| create_pending_generation | yes | `createPendingResumeGeneration` | required for durable billable flow |
| reserve_credit | yes | `reserveCreditForGenerationIntent` | RPC-backed reservation |
| replay preview access | yes | `getResumeTargetForSession` or `getSession`, plus `getUserBillingPlan` | historical preview lock remains source of truth |
| fresh preview access | yes | `getUserBillingPlan` | now cheaper than full billing info lookup |
| finalize_credit | yes | `finalizeCreditReservation` | required billing correctness |
| persist_completed_generation | yes | `updateResumeGeneration` | required persistence |

## Redundant Read Removed

- Direct `generate_file` requests already run preflight in `resolveGenerateFileExecutionContext`, including `getLatestCvVersionForScope`.
- `generateBillableResume` was performing the same latest-version lookup again in the same request path.
- The billable flow now accepts trusted `latestVersionId` + `latestVersionSource` from preflight and skips the duplicate DB read while preserving the same semantics for background job execution, where that trusted preflight data does not exist.

## Additional Query Reduction

- Replay/final preview access decisions previously used `getUserBillingInfo`, which performs two DB reads.
- This path now uses `getUserBillingPlan`, a single-read helper, because preview-lock decisions only need the plan tier, not the full billing snapshot.

## Before / After Evidence

- Representative direct `generate_file` request with trusted preflight metadata:
  - before: 8 queries
  - after: 7 queries
- Concrete removal:
  - duplicate `lookup_latest_version` query in the same request path

## Safety Notes

- No change to artifact generation behavior
- No change to idempotency behavior
- No change to billing reservation/finalization semantics
- Background job path still performs authoritative latest-version lookup because it does not receive trusted preflight metadata
