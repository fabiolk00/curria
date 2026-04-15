# Phase 33 Validation

## Goal-Backward Check

Phase 33 succeeds only if a future milestone closeout can be trusted without manual cleanup.

That means:

- archive summaries must stop drifting from the actual archived roadmap, requirements, and audit posture
- decimal phases must be preserved in counts and archive output
- active planning files must end a closeout in a coherent “next milestone ready” state
- there must be committed proof for these rules, not just a one-off manual cleanup

## Required Outputs

- a hardened closeout metadata contract covering `.planning/MILESTONES.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, and archived milestone files
- deterministic regression proof for decimal phase handling, shipped counts, archive output, and next-cycle reset behavior

## Risks To Avoid

- fixing only the current text drift in docs without improving the underlying closeout path
- updating archive summaries manually but leaving no repeatable verification path
- treating decimal phases like `31.1` as special-case prose rather than first-class milestone members

## Plan Shape Decision

Use 2 sequential plans:

- `33-01` for hardening the metadata contract and archive generation behavior
- `33-02` for regression proof and state-reset verification

This keeps implementation of the contract separate from the proof net that protects it.
