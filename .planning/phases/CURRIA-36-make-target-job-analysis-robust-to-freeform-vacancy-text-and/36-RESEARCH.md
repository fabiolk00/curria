# Phase 36 Research

## Objective

Plan the smallest root-cause hardening that makes job targeting work against arbitrary vacancy text without weakening the factual rewrite contract.

## What I Reviewed

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/CURRIA-36-make-target-job-analysis-robust-to-freeform-vacancy-text-and/36-CONTEXT.md`
- `.planning/milestones/v1.1-phases/CURRIA-09-ats-enhancement-reliability-hardening/09-CONTEXT.md`
- `.planning/milestones/v1.1-phases/CURRIA-10-target-job-rewrite-pipeline/10-CONTEXT.md`
- `src/lib/agent/tools/build-targeting-plan.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/agent/tools/validate-rewrite.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/components/dashboard/resume-workspace.tsx`

## Key Findings

### The failure root is semantic under-modeling, not just weak filtering

- The current code treats `targetRole` as a primary anchor even when the vacancy text does not contain one clean role string.
- Headings and recruiter prose are symptoms, but the deeper issue is that the plan does not gracefully continue when role extraction confidence is low.

### The vacancy already contains enough useful signals to proceed without a clean title

- Skills, tools, responsibilities, analytics context, and seniority cues appear across the freeform text the user pastes.
- Those signals are better anchors for `mustEmphasize`, skill ordering, and summary positioning than an unreliable title candidate.

### Validation should stay strict, but rewrites should be sanitized before validation

- `validateRewrite(...)` is doing the right thing by rejecting unsupported skills and invented fit.
- A safer rewrite flow should reorder and constrain the optimized skills section back to original supported skills before validation, instead of letting the whole run die on a predictable LLM failure mode.

### UX should explain likely parser bugs without treating every failure as user error

- The modal is already the right place to explain blocked rewrites.
- It should also recognize broader suspicious role patterns, including English headings and generic recruiter prose, so the user can distinguish a factual blocker from likely parsing drift.

## Risks

- Overcorrecting into an empty or generic targeting plan that loses useful vacancy focus.
- Quietly masking unsupported-skill hallucinations instead of preserving the factual validation contract.
- Introducing new type fields that the dashboard cannot tolerate unless tests cover the widened shape.

## Recommended Plan Shape

Use 2 sequential plans:

1. Rebuild targeting-plan extraction around vacancy semantics, with a low-confidence fallback when a trustworthy role title does not exist.
2. Harden rewrite output and user-facing failure handling so freeform vacancy text still produces a grounded result or a clearly explained block.

## Proposed Requirement Mapping

- `VAC-01`: job targeting can derive useful targeting context from arbitrary vacancy text without depending on clean headings or an explicit role title
- `VAC-02`: job targeting remains factually grounded under freeform vacancy input and reduces preventable validation failures from unsupported skill injection
