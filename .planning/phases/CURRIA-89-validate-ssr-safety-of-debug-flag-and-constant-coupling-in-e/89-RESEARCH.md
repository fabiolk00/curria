# Phase 89 Research

## Current seam

The same-entry surfacing layer remains local to `src/lib/resume/optimized-preview-highlights.ts`:

- `buildOptimizedPreviewHighlights(...)` consolidates per-entry preview highlights
- `selectVisibleExperienceHighlightsForEntry(...)` applies the explicit Layer 3 same-entry visible-slot policy
- `shouldTraceExperienceHighlightSurfacing()` gates the debug trace introduced in Phase 88

## Real execution call chain

The real product call chain into the surfacing layer is:

1. App Router entrypoint: [src/app/(auth)/dashboard/resumes/compare/[sessionId]/page.tsx](/c:/CurrIA/src/app/(auth)/dashboard/resumes/compare/[sessionId]/page.tsx)
2. Client shell: [src/components/resume/resume-comparison-page.tsx](/c:/CurrIA/src/components/resume/resume-comparison-page.tsx)
3. Dashboard fetch: `getResumeComparison(sessionId)` in [src/lib/dashboard/workspace-client.ts](/c:/CurrIA/src/lib/dashboard/workspace-client.ts)
4. Server route: [src/app/api/session/[id]/comparison/route.ts](/c:/CurrIA/src/app/api/session/[id]/comparison/route.ts)
5. Route context/decision: [src/lib/routes/session-comparison/context.ts](/c:/CurrIA/src/lib/routes/session-comparison/context.ts) -> [src/lib/routes/session-comparison/decision.ts](/c:/CurrIA/src/lib/routes/session-comparison/decision.ts)
6. Client render: [src/components/resume/resume-comparison-view.tsx](/c:/CurrIA/src/components/resume/resume-comparison-view.tsx)
7. `ResumeDocument` `useMemo(...)` calls `buildOptimizedPreviewHighlights(...)`
8. `buildOptimizedPreviewHighlights(...)` calls `selectVisibleExperienceHighlightsForEntry(...)`

## Execution-context conclusion

The server route only prepares comparison data. The surfacing layer itself is executed inside `ResumeComparisonView`, which is a `use client` component.

That does **not** make the seam client-only. In Next.js App Router, Client Components are still used to prerender the route during a full page load, then hydrate on the client. Official docs confirm that both Server and Client Components can contribute to server-rendered HTML on the initial load, and that Client Components can also be rendered on the server during initial page generation:

- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/14/app/building-your-application/rendering/client-components
- https://nextjs.org/docs/app/glossary

Therefore the surfacing layer should be treated as a **mixed-context render seam**:

- server/runtime render during initial page generation
- client/runtime render after hydration and on client-side interactions
- test/runtime render in Vitest node and jsdom environments

## Debug-flag assessment

Current Phase 88 implementation:

- disables tracing in production
- reads `globalThis.__CURRIA_DEBUG_EXPERIENCE_HIGHLIGHT_SURFACING__` from the current runtime

Residual issue confirmed:

- the guard is behaviorally safe, but its intended semantics are undocumented
- because the seam is mixed-context, future maintainers could incorrectly assume a browser-side mutation is a supported control for server-side traces across SSR boundaries

Minimal safe direction:

- keep the flag runtime-local
- document that the flag only affects the runtime where it is set
- make the mixed-context assumption explicit in `shouldTraceExperienceHighlightSurfacing()`
- optionally add a trivial `typeof globalThis === "undefined"` guard for explicitness, not because it changes normal runtime behavior

## Constant-coupling audit

Repo-wide search for `EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY` found only the product module itself:

- `src/lib/resume/optimized-preview-highlights.ts`

No test files, test helpers, or shared fixtures import or re-export the constant. Existing tests assert observable behavior such as:

- selected `highlightCategory`
- selected `highlightTier`
- bullet ordering
- cap enforcement

No fixture-coupling corrections are currently required.

## Risks to avoid

- do not change the editorial category order
- do not retune selector ranking
- do not broaden the debug mechanism into a user-facing or cross-runtime control
- do not add defensive SSR code that implies a different supported runtime model than the actual App Router call chain

## Implementation direction

Phase 89 should remain narrow:

1. add a small comment and explicit runtime-local guard framing to `shouldTraceExperienceHighlightSurfacing()`
2. preserve the current Layer 3 behavior unchanged
3. document in validation artifacts that the flag is supported for non-production runtime-local diagnostics only
4. document that the exported policy constant has no test-fixture coupling in the current repo
