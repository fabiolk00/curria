# Quick Task 260426-hjh Plan

## Scope

Audit and harden the shared highlight path after Phases 106 and 107 with explicit ATS protection:

1. Verify the shared highlight engine stays safe when ATS calls it without `jobKeywords`.
2. Prove legacy highlight artifacts remain readable after `highlightSource` and `highlightGeneratedAt` were added.
3. Make the keyword hygiene thresholds in the shared detector explicit and documented.
4. Confirm the frontend compare flow reads the persisted highlight after generation without a stale read window.

## Constraints

- Do not change ATS editorial logic or its generation gate behavior.
- Keep backward compatibility for persisted highlight artifacts created before Phase 107.
- Do not duplicate the shared highlight generator.

## Implementation Notes

- Prefer focused regression tests over behavioral rewrites where the current code is already safe.
- Treat `lastRewriteMode` as the best legacy fallback for artifact origin because highlight tracks the last persisted optimized artifact, not the UI mode currently selected.
