# Phase 107 Context

## Task

Harden the `job_targeting` highlight flow after the validation and UI refactors:

- audit when the highlight actually runs
- make the shared highlight artifact identify whether it came from ATS or job targeting
- prevent low-confidence placeholder target roles from polluting highlight keywords
- confirm how highlight state reaches the client and cover rollback / repeat-run behavior with tests

## Constraints

- `ats_enhancement` highlight behavior is production-validated and must not change editorially
- do not fork the shared highlight generator
- keep rollback to previous `highlightState` intact

## Audit Notes Locked Before Execution

- `job_targeting` currently computes `optimizedChanged` against `session.cvState`, not `previousOptimizedCvState`
- `extractJobKeywords(...)` currently picks the first non-empty source among `missingSkills`, `mustEmphasize`, `focusKeywords`, target-fit reasons, and JD fragments
- `normalizeSmartGenerationSuccess(...)` does not return `highlightState` directly today; session-based surfaces read it through `/api/session/[id]` and the comparison decision layer
