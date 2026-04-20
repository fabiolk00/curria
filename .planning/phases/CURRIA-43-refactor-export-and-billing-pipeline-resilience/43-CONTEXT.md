# Phase 43 Context - Refactor export and billing pipeline resilience

## Decisions

- This phase is a focused reliability refactor for the resume export and billing pipeline, not a redesign of the ATS workflow, UI, or artifact template system.
- `generate_file` and `generateBillableResume(...)` must treat successful artifact generation as the primary outcome; billing bookkeeping and generation-history persistence are supporting concerns that must not incorrectly surface `INTERNAL_ERROR` after the artifact path already succeeded.
- The current brownfield request and job surfaces should stay intact. Prefer tightening boundaries and fallbacks inside the existing export pipeline over introducing a new service, queue, billing model, or public API shape.
- The pipeline must remain billing-safe. If generation-specific billing infrastructure is missing, drifted, or partially unavailable, the system should degrade to the safest supported credit-consumption path rather than silently skip credit handling.
- Schema drift and partially provisioned environments must be first-class resilience cases. Missing RPCs, missing tables, missing columns, and failed generation-record updates should be observable and recoverable where possible.
- Artifact generation, credit consumption, and generation-record persistence should become explicit sub-steps with clear logging so operators can distinguish renderer failure from bookkeeping failure.
- Resume truth rules remain unchanged: `cvState` stays canonical, optimized-state selection stays deterministic, and ATS enhancement semantics should not be rewritten in this phase.
- Tests for this phase should focus on no-target ATS export, degraded billing infra, degraded `resume_generations` persistence, and the guarantee that successful artifact output is still returned when auxiliary persistence fails.

## Claude's Discretion

- Choose the smallest brownfield-safe refactor that makes export generation, credit consumption, and generation-record persistence easier to reason about as separate steps.
- Decide whether the right shape is helper extraction, orchestration splitting inside `generateBillableResume(...)`, or a small pipeline module, as long as the boundaries become clearer and failure handling is explicit.
- Add or tighten structured logs where they materially improve diagnosis, but avoid flooding logs or changing user-facing wording unless required for correctness.
- Reuse the current tests and fixtures where possible; add only the focused regression coverage needed to prove the new resilience guarantees.

## Deferred Ideas

- Redesigning ATS enhancement, job-targeting prompts, or resume-writing business rules.
- Replacing the current export API shape or moving billing to a separate service.
- New UX for generation progress, new product surfaces, or broad billing policy changes.
- Non-essential cleanup outside the export and billing pipeline touched by this failure mode.
