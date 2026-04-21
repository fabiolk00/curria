# 58 Validation

The phase is complete when all of the following are true:

- `generate_file` has an explicit authoritative intake contract for source selection
- payload/source mismatches return typed precondition failures before billable generation
- smart-generation verifies post-persistence handoff coherence before dispatch
- smart-generation and legacy ATS routes preserve typed dispatch failure semantics
- generate-file preflight emits structured logs and seam-specific metric counters
- regression coverage exists for the handoff seam and preview-lock transverse compatibility
- `npm run typecheck` passes
- `npm run audit:route-architecture` passes
- targeted seam tests pass
- `npm run test:architecture-proof-pack` passes
