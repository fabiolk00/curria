---
status: ready
task: 260502-g04-refatorar-job-targeting-para-motor-gener
created: 2026-05-02
---

# Validation Strategy: Job Targeting Generic Compatibility Engine

## Goal

Prove that Job Targeting compatibility decisions now come from one generic, deterministic, catalog-driven `JobCompatibilityAssessment`, while the brownfield product surface remains stable.

## Validation Architecture

### Deterministic Core Tests
- Catalog validation rejects terms and anti-equivalences without `goldenCaseIds`.
- Requirement extraction and decomposition handle generic section and composite-list syntax without domain-specific terms.
- Evidence extraction reads only real `cvState` fields.
- Matcher precedence is exact, catalog alias, anti-equivalence, category equivalent, adjacent category, optional ambiguity resolver, fallback unsupported.
- Score uses `job-compat-score-v1` only.
- Claim policy produces allowed, cautious, and forbidden claims with templates/prohibited terms as required.
- Structured validation detects forbidden terms and unsafe direct claims.

### Golden Cases
- Run all locked golden cases through `evaluateJobCompatibility`.
- Assert supported, adjacent, unsupported, critical gap, claim policy, score range, and low-fit expectations.

### Architecture Guard
- Scan compatibility core files for fixture-specific tool/vendor/stack/segment examples.
- Exclude catalog JSON, golden cases, fixtures, and tests.

### Pipeline Proof
- Assert `runJobTargetingPipeline` persists `agentState.jobCompatibilityAssessment`.
- Assert legacy `targetingPlan`, `jobTargetingExplanation`, low-fit modal data, and comparison score are assessment-derived.
- Assert accepted override still suppresses blocking action but keeps assessment/audit metadata.

### Regression Commands

```bash
npx vitest run src/lib/agent/job-targeting/__tests__ src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/job-targeting/override/route.test.ts -x
npm run typecheck
```

## Pass Criteria

- All required compatibility unit tests pass.
- All golden cases pass.
- Hardcode guard passes.
- Focused pipeline and comparison regressions pass.
- Typecheck passes.
