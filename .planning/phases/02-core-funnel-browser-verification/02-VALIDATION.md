---
phase: 02
slug: core-funnel-browser-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 02 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Chromium plus existing Vitest and TypeScript checks |
| **Config file** | `playwright.config.ts` (new in 02-01) and `vitest.config.ts` |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run test:e2e -- --project=chromium` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run the relevant targeted browser or Vitest command for that wave
- **Before `/gsd-verify-work`:** `npm run test:e2e -- --project=chromium` must be green
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | QA-01, QA-03 | T-02-02 / T-02-03 | Playwright, browser scripts, and shared fixture helpers create a deterministic browser harness | browser smoke | `npm run test:e2e -- tests/e2e/auth.guard.spec.ts --project=chromium` | no - 02-01 | pending |
| 02-01-02 | 01 | 1 | QA-01, QA-03 | T-02-01 | Auth bypass only works when explicitly enabled and signed | unit + browser | `npm test -- src/lib/auth/e2e-auth.test.ts src/app/api/e2e/auth/route.test.ts` | no - 02-01 | pending |
| 02-02-01 | 02 | 2 | QA-01, QA-02 | T-02-05 | Stable browser selectors reflect real profile, workspace, and preview state instead of brittle copy | component | `npm test -- src/components/dashboard/resume-workspace.test.tsx src/components/dashboard/chat-interface.test.tsx src/components/dashboard/preview-panel.test.tsx` | partial | pending |
| 02-02-02 | 02 | 2 | QA-01 | T-02-04 | Guest redirect and manual profile save work in-browser with mocked profile APIs | browser | `npm run test:e2e -- tests/e2e/profile-setup.spec.ts --project=chromium` | no - 02-02 | pending |
| 02-02-03 | 02 | 2 | QA-02 | T-02-04 / T-02-06 | Core funnel browser flow covers session creation, target outcome, artifact availability, and download | browser | `npm run test:e2e -- tests/e2e/core-funnel.spec.ts --project=chromium` | no - 02-02 | pending |
| 02-03-01 | 03 | 3 | QA-03 | T-02-07 | CI installs browsers, starts the app in E2E mode, and runs the Chromium suite with explicit secrets and dummy provider vars | static audit | `rg -n "test:e2e|playwright install --with-deps chromium|E2E_AUTH_BYPASS_SECRET|E2E_AUTH_ENABLED" .github/workflows/ci.yml` | yes | pending |
| 02-03-02 | 03 | 3 | QA-03 | T-02-08 / T-02-09 | Repo docs explain the mocked-provider browser workflow and guardrails | static audit | `rg -n "test:e2e|Playwright|E2E_AUTH_ENABLED|mocked API|E2E_AUTH_BYPASS_SECRET" README.md docs/developer-rules/TESTING.md` | yes | pending |

*Status: pending, green, red, or flaky.*

---

## Wave 0 Requirements

- [ ] `package.json` - add direct `@playwright/test` dependency plus `test:e2e` script
- [ ] `playwright.config.ts` - define Chromium project, base URL, and server startup
- [ ] `tests/e2e/fixtures/auth-session.ts` - reusable signed-auth bootstrap helper
- [ ] `tests/e2e/fixtures/api-mocks.ts` - deterministic profile, session, agent, and file mocks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Clerk sign-in still reaches `/dashboard` after the E2E auth seam is added | QA-01 | CI intentionally bypasses live Clerk | In staging, sign out, visit `/dashboard`, confirm redirect to `/login`, complete real sign-in, and verify the authenticated dashboard loads without the E2E auth flag enabled. |
| Real generated artifact preview or download still works for a valid staging session | QA-02 | CI uses mocked file URLs and avoids live storage | In staging, open a session with known generated artifacts, confirm the preview panel loads the PDF, and trigger at least one artifact download. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 240s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-10
