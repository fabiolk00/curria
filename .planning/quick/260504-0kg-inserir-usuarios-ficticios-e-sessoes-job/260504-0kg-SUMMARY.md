# Quick Task 260504-0kg: Inserir usuarios ficticios e sessoes Job Targeting multi-dominio no banco

**Completed:** 2026-05-04
**Status:** Done

## What Changed

- Added `scripts/job-targeting/seed-shadow-users.ts`.
- Seeded 30 fictitious shadow users, profiles, and job-targeting sessions into the configured Supabase database.
- Used deterministic IDs and `upsert` idempotency for the seed run `shadow-seed-multidomain-001`.

## Database Scope

Inserted or updated only:

- `users`
- `user_profiles`
- `sessions`

Did not insert into:

- `credit_reservations`
- `resume_generations`
- billing/payment tables
- artifact/generated-file storage

## Seed Result

```json
{
  "seedRunId": "shadow-seed-multidomain-001",
  "usersCreated": 30,
  "usersReused": 0,
  "sessionsCreated": 30,
  "sessionsReused": 0,
  "domains": {
    "data-bi": 3,
    "software-engineering": 3,
    "marketing": 3,
    "sales": 3,
    "finance": 3,
    "operations": 3,
    "manufacturing": 3,
    "hr": 3,
    "legal-admin": 3,
    "health-admin": 3
  },
  "creditReservationsCreated": 0,
  "resumeGenerationsCreated": 0,
  "artifactsCreated": 0,
  "OpenAICalls": 0
}
```

## Verification

Ran only:

```bash
npx tsx scripts/job-targeting/seed-shadow-users.ts --seed-run-id shadow-seed-multidomain-001 --count-per-domain 3
```

No tests, batch runner, analyzer, LLM call, source-of-truth activation, PDF/DOCX generation, billing write, or credit reservation were run.
