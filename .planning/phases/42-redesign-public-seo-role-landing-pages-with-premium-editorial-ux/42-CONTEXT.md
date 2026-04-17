# Phase 42: Redesign public SEO role landing pages with premium editorial UX - Context

**Gathered:** 2026-04-17
**Status:** Ready for execution

<domain>
## Phase Boundary

This phase redesigns the public SEO role landing page renderer and its supporting public surfaces so the experience feels premium, calm, editorial, and productized without changing the content model, routing, metadata strategy, or conversion logic.

The work is visual and experiential, not semantic simplification.
</domain>

<decisions>
## Locked Decisions

- Keep `RoleLandingConfig` as the source of truth for role content.
- Keep the current public route contract and slug resolution.
- Keep CTA positioning, CTA meaning, and SEO-safe section inventory intact.
- Preserve the related-pages carousel behavior and overall SEO page purpose.
- Reduce the repeated card-grid feeling across the renderer; sections should feel like intentional editorial surfaces.
- Improve profession-specific hero visuals, especially for `developer`, `data_engineer`, and `finance`.
- Keep the code maintainable and reusable rather than forking per-page implementations.
- Review visible PT-BR copy surfaces and keep copy-audit protection green.

## The Agent's Discretion

- Exact premium section primitives, background treatment, spacing system, and motion timing.
- Whether the visual system keeps or expands the current variant model, as long as the renderer remains scalable and config-driven.
</decisions>

<canonical_refs>
## Canonical References

### Public SEO landing contracts
- `src/components/landing/seo-role-landing-page.tsx` - current public renderer to rebuild
- `src/lib/seo/role-landing-config.ts` - source-of-truth content and role mapping
- `src/app/(public)/[variant]/page.tsx` - public routing and metadata contract

### Shared public chrome
- `src/components/landing/header.tsx` - public page header used by SEO pages
- `src/components/landing/footer.tsx` - public page footer used by SEO pages

### Safety rails
- `scripts/audit-copy-quality.mjs` - PT-BR and mojibake safety audit
</canonical_refs>

<specifics>
## Specific Ideas

- Use Stripe / Linear-style calm surfaces, restrained gradients, intentional asymmetry, and less repeated panel boxing.
- Preserve the current hero charts direction; improve layout quality and surrounding rhythm.
- Keep the SEO carousel exactly as-is unless a build or integration issue forces a tiny compatibility change.
</specifics>

<deferred>
## Deferred Ideas

- New role configs or slug changes.
- SEO strategy changes or removal of existing sections.
- New business logic in signup, ATS scoring, or metadata generation.
</deferred>

