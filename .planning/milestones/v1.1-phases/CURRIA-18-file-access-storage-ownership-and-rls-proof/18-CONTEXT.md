# Phase 18 Context - File Access, Storage Ownership, and RLS Proof

## Why this phase exists

Phase 16 proved the current app-layer ownership model for protected routes and file download access. Phase 17 then closed the billing-side replay and duplicate-charge invariants for paid artifact delivery. What still remains under-proven is the seam between:

- route-level ownership checks
- transient signed URL creation
- Supabase admin or service-role access
- external storage policy and RLS guarantees

The repository already has strong route tests for `/api/file/[sessionId]` and session ownership lookups, but the current docs intentionally stop short of claiming that the repo alone proves storage or RLS isolation. That is the exact gap this phase should close as far as the codebase can honestly prove it.

## What the repo already proves

- `/api/file/[sessionId]` authorizes through `getCurrentAppUser()` plus `getSession(sessionId, appUserId)`.
- Target downloads require the parent session to be owned first, then the selected target to belong to that session.
- Signed resume URLs are generated transiently and must not be persisted back into session state.
- `getSupabaseAdminClient()` is explicitly `server-only`.

## What is still ambiguous today

- which routes depend only on app-layer ownership versus storage policy versus both
- where service-role or admin Supabase access bypasses RLS by design
- whether file and artifact routes have a committed proof matrix that distinguishes "repo-proven" from "infra-assumed"
- whether every storage-linked route has negative-path tests for cross-user access and stale or foreign artifact selection

## Phase intent

This phase should not attempt a broad storage redesign. It should:

1. tighten route-level proof for file, session, and artifact ownership behavior
2. inventory and document every admin-storage or service-role seam relevant to file access
3. publish a final boundary matrix that states exactly what is proven in code and what still depends on Supabase Storage policy or RLS outside the repo

## Acceptance focus

- File and session access routes fail closed for cross-user access.
- The route and doc layer make clear that signed URLs are a delivery mechanism, not an authorization mechanism by themselves.
- Service-role and admin storage usage is inventoried and justified.
- RLS and storage-policy claims are explicit, scoped, and non-hand-wavy.

## Requirements

- `SEC-03`
- `SEC-04`
- `DATA-02`
