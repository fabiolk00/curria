# 71-01 Summary

- Added `optimized-preview-highlights.ts` to compute selective preview highlights from original vs optimized resume content.
- Integrated highlight rendering into the optimized comparison summary and experience bullets only.
- Added a user-facing toggle to show or hide highlights in the optimized preview.
- Kept the feature purely visual so exports, persistence, and ATS Readiness logic remain unchanged.
- Added regression coverage for relevant vs irrelevant changes, premium metric bullets, and highlight toggling.
