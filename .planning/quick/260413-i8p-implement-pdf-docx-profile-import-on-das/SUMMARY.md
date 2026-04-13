# Quick Task 260413-i8p

Implemented PDF/DOCX profile import for `dashboard/resumes/new` using the existing resume parsing and structured ingestion flow.

## Delivered

- Added `POST /api/profile/upload` for authenticated multipart resume import.
- Reused existing `parse-file` and `resume-ingestion` utilities to extract and merge `cvState`.
- Shared profile persistence through `src/lib/profile/user-profiles.ts`.
- Replaced the placeholder PDF/DOCX modal UI with a working file import flow.
- Updated the profile page to preserve and display `pdf` as the saved profile source.
- Added focused backend and frontend tests covering upload, merge behavior, and UI success/error paths.

## Verification

- `npx vitest run src/app/api/profile/upload/route.test.ts src/components/resume/resume-builder.test.tsx src/components/resume/user-data-page.test.tsx src/lib/linkedin/extract-profile.test.ts`
- `npx vitest run src/app/api/profile/extract/route.test.ts src/app/api/profile/status/[jobId]/route.test.ts src/lib/agent/tools/resume-ingestion.test.ts src/lib/agent/tools/parse-file.test.ts`
