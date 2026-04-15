# Phase 7 Verification

Date: 2026-04-10
Phase: `07-transcript-integrity-and-end-to-end-agent-verification`

## Automated Checks

- `npm run typecheck` - PASS
- `npm test -- src/components/dashboard/chat-interface.test.tsx src/components/dashboard/chat-interface.route-stream.test.tsx src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts scripts/replay-agent-dialog.test.ts` - PASS (`5` files, `38` tests)
- `npm run test:e2e -- tests/e2e/chat-transcript.spec.ts --project=chromium` - PASS (`1` spec)
- `npx tsx scripts/replay-agent-dialog.ts --help` - PASS
- `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` - PASS

## Scope Proven

- One request now stays one coherent visible assistant turn, even when recoverable stream errors, empty-response fallbacks, or late history hydration are involved.
- The real `/api/agent` route output is now proven at the component seam, not only in handcrafted SSE tests.
- Chromium regression coverage catches the original `reescreva` incident shape and verifies transcript stability after reload-driven hydration.
- Operators now have a committed replay CLI and runbook that capture release headers, SSE events, and final assistant text for the representative vacancy -> `reescreva` sequence.

## Residual Notes

- The focused Chromium transcript run still logs the existing mocked billing metadata load warnings from the dashboard and auth layouts. They did not block transcript verification.
- The live deployed replay still requires an operator-provided authenticated session cookie; the repo now provides the tooling and runbook, but not a stored credential.

## Manual Follow-Up

- When diagnosing a live incident, run `npm run agent:parity -- --url <deployment> ...` first, then `npm run agent:replay-dialog -- --url <deployment> --cookie "__session=..." ...` and attach the artifact to the incident or deploy notes.
