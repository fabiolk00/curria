## Validation

### Validation Architecture

Phase 97 uses prompt-first validation with a strict downstream seam check:

1. prove improved detector guidance with focused detector fixtures
2. immediately prove the resolved-span seam still behaves correctly through artifact tests before any resolver-side changes
3. only then allow minimal artifact arbitration for residual failures
4. finish with one mandatory shared ATS/job-targeting persisted-highlight regression plus unchanged route/renderer smoke proof

### Requirement Traceability

| Requirement | Proof |
|-------------|-------|
| `CV-HILITE-EDITORIAL-01` | `src/lib/agent/tools/detect-cv-highlights.test.ts` detector fixtures for weak starts, semantic closure, and whole semantic units |
| `CV-HILITE-RESOLVER-01` | `src/lib/resume/cv-highlight-artifact.test.ts` residual-gap fixtures for conservative trim-left, metric closure, and keep-base behavior |
| `CV-HILITE-SHARED-SMOKE-01` | `src/lib/agent/tools/pipeline.test.ts` mandatory shared persisted-highlight regression, plus `src/lib/routes/session-comparison/decision.test.ts` and `src/components/resume/resume-comparison-view.test.tsx` smoke checks |

### Required Commands

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts`
- `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/pipeline.test.ts -t highlight`
- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx`

### Acceptance Gate

Validation passes only when:

- prompt hardening alone is evaluated before resolver work starts
- any resolver change stays conservative and deterministic
- one shared job-targeting regression exists and passes
- locked-preview omission and renderer segmentation remain unchanged consumers of persisted highlight state
