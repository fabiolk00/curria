# 14-01 Summary

Introduced a staged TypeScript-aware lint baseline by:

- adding `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- extending `.eslintrc.json` with a scoped brownfield rollout instead of repo-wide enforcement
- wiring `pnpm lint:types` and folding it into `pnpm lint`

The initial enforcement scope intentionally covers the highest-value low-noise seams:

- `src/app/api/e2e`
- `src/app/api/cron`
- `src/lib/auth`
- `src/lib/openai`
- `src/lib/db/supabase-admin.ts`
- `src/lib/asaas/client.ts`

Verification:

- `pnpm lint`
- `pnpm typecheck`
