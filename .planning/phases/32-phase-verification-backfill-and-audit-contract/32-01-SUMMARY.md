# Plan 32-01 Summary

## What changed

- Created the canonical archive root `.planning/milestones/v1.4-phases/` so the `v1.4` proof backfill lives under milestone history instead of reopening the active `v1.5` phase tree.
- Added `.planning/milestones/v1.4-phases/VERIFICATION-CONTRACT.md` to define the required `VERIFICATION.md` shape, accepted evidence sources, conservative status rules, and explicit non-claims for the backfill.
- Restored the archived phase directories for shipped phases `28`, `29`, `30`, `31`, and `31.1` from committed git history so later verification files can cite real plans, summaries, research, and validation artifacts.

## Verification

- `Get-ChildItem .planning/milestones/v1.4-phases -Directory`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" state validate`

## Outcome

- Phase 32 now has a stable, milestone-scoped archive contract for `v1.4` verification backfill, with the active planning state still anchored on `v1.5`.
