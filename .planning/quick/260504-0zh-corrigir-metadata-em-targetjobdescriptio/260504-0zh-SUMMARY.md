# Quick Summary: Corrigir metadata e negative evidence no matcher

Date: 2026-05-04
Status: Completed

## Changes

- Sanitized seeded `targetJobDescription` in seed/export paths so job text contains only the target role, main requirements, and differentials.
- Added a defensive requirement-extraction filter for seed/test metadata headings and lines.
- Added `detectEvidencePolarity(text, term)` and negative-evidence handling in the matcher.
- Preserved dotted technology terms such as `Node.js` during requirement sentence splitting.
- Added focused tests for seed metadata filtering, negative evidence, and positive evidence controls.
- Re-ran seeded 30 compatibility without LLM and updated `.local/job-targeting-shadow-results/seeded-30-quality-review-fixed.md`.

## Results

- Metadata terms in exported target descriptions: 0/30.
- Metadata terms in requirements, unsupported requirements, gaps, or claim policy: 0/30.
- Negative evidence attached to supported/adjacent requirements: 0/30.
- Fixed review: approve_assessment 28/30, false_supported_requirement 0, missing_real_gap 0, requirement_extraction_issue 0.

## Verification

- `npx vitest run src/lib/agent/job-targeting/__tests__/requirement-decomposition.test.ts src/lib/agent/job-targeting/__tests__/evidence-extraction.test.ts src/lib/agent/job-targeting/__tests__/matcher.test.ts`
- `npx tsx scripts/job-targeting/run-shadow-batch.ts --input .local/job-targeting-shadow-cases/seeded-30-diverse-cases.jsonl --output .local/job-targeting-shadow-results/seeded-30-diverse-compatibility-fixed.jsonl --limit 30 --concurrency 2 --persist`
- `npx tsx scripts/job-targeting/analyze-shadow-divergence.ts .local/job-targeting-shadow-results/seeded-30-diverse-compatibility-fixed.jsonl --output-dir .local/job-targeting-shadow-results/seeded-30-diverse-compatibility-fixed`
- `npm run typecheck`
- `npm test`

## Cost

- OpenAI calls: 0
- estimatedCostUsd: 0
- gapAnalysisCalls: 0
- rewriteCalls: 0
