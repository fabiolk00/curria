# Phase 74 Context

## Problem

Manual resume edits could persist the draft and immediately invalidate the current artifact, but the follow-up `/generate` call was still allowed to be blocked by an older in-flight artifact job. That produced the worst UX state:

- the user saw an export-in-progress failure while saving
- the edited draft did not feel trustworthy
- the current PDF became unavailable because the artifact had already been invalidated
- download and save could both feel broken at the same time

## Root cause

Two behaviors interacted badly:

1. `session-generate/policy.ts` treated any active artifact-generation job for the user as a conflicting export, even if it belonged to another session or another target scope.
2. `manual-edit/route.ts` invalidated the current artifact immediately after persisting the edit, before knowing whether regeneration could actually proceed.

## Intended fix

- narrow export conflicts to the current session scope
- when a real same-scope export is already active, persist the manual edit but keep the last valid artifact usable
- treat post-save export conflicts as saved-but-deferred in the editor UX
- add logs that make save/export/download conflict states diagnosable
