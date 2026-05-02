# Quick Task 260502-g04: Job Targeting Generic Compatibility Engine - Research

**Researched:** 2026-05-02  
**Domain:** CurrIA Job Targeting compatibility/refactor  
**Confidence:** HIGH for codebase map; MEDIUM-HIGH for implementation plan

<user_constraints>
## User Constraints (from CONTEXT.md)

All bullets in this section are copied from `.planning/quick/260502-g04-refatorar-job-targeting-para-motor-gener/260502-g04-CONTEXT.md`. [VERIFIED: .planning/quick/260502-g04-refatorar-job-targeting-para-motor-gener/260502-g04-CONTEXT.md]

### Locked Decisions

#### Canonical Source Of Truth
- Create `src/lib/agent/job-targeting/compatibility/` with assessment, matching, scoring, claim-policy, requirement extraction/decomposition, evidence extraction, structured validation, and shared types.
- `JobCompatibilityAssessment` is the single source of truth for supported, adjacent, unsupported requirements, claim permissions, score, critical gaps, review-needed gaps, low-fit state, and audit metadata.
- Existing legacy structures such as `targetEvidence`, `coreRequirementCoverage`, `rewritePermissions`, `safeTargetingEmphasis`, low-fit gate data, explanations, and score breakdown must be adapted from assessment rather than recalculating compatibility independently.

#### Generic Core
- Core code may normalize text, extract/decompose requirements, extract resume evidence, compare terms, classify evidence, calculate deterministic scores, apply claim policy, and validate generated claims.
- Core code must not contain hardcoded rules for tools, vendors, stacks, companies, industries, or segments.
- Specific examples such as Power BI, Power Query, Totvs, Java, Salesforce, SAP, Google Ads, Excel, Tableau, HubSpot, AutoCAD, CRM, and ERP are allowed in fixtures, tests, and catalog JSON only.

#### Catalog Contract
- Create `src/lib/agent/job-targeting/catalog/` with catalog types, loader, validator, `generic-taxonomy.json`, and domain packs for data-bi, software-engineering, finance, marketing, operations, sales, and hr.
- Catalog packs are versioned data. Each pack must include `id`, `version`, `domain`, `terms`, `categories`, `antiEquivalences`, and `goldenCaseIds`.
- No catalog term or anti-equivalence is valid without `goldenCaseIds`.

#### Matching Order
- Matching precedence is exact, catalog alias, anti-equivalence, category equivalence, adjacent category, optional LLM ambiguity resolver, fallback unsupported.
- Anti-equivalence blocks unsafe inference but never beats an exact match.
- Product surfaces reason only in `supported`, `adjacent`, and `unsupported`; internal evidence levels remain available for audit/debug.

#### Claim Safety
- Claim policy must be structured, not a string list.
- Supported evidence can become allowed claims.
- Adjacent evidence can only become cautious claims and must include a cautious verbalization template.
- Unsupported evidence becomes forbidden claims with prohibited terms.
- Rewriter and structured validation must be able to enforce forbidden/cautious claim boundaries.

#### Score
- Score must be deterministic and versioned as `job-compat-score-v1`.
- Weights: skills `0.34`, experience `0.46`, education `0.20`, adjacent discount `0.50`.
- Supported counts as `1.0`, adjacent as `0.5`, unsupported as `0.0`.
- Final visual score must come from this score, not an arbitrary LLM score or parallel coverage calculation.

#### Golden Cases And Tests
- Add golden cases before behavior refactor and use them to prove improvements.
- Minimum cases: `data-bi-good-fit-with-specific-gaps`, `data-bi-tool-without-related-transform-tool`, `correlated-education-good-fit`, `software-engineering-low-fit-from-data-profile`, `erp-specific-tool-missing`, `automation-adjacent-without-rpa`, `marketing-ads-good-fit-with-missing-crm`, `finance-analyst-missing-accounting-system`.
- Add tests for catalog validator, requirement decomposition, evidence extraction, matcher, claim policy, score, assessment, structured validation, golden cases, and architecture hardcode guard.

