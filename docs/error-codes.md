# Error Codes

## Overview

CurrIA uses 8 structured tool error codes to classify failures consistently across tools, the dispatcher, and route adapters.

Each code has:
- a stable string value defined in `src/lib/agent/tool-errors.ts`
- a mapped HTTP status for route adapters
- intended semantics
- typical creation points
- expected client behavior

Structured tool failures use this shape:

```ts
type ToolFailure = {
  success: false
  code: ToolErrorCode
  error: string
}
```

Important boundary:
- tool failures are structured
- dispatcher logs structured failures with `errorCode` and `errorMessage`
- route adapters preserve `{ success: false, code, error }` when a tool returns a `ToolFailure`
- some route-level auth and request-body validation still return plain `{ error: ... }` JSON today

See also:
- `src/lib/agent/tool-errors.ts`
- [Logging and Error Queries](./logging.md)
- [Error Handling Rules](../.claude/rules/error-handling.md)

## Error Code Reference

### `VALIDATION_ERROR` (HTTP 400)

**Semantics:** User input or structured data is invalid.

**When to use:**
- Zod validation fails
- required fields are missing or empty
- a field has the wrong type
- an array is empty when generation requires content
- nested data is structurally invalid

**Who creates it:**
- tools validating input or generated state
- `generate_file` before any DOCX/PDF/storage work starts
- route adapters preserve it when tools return it
- some route handlers also return plain `400` responses for request-body validation outside the tool layer

**Examples:**
- `fullName is required.`
- `At least one work experience entry is required.`
- `phone: Expected string, received number`

**Client action:** Show a user-facing fix message and stop retrying until the data is corrected.

---

### `GENERATION_ERROR` (HTTP 500)

**Semantics:** Generation failed after validation passed.

**When to use:**
- DOCX rendering fails
- PDF rendering fails
- storage upload fails
- signed URL creation fails
- other generation-time work fails after the resume state is already valid

**Who creates it:**
- `generate_file`

**Examples:**
- `File generation failed.`
- `Storage upload failed: ...`
- `Failed to create signed download URLs.`

**Client action:** Show a retry/support message. This usually indicates an infrastructure or code problem, not bad user input.

---

### `PARSE_ERROR` (HTTP 400)

**Semantics:** Resume parsing or extraction failed.

**When to use:**
- PDF extraction fails
- DOCX extraction fails
- OCR/image extraction fails
- the file is unreadable or unsupported
- extraction returns unusable content

**Who creates it:**
- `parse_file`

**Examples:**
- `Could not extract text from PDF file.`
- `Could not extract text from DOCX file.`
- `Could not read text from image.`

**Client action:** Suggest uploading a different file type, a higher-quality file, or a text-based document instead of a scanned one.

---

### `LLM_INVALID_OUTPUT` (HTTP 500)

**Semantics:** The model responded, but the response was malformed or failed schema validation.

**When to use:**
- model output is not valid JSON
- parsed JSON does not match the expected schema
- required model fields are missing
- model output shape is fundamentally wrong for the tool

**Who creates it:**
- tools that call Anthropic and validate structured output
- `rewrite_section`
- `analyze_gap`
- `create_target_resume`

**Examples:**
- `Invalid rewrite payload for section "summary".`
- `Invalid gap analysis payload.`
- `Invalid target resume payload.`

**Client action:** Ask the user to retry. Repeated occurrences usually indicate a prompt/schema alignment issue.

---

### `NOT_FOUND` (HTTP 404)

**Semantics:** A required entity does not exist.

**When to use:**
- session not found
- target resume not found
- gap analysis not found when a dependent tool needs it
- another required record lookup returns no entity

**Who creates it:**
- tools checking prerequisites
- route handlers doing ownership/resource checks may also return plain `404` responses outside the tool layer

**Examples:**
- `Target resume not found.`
- `No structured gap analysis is available for this session.`

**Client action:** Inform the user that the resource is missing and guide them back to a valid session or target.

---

### `UNAUTHORIZED` (HTTP 401)

**Semantics:** Authentication or authorization failed.

