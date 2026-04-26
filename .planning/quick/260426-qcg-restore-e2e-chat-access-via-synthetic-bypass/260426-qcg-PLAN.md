# Quick Task Plan — 260426-qcg

## Goal

Restore Playwright chat-route stability for synthetic E2E users after the Pro-plan AI chat gate moved into the shared server access contract.

## Scope

- Add a server-side AI chat access override only for valid E2E auth cookies that match the requested synthetic `appUserId`.
- Cover the override with a focused unit test.
- Re-run the failing E2E flows that depend on `/chat`.

## Guardrails

- No production behavior change for real users.
- No broad plan-gating rewrite in page/layout code.
- Keep the override centralized in `getAiChatAccess(...)`.
