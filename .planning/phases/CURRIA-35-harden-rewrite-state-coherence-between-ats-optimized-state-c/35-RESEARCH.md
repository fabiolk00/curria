# Phase 35 Research

## Objective

Plan the smallest safe hardening change that restores coherence between deterministic optimized resume state and later chat or target-resume consumers.

## What I Reviewed

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/CURRIA-35-harden-rewrite-state-coherence-between-ats-optimized-state-c/35-CONTEXT.md`
- `.planning/milestones/v1.1-phases/06-dialog-continuity-and-model-routing-hardening/06-RESEARCH.md`
- `.planning/milestones/v1.1-phases/CURRIA-08-ats-enhancement-rewrite-pipeline/08-02-PLAN.md`
- `.planning/milestones/v1.1-phases/CURRIA-09-ats-enhancement-reliability-hardening/09-02-SUMMARY.md`
- `.planning/milestones/v1.1-phases/CURRIA-10-target-job-rewrite-pipeline/10-CONTEXT.md`
- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/index.ts`
- `src/lib/agent/streaming-loop.test.ts`
- `src/lib/agent/tools/index.test.ts`

## Key Findings

### The rewrite pipelines already honor the optimized-state contract

- ATS enhancement and job targeting already rewrite the full supported resume structure and persist the validated result into `agentState.optimizedCvState`.
- Historical phase artifacts are explicit that `optimizedCvState` is the deterministic output consumers should prefer once it exists.

### The drift happens in downstream consumers, not in the pipeline itself

- Follow-up chat rewrites still had helper paths that pulled `summary`, `experience`, `skills`, scoring text, or target keywords from `session.cvState`.
- Tool-driven target resume creation also risked starting from stale base `cvState` after an ATS rewrite had already produced a newer optimized source.

### The user complaint maps directly to a missing coherence seam

- If the user asks the chat to rewrite experience after ATS enhancement already ran, stale sourcing makes the follow-up appear to ignore the optimized professional history.
- This is a correctness issue first and a UX issue second: the visible output can be logically inconsistent with the latest validated resume state even when no facts are invented.

## Risks

- Accidentally flipping the canonical source-of-truth rule by treating `optimizedCvState` as persisted truth rather than an effective downstream source.
- Fixing summary-only chat rewrites while leaving experience or target-resume derivation on stale state.
- Adding tests that prove only one happy path and miss the actual professional-experience complaint.

## Recommended Plan Shape

Use 2 sequential plans:

1. Introduce one effective resume-state selection seam in the chat and target-derivation paths so downstream consumers consistently prefer `optimizedCvState` when present.
2. Lock the contract with regressions focused on follow-up rewrite sourcing, especially experience, and target resume creation after ATS enhancement.

## Proposed Requirement Mapping

- `COH-01`: follow-up chat rewrites and deterministic helpers use the effective optimized resume state
- `COH-02`: target resume derivation after ATS enhancement stays coherent and regression-tested
