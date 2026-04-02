---
title: CurrIA Architecture Overview
audience:
  - developers
  - architects
  - operations
related:
  - ./INDEX.md
  - ./CONCEPTS.md
  - ./state-model.md
  - ./tool-development.md
status: current
updated: 2026-04-01
---

# Architecture Overview

Back to [Documentation Index](./INDEX.md) | Start with [Concepts](./CONCEPTS.md)

## Runtime Boundaries

## OpenAI Rollout Status

- The runtime is fully on OpenAI.
- The runtime model is standardized in `src/lib/agent/config.ts`.
- The current default runtime model is `gpt-5-nano`.
- `OPENAI_MODEL` is the runtime override knob.
- `OPENAI_MODEL_COMBO` is retained only for backward compatibility and model-selection workflows.
- The long-term model choice depends on the pt-BR quality and cost bakeoff documented in [Model Selection Matrix](./openai/MODEL_SELECTION_MATRIX.md).
- The approval gate is documented in [Portuguese Quality Gate](./openai/PORTUGUESE_QUALITY_GATE.md).

### Identity Boundary

- External identity: Clerk
- Internal identity: app user in `users`
- Mapping table: `user_auth_identities`

After the auth boundary, use app user IDs in domain code.

### Persistence Boundary

- Runtime data access uses Supabase JS.
- Prisma is used for schema reference and SQL migration helpers.
- Session state is JSON-backed inside the `sessions` table.
- Immutable resume history lives in `cv_versions`.
- Target-specific derived resumes live in `resume_targets`.

### Billing Boundary

- Credit balance lives in `credit_accounts`.
- Billing metadata lives in `user_quotas`.
- Asaas webhooks mutate credits only after successful processing.

## Main Request Flows

### `/api/agent`

1. Resolve current app user.
2. Rate limit the request.
3. Validate input with Zod.
4. Load or create session.
5. Consume one credit on new session creation.
6. Increment message count.
7. Persist the user message.
8. Build prompt context from the session bundle.
9. Run the OpenAI tool loop.
10. Apply tool patches centrally.
11. Stream SSE deltas and final session metadata.

### `/api/webhook/asaas`

1. Verify `asaas-access-token`.
2. Parse and validate payload.
3. Create a stable processed-event fingerprint.
4. Skip duplicate deliveries.
5. Apply side effects.
6. Mark the event as processed only after success.

### `/api/webhook/clerk`

1. Verify Svix headers and signature.
2. Deduplicate with Redis.
3. Bootstrap, sync, or disable the mapped app user.

## Session Architecture

Top-level session bundle:

- `stateVersion`
- `phase`
- `cvState`
- `agentState`
- `generatedOutput`
- `atsScore`

See [Session State Model](./state-model.md) for the detailed contract.

## Agent Tool Architecture

Tool execution contract:

- input comes from the model tool call.
- output is client-compatible tool result JSON.
- patch is an optional minimal state change.

Dispatcher contract:

1. Run the tool.
2. Persist patches through `applyToolPatchWithVersion()` when session state changes.
3. Update the live session snapshot.
4. Return serialized tool output to the loop.

This is what keeps state mutation controlled and testable.

Additional resume persistence rules:

- first trusted canonical ingestion can create a `cv_versions` snapshot.
- canonical rewrites can create `cv_versions` snapshots.
- target-derived resume creation persists in `resume_targets` and also creates a `cv_versions` snapshot.

## Current Route and Feature Realities

- OpenAI tool loop currently uses non-streaming calls and re-streams word chunks over SSE.
- `generate_file` returns signed URLs directly.
- `/api/file/[sessionId]` returns fresh signed URLs from persisted artifact metadata.
- `/api/file/[sessionId]?targetId=<resumeTargetId>` returns fresh signed URLs for an owned target-derived artifact.
- Route-level attachment bootstrap still writes `agentState.attachedFile` before the tool loop starts.
- `/api/session/[id]/versions` returns immutable history for the owning app user.
- `/api/session/[id]/targets` lists or creates target-specific variants for the owning app user.

## System Invariants

- `cvState` is canonical resume truth.
- `agentState` is operational context.
- `generatedOutput` stores artifact metadata only.
- `cv_versions` stores immutable snapshot history.
- `resume_targets` stores target-specific derived states.
- base artifact metadata lives on the session; target artifact metadata lives on the target row.
- tool-originated state changes must use `ToolPatch`.
- runtime credit enforcement must read from `credit_accounts`.
- domain logic must not depend on Clerk IDs.

## Related Documentation

- [Core Concepts](./CONCEPTS.md) - plain-English mental models before implementation details.
- [Session State Model](./state-model.md) - canonical bundle structure and persistence rules.
- [Tool Development Guide](./tool-development.md) - tool contract and mutation boundaries.
- [Documentation Index](./INDEX.md) - topic-based entry point for the rest of the docs.
