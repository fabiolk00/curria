## Validation

- `npm run typecheck`
- `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/validate-rewrite.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/resume-comparison-view.test.tsx src/app/api/session/[id]/route.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/manual-edit/route.test.ts`

## Result

- PASS: semantic hash-based bullet item IDs stay stable across reorder/index shift scenarios and invalidate legacy versioned artifacts safely.
- PASS: segmentation now reconstructs the original text losslessly even with direct overlapping/unsorted/out-of-bounds input.
- PASS: invalid model payloads emit explicit warning and metric events while valid empty responses remain silent no-highlight results.
- PASS: editorial guardrails reject overly long summary/bullet spans while preserving compact measurable bullet exceptions.
- PASS: typecheck and targeted integration suites completed successfully.
