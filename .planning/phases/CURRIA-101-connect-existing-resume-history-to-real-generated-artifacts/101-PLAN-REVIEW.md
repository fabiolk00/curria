## Plan Review

Status: PASS

Key review conclusions:

- Keep `resume_generations.type` untouched for billing and add history-specific metadata columns for UI/source semantics.
- Use the existing chat/profile idempotency prefixes to classify `chat`, `ats_enhancement`, and `target_job` without adding a second generation pipeline.
- Extend `/api/file/[sessionId]` with an opt-in redirect/download mode so history cards can open protected artifact URLs directly while preserving the default JSON contract used elsewhere.
- Reuse `/dashboard/resume/compare/[sessionId]` for viewer/open to avoid a parallel history viewer page.
- Keep the UI refactor constrained to the existing history components and add focused RTL/API tests instead of screenshot tests.