**When to use:**
- unauthenticated request
- ownership/auth check fails inside a tool boundary
- invalid credentials at an integration boundary

**Who creates it:**
- route handlers commonly return plain `401` responses for auth failures today
- tool failures can also carry `UNAUTHORIZED` when the error originates inside the tool layer

**Examples:**
- `Unauthorized.`

**Client action:** Prompt for login or re-authentication.

---

### `RATE_LIMITED` (HTTP 429)

**Semantics:** A rate limit was exceeded.

**When to use:**
- a service rejects the request with `429`
- dispatcher/tool error resolution maps an upstream `status: 429` exception

**Who creates it:**
- `toolFailureFromUnknown(...)` / `resolveToolErrorCode(...)` when they see `status: 429`

**Examples:**
- `Too many requests. Please wait before trying again.`

**Client action:** Tell the user to wait and retry later.

---

### `INTERNAL_ERROR` (HTTP 500)

**Semantics:** Unexpected fallback for unclassified failures.

**When to use:**
- an exception escapes normal handling
- the failure shape is unknown
- no specific code can be resolved safely

**Who creates it:**
- dispatcher catch blocks
- `toolFailureFromUnknown(...)` fallback behavior

**Examples:**
- `Tool execution failed.`
- `An error occurred.`

**Client action:** Show a generic retry/support message. This should be investigated if it appears repeatedly.

## Error Code Decision Tree

Use this order when choosing a code:

1. Does input or structured state fail validation?
   Then use `VALIDATION_ERROR`.
2. Does file parsing/extraction fail?
   Then use `PARSE_ERROR`.
3. Did the model return malformed output or fail schema validation?
   Then use `LLM_INVALID_OUTPUT`.
4. Is a required entity missing?
   Then use `NOT_FOUND`.
5. Is the request unauthorized?
   Then use `UNAUTHORIZED`.
6. Did an upstream service reject the request with `429`?
   Then use `RATE_LIMITED`.
7. Did generation fail after validation passed?
   Then use `GENERATION_ERROR`.
8. Otherwise use `INTERNAL_ERROR`.

## Implementation Details

All tool error codes live in `src/lib/agent/tool-errors.ts`:

```ts
export const TOOL_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  LLM_INVALID_OUTPUT: 'LLM_INVALID_OUTPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  GENERATION_ERROR: 'GENERATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ToolErrorCode = typeof TOOL_ERROR_CODES[keyof typeof TOOL_ERROR_CODES]

export const TOOL_ERROR_HTTP_STATUS: Readonly<Record<ToolErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  PARSE_ERROR: 400,
  LLM_INVALID_OUTPUT: 500,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  GENERATION_ERROR: 500,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}
```

Core helpers:
- `toolFailure(code, error)` builds `{ success: false, code, error }`
- `toolFailureFromUnknown(error, message?, fallbackCode?)` resolves code from unknown exceptions and caps fallback messages at 500 chars
- `getHttpStatusForToolError(code)` maps tool codes to route status codes
- `isToolFailure(value)` lets route adapters and the dispatcher safely recognize structured failures

## Message Length Rules

Structured error messages should stay small and user-facing.

Current behavior:
- `toolFailureFromUnknown(...)` caps messages at 500 chars
- `generate_file` validation errors also cap messages at 500 chars before returning them
- the truncation format is `499 chars + U+2026`

When calling `toolFailure(...)` directly:
- prefer concise messages
- pre-summarize long third-party/library errors before returning them

## Quick Examples

### Validation failure before generation

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.VALIDATION_ERROR,
    'At least one work experience entry is required.',
  ),
}
```

### Model returned invalid JSON

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.LLM_INVALID_OUTPUT,
    `Invalid rewrite payload for section "${input.section}".`,
  ),
}
```

### Missing target resume

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.NOT_FOUND,
    'Target resume not found.',
  ),
}
```

### Unexpected exception fallback

```ts
catch (error) {
  return {
    output: toolFailureFromUnknown(error, 'Tool execution failed.'),
  }
}
```
