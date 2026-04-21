# Hotspot Watchlist

## Recently Resolved

- `src/app/api/session/[id]/comparison/route.ts` is no longer a route-architecture ambiguity hotspot after the extraction to `src/lib/routes/session-comparison/*`.
- `POST /api/session/[id]/compare` remains the canonical compare seam; future compare semantics should land there instead of reopening overlap with `comparison`.

## `src/lib/routes/session-generate/decision.ts`

Why it is a hotspot:

- durable job reuse, retry semantics, completed fallback, and in-flight persistence all meet here

Current responsibilities:

- coordinate reusable job interpretation
- start or rejoin durable processing
- normalize completed, failed, and in-progress outcomes

Signs it needs another split:

- the file exceeds 350 lines
- more than 5 distinct responsibilities appear in one module
- tests need more than 8 mocks to prove one path
- a new feature touches unrelated orchestration concerns in the same edit

Next extraction if it grows:

- keep route-specific helpers in `job-reuse.ts`, `job-start.ts`, and `state-persistence.ts`
- isolate artifact-ready degraded fallback in `artifact-fallback.ts`

## `src/lib/routes/smart-generation/decision.ts`

Why it is a hotspot:

- readiness, session bootstrap, pipeline execution, and result normalization are tightly adjacent

Current responsibilities:

- resolve workflow mode
- validate readiness and quota
- bootstrap the session snapshot
- run the selected rewrite pipeline
- normalize the generated result

Signs it needs another split:

- the file exceeds 350 lines
- more than 5 distinct responsibilities appear in one module
- tests need more than 8 mocks to prove one path
- new features require edits across unrelated validation and normalization sections

Next extraction if it grows:

- `readiness.ts`
- `workflow-mode.ts`
- `dispatch.ts`
- `session-bootstrap.ts`
- `result-normalization.ts`
- `preview-access.ts`
