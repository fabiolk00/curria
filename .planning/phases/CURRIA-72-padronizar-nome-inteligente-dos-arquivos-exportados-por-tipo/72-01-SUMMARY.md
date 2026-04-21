# 72-01 Summary

- Added `buildResumeExportFilename(...)` and `normalizeFilenameSegment(...)` as the central naming seam for exported resumes.
- File download responses now return `pdfFileName` metadata built from the canonical helper.
- Preview downloads, comparison downloads, and the session documents panel now consume the canonical filename instead of hardcoded labels.
- Added regression tests for ATS exports, reliable target-title exports, fallback behavior, and route/client propagation.
