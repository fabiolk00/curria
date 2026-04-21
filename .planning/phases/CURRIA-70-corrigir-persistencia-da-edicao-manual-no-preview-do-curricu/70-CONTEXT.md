# Phase 70 Context

## Goal

Fix manual resume editing so the saved draft, preview, subsequent re-edit flows, and export all use the same canonical resume source.

## Root Cause

Two consistency problems were coupled:

1. The dashboard preview panel opened the resume editor in `base` scope by default, even when the previewed/exported PDF was effectively backed by `session.agentState.optimizedCvState`.
2. Manual saves persisted CV state but left the previous generated artifact metadata intact, so preview/export could continue serving an older PDF after the edit.

## Decisions

- Manual edits keep using the existing canonical owners:
  - base: `session.cvState`
  - optimized: `session.agentState.optimizedCvState`
  - target: `resume_targets.derivedCvState`
- Base preview editing now resolves the effective editor scope by inspecting whether an optimized CV state exists.
- Edited artifact metadata is invalidated when the edited source is also the exported source.
- The preview editor save flow now regenerates the PDF after persistence so preview and export converge on the same edited source.

## Verification

- `npm run typecheck`
- `npx vitest run "src/components/dashboard/resume-editor-modal.test.tsx" "src/components/dashboard/preview-panel.test.tsx" "src/app/api/session/[id]/manual-edit/route.test.ts"`
- `npx vitest run "src/app/api/file/[sessionId]/route.test.ts" "src/components/resume/resume-comparison-view.test.tsx"`
