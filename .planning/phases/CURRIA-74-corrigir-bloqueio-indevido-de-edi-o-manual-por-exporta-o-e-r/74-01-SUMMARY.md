# 74-01 Summary

Phase 74 fixed the export deadlock around manual resume editing.

## What changed

- export conflicts now only block generation when they belong to the same session scope
- manual save keeps the previous valid artifact when a real same-scope export is already running
- the editor modal now treats `EXPORT_ALREADY_PROCESSING` as “saved, but PDF refresh deferred” instead of a failed save
- file-access observability now records unavailable download states explicitly

## Outcome

Users are no longer trapped in the state where save fails because of a ghost export and download is unavailable at the same time.
