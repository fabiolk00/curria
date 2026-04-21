# Architecture Scorecard

Updated: 2026-04-20

## Current Score

- Route thinness: pass. Critical routes keep request resolution in `context.ts`, orchestration in `decision.ts`, and HTTP mapping in `response.ts`, including the extracted `compare` and `comparison` seams.
- Hotspot count: 2 tracked. `session-generate/decision.ts` and `smart-generation/decision.ts` stay on the watchlist with explicit split triggers.
- Compare ambiguity: reduced. `POST /compare` is now the documented canonical seam, while `GET /comparison` stays compatibility-only for the dashboard contract.
- Invariant coverage: pass. Locked preview, locked compare, and locked versions now assert their seam contracts in code and tests.
- Signed URL emitter count: 3 approved chokepoints.
- Preview policy enforcement points: `locked-preview.ts`, `preview-sanitization.ts`, route decision invariants, and proof-pack tests.
- Transverse test coverage: pass. Preview-lock transverse flow remains in the release proof pack.
- Governance automation coverage: pass. CI now runs `npm run audit:route-architecture`.

## How To Read It

- A downgrade here should trigger the next architecture hardening pass before more feature work accumulates.
- If hotspot count rises above 2 or a chokepoint expands outside the approved list, treat that as a regression.
