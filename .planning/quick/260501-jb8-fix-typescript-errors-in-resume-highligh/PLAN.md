# Quick Task 260501-jb8

## Goal

Fix TypeScript build errors in resume highlight review metadata and job targeting evidence count telemetry.

## Scope

- Align `CvHighlightState` with the existing highlight state schema fields used by the review UI.
- Move override review metadata count calculation into `buildOverrideReviewHighlightState`.
- Replace obsolete `inferred` evidence count comparisons with current evidence levels.
- Run focused typecheck verification.
