# Agent Prompt: Execute Asaas Billing Staging Validation

You are validating the CurrIA Asaas billing system in staging. Execute the staging validation plan end to end, verify database state after each step, and produce a clear go/no-go report for engineering and ops.

## Objective

Run the staging validation described in:

- [docs/staging-validation-plan.md](/c:/CurrIA/docs/staging-validation-plan.md)

Validate that:

1. The 7 billing scenarios behave correctly in staging.
2. Database state matches the expected post-conditions.
3. Error handling, retry behavior, and duplicate protection work correctly.
4. Ops can diagnose and recover from partial-success states.

## Environment Preconditions

Do not start scenario execution until you confirm all of the following:

1. The latest billing code is deployed to staging.
2. The SQL migration `prisma/migrations/billing_webhook_hardening.sql` has been applied.
3. The staging database is reachable.
4. The staging webhook endpoint is reachable.
5. The following environment variables are available:
   - `STAGING_API_URL`
   - `STAGING_DB_URL`
   - `STAGING_ASAAS_WEBHOOK_TOKEN`
6. Test user `usr_staging_001` exists, or you can create it safely in staging-only data.

If any precondition fails, stop immediately and report the environment blocker.

## Execution Rules

1. Read [docs/staging-validation-plan.md](/c:/CurrIA/docs/staging-validation-plan.md) completely before running commands.
2. Execute scenarios in order unless a critical blocker requires stopping.
3. Before each major scenario, reset or verify the required starting DB state.
4. For each scenario:
   - run the documented request(s)
   - capture HTTP status and response body
   - run the verification SQL
   - compare actual results to expected results
   - record `PASS`, `FAIL`, or `PARTIAL`
5. If the plan document and the real schema conflict, prefer the real schema and current implementation, but document the deviation explicitly.
6. Never guess silently. If a query or command in the plan is stale, adapt it, note the change, and continue only if the intent is still clear.
7. Use staging URLs and staging credentials only. Do not hit production.

## Important Implementation Truths

Use these implementation rules when interpreting results:

1. Initial paid events (`PAYMENT_RECEIVED`, `SUBSCRIPTION_CREATED`) resolve from `billing_checkouts`.
2. Recurring events (`SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED`, `SUBSCRIPTION_DELETED`) resolve from `user_quotas.asaas_subscription_id`.
3. Initial paid events and allowed plan purchases are additive, but subscription renewals replace the balance with the renewed plan allocation.
4. Cancellation is metadata-only and must not revoke credits.
5. Duplicate protection exists at both the route layer and the SQL RPC layer.
6. Partial-success is possible if the SQL RPC succeeds but checkout status marking fails afterward.

## Known Validation Nuances

When executing the plan, use these safeguards:

1. `processed_events` does not store `user_id` directly.
   - If the plan uses a `processed_events.user_id` filter, adapt the query using `event_payload`, `event_type`, `event_fingerprint`, payment id, or subscription id.
2. Overflow behavior is enforced by the SQL RPC.
   - The current implementation raises an error like `Credit grant would exceed max balance.`
   - If the plan text says `Credit balance overflow`, treat semantically equivalent overflow errors as matching, but document the exact returned message.
3. Legacy `externalReference` is accepted only for recurring pre-cutover flows resolved by subscription id.
   - Legacy is not valid for new one-time payments or new subscription creation.
4. If a scenario requires a checkout reference from a previous step, capture and reuse the exact value created in staging.

## Setup Phase

Before Scenario 1:

1. Confirm DB connectivity using `psql "$STAGING_DB_URL"`.
2. Confirm webhook endpoint reachability using a safe request or health check.
3. Ensure `usr_staging_001` exists, or create it if absent.
4. Snapshot current staging rows for the test user from:
   - `users`
   - `credit_accounts`
   - `user_quotas`
   - `billing_checkouts`
5. If needed, reset test state so scenario setup starts from clean, staging-safe values.
6. Confirm the webhook token is present and non-empty.

## Scenario Execution Procedure

For each scenario in [docs/staging-validation-plan.md](/c:/CurrIA/docs/staging-validation-plan.md):

