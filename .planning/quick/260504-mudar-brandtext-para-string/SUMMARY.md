# Summary

Removed inline logo rendering from prose copy by replacing BrandText usages with plain Trampofy strings. Kept BrandWordmark only for actual logo surfaces.

## Files changed
- src/components/landing/faq-section.tsx
- src/components/landing/social-proof.tsx
- src/components/landing/hero-section.tsx
- src/components/landing/hero-section.test.tsx
- src/components/landing/ats-explainer.tsx
- src/components/landing/how-trampofy-solves.tsx
- src/components/brand-wordmark.tsx

## Validation
- npm run typecheck: passed
- npm run lint: passed
- npm test: passed
- npm run build: passed
- localhost:3002 restarted and served / with 200
