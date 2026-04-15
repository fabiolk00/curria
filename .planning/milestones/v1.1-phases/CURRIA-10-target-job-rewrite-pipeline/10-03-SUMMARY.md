## Summary

Wave 10-03 persisted target-job rewrites as first-class outputs and aligned export/read models with the new workflow.

Implemented:
- `job-targeting` CV version source and billing/export acceptance
- structured `job_targeting` logs by workflow stage
- target-job pipeline persistence through `createCvVersion(...)`
- download regression coverage for completed targeted base artifacts
- workspace/session read models updated to surface targeted optimized state and targeting metadata

Validation:
- `pnpm tsc --noEmit`
- `pnpm vitest run src/app/api/file/[sessionId]/route.test.ts src/app/api/session/[id]/route.test.ts src/lib/db/cv-versions.test.ts src/lib/resume-generation/generate-billable-resume.test.ts`
