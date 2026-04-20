---
title: Staging Validation Agent Prompt
audience: [developers, operations]
related: [SETUP_GUIDE.md, VALIDATION_PLAN.md]
status: current
updated: 2026-04-06
---

# Agent Prompt: Execute Asaas Billing Staging Validation

You are validating the CurrIA Asaas billing system in staging. Execute the staging validation plan end to end, verify database state after each step, and produce a clear go/no-go report.

## Preconditions

Do not start until all are true:

1. Latest billing code is deployed.
2. `prisma/migrations/billing_webhook_hardening.sql` has been applied.
3. `prisma/migrations/20260406_align_asaas_webhook_contract.sql` has been applied.
4. `prisma/migrations/20260412_resume_generation_billing.sql` has been applied.
5. `prisma/migrations/20260420_credit_reservation_ledger.sql` has been applied.
6. Staging DB is reachable.
7. Staging webhook endpoint is reachable.
8. `STAGING_API_URL`, `STAGING_DB_URL`, and `STAGING_ASAAS_WEBHOOK_TOKEN` are available.

## Important implementation truths

Use these when judging results:

1. One-time grants resolve from settled payment events.
2. Initial recurring activation also resolves from a settled payment, not from `SUBSCRIPTION_CREATED`.
3. `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` should converge to the internal DB event type `PAYMENT_SETTLED`.
4. `SUBSCRIPTION_CREATED` is informational only and may return `200 ignored`.
5. `SUBSCRIPTION_UPDATED` and cancellation-family events are metadata/no-op paths, not credit grants.
6. Duplicate protection exists at the route layer and the SQL RPC layer.
7. Partial success is possible if the SQL RPC succeeds but checkout-status marking fails afterward.

## Stop conditions

Stop and mark `NO-GO` if any occur:

1. A duplicate webhook grants credits twice.
2. A recurring renewal adds credits instead of replacing the balance.
3. `SUBSCRIPTION_CREATED` is still treated as a credit grant.
4. Cancellation revokes credits.
5. Internal DB event types still persist old names like `PAYMENT_RECEIVED`.

## What success looks like

1. One-time settlement increases credits once.
2. The first recurring settled payment activates the subscription and sets `asaas_subscription_id`.
3. Renewal replaces the balance once.
4. Invalid `SUBSCRIPTION_CREATED` snapshots return `200 ignored`.
5. Cancellation clears metadata and preserves credits.
6. Duplicate delivery returns `cached: true` or is otherwise deduplicated safely.

## Output requirement

Return a report with:

- environment check
- scenario-by-scenario status
- exact DB verification
- any doc drift you had to adapt
- final recommendation: `PROCEED` or `STOP`
