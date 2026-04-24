## Research Complete

### Standard Stack

- Use the existing Supabase-backed `resume_generations` table as the durable history source; do not introduce a second artifact-history table.
- Keep billing semantics on `resume_generations.type` and add history-specific metadata columns instead of widening the billing enum blindly.
- Reuse `generateBillableResume(...)` as the single persistence choke point for successful/failed export attempts.
- Expose the UI through a thin authenticated Next.js route using `zod` query validation, mirroring the style of `src/app/api/billing/history/route.ts`.
- Reuse `src/lib/dashboard/workspace-client.ts` for client fetching and keep the page component responsible for page-state transitions.

### Architecture Patterns

- Persist history metadata as close as possible to the existing generation row lifecycle:
  - create pending row with normalized history metadata
  - mark completion/failure with dedicated timestamps
  - keep idempotency on the existing generation row rather than post-hoc dedupe in the UI
- Distinguish history kind from billing type:
  - `chat` comes from the chat generation idempotency prefix
  - `ats_enhancement` comes from profile/general ATS flows and base re-exports
  - `target_job` comes from target/profile-target flows and target-scoped exports
- Build the UI view model in one service layer that:
  - limits the total candidate set to 6
  - paginates that capped set in memory
  - maps safe internal URLs only
  - never returns raw storage paths
- Extend `/api/file/[sessionId]` with an opt-in redirect/download mode instead of replacing the current JSON contract, so history cards can open a protected URL directly.

### Don't Hand-Roll

- Do not build a new PDF viewer; reuse `/dashboard/resume/compare/[sessionId]`.
- Do not add browser-side storage access or signed-url generation on the client.
- Do not create a parallel mock/history store in React state.
- Do not infer ownership from client-provided user identifiers.

### Common Pitfalls

- `resume_generations.type` currently only models billing types (`ATS_ENHANCEMENT` and `JOB_TARGETING`); using it directly for UI badges would collapse chat-origin exports into ATS.
- `/api/file/[sessionId]` currently returns JSON; opening it directly in a new tab would show JSON unless a redirect mode is added carefully.
- Existing history UI uses mock shapes (`mode`, `pdfAvailable`) that do not match the desired API contract.
- Some older `resume_generations` rows may not have the new history metadata; the list service needs safe fallbacks for title/description/kind.
- The compare page is session-scoped, so target rows should reuse the session compare route instead of inventing a target-only viewer unless absolutely necessary.

### Code Examples

- `src/lib/agent/agent-loop.ts`
  - Chat export idempotency already embeds `:chat:` and an explicit scope fingerprint.
- `src/lib/routes/file-access/context.ts`
  - Ownership validation already exists for `sessionId` and optional `targetId`.
- `src/lib/routes/file-access/response.ts`
  - Safe artifact URL creation is centralized there and should remain the only place that turns storage paths into access URLs.
- `src/components/resume/generated-resume-history.tsx`
  - The existing screen already supplies the grid, empty/error/loading scaffolding, and pagination shell that can be adapted rather than rebuilt.

### Recommended Approach

1. Extend `resume_generations` with history metadata fields:
   - `history_kind`
   - `history_title`
   - `history_description`
   - `target_role`
   - `target_job_snippet`
   - `completed_at`
   - `failed_at`
2. Add a small `resume-history` service layer that:
   - resolves kind/title/description fallbacks
   - sanitizes target-job snippets
   - lists only the latest 6 items
   - returns page-sized DTOs with safe download/viewer URLs
3. Update generation persistence to populate the new metadata during pending/completed/failed transitions.
4. Add an authenticated route under `/api/profile/resume-generations`.
5. Replace the mock history page wiring with real fetch + pagination state, preserving the existing layout direction.
