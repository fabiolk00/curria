# 07-03 Summary

## Outcome

Wave 3 gave the milestone an operator-grade repro path and tied the whole transcript story together in one verification bundle.

## What changed

- added `scripts/replay-agent-dialog.ts` with a committed vacancy -> `reescreva` replay flow that captures:
  - Phase 5 provenance headers
  - SSE events
  - final assistant text
  - session reuse between turns
- added `scripts/replay-agent-dialog.test.ts` to lock argument parsing, session reuse, and artifact formatting
- added `docs/agent-transcript-repro.md` so parity and replay now read as one incident workflow
- exposed the CLI through `npm run agent:replay-dialog`

## Verification

- `npm test -- scripts/replay-agent-dialog.test.ts`
- `npx tsx scripts/replay-agent-dialog.ts --help`
- `npm run typecheck`

## Notes

The replay CLI is ready for live deployment use, but the actual authenticated replay against a deployed environment remains an operator-run step because it needs a real session cookie.
