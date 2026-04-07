---
title: CurrIA Database Conventions
audience: [developers, architects, operations]
related:
  - ./INDEX.md
  - ./architecture-overview.md
  - ./PRODUCTION-READINESS-CHECKLIST.md
status: current
updated: 2026-04-07
---

# Database Conventions

Back to [Documentation Index](./INDEX.md)

## ID Strategy

CurrIA uses two classes of identifiers:

- domain IDs with business meaning
- generic surrogate IDs for relational rows

### Domain IDs

Use domain-specific IDs only when the identifier itself carries meaning across boundaries.

Current examples:

- `users.id` uses the internal app-user identifier
- `credit_accounts.id` uses `cred_{userId}`
- `billing_checkouts.checkout_reference` is the billing trust anchor and is distinct from the row primary key

### Generic Surrogate IDs

For ordinary table primary keys, use this standard:

```sql
id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text
```

And follow both rules below:

1. Direct app inserts must also send `id` explicitly.
2. SQL functions that create rows must also set `id = gen_random_uuid()::text` explicitly.

CurrIA centralizes app-side generation in [ids.ts](/C:/CurrIA/src/lib/db/ids.ts).

This dual approach is intentional:

- the database stays self-consistent when rows are created outside the app
- the app does not depend on drift-prone defaults being present in every environment

## Why This Exists

Several production tables were found with missing `id` defaults even though migrations expected them. That mismatch can surface as runtime failures such as:

- `null value in column "id" violates not-null constraint`

The standard above hardens both sides of the contract so schema drift does not silently break inserts.

## Timestamp Strategy

Mutable relational rows use this timestamp standard:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Append-only tables generally keep:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

And follow these rules:

1. direct app inserts should send explicit timestamps when the app owns the write path
2. app upserts and updates must always send explicit `updated_at`
3. SQL functions that insert mutable rows must set both `created_at` and `updated_at` explicitly

CurrIA centralizes app-side helpers in [timestamps.ts](/C:/CurrIA/src/lib/db/timestamps.ts).

### Why `updated_at` Needs The Same Hardening

Several production tables retained `created_at` defaults but lost `updated_at` defaults. That mismatch can surface as:

- `null value in column "updated_at" violates not-null constraint`

For that reason, timestamp handling follows the same defense-in-depth model as generic IDs:

- database defaults exist
- app writes still send explicit values on owned paths
- SQL functions still set timestamps explicitly

## Required Pattern For New Tables

When adding a new table with a generic text primary key:

1. define `id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` in the migration
2. if the app inserts directly into that table, generate `id` with `createDatabaseId()`
3. if an RPC or SQL function inserts into that table, set `id` explicitly inside the SQL function
4. add at least one test that asserts the insert payload includes `id` when the app owns the write

When the table is mutable and has lifecycle timestamps:

1. define both `created_at` and `updated_at` with `DEFAULT NOW()`
2. use `createInsertTimestamps()` for direct inserts
3. use `createUpdatedAtTimestamp()` for updates and upserts
4. if SQL functions insert mutable rows, set both timestamps explicitly inside the SQL function

## Existing Tables Covered By This Standard

The hardening migration [20260407_harden_text_id_generation.sql](/C:/CurrIA/prisma/migrations/20260407_harden_text_id_generation.sql) restores or enforces this pattern for:

- `user_auth_identities`
- `user_quotas`
- `sessions`
- `messages`
- `api_usage`
- `processed_events`
- `billing_checkouts`
- `customer_billing_info`
- `job_applications`
- `cv_versions`
- `resume_targets`

Timestamp hardening is applied by [20260407_harden_standard_timestamps.sql](/C:/CurrIA/prisma/migrations/20260407_harden_standard_timestamps.sql).

## Verification Query

Use this query after rollout to confirm defaults exist:

```sql
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN (
    'user_auth_identities',
    'user_quotas',
    'sessions',
    'messages',
    'api_usage',
    'processed_events',
    'billing_checkouts',
    'customer_billing_info',
    'job_applications',
    'cv_versions',
    'resume_targets'
  )
ORDER BY table_name;
```

Expected result:

- `column_default = gen_random_uuid()::text` or equivalent `pgcrypto` expression for every listed table

Use this query after rollout to confirm timestamp defaults exist:

```sql
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at')
  AND table_name IN (
    'users',
    'user_auth_identities',
    'credit_accounts',
    'user_quotas',
    'sessions',
    'messages',
    'api_usage',
    'processed_events',
    'billing_checkouts',
    'customer_billing_info',
    'job_applications',
    'cv_versions',
    'resume_targets'
  )
ORDER BY table_name, column_name;
```

Expected result:

- mutable tables return `NOW()` or equivalent defaults for both `created_at` and `updated_at`
- append-only tables return a `NOW()` or equivalent default for `created_at`

## Operational Rule

If an insert fails with a null `id` on a text primary-key table:

1. check whether the table belongs to the generic surrogate-ID group
2. confirm the app-side payload includes `id` when the app owns the insert
3. confirm the database column still has the expected default
4. confirm SQL functions that create rows are not relying on an absent default

If an insert or upsert fails with a null `updated_at`:

1. confirm the table is part of the mutable timestamp group
2. confirm the app write sends explicit `updated_at` on inserts, upserts, or updates
3. confirm the database column still has `DEFAULT NOW()`
4. confirm SQL functions that create mutable rows set both timestamps explicitly
