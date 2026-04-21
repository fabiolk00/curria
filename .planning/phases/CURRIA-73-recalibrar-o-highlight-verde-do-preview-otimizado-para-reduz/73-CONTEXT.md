# Phase 73 Context

## Goal

Recalibrate optimized preview highlights so the green emphasis highlights short semantic improvements and strong premium bullets rather than fragmented single-word token changes.

## Problem

Phase 71 established the right product boundary for preview-only highlights, but the helper still allowed many isolated words and tiny fragments to light up. That made the summary feel noisy and the optimized column look more like a token diff than a premium before/after preview.

## Decisions

- Keep the feature preview-only and leave export, persistence, and ATS scoring untouched.
- Move highlight selection from permissive token additions to short phrase-level semantic chunks.
- Use stricter summary density rules than inline experience bullets.
- Preserve whole-line emphasis for premium materially improved bullets, especially quantified impact/scope cases.
- Slightly soften the green treatment so the UI feels more editorial and less like a raw markup pass.

## Verification

- `npm run typecheck`
- `npx vitest run "src/lib/resume/optimized-preview-highlights.test.ts" "src/components/resume/resume-comparison-view.test.tsx"`
- `npm run audit:copy-regression`
