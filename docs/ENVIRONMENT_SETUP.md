---
title: Environment Variables Setup
audience: [developers, operators]
related: [GETTING_STARTED.md, staging/SETUP_GUIDE.md]
status: current
updated: 2026-04-10
---

# Environment Variables Setup

CurrIA uses committed templates for the launch-critical contract and local untracked files for real secrets.

## Files and Ownership

Committed files:

- `.env.example` - local development template for runtime variables
- `.env.staging.example` - staging validation template for `scripts/verify-staging.sh`

Ignored local files:

- `.env` - your real local runtime credentials
- `.env.local` - personal overrides
- `.env.staging` - real staging validation credentials
- `.env.*.local` - environment-specific local overrides

Only the root template files should appear in git. Real secrets must stay in ignored local files or your deployment platform, and CI blocks tracked nested `.env*` files anywhere else in the repo.

## Canonical Runtime Contract

CurrIA treats these names as canonical for local dev, CI, preview, staging, and production:

| Area | Required variables |
|------|--------------------|
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| OpenAI | `OPENAI_API_KEY` |
| Asaas | `ASAAS_ACCESS_TOKEN`, `ASAAS_WEBHOOK_TOKEN` |
| Upstash | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

Optional variables:

- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_AGENT_MODEL`
- `OPENAI_MODEL_COMBO`
- `OPENAI_DIALOG_MODEL`
- `ASAAS_SANDBOX`
- `LINKDAPI_API_KEY`

Do not use legacy provider aliases. CI and runtime are intentionally aligned on the canonical names above.

OpenAI model selection works as follows:

- `OPENAI_MODEL_COMBO` selects the baseline agent combo.
- Prefer `OPENAI_AGENT_MODEL` when you want to override the agent turn model directly.
- `OPENAI_MODEL` is still accepted as a compatibility alias for `OPENAI_AGENT_MODEL`.
- `OPENAI_DIALOG_MODEL` is an explicit override for dialog and confirm turns only.
- When `OPENAI_DIALOG_MODEL` is unset, dialog and confirm turns follow the resolved agent model.

## Local Setup

1. Copy the template:

```bash
copy .env.example .env
# or: cp .env.example .env
```

2. Replace every placeholder value in `.env` with a real secret or local connection string.

3. Keep optional values empty unless you actively use that integration or override.

4. Start the app:

```bash
npm run dev
```

If a launch-critical variable is missing, the relevant runtime path now fails with an explicit error naming the missing variable.

## Staging Validation Setup

Use `.env.staging.example` only for the staging verification flow described in [staging/SETUP_GUIDE.md](./staging/SETUP_GUIDE.md).

1. Copy the staging template:

```bash
copy .env.staging.example .env.staging
# or: cp .env.staging.example .env.staging
```

2. Fill in:

- `STAGING_DB_URL`
- `STAGING_API_URL`
- `STAGING_ASAAS_WEBHOOK_TOKEN`
- `STAGING_ASAAS_ACCESS_TOKEN`

3. Run the staging preflight:

```bash
bash scripts/verify-staging.sh
```

That script checks the staging env file, database reachability, required billing tables, RPC functions, API reachability, webhook token presence, and test-user data.

## Deployment Guidance

Deploy environments must use the same canonical runtime names listed above. Before rolling out Phase 1:

- rename any legacy Asaas variable to `ASAAS_ACCESS_TOKEN`
- rename any legacy Upstash variables to `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- confirm `ASAAS_WEBHOOK_TOKEN` and `CLERK_WEBHOOK_SECRET` are stored separately from API access credentials

## Safety Rules

- Never copy real values back into `.env.example` or `.env.staging.example`.
- Never commit `.env`, `.env.local`, or `.env.staging`.
- If a secret rotates, update only your local file or deployment platform entry unless the contract name itself changed.
- If you add a new required variable, update the template and docs in the same change.
- CI runs `npm run audit:secrets` to block tracked `.env*` files outside the committed root templates, private keys, and obvious committed secret values for launch-critical env names.

## Quick Checks

Verify the templates are the only tracked env files:

```bash
git ls-files | grep ".env"
```

Expected tracked files:

- `.env.example`
- `.env.staging.example`

Verify your local runtime file is ignored:

```bash
git check-ignore .env
git check-ignore .env.staging
```

Run the repo secret audit locally before pushing if you touched env or CI files:

```bash
npm run audit:secrets
```

## Related Documentation

- [README.md](../README.md)
- [staging/SETUP_GUIDE.md](./staging/SETUP_GUIDE.md)
- [staging/VALIDATION_PLAN.md](./staging/VALIDATION_PLAN.md)
- [.env.example](../.env.example)
- [.env.staging.example](../.env.staging.example)
