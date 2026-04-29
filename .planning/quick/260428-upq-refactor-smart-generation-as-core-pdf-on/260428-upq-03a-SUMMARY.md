---
task_id: 260428-upq
plan_id: 260428-upq-03a
status: completed
---

# 260428-upq-03a Summary

## Completed

- Redirected `/dashboard` to `/profile-setup` by default.
- Redirected `/dashboard?session=<id>` to the resume comparison route.
- Updated legacy dashboard canonicalization to point at profile setup while preserving `/chat/:id` compatibility.
- Replaced the sidebar's primary chat action with a guided "Gerar currículo" action to profile setup.
- Removed Pro-chat filtering from normal sidebar navigation and kept profile/history navigation visible.
- Updated the welcome guide to focus on profile setup, ATS generation, and resume history.

## Tests

- `npx vitest run "src/app/(auth)/dashboard/page.test.tsx" src/lib/routes/app.test.ts src/components/dashboard/sidebar.test.tsx src/components/dashboard/welcome-guide.test.tsx "src/app/(auth)/layout.test.tsx"` - passed.
- `$bad = @(rg -n 'Nova conversa|Chat com IA' src/components/dashboard/sidebar.tsx src/lib/dashboard/welcome-guide.ts 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }` - passed.

## Changed Files

- `src/app/(auth)/dashboard/page.tsx`
- `src/app/(auth)/dashboard/page.test.tsx`
- `src/lib/routes/app.ts`
- `src/lib/routes/app.test.ts`
- `src/components/dashboard/sidebar.tsx`
- `src/components/dashboard/sidebar.test.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/lib/dashboard/welcome-guide.ts`
- `src/components/dashboard/welcome-guide.tsx`
- `src/components/dashboard/welcome-guide.test.tsx`
