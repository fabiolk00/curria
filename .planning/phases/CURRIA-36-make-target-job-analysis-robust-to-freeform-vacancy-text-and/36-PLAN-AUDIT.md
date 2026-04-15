# Phase 36 Plan Audit

## Verdict

Plan approved.

## Why this plan is correct

- It addresses the root cause: over-reliance on `targetRole` when vacancy text is freeform.
- It preserves the historical deterministic rewrite and validation contract from Phases 8, 9, 10, and 35 instead of weakening honesty checks.
- It improves graceful degradation by extracting semantic vacancy focus even when no clean role title exists.

## Coverage Check

| Requirement | Covered by | Notes |
|-------------|------------|-------|
| VAC-01 | `36-01` | Freeform vacancy parsing, semantic focus extraction, and low-confidence role fallback are explicit scope. |
| VAC-02 | `36-01` | Rewrite hardening and supported-skill sanitization are explicit scope. |

## Risks Watched

- A future refactor could reintroduce `targetRole` as the dominant anchor unless the new tests remain.
- The workspace still has a separate pre-existing dialog test warning unrelated to this phase's behavior.