1. Read the scenario setup and expected state carefully.
2. Execute the setup SQL exactly, unless it conflicts with the real schema.
3. Execute the documented HTTP request or `curl` command.
4. Capture:
   - request command
   - HTTP status
   - response body
5. Run the verification SQL queries.
6. Capture actual DB rows or summarized values.
7. Compare actual vs expected.
8. Record one of:
   - `PASS`
   - `FAIL`
   - `PARTIAL`
9. If the scenario fails, record whether downstream scenarios can still continue safely.

## Stop Conditions

Stop immediately and mark the run `NO-GO` if any of the following occur:

1. A duplicate webhook grants credits twice.
2. Overflow is not enforced.
3. Cancellation revokes credits.
4. Renewal trust depends on checkout lookup instead of `asaas_subscription_id`.
5. A staging environment issue prevents trustworthy validation of billing state.

If a non-critical scenario fails but later scenarios remain independently testable, continue and report the failure clearly.

## Scenario Success Checklist

Verify these concrete outcomes:

1. Scenario 1:
   - credits increase `5 -> 8`
   - duplicate payment is cached
   - no double grant occurs
2. Scenario 2:
   - subscription creation adds credits
   - `user_quotas.asaas_subscription_id` is set
   - checkout becomes `subscription_active`
3. Scenario 3:
   - renewal replaces the previous remaining balance with the renewed plan allocation
   - recurring trust comes from `user_quotas`
   - duplicate renewal is cached
4. Scenario 4:
   - cancellation leaves credits unchanged
   - metadata is updated correctly
5. Scenario 5:
   - invalid reference returns `400`
   - corrected retry succeeds
6. Scenario 6:
   - overflow is rejected
   - no partial credit mutation occurs
   - no `processed_events` row is inserted on rollback
7. Scenario 7:
   - partial-success behavior is understood and documented
   - economic mutation can succeed even if checkout status marking lags

## How to Handle Deviations

If actual behavior differs from the plan:

1. Record the exact command run.
2. Record the exact actual output.
3. Record the exact DB rows or values observed.
4. State whether the deviation is:
   - plan-doc drift
   - environment issue
   - code defect
   - unclear / needs manual review

If the plan query is invalid but intent is obvious:

1. adapt the query
2. note the adaptation
3. continue

If intent is not obvious:

1. stop that scenario
2. mark it `PARTIAL`
3. explain what additional clarification is needed

## Output Format

Return a markdown report using this structure:

```markdown
# Staging Validation Report

## Executive Summary
- Scenarios Passed: X/7
- Scenarios Partial: Y/7
- Scenarios Failed: Z/7
- Critical Issues: N
- Recommendation: PROCEED | STOP

## Environment Check
- API Reachable: yes/no
- DB Reachable: yes/no
- Webhook Token Present: yes/no
- Migration Verified: yes/no
- Test User Ready: yes/no

## Scenario Results

### Scenario 1: One-Time Payment
- Status: PASS | FAIL | PARTIAL
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: none | ...

### Scenario 2: Subscription Creation
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

### Scenario 3: Subscription Renewal
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

### Scenario 4: Subscription Cancellation
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

### Scenario 5: Webhook Failure and Retry
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

### Scenario 6: RPC Rejection (Overflow)
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

### Scenario 7: Partial Success
- Status: ...
- Request(s): ...
- Expected: ...
- Actual: ...
- DB Verification: ...
- Deviations: ...

## Critical Issues Found
- ...

## Deviations from Plan
- ...

## Recommendation
- PROCEED to production
- or STOP and fix blockers before re-validation
```

## Final Verification Requirements

Before finalizing the report, confirm explicitly:

1. All 7 scenarios were attempted or intentionally skipped with reason.
2. Each scenario includes actual DB verification, not just HTTP response inspection.
3. Any deviations from expected DB state are documented.
4. Any invalid or stale queries from the plan were adapted and explained.
5. The final recommendation is based on actual observed behavior, not assumptions.

## Deliverable Standard

The final report must be usable by:

1. engineering for bug triage
2. ops for runbook creation
3. release review for go/no-go production approval

Prefer concrete evidence over narrative. Use exact values, exact statuses, and exact query results wherever possible.
