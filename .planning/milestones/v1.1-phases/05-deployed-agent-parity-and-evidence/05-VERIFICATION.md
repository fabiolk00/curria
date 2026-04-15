# Phase 5 Verification

Date: 2026-04-10
Phase: `05-deployed-agent-parity-and-evidence`

## Automated Checks

- `npm run typecheck` - PASS
- `npm test -- src/app/api/agent/route.test.ts src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/streaming-loop.test.ts src/lib/runtime/release-metadata.test.ts scripts/check-agent-runtime-parity.test.ts` - PASS (`6` files, `54` tests)
- `npx tsx scripts/check-agent-runtime-parity.ts --help` - PASS
- parity doc static audit for `X-Agent-Release`, `agent:parity`, `/api/agent`, and `OPENAI_DIALOG_MODEL` - PASS
- `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` - PASS

## Scope Proven

- `/api/agent` now emits a stable provenance header contract on safe JSON responses and SSE responses.
- Route and loop logs include release identity alongside model, assistant text length, and fallback or recovery fields.
- Operators have a committed parity CLI and runbook for post-deploy verification without creating sessions.
- Regression coverage protects the helper, route headers, loop log schema, and CLI mismatch behavior.

## Manual Follow-Up

- Run `npm run agent:parity -- --url <deployment> ...` against the real deployed environment after rollout.
- Correlate one live `requestId` across route receipt and completed-turn logs to confirm the production log stream matches the committed schema.
