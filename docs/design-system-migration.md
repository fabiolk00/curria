# Figma Design System Migration

**Status:** In Progress
**Started:** March 2026
**Last Updated:** March 30, 2026
**Owner:** Frontend + Design

## Overview

CurrIA is migrating its public and authenticated UI to the imported Figma design system currently stored in `modernize-design-files/`.

### Progress Snapshot

- Pages completed: 3 core views aligned
- Pages in progress: dashboard shell and workspace-depth surfaces
- Design reference source: `modernize-design-files/`
- Tracking support: `.claude/analysis/` cleanup and handoff docs

## Completed Pages

- [x] ATS Guide public page
- [x] Dashboard resumes route
- [x] Dashboard resumes alias and navigation alignment
- [ ] Landing page final polish
- [ ] Pricing page final polish
- [ ] Chat/workspace interaction surfaces
- [ ] Settings page final polish
- [ ] Auth forms final parity pass
- [ ] Resume comparison experience
- [ ] Remaining dashboard internals

## Route Mapping

| Experience | Current Route | Status | Notes |
|-----------|---------------|--------|-------|
| Landing page | `/` | In progress | Core sections migrated; final parity pass still open |
| ATS guide | `/what-is-ats` | Complete | Public route using imported design language |
| Dashboard workspace | `/dashboard` | In progress | Real product logic preserved; visual parity still ongoing |
| Resume library | `/dashboard/resumes` | Complete | Figma-style route restored |
| Resume library alias | `/resumes` | Complete | Redirects to `/dashboard/resumes` |
| Settings | `/settings` | In progress | New authenticated page added, still open for final polish |
| Login | `/login` | In progress | Modernized layout active |
| Signup | `/signup` | In progress | Modernized layout active |
| Pricing | `/pricing` | In progress | Modernized layout active |

## Component Mapping

| Imported Reference | App Implementation | Status |
|-------------------|--------------------|--------|
| `components/header.tsx` | `src/components/landing/header.tsx` | Active |
| `components/hero-section.tsx` | `src/components/landing/hero-section.tsx` | Active |
| `components/ats-explainer.tsx` | `src/components/landing/ats-explainer.tsx` | Active |
| `components/pricing-section.tsx` | `src/components/landing/pricing-section.tsx` | Active |
| `components/final-cta.tsx` | `src/components/landing/final-cta.tsx` | Active |
| `components/footer.tsx` | `src/components/landing/footer.tsx` | Active |
| `components/dashboard/DashboardShell.tsx` | `src/components/dashboard/dashboard-shell.tsx` | Active |
| `components/dashboard/DashboardSidebar.tsx` | `src/components/dashboard/sidebar.tsx` | Active |
| `components/dashboard/SessionList.tsx` | `src/components/dashboard/session-list.tsx` | Active |
| `components/dashboard/ResumeWorkspace.tsx` | `src/components/dashboard/resume-workspace.tsx` | In progress |
| `components/dashboard/CompareDrawer.tsx` | `src/components/dashboard/compare-drawer.tsx` | In progress |
| `components/dashboard/ManualEditDialog.tsx` | `src/components/dashboard/manual-edit-dialog.tsx` | In progress |

## Validation Checklist

Each migrated page should ship only after:

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] Mobile and desktop layout review
- [ ] Functional flow preserved against current backend contracts
- [ ] Auth/public route behavior confirmed

## Recent Migration Commits

- `1193782` - align dashboard resumes with imported layout
- `c201afe` - align ats guide with imported layout
- `ebcf232` - allow public access to ats guide
- `1a49f21` - make ats guide public
- `1c85f07` - apply modernize frontend components

## Next Steps

1. Finish dashboard workspace visual parity against imported references.
2. Review landing, pricing, and auth pages for remaining drift.
3. Decide whether `modernize-design-files/` remains a tracked reference or gets replaced by a formal design-system package later.
4. Keep this document updated as each page reaches parity.
