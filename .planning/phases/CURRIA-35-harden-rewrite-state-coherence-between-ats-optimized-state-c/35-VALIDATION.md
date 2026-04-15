# Phase 35 Validation

## Goal-Backward Check

Phase 35 only succeeds if deterministic rewrite outputs and later chat or target-resume consumers agree on the same effective resume source.

That means:

- the fix must preserve the historical contract from Phases 8, 9, and 10 that `optimizedCvState` is the validated rewritten resume snapshot
- chat follow-up rewrites must stop sourcing section content from stale base `cvState` when a newer optimized snapshot exists
- target resume derivation must also start from the same effective optimized source
- proof must cover the real complaint area: experience rewrites after prior optimization

## Required Outputs

- one shared effective-state selection seam in the relevant downstream consumers
- targeted regression coverage for follow-up rewrites and target resume derivation
- committed execution and verification artifacts that cite the earlier rewrite phases explicitly

## Risks To Avoid

- treating `optimizedCvState` as canonical persisted truth rather than the effective runtime source
- fixing only the chat summary path while leaving experience or target-resume derivation stale
- closing the phase with narrative confidence but without regression proof

## Plan Shape Decision

Use 2 sequential plans:

- `35-01` to route chat rewrite sourcing and deterministic target derivation through the effective optimized resume state
- `35-02` to lock the contract with experience-focused regressions, validation, and operator-facing proof
