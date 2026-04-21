# Phase 48: Route Policy Extraction and Decision Normalization - Research

**Researched:** 2026-04-20
**Domain:** Thin-route architecture over existing billing, preview-lock, and durable-job contracts
**Confidence:** HIGH

## Summary

The densest route today is [`src/app/api/session/[id]/generate/route.ts`](C:/CurrIA/src/app/api/session/[id]/generate/route.ts), which currently mixes ownership checks, trust validation, scope and target resolution, idempotency key construction, active-export guarding, durable job reuse or retry, billing reconciliation blocking, persistence fallbacks, and HTTP response shaping in one handler. The route already has strong tests, so the safest refactor is extraction without contract change rather than logic rewrite.

[`src/app/api/file/[sessionId]/route.ts`](C:/CurrIA/src/app/api/file/[sessionId]/route.ts) is the second most policy-dense surface. It combines artifact metadata lookup, latest job interpretation, preview lock precedence, reconciliation hints, and signed URL issuance. The key architectural boundary is that the route must never derive real-file access outside a central decision layer, especially when a locked historical artifact exists.

[`src/app/api/profile/smart-generation/route.ts`](C:/CurrIA/src/app/api/profile/smart-generation/route.ts) already has cleaner shape but still interprets workflow mode, readiness, quota, persisted patch output, and preview-lock response semantics inline. [`src/app/api/session/[id]/versions/route.ts`](C:/CurrIA/src/app/api/session/[id]/versions/route.ts) and [`src/app/api/session/[id]/compare/route.ts`](C:/CurrIA/src/app/api/session/[id]/compare/route.ts) are thinner, but they still own preview-aware sanitization decisions that should live in explicit decision modules to avoid drift.

## Codebase Findings

- Generate route semantics are already protected by focused route tests in [src/app/api/session/[id]/generate/route.test.ts](C:/CurrIA/src/app/api/session/[id]/generate/route.test.ts), including active export blocking, reconciliation pending, retry reuse, and degraded artifact success fallback.
- File route semantics are already protected by [src/app/api/file/[sessionId]/route.test.ts](C:/CurrIA/src/app/api/file/[sessionId]/route.test.ts), including locked preview, reconciliation detail, stale failed artifacts, and signed URL failure behavior.
- Versions and compare route tests already codify free-trial lock behavior in [src/app/api/session/[id]/versions/route.test.ts](C:/CurrIA/src/app/api/session/[id]/versions/route.test.ts) and [src/app/api/session/[id]/compare/route.test.ts](C:/CurrIA/src/app/api/session/[id]/compare/route.test.ts).
- Existing sanitization helpers already live in `@/lib/cv/preview-sanitization` and `@/lib/generated-preview/locked-preview`, so the route refactor should reuse those instead of inventing a second preview policy source.

## Recommended Shape

- Use route-specific folders under `src/lib/routes/`:
  - `session-generate/`
  - `file-access/`
  - `smart-generation/`
  - `session-versions/`
  - `session-compare/`
- Keep each route folder small and cohesive:
  - `context.ts` for request and ownership resolution
  - `policy.ts` for blocking or reusable decisions when needed
  - `decision.ts` for execution or outcome normalization
  - `response.ts` for HTTP mapping
  - `types.ts` only where union types would otherwise clutter the logic
- Add a tiny shared helper module only for repeated response or decision primitives if at least two routes truly share them.

## Do Not Hand-Roll

- Do not build a route framework or generic pipeline abstraction across the whole app.
- Do not duplicate preview lock logic outside the existing preview-sanitization and locked-preview helpers.
- Do not redesign durable job APIs or billing repositories just to make the route extraction cleaner.

## Main Risks

- Accidentally changing status codes or payload shape while normalizing decisions.
- Moving preview-lock logic into multiple new helpers instead of one route decision boundary per surface.
- Treating current session or target state as stronger than historical locked artifact state in the file route.
- Weakening existing route tests instead of preserving them and adding smaller decision-module tests around the extracted helpers.

## Recommended Plan Split

- `48-01`: session generate plus shared route decision primitives
- `48-02`: file access and smart generation
- `48-03`: versions, compare, regression proof, and route-boundary docs

## Primary Sources

- [src/app/api/session/[id]/generate/route.ts](C:/CurrIA/src/app/api/session/[id]/generate/route.ts)
- [src/app/api/file/[sessionId]/route.ts](C:/CurrIA/src/app/api/file/[sessionId]/route.ts)
- [src/app/api/profile/smart-generation/route.ts](C:/CurrIA/src/app/api/profile/smart-generation/route.ts)
- [src/app/api/session/[id]/versions/route.ts](C:/CurrIA/src/app/api/session/[id]/versions/route.ts)
- [src/app/api/session/[id]/compare/route.ts](C:/CurrIA/src/app/api/session/[id]/compare/route.ts)
- [src/app/api/session/[id]/generate/route.test.ts](C:/CurrIA/src/app/api/session/[id]/generate/route.test.ts)
- [src/app/api/file/[sessionId]/route.test.ts](C:/CurrIA/src/app/api/file/[sessionId]/route.test.ts)
- [src/app/api/profile/smart-generation/route.test.ts](C:/CurrIA/src/app/api/profile/smart-generation/route.test.ts)
- [src/app/api/session/[id]/versions/route.test.ts](C:/CurrIA/src/app/api/session/[id]/versions/route.test.ts)
- [src/app/api/session/[id]/compare/route.test.ts](C:/CurrIA/src/app/api/session/[id]/compare/route.test.ts)
