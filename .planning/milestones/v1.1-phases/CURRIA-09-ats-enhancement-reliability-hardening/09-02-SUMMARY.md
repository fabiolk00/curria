# 09-02 Summary

## Outcome

Wave 2 tightened ATS rewrite safety by introducing an explicit rewrite plan and stronger cross-section validation.

## What changed

- added `src/lib/agent/tools/build-rewrite-plan.ts` so section rewrites now share:
  - factual anchors
  - keyword focus
  - section goals
  - do-not-invent guidance
- updated `src/lib/agent/tools/rewrite-resume-full.ts` to execute against that shared intermediate plan
- expanded `src/lib/agent/tools/validate-rewrite.ts` to catch:
  - unsupported summary numeric claims
  - summary-to-skills drift
  - summary mentions not aligned with rewritten experience
- added regressions proving invalid ATS rewrites do not become the effective optimized source

## Verification

- `pnpm tsc --noEmit`
- `pnpm vitest run src/lib/agent/tools/pipeline.test.ts src/app/api/profile/ats-enhancement/route.test.ts src/lib/agent/tools/index.test.ts`

## Notes

The ATS path now guards against misleading internal drift, not only against obvious invented facts.
