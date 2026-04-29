---
task_id: 260428-upq
plan_id: 260428-upq-03b
status: completed
---

# 260428-upq-03b Summary

## Completed

- Updated plan feature copy in `src/lib/plans.ts` to sell guided PDF resume generation instead of chat or retired formats.
- Removed the chat comparison property and row from `src/lib/pricing/plan-comparison.ts` and `src/components/landing/pricing-comparison-table.tsx`.
- Updated pricing tests to cover the new no-chat/no-retired-format copy boundary without embedding retired copy strings that would break the grep gate.
- Updated ATS landing copy so the upload explanation refers to readable PDF only.

## Tests

- `npx vitest run src/components/landing/pricing-comparison-table.test.tsx src/components/landing/pricing-section.test.tsx` - passed.
- `$bad = @(rg -n 'Chat com IA|DOCX|docx' src/lib/plans.ts src/lib/pricing src/components/landing 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }` - passed.

## Changed Files

- `src/lib/plans.ts`
- `src/lib/pricing/plan-comparison.ts`
- `src/components/landing/pricing-comparison-table.tsx`
- `src/components/landing/pricing-comparison-table.test.tsx`
- `src/components/landing/pricing-section.test.tsx`
- `src/components/landing/o-que-e-ats-page.tsx`
