# Scripts

Operational scripts live here so they stay separate from the application runtime.

## Available scripts

### `npm run phase1:model-selection`

Runs the OpenAI model-selection bakeoff defined in [run-openai-model-selection-phase1.ts](./run-openai-model-selection-phase1.ts).

- Purpose: generate blind-review packets comparing the configured model combinations
- Requires: `.env` with `OPENAI_API_KEY`
- Output: timestamped files under `docs/openai-model-selection-runs/` plus a `latest/` copy

### `npm run agent:baseline`

Generates a 7-day OpenAI cost and generation baseline using production data sources.

- Purpose: capture median token/cost usage before trying any agent-model promotion
- Requires: `.env` with Supabase admin credentials
- Output: timestamped files under `docs/openai-baselines/` plus a `latest/` copy

### `scripts/verify-staging.sh`

Checks whether the staging environment is ready for billing and webhook validation.

- Purpose: verify staging environment variables, database access, billing tables, billing RPC functions, API reachability, webhook token presence, and staging test-user data
- Requires: Bash, `psql`, `curl`, and a populated `.env.staging`
- Typical use:

```bash
bash scripts/verify-staging.sh
```

## Guidance

- Keep scripts here focused on operator workflows, validation, or one-off engineering support tasks.
- If a script becomes part of the product runtime, move it under `src/` or wire it through a first-class app command instead.
