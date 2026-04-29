---
task_id: 260428-upq
plan_id: 260428-upq-02a
status: completed
---

# 260428-upq-02a Summary

## Completed

- Removed AI-chat entitlement loading from `src/app/(auth)/profile-setup/page.tsx`.
- Removed AI-chat entitlement loading from `src/app/(auth)/layout.tsx`.
- Added `profile_setup` as an optional billing-info surface and now derive profile setup recurring-plan display from billing metadata.
- Added profile setup render coverage that fails if the page tries to load AI-chat entitlement.
- Updated auth layout tests to reflect the non-chat app shell contract.

## Tests

- `npx vitest run "src/app/(auth)/profile-setup/page.test.tsx" "src/app/(auth)/layout.test.tsx"` - passed.
- `$bad = @(rg -n 'getAiChatAccess' 'src/app/(auth)/profile-setup/page.tsx' 'src/app/(auth)/layout.tsx' 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }` - passed.

## Changed Files

- `src/app/(auth)/profile-setup/page.tsx`
- `src/app/(auth)/profile-setup/page.test.tsx`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/layout.test.tsx`
- `src/lib/asaas/optional-billing-info.ts`
