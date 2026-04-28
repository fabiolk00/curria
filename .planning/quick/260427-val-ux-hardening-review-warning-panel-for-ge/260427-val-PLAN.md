# Quick Task 260427-val: UX hardening review warning panel for override resumes

## Plan

1. Move override review warnings out of the resume footer area into an intentional review panel near the optimized document.
2. Render textual review items even when override review has zero inline ranges, with human copy and mojibake repair.
3. Only show inline highlight controls and legend when inline override ranges exist; preserve normal highlight behavior for safe generations.
4. Add focused component tests for warning-panel UX, copy, mojibake repair, normal highlights, and section scroll.

## Verification

- Run focused resume comparison tests.
- Run `npm run typecheck`.
