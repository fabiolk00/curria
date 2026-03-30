# Logging and Error Queries

## Overview

Tool failures are logged structurally so engineers can query by error code instead of grepping arbitrary text.

Relevant events in `src/lib/agent/tools/index.ts`:
- `agent.tool.started`
- `agent.tool.completed`
- `agent.tool.failed`
- `agent.tool.generated_output.persisted`

Important fields:
- `toolName`
- `sessionId`
- `appUserId`
- `phase`
- `stateVersion`
- `latencyMs`
- `errorCode`
- `errorMessage`

Use `errorCode` for aggregation and alerting. Use `errorMessage` for debugging context.

See also:
- [Error Codes](./error-codes.md)
- [Error Handling Rules](../.claude/rules/error-handling.md)

## Log Shape

Example warning log for a handled tool failure:

```json
{
  "level": "warn",
  "message": "agent.tool.completed",
  "timestamp": "2026-03-29T19:30:45.000Z",
  "metadata": {
    "sessionId": "sess_abc123",
    "appUserId": "usr_xyz789",
    "toolName": "generate_file",
    "phase": "confirm",
    "stateVersion": 1,
    "latencyMs": 45,
    "success": false,
    "touchedGeneratedOutput": true,
    "errorCode": "VALIDATION_ERROR",
    "errorMessage": "fullName is required."
  }
}
```

Example error log for an unhandled exception:

```json
{
  "level": "error",
  "message": "agent.tool.failed",
  "timestamp": "2026-03-29T19:31:02.000Z",
  "metadata": {
    "sessionId": "sess_abc123",
    "appUserId": "usr_xyz789",
    "toolName": "rewrite_section",
    "errorCode": "INTERNAL_ERROR",
    "errorMessage": "Tool execution failed."
  }
}
```

## Common Queries

The SQL examples below assume a log sink with a `logs` table and a `metadata jsonb` column.

### Find all validation errors in the last 24 hours

```sql
SELECT *
FROM logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND metadata->>'errorCode' = 'VALIDATION_ERROR'
ORDER BY timestamp DESC;
```

### Find all generation errors

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' = 'GENERATION_ERROR'
ORDER BY timestamp DESC
LIMIT 100;
```

### Find all errors for a specific app user

```sql
SELECT *
FROM logs
WHERE metadata->>'appUserId' = 'usr_123'
  AND metadata ? 'errorCode'
ORDER BY timestamp DESC;
```

### Find all errors for a specific session

```sql
SELECT *
FROM logs
WHERE metadata->>'sessionId' = 'sess_456'
  AND metadata ? 'errorCode'
ORDER BY timestamp DESC;
```

### Count errors by code for the last 7 days

```sql
SELECT
  metadata->>'errorCode' AS error_code,
  COUNT(*) AS count
FROM logs
WHERE timestamp > NOW() - INTERVAL '7 days'
  AND metadata ? 'errorCode'
GROUP BY metadata->>'errorCode'
ORDER BY count DESC;
```

### Find parse errors

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' = 'PARSE_ERROR'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Find missing-entity errors

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' = 'NOT_FOUND'
ORDER BY timestamp DESC
LIMIT 50;
```

### Find rate-limit spikes

```sql
SELECT
  metadata->>'appUserId' AS app_user_id,
  COUNT(*) AS count,
  MAX(timestamp) AS last_occurrence
FROM logs
WHERE metadata->>'errorCode' = 'RATE_LIMITED'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY metadata->>'appUserId'
ORDER BY count DESC;
```

### Find invalid model outputs

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' = 'LLM_INVALID_OUTPUT'
ORDER BY timestamp DESC
LIMIT 50;
```

### Find internal errors fast

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' = 'INTERNAL_ERROR'
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### Find generated output persistence events

```sql
SELECT *
FROM logs
WHERE message = 'agent.tool.generated_output.persisted'
  AND metadata->>'toolName' = 'generate_file'
ORDER BY timestamp DESC
LIMIT 100;
```

## Text Log Grep Patterns

If you only have raw JSON logs on disk:

### Find all validation errors

```bash
rg '"errorCode":"VALIDATION_ERROR"' ./logs
```

### Find all generate_file failures

```bash
rg '"toolName":"generate_file"' ./logs | rg '"errorCode":'
```

### Find generated output persistence logs

```bash
rg '"message":"agent.tool.generated_output.persisted"' ./logs
```

## Debugging Workflows

### "Something is broken. Where do I start?"

1. Query `INTERNAL_ERROR`, `LLM_INVALID_OUTPUT`, and `GENERATION_ERROR` first.
2. Look at `toolName` to identify the subsystem.
3. Use `sessionId` to reconstruct the sequence for one user flow.
4. Use `errorMessage` for the first concrete clue, but aggregate on `errorCode`.

```sql
SELECT *
FROM logs
WHERE metadata->>'errorCode' IN ('INTERNAL_ERROR', 'LLM_INVALID_OUTPUT', 'GENERATION_ERROR')
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 50;
```

### "Why are users seeing validation errors?"

```sql
SELECT
  metadata->>'errorMessage' AS error_message,
  COUNT(*) AS count
FROM logs
WHERE metadata->>'errorCode' = 'VALIDATION_ERROR'
  AND timestamp > NOW() - INTERVAL '1 day'
GROUP BY metadata->>'errorMessage'
ORDER BY count DESC;
```

Interpretation:
- repeated `fullName is required.` may indicate a form/UX gap
- repeated `At least one work experience entry is required.` may indicate onboarding friction before generation

### "Is file generation healthy?"

```sql
SELECT
  COUNT(*) FILTER (WHERE metadata->>'errorCode' = 'GENERATION_ERROR') AS generation_errors,
  COUNT(*) FILTER (WHERE metadata->>'errorCode' = 'VALIDATION_ERROR') AS validation_errors,
  COUNT(*) FILTER (WHERE message = 'agent.tool.generated_output.persisted') AS persisted_generated_output_events
FROM logs
WHERE metadata->>'toolName' = 'generate_file'
  AND timestamp > NOW() - INTERVAL '1 hour';
```

Interpretation:
- high `VALIDATION_ERROR` counts suggest invalid resume state reaching generation
- high `GENERATION_ERROR` counts suggest template, PDF, storage, or signing problems
- persistence events confirm failure metadata is being written when generation fails

## Metrics To Monitor

- `VALIDATION_ERROR` rate
- `GENERATION_ERROR` rate
- `PARSE_ERROR` rate
- `LLM_INVALID_OUTPUT` rate
- `RATE_LIMITED` rate
- `INTERNAL_ERROR` count
- `agent.tool.generated_output.persisted` count for `generate_file`

## Query Tips

- Prefer `errorCode` over `errorMessage` for dashboards and alerts.
- Use `toolName + errorCode` for root-cause grouping.
- Use `sessionId` for one-user incident debugging.
- Use `appUserId` for repeated-user impact analysis.
- `success: false` on `agent.tool.completed` means the tool returned a structured failure, not necessarily an unhandled exception.

## Field Reference

- `message`: event name such as `agent.tool.completed`
- `metadata.toolName`: tool being executed
- `metadata.sessionId`: session context
- `metadata.appUserId`: authenticated internal app user
- `metadata.errorCode`: structured classification
- `metadata.errorMessage`: user-facing error detail
- `metadata.latencyMs`: duration of the operation

For code selection semantics, see [Error Codes](./error-codes.md).
