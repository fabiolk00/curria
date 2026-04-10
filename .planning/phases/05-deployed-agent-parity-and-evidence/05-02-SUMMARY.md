---
phase: 05-deployed-agent-parity-and-evidence
plan: 02
subsystem: infra
tags: [ops, runtime, observability, openai, docs]
requires:
  - phase: 05-01
    provides: Shared release provenance headers and logs for `/api/agent`
provides:
  - Safe operator parity CLI for deployed `/api/agent`
  - Dedicated runbook for agent runtime parity
  - Discoverable documentation links from architecture and OpenAI docs
affects: [phase-5-plan-03, operators, observability, deploys]
tech-stack:
  added: []
  patterns: [safe unauthorized parity probe, explicit expected-release checks, runtime parity runbook]
key-files:
  created:
    - scripts/check-agent-runtime-parity.ts
    - docs/agent-runtime-parity.md
  modified:
    - package.json
    - docs/architecture-overview.md
    - docs/openai/README.md
    - docs/INDEX.md
key-decisions:
  - "Use an unauthenticated POST to `/api/agent` as the parity probe so the check remains non-mutating and returns provenance on the expected 401 path."
  - "Require explicit expected release, release source, agent model, and dialog model values so operators get a hard failure instead of an ambiguous inspection output."
patterns-established:
  - "Operator parity contract: deployments are verified with headers, not by inferring runtime behavior from a successful chat turn."
  - "Docs discoverability: new runtime runbooks must be linked from architecture and the documentation index."
requirements-completed: [OPS-04, OPS-06]
duration: 4 min
completed: 2026-04-10
---

# Phase 5 Plan 02: Deployed Agent Parity and Evidence Summary

**Operators now have a safe `/api/agent` parity command and runbook that verifies the deployed release and resolved model contract without creating sessions.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T16:28:00Z
- **Completed:** 2026-04-10T16:31:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `npm run agent:parity` to verify deployed `/api/agent` provenance headers against explicit expected values.
- Created a dedicated runbook that explains the header contract, safe request path, and mismatch interpretation.
- Linked the parity workflow from architecture, OpenAI runtime notes, and the main docs index.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build a safe `/api/agent` parity checker CLI** - `ce6cfc3` (feat)
2. **Task 2: Document the parity contract and rollout procedure** - `ce6cfc3` (feat)

**Plan metadata:** recorded with the plan-summary docs commit

## Files Created/Modified

- `scripts/check-agent-runtime-parity.ts` - Non-mutating deployed parity CLI for `/api/agent`.
- `package.json` - Operator entrypoint for `npm run agent:parity`.
- `docs/agent-runtime-parity.md` - Runbook for the parity header contract and post-deploy checks.
- `docs/architecture-overview.md` - Discoverable architecture note for the parity workflow.
- `docs/openai/README.md` - Model-contract mapping for parity expectations.
- `docs/INDEX.md` - Documentation index link for the new runbook.

## Decisions Made

- The parity script treats any status other than `401` as a failure because the safe unauthenticated probe should never enter session or billing paths.
- The runbook documents explicit expected values instead of reading them from local env so operators can compare live behavior to the intended deploy contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The initial CLI entrypoint check was too strict for `tsx` on Windows, so `--help` printed nothing. The direct-execution detection was relaxed to normalize Windows paths before comparing the script entrypoint.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can now add regression coverage for the new helper, headers, log schema, and parity CLI behavior.

---
*Phase: 05-deployed-agent-parity-and-evidence*
*Completed: 2026-04-10*
