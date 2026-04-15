---
phase: 06
slug: dialog-continuity-and-model-routing-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 06 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing Vitest loop, route, and config tests plus TypeScript checks |
| **Config files** | `vitest.config.ts`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` |
| **Quick run command** | `npm run typecheck` |
| **Primary targeted suite** | `npm test -- src/lib/agent/config.test.ts src/lib/agent/streaming-loop.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts` |
| **Static planning audit** | `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` |
| **Estimated runtime** | ~180 seconds for typecheck plus the focused dialog-routing suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After Wave 1:** Run the targeted tests for the touched loop, config, or route files
- **Before phase verification:** Re-run the full focused dialog-routing suite plus `state validate`
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AGNT-01, AGNT-03 | T-06-01 / T-06-02 | Dialog recovery preserves the latest rewrite intent and latest target-job context instead of repeating stale bootstrap copy | unit | `npm test -- src/lib/agent/streaming-loop.test.ts src/app/api/agent/route.sse.test.ts` | yes | pending |
| 06-01-02 | 01 | 1 | AGNT-01, AGNT-03 | T-06-02 / T-06-03 | Best visible text survives repeated truncation or empty-response recovery and the loop only falls back when that is more useful than stale text | unit | `npm test -- src/lib/agent/streaming-loop.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts` | yes | pending |
| 06-02-01 | 02 | 1 | AGNT-02 | T-06-04 / T-06-05 | Dialog and confirm model selection follows one explicit resolved contract for both override and no-override cases | unit | `npm test -- src/lib/agent/config.test.ts src/app/api/agent/route.model-selection.test.ts` | yes | pending |
| 06-02-02 | 02 | 1 | AGNT-02 | T-06-05 | Docs and env examples match the runtime model-routing contract and do not imply a hidden second default | static audit | `powershell -NoProfile -Command \"$files = 'docs/openai/README.md','docs/ENVIRONMENT_SETUP.md','.env.example'; $content = ($files | ForEach-Object { Get-Content $_ -Raw }) -join \\\"`n\\\"; foreach ($target in @('OPENAI_AGENT_MODEL','OPENAI_DIALOG_MODEL','dialog','confirm')) { if ($content -notmatch [regex]::Escape($target)) { exit 1 } }; exit 0\"` | yes | pending |
| 06-03-01 | 03 | 2 | AGNT-01, AGNT-02, AGNT-03 | T-06-01 / T-06-02 / T-06-04 | Regression coverage protects terse rewrite follow-ups, latest-vacancy replacement, and route-level model routing under fresh imports | unit | `npm test -- src/lib/agent/config.test.ts src/lib/agent/streaming-loop.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts` | yes | pending |
| 06-03-02 | 03 | 2 | AGNT-01, AGNT-02, AGNT-03 | T-06-03 / T-06-05 | Phase 6 closes with state, plan, and regression evidence aligned to the current milestone | unit + static audit | `npm run typecheck && node .codex/get-shit-done/bin/gsd-tools.cjs state validate` | yes | pending |

*Status: pending, green, red, or flaky.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A representative `reescreva` request returns a concrete rewrite or non-repetitive continuation on a real runtime | AGNT-01, AGNT-03 | Requires a real streamed request with realistic history and prompt pressure | Run one representative dialog flow against a dev or deployed environment, capture the final visible assistant turn, and confirm it no longer repeats the earlier vacancy bootstrap text. |
| Route logs show the expected selected model and fallback branch during a real dialog recovery | AGNT-02, AGNT-03 | Requires live request correlation and log access | Use the Phase 5 provenance and parity workflow to capture one request, then confirm the logs show the expected model contract and fallback branch for the dialog turn. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 300s for repo-local checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-10
