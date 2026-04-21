# Phase 71 Context

## Goal

Add a subtle, preview-only green highlight layer to the optimized resume comparison so users can quickly recognize meaningful improvements without polluting the original view or changing any canonical resume data.

## Problem

The optimized comparison already shows the improved resume, but users still need to manually read both columns line by line to understand what changed. A raw diff would be too noisy, while no highlight leaves value perception too implicit.

## Decisions

- Highlight only the optimized preview column.
- Use a lightweight semantic diff heuristic instead of a raw technical diff.
- Favor summary and experience bullets, where the strongest perceived value lives.
- Keep existing skill-chip “new skill” emphasis and avoid duplicating that logic.
- Reserve whole-line emphasis for materially improved premium bullets; otherwise highlight only the relevant added segments.
- Keep the feature render-only so export, persistence, and ATS Readiness remain untouched.

## Verification

- `npm run typecheck`
- `npx vitest run "src/lib/resume/optimized-preview-highlights.test.ts" "src/components/resume/resume-comparison-view.test.tsx"`
- `npm run audit:copy-regression`
