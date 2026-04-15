---
phase: 05
slug: deployed-agent-parity-and-evidence
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 05 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing Vitest route, loop, and component tests plus TypeScript checks |
| **Config files** | `vitest.config.ts`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` |
| **Quick run command** | `npm run typecheck` |
| **Primary targeted suite** | `npm test -- src/app/api/agent/route.test.ts src/app/api/agent/route.model-selection.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/streaming-loop.test.ts src/lib/runtime/release-metadata.test.ts scripts/check-agent-runtime-parity.test.ts` |
| **Static doc audit** | `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` plus repo-local grep checks for parity header names |
| **Estimated runtime** | ~180 seconds for typecheck plus targeted Vitest and script help checks |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run the targeted suite for the touched route, helper, or script files
- **Before phase verification:** Re-run the final targeted suite plus the parity-doc static audit
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | OPS-04, OPS-05 | T-05-01 / T-05-02 / T-05-03 | `/api/agent` emits safe server-derived provenance on responses and logs without exposing raw env data | unit | `npm run typecheck` | yes | pending |
| 05-02-01 | 02 | 2 | OPS-06 | T-05-04 / T-05-05 | Post-deploy parity tooling inspects provenance without creating sessions or consuming credits | unit + static audit | `powershell -NoProfile -Command \"$help = npx tsx scripts/check-agent-runtime-parity.ts --help 2>&1 | Out-String; if ($help -notmatch 'expected-release' -or $help -notmatch '/api/agent') { exit 1 }; $doc = Get-Content 'docs/agent-runtime-parity.md' -Raw; if ($doc -notmatch 'X-Agent-Release' -or $doc -notmatch 'agent:parity') { exit 1 }; exit 0\"` | no - 05-02 | pending |
| 05-03-01 | 03 | 3 | OPS-04, OPS-05 | T-05-01 / T-05-03 | Regression tests lock release headers, release helper fallbacks, and completed-turn log schema | unit | `npm test -- src/app/api/agent/route.test.ts src/lib/agent/streaming-loop.test.ts src/lib/runtime/release-metadata.test.ts` | no - 05-03 | pending |
| 05-03-02 | 03 | 3 | OPS-06 | T-05-04 / T-05-05 | Parity script behavior and docs stay aligned with the committed runtime contract | unit + static audit | `npm test -- scripts/check-agent-runtime-parity.test.ts && node .codex/get-shit-done/bin/gsd-tools.cjs state validate` | no - 05-03 | pending |

*Status: pending, green, red, or flaky.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed `/api/agent` route reports the expected release and model contract | OPS-04, OPS-06 | Requires a real deployment target and operator-selected expected values | Run the new parity script against the deployed URL, compare the reported release and resolved models to the intended rollout, and record the result in the phase verification notes. |
| Request-level logs can be correlated from route receipt through turn completion | OPS-05 | Requires live log access and one real request lifecycle | Trigger one safe `/api/agent` request, capture the `requestId`, and verify the corresponding logs show release provenance, selected model, assistant text length, and fallback or recovery details. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 300s for repo-local checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-10
