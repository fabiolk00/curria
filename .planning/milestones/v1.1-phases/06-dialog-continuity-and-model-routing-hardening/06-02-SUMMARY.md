---
phase: 06-dialog-continuity-and-model-routing-hardening
plan: 02
subsystem: config
tags: [openai, config, docs, env, vitest]
requires:
  - phase: 05-02
    provides: Runtime parity docs and resolved-model provenance contract
provides:
  - Explicit shared dialog and confirm model-routing contract
  - Fresh-import route proof for override and no-override cases
  - Docs and env examples aligned with the runtime model contract
affects: [phase-6-plan-03, operators, env-setup]
tech-stack:
  added: []
  patterns: [shared dialog-phase model set, fresh-import route model proof, compatibility alias documentation]
key-files:
  created: []
  modified:
    - src/lib/agent/config.ts
    - src/lib/agent/config.test.ts
    - src/app/api/agent/route.model-selection.test.ts
    - docs/openai/README.md
    - docs/ENVIRONMENT_SETUP.md
    - .env.example
key-decisions:
  - "Make `dialog` and `confirm` share one explicit override-or-inherit contract instead of relying on a hidden stronger default."
  - "Document `OPENAI_MODEL` as a compatibility alias while keeping `OPENAI_AGENT_MODEL` as the preferred override."
patterns-established:
  - "Fresh-import route proof: route-level model tests must prove both override and inherited agent-model behavior."
  - "Env contract clarity: docs and examples must match the real override and fallback behavior in code."
requirements-completed: [AGNT-02]
duration: 8 min
completed: 2026-04-10
---

# Phase 6 Plan 02: Dialog Continuity and Model Routing Hardening Summary

**Dialog and confirm turns now follow one explicit model-routing contract that is proven in fresh-import route tests and documented in the env/runtime docs.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Made the shared dialog and confirm model-routing contract explicit in `config.ts`.
- Added fresh-import route tests for both explicit `OPENAI_DIALOG_MODEL` override and no-override inheritance from the resolved agent model.
- Updated runtime docs and `.env.example` to include the combo, agent override, compatibility alias, and dialog override knobs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize the runtime dialog-model contract** - `a8c2adc` (feat)
2. **Task 2: Align docs and env examples to the runtime contract** - `a8c2adc` (feat)

**Plan metadata:** recorded with the plan-summary docs commit

## Files Created/Modified

- `src/lib/agent/config.ts` - Explicit shared resolver for dialog and confirm phases.
- `src/lib/agent/config.test.ts` - Helper-level import proof for override and inherited behavior.
- `src/app/api/agent/route.model-selection.test.ts` - Fresh-import route coverage for dialog and confirm with and without overrides.
- `docs/openai/README.md` - Runtime model contract note for combos and overrides.
- `docs/ENVIRONMENT_SETUP.md` - Preferred override guidance and compatibility alias note.
- `.env.example` - Optional combo, agent override, compatibility alias, and dialog override placeholders.

## Decisions Made

- Kept `OPENAI_DIALOG_MODEL` optional instead of turning it into a second baseline.
- Preserved `OPENAI_MODEL` for compatibility while steering new operator changes toward `OPENAI_AGENT_MODEL`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 03 can now lock the continuity and model-routing behavior with one final targeted regression bundle.

---
*Phase: 06-dialog-continuity-and-model-routing-hardening*
*Completed: 2026-04-10*
