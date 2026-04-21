# Planning Directory Guide

`.planning/` is the project's working memory and historical record for roadmap, requirements, phase execution, and milestone state.

## Canonical Contents

- `ROADMAP.md`, `REQUIREMENTS.md`, and `STATE.md` are the active project planning source of truth.
- `phases/` stores real phase context, plans, summaries, validation notes, and review artifacts that explain why work happened.
- `milestones/`, `research/`, and `codebase/` contain longer-lived planning and analysis assets when they are intentionally curated.

## What Does Not Belong Here

- local scratch outputs
- one-off audit dumps
- temporary debugging notes that are not being kept as historical project memory
- generated files created only to help a local investigation

## Hygiene Rules

- Local debug artifacts should live in ignored paths such as `.planning/debug/`.
- Temporary audit outputs such as `.planning/.tmp-copy-audit.json` should not be committed.
- If a planning artifact explains a real phase decision or verification result, keep it in `phases/` instead of treating it as disposable scratch.