#### Pipeline Integration
- In `runJobTargetingPipeline`, after gap analysis, call `evaluateJobCompatibility` with `cvState`, `targetJobDescription`, `gapAnalysis`, `userId`, and `sessionId`.
- Persist `agentState.jobCompatibilityAssessment`.
- Low-fit decisions and displayed score should use assessment.
- Add safe structured logs for started, catalog loaded, requirements extracted, evidence classified, claim policy built, score calculated, and completed. Logs must include counts and versions, not full resume or full job description.

### Claude's Discretion

None provided in CONTEXT.md. [VERIFIED: .planning/quick/260502-g04-refatorar-job-targeting-para-motor-gener/260502-g04-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)

None provided in CONTEXT.md. [VERIFIED: .planning/quick/260502-g04-refatorar-job-targeting-para-motor-gener/260502-g04-CONTEXT.md]
</user_constraints>

## Summary

CurrIA already has a Job Targeting runtime, but the compatibility decision is distributed across `buildTargetedRewritePlan`, `classifyTargetEvidence`, `domain-equivalents`, `core-requirement-coverage`, `rewrite-permissions`, `safe-targeting-emphasis`, `low-fit-warning-gate`, `score-breakdown`, `target-recommendations`, and `validation-policy`. [VERIFIED: src/lib/agent/tools/build-targeting-plan.ts:154-219; src/lib/agent/job-targeting/evidence-classifier.ts:502-535; src/lib/agent/job-targeting/domain-equivalents.ts:38-400; src/lib/agent/job-targeting/core-requirement-coverage.ts:829-984; src/lib/agent/job-targeting/score-breakdown.ts:211-255; src/lib/agent/job-targeting/validation-policy.ts:121-386]

The safest plan is to add `JobCompatibilityAssessment` as the new canonical contract, then adapt legacy `TargetingPlan`, score breakdown, low-fit gate, claim permissions, recoverable drafts, and validation inputs from that assessment before deleting old calculations. [VERIFIED: src/types/agent.ts:196-344; src/types/agent.ts:440-477; src/lib/agent/job-targeting-pipeline.ts:623-702; src/lib/agent/job-targeting-pipeline.ts:1176-1418]

