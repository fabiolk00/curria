# Phase 56 Context - Governance Enforcement Alignment

## Goal

Close the remaining governance-level gaps so automation, CI, docs, and curated proof flows all match the architecture promises already documented in the repo.

This phase must not change runtime or product semantics.

## Problems Addressed

1. CI promised both `audit:route-architecture` and `test:architecture-proof-pack`, but only the audit ran in CI.
2. The route-architecture audit enforced fewer critical route families than the review docs described.
3. The extracted `comparison` route was regression-tested but not part of the curated proof pack.
4. An architecture doc still contained a local absolute Windows path.

## Intended Outcomes

- CI runs both the route-architecture audit and the architecture proof pack.
- The audit enforces extracted seams for `compare`, `comparison`, and `versions` in addition to the existing critical surfaces.
- The proof pack covers the `comparison` route and its extracted seam tests.
- Architecture review docs use repo-portable links and describe the new enforcement reality.
