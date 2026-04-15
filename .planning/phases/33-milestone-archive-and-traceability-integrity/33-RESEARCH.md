# Phase 33 Research

## Objective

Plan how to make milestone closeout metadata deterministic so future archive flows do not require manual repair, especially when a milestone contains decimal phases like `31.1`.

## What I Reviewed

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/MILESTONES.md`
- `.planning/PROJECT.md`
- `.planning/milestones/v1.4-ROADMAP.md`
- `.planning/milestones/v1.4-REQUIREMENTS.md`
- `.planning/milestones/v1.4-MILESTONE-AUDIT.md`
- `C:\Users\fabio\.codex\skills\gsd-complete-milestone\SKILL.md`

## Current Observations

### Archive metadata can drift from reality

- `v1.4` needed manual repair after closeout so the archive reflected the actual milestone name, the inserted phase `31.1`, and the right archive wording.
- `.planning/MILESTONES.md` still says `v1.4` lacks `VERIFICATION.md` artifacts, but Phase 32 already backfilled them. That proves the closeout history can drift unless archive summaries are updated or derived deterministically.
- `.planning/PROJECT.md` still lists “backfill or replace the missing verification layer” under `v1.5` next goals, even though Phase 32 completed that work. The project narrative is no longer fully aligned with active milestone state.

### Active planning state and archive state need one contract

- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `.planning/STATE.md` are now aligned for Phase 32 completion, but the shipped milestone summaries in `.planning/MILESTONES.md` and `.planning/PROJECT.md` are not.
- The completion workflow in the GSD skill expects a one-line archived roadmap entry, requirement archive creation, fresh requirements reset, and consistent milestone statistics. The recent history shows those steps can succeed partially while still leaving stale references in adjacent planning files.

### Decimal phases are a real edge case

- `v1.4` shipped with five phases because `31.1` was inserted after `31`.
- The archive files now represent `31.1` correctly, but earlier closeout behavior required manual fixes. Any deterministic closeout contract must count decimal phases, preserve their summaries, and keep phase or plan totals correct.

## Risks

- If archive summary files remain hand-maintained, later milestones can again report stale accomplishments, stale gaps, or the wrong archive posture even when phase artifacts are correct.
- If the active-to-archived closeout contract is not tested, the next milestone could again leave `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `PROJECT.md`, and `MILESTONES.md` out of sync.
- If decimal phases are not treated as first-class entries, shipped stats and archive directories can silently undercount milestone scope.

## Recommended Planning Direction

Phase 33 should split into two waves:

1. Harden the closeout metadata contract and stale-summary update path.
2. Add deterministic proof for archive output, traceability reset, and decimal-phase handling.

## Proposed Requirement Mapping

- `DOC-01`: Closeout and archive metadata stay internally consistent, including decimal phases and shipped counts.
- `DOC-02`: Completing a milestone leaves a clean next-cycle surface with accurate archive files, cleared active phase dirs, and fresh active requirements.