**Primary recommendation:** implement the new engine behind `evaluateJobCompatibility(...)`, persist `agentState.jobCompatibilityAssessment`, and keep current consumers working through adapters until all score/gate/claim consumers read assessment-derived data. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:429-510; src/lib/db/session-normalization.ts:93-126]

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Keep `cvState` as canonical resume truth and `agentState` as operational runtime context; Job Compatibility belongs in `agentState`, not `cvState`. [CITED: CLAUDE.md; VERIFIED: src/types/agent.ts:440-477]
- Tools and pipelines must not mutate session persistence outside the existing state merge/persistence seams; pipeline-local state is persisted through `updateSession` and agent-state patches. [CITED: CLAUDE.md; VERIFIED: src/lib/agent/job-targeting-pipeline.ts:35-59; src/lib/db/session-normalization.ts:93-178]
- Route handlers should stay thin, external inputs should be validated with `zod`, and structured logs should use `logInfo`, `logWarn`, and `logError`. [CITED: AGENTS.md; CITED: CLAUDE.md]
- Brownfield product behavior should be preserved unless scope explicitly changes; this phase should be compatibility refactor, not UI/business-rule expansion. [CITED: AGENTS.md]
- Test framework is Vitest with Testing Library, and committed tests should reuse the existing local mocks and `vi.hoisted` patterns for OpenAI seams. [VERIFIED: package.json; VERIFIED: vitest.config.ts; VERIFIED: src/lib/agent/job-targeting/evidence-classifier.test.ts:1-35]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why standard here |
|---|---:|---|---|
| TypeScript | 5.9.3 | Typed domain contracts and adapters | Existing stack and all Job Targeting code are TS modules. [VERIFIED: npm ls typescript; VERIFIED: src/lib/agent/job-targeting] |
| Zod | 3.25.76 | Catalog JSON validation | Existing convention says validate external/structured input with zod. [VERIFIED: npm ls zod; CITED: AGENTS.md] |
| Vitest | 1.6.1 | Unit and integration proof | Existing Job Targeting coverage uses Vitest. [VERIFIED: npm ls vitest; VERIFIED: src/lib/agent/job-targeting/*.test.ts] |
| OpenAI SDK | 6.33.0 | Optional ambiguity resolver only | Current classifier already uses the existing OpenAI client behind `callOpenAIWithRetry`; new core should stay deterministic-first and keep LLM optional. [VERIFIED: npm ls openai; VERIFIED: src/lib/agent/job-targeting/evidence-classifier.ts:342-488; VERIFIED: CONTEXT.md] |

### Installation

No new dependency is required for the planned refactor. [VERIFIED: package.json; VERIFIED: npm ls zod vitest typescript openai]

## Current Pipeline Map

| Surface | Current behavior | Planning implication |
|---|---|---|
| Smart Generation | `executeSmartGenerationDecision` resolves `job_targeting` when `targetJobDescription` is present, then `runSmartGenerationPipeline` dispatches to `runJobTargetingPipeline`. [VERIFIED: src/lib/routes/smart-generation/decision.ts:70-176; src/lib/routes/smart-generation/dispatch.ts:1-15] | Integrate assessment inside pipeline, not the route. |
| Pipeline | `runJobTargetingPipeline` performs gap analysis, target fit, targeting plan, rewrite, validation, explanation, highlight, and version persistence. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:429-1624] | Add assessment immediately after gap analysis and before target plan/rewrite. |
| Override route | Pre-rewrite low-fit override rebuilds a generation session and calls `runJobTargetingPipeline(..., { userAcceptedLowFit, skipPreRewriteLowFitBlock, skipLowFitRecoverableBlocking, deferSessionPersistence })`. [VERIFIED: src/app/api/session/[id]/job-targeting/override/route.ts:613-670] | Assessment must preserve override flags and not re-block accepted low-fit paths. |
| Session API | `GET /api/session/[id]` exposes `targetingPlan`, `jobTargetingExplanation`, `rewriteValidation`, and `recoverableValidationBlock`. [VERIFIED: src/app/api/session/[id]/route.ts:100-131] | Add `jobCompatibilityAssessment` only if client needs diagnostics; otherwise keep it server/internal. |
| Compare API | Session comparison backfills missing `scoreBreakdown` from `targetingPlan`. [VERIFIED: src/lib/routes/session-comparison/decision.ts:18-37] | Replace this fallback with assessment-derived score to avoid a second calculator. |
| UI | Resume comparison renders `JobTargetingScoreCard` when `jobTargetingExplanation.scoreBreakdown` exists. [VERIFIED: src/components/resume/resume-comparison-view.tsx:635-773] | Keep the public score response shape stable while changing its source. |

## Existing Compatibility Structures

| Structure | Current owner | Notes for refactor |
|---|---|---|
| `TargetEvidence` | `src/types/agent.ts` | Current levels include `explicit`, `normalized_alias`, `technical_equivalent`, `strong_contextual_inference`, `semantic_bridge_only`, and `unsupported_gap`. [VERIFIED: src/types/agent.ts:220-250] |
| `TargetedRewritePermissions` | `src/types/agent.ts` and `rewrite-permissions.ts` | Current claim policy is list-based and must be adapted from structured assessment claim policy. [VERIFIED: src/types/agent.ts:323-330; src/lib/agent/job-targeting/rewrite-permissions.ts:46-91] |
| `SafeTargetingEmphasis` | `safe-targeting-emphasis.ts` | Current bridge wording is generated from evidence; adapter can map assessment cautious claims into this shape. [VERIFIED: src/lib/agent/job-targeting/safe-targeting-emphasis.ts:71-122] |
| `CoreRequirementCoverage` | `core-requirement-coverage.ts` | Current extractor/decomposer has useful generic parsing, but it also includes many phrase/heading regexes. [VERIFIED: src/lib/agent/job-targeting/core-requirement-coverage.ts:1-984] |
| `LowFitWarningGate` | `low-fit-warning-gate.ts` | Current gate uses match score, career risk, target evidence ratios, and core coverage. [VERIFIED: src/lib/agent/job-targeting/low-fit-warning-gate.ts:43-158] |
| `JobTargetingScoreBreakdown` | `score-breakdown.ts` | Current score uses the target plan and its own evidence scores; it does not match the locked `job-compat-score-v1` formula. [VERIFIED: src/lib/agent/job-targeting/score-breakdown.ts:33-36; src/lib/agent/job-targeting/score-breakdown.ts:103-121; VERIFIED: CONTEXT.md] |
| `JobTargetingExplanation` | `src/types/agent.ts` | Current client-facing explanation has `scoreBreakdown`, recommendations, `source`, and `version: 1`. [VERIFIED: src/types/agent.ts:196-207] |

## Architecture Patterns

### Recommended Project Structure

```text
src/lib/agent/job-targeting/
  catalog/
    catalog-types.ts
    catalog-validator.ts
    catalog-loader.ts
    generic-taxonomy.json
    domain-packs/*.json
  compatibility/
    assessment.ts
    requirement-decomposition.ts
    evidence-extraction.ts
    matcher.ts
    score.ts
    claim-policy.ts
    structured-validation.ts
    legacy-adapters.ts
  __fixtures__/
    golden-cases/*.json
  __tests__/
    *.test.ts
```

This structure matches the locked path decisions and keeps catalog data outside core logic. [VERIFIED: CONTEXT.md]

### Pattern 1: Canonical Assessment With Legacy Adapters

**What:** `evaluateJobCompatibility` returns one canonical assessment, and `legacy-adapters.ts` derives current `TargetingPlan`, `JobTargetingExplanation`, `LowFitWarningGate`, `TargetEvidence`, and validation policy shapes. [VERIFIED: CONTEXT.md; VERIFIED: src/types/agent.ts:196-344]

**When to use:** use this for the first integration wave so `rewriteResumeFull`, `validateRewrite`, recoverable modal generation, comparison UI, and override route can keep their current signatures while their inputs become assessment-derived. [VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts:85-261; VERIFIED: src/lib/agent/tools/validate-rewrite.ts:193-386; VERIFIED: src/lib/agent/job-targeting-pipeline.ts:1362-1418]

### Pattern 2: Catalog Data, Not Core Branches

**What:** move rules like domain equivalents, strict literals, anti-equivalences, and adjacency into validated catalog packs. [VERIFIED: CONTEXT.md; VERIFIED: src/lib/agent/job-targeting/domain-equivalents.ts:38-400; VERIFIED: src/lib/agent/job-targeting/skill-adjacency.ts:12-51]

**When to use:** use catalog JSON for all tool/vendor/domain/segment examples and make the matcher operate on generic fields such as aliases, categories, anti-equivalences, and adjacency. [VERIFIED: CONTEXT.md]

### Pattern 3: Golden Cases Before Behavior Swap

**What:** add the locked golden cases first, snapshot the current false positives/false negatives, then make the engine pass those cases without changing unrelated pipeline behavior. [VERIFIED: CONTEXT.md; VERIFIED: src/lib/agent/job-targeting/job-targeting-compatibility-regression.test.ts:155-259]

**When to use:** use golden cases as the refactor safety net before replacing `classifyTargetEvidence`, `buildCoreRequirementCoverage`, `buildLowFitWarningGate`, and `buildJobTargetingScoreBreakdownFromPlan`. [VERIFIED: src/lib/agent/tools/build-targeting-plan.ts:154-219]

## Integration Plan Guidance

1. Freeze `JobCompatibilityAssessment` types and catalog schemas first; add tests for schema validation and the hardcode guard before changing runtime behavior. [VERIFIED: CONTEXT.md; VERIFIED: src/lib/agent/job-targeting/core-requirement-coverage.test.ts:53-70]
2. Add catalog loader/validator and move current domain-specific examples from `domain-equivalents.ts` and `skill-adjacency.ts` into JSON packs. [VERIFIED: src/lib/agent/job-targeting/domain-equivalents.ts:38-400; VERIFIED: src/lib/agent/job-targeting/skill-adjacency.ts:12-51]
3. Implement deterministic requirement extraction, evidence extraction, matcher, claim policy, and `job-compat-score-v1` in `compatibility/` with focused unit tests. [VERIFIED: CONTEXT.md]
4. Add `legacy-adapters.ts` that derives current `targetEvidence`, `rewritePermissions`, `safeTargetingEmphasis`, `coreRequirementCoverage`, `lowFitWarningGate`, `jobTargetingExplanation`, and `rewriteValidation` inputs from the assessment. [VERIFIED: src/types/agent.ts:196-344; VERIFIED: src/types/agent.ts:440-477]
5. Integrate `evaluateJobCompatibility` in `runJobTargetingPipeline` after `gapAnalysis` and persist `agentState.jobCompatibilityAssessment` alongside the legacy adapted `targetingPlan`. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:565-702; VERIFIED: src/lib/db/session-normalization.ts:93-126]
6. Replace downstream score/gate/validation recomputation with assessment-derived adapters, then remove old domain-hardcoded runtime modules once tests prove parity or intended improvement. [VERIFIED: src/lib/routes/session-comparison/decision.ts:28-37; VERIFIED: src/lib/agent/job-targeting-pipeline.ts:1176-1418]

## Likely Files To Touch

| File / Area | Why |
|---|---|
| `src/types/agent.ts` | Add `JobCompatibilityAssessment` to `AgentState` and keep legacy fields during migration. [VERIFIED: src/types/agent.ts:440-477] |
| `src/lib/agent/job-targeting-pipeline.ts` | Main integration seam after gap analysis and before targeting/rewrite. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:565-702] |
| `src/lib/agent/tools/build-targeting-plan.ts` | Current enriched plan builder can become a legacy adapter wrapper or be narrowed after assessment integration. [VERIFIED: src/lib/agent/tools/build-targeting-plan.ts:154-219] |
| `src/lib/agent/tools/rewrite-resume-full.ts` | Consumes `TargetingPlan` permission/emphasis/core coverage instructions. [VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts:155-261; src/lib/agent/tools/rewrite-resume-full.ts:389-464] |
| `src/lib/agent/tools/validate-rewrite.ts` and `src/lib/agent/job-targeting/validation-policy.ts` | Enforce claim boundaries; should consume structured claim policy via adapter. [VERIFIED: src/lib/agent/tools/validate-rewrite.ts:320-386; src/lib/agent/job-targeting/validation-policy.ts:121-386] |
| `src/lib/routes/session-comparison/decision.ts` | Remove score backfill from legacy `targetingPlan` and use assessment-derived score. [VERIFIED: src/lib/routes/session-comparison/decision.ts:18-37] |
| `src/app/api/session/[id]/route.ts` | Decide whether to expose assessment diagnostics; current route already returns legacy targeting fields. [VERIFIED: src/app/api/session/[id]/route.ts:100-131] |
| `src/app/api/session/[id]/job-targeting/override/route.ts` | Must preserve accepted-low-fit override behavior. [VERIFIED: src/app/api/session/[id]/job-targeting/override/route.ts:613-670] |
| `src/lib/agent/job-targeting/*.test.ts` and `src/lib/agent/tools/pipeline.test.ts` | Existing focused tests are the best regression scaffold. [VERIFIED: rg --files src/lib/agent/job-targeting; VERIFIED: src/lib/agent/tools/pipeline.test.ts:1749-1865] |

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Catalog validation | Ad hoc JSON checks | Zod schemas in `catalog/catalog-validator.ts` | Project convention already uses zod for structured validation. [CITED: AGENTS.md; VERIFIED: npm ls zod] |
| Public score math | Parallel calculators in route/UI/pipeline | `job-compat-score-v1` from assessment | Current comparison route can backfill score from `targetingPlan`, which would become a second calculator if left in place. [VERIFIED: src/lib/routes/session-comparison/decision.ts:28-37] |
| Claim safety | String lists as source of truth | Structured claim policy adapted to legacy lists | Current `TargetedRewritePermissions` is list-based and should become an adapter output. [VERIFIED: src/types/agent.ts:323-330; VERIFIED: CONTEXT.md] |
| Domain equivalence | `if Power BI then...` runtime branches | Catalog alias/category/anti-equivalence records | Current `domain-equivalents.ts` and `skill-adjacency.ts` contain runtime technology/domain examples that conflict with the new locked core rule. [VERIFIED: src/lib/agent/job-targeting/domain-equivalents.ts:38-400; VERIFIED: src/lib/agent/job-targeting/skill-adjacency.ts:12-51; VERIFIED: CONTEXT.md] |
| Golden proof | One-off fixture assertions | Shared golden case runner | The phase requires multiple domain packs and golden cases, so a runner prevents duplicated test setup. [VERIFIED: CONTEXT.md] |

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `sessions.agent_state` stores operational targeting state, including `targetingPlan`, `jobTargetingExplanation`, and blocked drafts; `resume_targets.gap_analysis` stores target analysis. [VERIFIED: prisma/schema.prisma:72; VERIFIED: prisma/schema.prisma:119-128; VERIFIED: docs/operations/json-persistence-contracts.md:20-31] | No table migration is required for adding an optional `agentState.jobCompatibilityAssessment`; add runtime fallback/adapters for old sessions without assessment. |
| Live service config | No external UI/service config was found for compatibility rules in repo search. [VERIFIED: rg "JOB_TARGETING|JOB_COMPAT|COMPATIBILITY|TARGETING" src .github scripts prisma docs] | None for this quick task. |
| OS-registered state | No PM2/systemd/launchd/TaskScheduler files were found in repo file inventory. [VERIFIED: rg --files pattern audit] | None. |
| Secrets/env vars | `.env`, `.env.example`, and `.env.staging.example` exist, but no `JOB_COMPAT`, `COMPATIBILITY`, or `TARGETING` env key was found. [VERIFIED: Get-ChildItem .env*; VERIFIED: rg -g ".env*" "JOB_TARGETING|JOB_COMPAT|COMPATIBILITY|COMPAT|TARGETING"] | None. |
| Build artifacts | No compatibility-specific build artifact or installed package state was found. [VERIFIED: rg --files pattern audit] | None. |

## Common Pitfalls

### Pitfall 1: Hidden Parallel Compatibility Decisions

**What goes wrong:** pipeline builds one decision, comparison route backfills another score, validation enforces another claim policy, and low-fit uses a separate ratio. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:623-702; VERIFIED: src/lib/routes/session-comparison/decision.ts:28-37; VERIFIED: src/lib/agent/tools/validate-rewrite.ts:320-386]

**Avoid:** make assessment the only source and adapt all legacy outputs from it. [VERIFIED: CONTEXT.md]

### Pitfall 2: Domain Hardcodes Survive In Helper Modules

**What goes wrong:** moving one rule to catalog still leaves examples in `score-breakdown`, `target-recommendations`, `domain-equivalents`, `skill-adjacency`, or target-role extraction. [VERIFIED: src/lib/agent/job-targeting/score-breakdown.ts:67-79; VERIFIED: src/lib/agent/job-targeting/domain-equivalents.ts:38-400; VERIFIED: src/lib/agent/job-targeting/skill-adjacency.ts:12-51; VERIFIED: src/lib/agent/tools/build-targeting-plan.ts:60-281]

**Avoid:** add an architecture guard over `src/lib/agent/job-targeting/compatibility/**` and legacy core files, excluding `catalog/**`, fixtures, and tests. [VERIFIED: src/lib/agent/job-targeting/core-requirement-coverage.test.ts:53-70]

### Pitfall 3: Accepted Low-Fit Override Regresses

**What goes wrong:** a new low-fit assessment can re-block after the user already accepted override. [VERIFIED: src/app/api/session/[id]/job-targeting/override/route.ts:613-670; VERIFIED: src/lib/agent/job-targeting-pipeline.ts:3056-3184]

**Avoid:** thread `userAcceptedLowFit`, `skipPreRewriteLowFitBlock`, and `skipLowFitRecoverableBlocking` into assessment/adapters or skip only the blocking action while keeping audit metadata. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:429-443]

### Pitfall 4: Score Formula Drift

**What goes wrong:** the existing score uses 96/74/56/20 evidence scores and fallback dimension scores instead of the locked 1.0/0.5/0.0 formula. [VERIFIED: src/lib/agent/job-targeting/score-breakdown.ts:103-146; VERIFIED: CONTEXT.md]

**Avoid:** implement `job-compat-score-v1` in one file and make `JobTargetingScoreBreakdown` a display adapter. [VERIFIED: CONTEXT.md]

## Code Examples

### Pipeline Integration Shape

```ts
const assessment = await evaluateJobCompatibility({
  cvState: session.cvState,
  targetJobDescription,
  gapAnalysis: gapAnalysisResult,
  userId: session.userId,
  sessionId: session.id,
})

const targetingPlan = buildTargetingPlanFromAssessment(assessment)
```

This belongs after current gap analysis and before current `buildTargetedRewritePlan`/rewrite steps. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:565-702; VERIFIED: CONTEXT.md]

### Legacy Adapter Boundary

```ts
return {
  ...session.agentState,
  workflowMode: 'job_targeting',
  gapAnalysis,
  jobCompatibilityAssessment: assessment,
  targetingPlan: buildTargetingPlanFromAssessment(assessment),
  jobTargetingExplanation: buildExplanationFromAssessment(assessment),
}
```

`agent_state` is JSON operational state and `normalizeAgentState` preserves structured agent fields while applying defaults. [VERIFIED: prisma/schema.prisma:72; VERIFIED: src/lib/db/session-normalization.ts:93-126]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 1.6.1 [VERIFIED: npx vitest --version] |
| Config file | `vitest.config.ts` [VERIFIED: vitest.config.ts] |
| Quick run command | `npx vitest run src/lib/agent/job-targeting src/lib/agent/tools/build-targeting-plan.test.ts src/lib/agent/tools/validate-rewrite.test.ts -x` |
| Full focused command | `npx vitest run src/lib/agent/job-targeting src/lib/agent/tools/pipeline.test.ts src/lib/routes/smart-generation/decision.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/profile/smart-generation/route.test.ts src/app/api/session/[id]/job-targeting/override/route.test.ts` |

### Behavior To Test

| Behavior | Test Type | Existing Coverage | Wave 0 Gap |
|---|---|---|---|
| Catalog validator rejects terms/anti-equivalences without `goldenCaseIds` | unit | none found. [VERIFIED: rg --files src/lib/agent/job-targeting] | Add `src/lib/agent/job-targeting/__tests__/catalog-validator.test.ts`. |
| Requirement extraction/decomposition remains generic | unit/golden | Partial current coverage in `core-requirement-coverage.test.ts`. [VERIFIED: src/lib/agent/job-targeting/core-requirement-coverage.test.ts:53-180] | Add golden runner for locked cases. |
| Matcher precedence exact > alias > anti-equivalence > category > adjacent > LLM > unsupported | unit | none found for this exact order. [VERIFIED: CONTEXT.md; VERIFIED: rg --files src/lib/agent/job-targeting] | Add `src/lib/agent/job-targeting/__tests__/matcher.test.ts`. |
| Claim policy allowed/cautious/forbidden maps to validation and rewrite | unit/integration | Current list-based tests exist. [VERIFIED: src/lib/agent/job-targeting/validation-policy.test.ts; VERIFIED: src/lib/agent/job-targeting/safe-targeting-emphasis.test.ts] | Add `claim-policy.test.ts` and adapter tests. |
| Score `job-compat-score-v1` uses locked weights and adjacent discount | unit | Current score tests cover old display shape only. [VERIFIED: src/lib/agent/job-targeting/score-breakdown.test.ts:56-99] | Add `src/lib/agent/job-targeting/compatibility/score.ts` and `src/lib/agent/job-targeting/__tests__/score.test.ts`. |
| Pipeline persists assessment and derives legacy fields | integration | Pipeline tests cover current legacy fields. [VERIFIED: src/lib/agent/tools/pipeline.test.ts:1749-1865] | Extend pipeline tests for `jobCompatibilityAssessment`. |
| Hardcode guard blocks tool/vendor/segment terms in core | unit/architecture | Current guard covers only `core-requirement-coverage.ts`. [VERIFIED: src/lib/agent/job-targeting/core-requirement-coverage.test.ts:53-70] | Add guard over `compatibility/**` excluding `catalog/**`, fixtures, tests. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | test/typecheck runtime | yes | 24.14.0 [VERIFIED: node --version] | none |
| npm | package scripts | yes | 11.9.0 [VERIFIED: npm --version] | none |
| Vitest | automated tests | yes | 1.6.1 [VERIFIED: npx vitest --version] | none |
| TypeScript | typecheck | yes | 5.9.3 [VERIFIED: npx tsc --version] | none |
| OpenAI credentials | optional ambiguity resolver runtime | not probed | SDK 6.33.0 installed [VERIFIED: npm ls openai] | deterministic fallback unsupported |

**Missing dependencies with no fallback:** none for unit-testable deterministic implementation. [VERIFIED: environment probes above]

**Missing dependencies with fallback:** OpenAI credentials are not required for deterministic tests because existing tests mock the OpenAI seam. [VERIFIED: src/lib/agent/job-targeting/evidence-classifier.test.ts:10-35]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---:|---|
| V2 Authentication | no new auth surface | Keep existing smart-generation and override route auth boundaries. [VERIFIED: src/lib/routes/smart-generation/context.ts; VERIFIED: src/app/api/session/[id]/job-targeting/override/route.ts] |
| V3 Session Management | yes, indirectly | Preserve session ownership and `agentState` JSON persistence contracts. [VERIFIED: docs/operations/json-persistence-contracts.md:20-31] |
| V4 Access Control | yes, indirectly | Do not add direct catalog/admin write route in this task. [VERIFIED: CONTEXT.md] |
| V5 Input Validation | yes | Validate catalog JSON with zod and fail closed on invalid packs. [VERIFIED: npm ls zod; VERIFIED: CONTEXT.md] |
| V6 Cryptography | no | No cryptographic change is required by this refactor. [VERIFIED: CONTEXT.md] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Prompt/job-description injection causing unsafe claims | Tampering | Deterministic claim policy plus structured validation from assessment. [VERIFIED: CONTEXT.md; VERIFIED: src/lib/agent/job-targeting/validation-policy.ts:121-386] |
| Logging resume/job content | Information Disclosure | New logs must include counts, IDs, versions, and no full resume/job text. [VERIFIED: CONTEXT.md; VERIFIED: src/lib/agent/job-targeting-pipeline.ts:704-763] |
| Catalog drift making unsafe equivalences valid | Tampering | Require pack validation and `goldenCaseIds` on terms/anti-equivalences. [VERIFIED: CONTEXT.md] |

## Open Questions (RESOLVED)

1. **Should `jobCompatibilityAssessment` be returned to clients?**  
   What we know: current session and comparison routes expose legacy targeting fields, and UI only needs score/recommendations/review cards today. [VERIFIED: src/app/api/session/[id]/route.ts:100-131; VERIFIED: src/components/resume/resume-comparison-view.tsx:635-773]  
   Resolution: keep full assessment server/internal initially. Persist it in `agentState.jobCompatibilityAssessment`, but expose only the existing adapted public fields unless a later UI task explicitly adds an assessment diagnostic surface.

2. **How much of target-role extraction is in scope for generic core?**  
   What we know: current role extraction has role-name regexes in `build-targeting-plan.ts`. [VERIFIED: src/lib/agent/tools/build-targeting-plan.ts:60-281]  
   Resolution: target-role extraction is metadata for this refactor, not part of the generic compatibility core. The assessment may report `targetRole`, `targetRoleConfidence`, and `targetRoleSource`, but tool/role taxonomy cleanup outside the compatibility engine is deferred.

## Sources

### Primary

- `.planning/quick/260502-g04-refatorar-job-targeting-para-motor-gener/260502-g04-CONTEXT.md` - locked phase decisions.
- `AGENTS.md` and `CLAUDE.md` - project constraints and architecture invariants.
- `src/lib/agent/job-targeting-pipeline.ts` - current runtime integration.
- `src/types/agent.ts` and `src/types/cv.ts` - state and CV contracts.
- `src/lib/agent/job-targeting/**` - current compatibility, score, gate, and validation modules.
- `src/lib/routes/smart-generation/**`, `src/app/api/session/[id]/job-targeting/override/route.ts`, `src/lib/routes/session-comparison/decision.ts` - route/consumer seams.
- `package.json`, `vitest.config.ts`, `npm ls`, `node --version`, `npm --version` - environment and test stack.

### Secondary

- `docs/operations/json-persistence-contracts.md` - JSON persistence ownership and migration direction.
- `.planning/STATE.md` and `.planning/ROADMAP.md` - phase history and related Job Targeting decisions.

### Tertiary

- None.

## Metadata

**Confidence breakdown:**

- Pipeline map: HIGH - verified against current source files and route consumers.
- State/persistence impact: HIGH - verified against Prisma schema and JSON persistence docs.
- Refactor slices: MEDIUM-HIGH - derived from verified seams and locked decisions.
- Security scope: MEDIUM - no new route is required, but catalog validation and logging must be enforced.

**Research date:** 2026-05-02  
**Valid until:** 2026-06-01
