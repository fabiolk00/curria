# Error Handling Rules

## Goal

Use the structured error system consistently so tools, dispatcher logs, and route adapters all behave the same way.

Primary references:
- `src/lib/agent/tool-errors.ts`
- `docs/error-codes.md`
- `docs/logging.md`

## Rule 1: Use `TOOL_ERROR_CODES` for tool failures

Bad:

```ts
return {
  output: {
    success: false,
    code: 'VALIDATION_ERROR',
    error: 'fullName is required.',
  },
}
```

Good:

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.VALIDATION_ERROR,
    'fullName is required.',
  ),
}
```

Why:
- keeps code values centralized
- prevents typos
- preserves route/log consistency

## Rule 2: Pick the narrowest correct code

Use the decision tree in `docs/error-codes.md`.

Quick mapping:
- `VALIDATION_ERROR`: bad input or invalid structured state
- `PARSE_ERROR`: file extraction/parsing problem
- `LLM_INVALID_OUTPUT`: model output did not match schema
- `NOT_FOUND`: required entity missing
- `UNAUTHORIZED`: auth/ownership problem
- `RATE_LIMITED`: upstream `429`
- `GENERATION_ERROR`: generation failed after validation passed
- `INTERNAL_ERROR`: true fallback for unknown/unhandled failures

Bad:

```ts
catch (error) {
  return {
    output: toolFailure(TOOL_ERROR_CODES.INTERNAL_ERROR, 'Something went wrong.'),
  }
}
```

Better:

```ts
catch (error) {
  return {
    output: toolFailureFromUnknown(error, 'Rewrite failed.'),
  }
}
```

## Rule 3: Messages must be user-facing and specific

Bad:
- `schema validation failed`
- `tool error`
- `VALIDATION_ERROR`

Good:
- `fullName is required.`
- `At least one work experience entry is required.`
- `Invalid rewrite payload for section "summary".`

Why:
- users and support staff see these messages
- specific messages reduce retries and debugging time

## Rule 4: Keep messages short

Current behavior:
- `toolFailureFromUnknown(...)` caps messages at 500 chars
- `generate_file` validation messages also cap at 500 chars
- truncation uses `499 chars + U+2026`

Guidance:
- prefer concise summaries under 200 chars
- do not pass large third-party stack traces into tool output
- if you call `toolFailure(...)` directly, summarize long library errors yourself first

## Rule 5: Validate early

Pattern:

```ts
const parsed = MyInputSchema.safeParse(input)
if (!parsed.success) {
  return {
    output: toolFailure(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Invalid input for myTool.',
    ),
  }
}
```

Do validation before:
- API calls
- storage writes
- model calls
- generation work

## Rule 6: Do not mutate session state directly

Tools should return state changes for the dispatcher to persist.

Bad:

```ts
session.agentState.parseError = 'Could not parse file.'
return {
  output: toolFailure(TOOL_ERROR_CODES.PARSE_ERROR, 'Could not parse file.'),
}
```

Good:

```ts
return {
  output: toolFailure(TOOL_ERROR_CODES.PARSE_ERROR, 'Could not parse file.'),
  patch: {
    agentState: {
      parseStatus: 'failed',
      parseError: 'Could not parse file.',
    },
  },
}
```

## Rule 7: Failed tools normally should not persist patches

Default rule:
- if a tool returns `ToolFailure`, do not persist `cvState` or `agentState` changes

Current exception:
- `generate_file` may persist `generatedOutput` failure metadata through the dispatcher so users can see that generation was attempted and failed

Do not generalize that exception casually.

## Rule 8: Use `toolFailureFromUnknown(...)` for unexpected exceptions

Pattern:

```ts
try {
  // work
} catch (error) {
  return {
    output: toolFailureFromUnknown(error, 'Tool execution failed.'),
  }
}
```

Why:
- resolves `RATE_LIMITED` from upstream `429`
- falls back safely to `INTERNAL_ERROR`
- extracts a usable message when needed
- caps fallback messages automatically

## Rule 9: `generate_file` is special

Follow this pattern:

```ts
const validation = validateGenerationCvState(input.cv_state)
if (!validation.success) {
  return {
    output: toolFailure(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      validation.errorMessage,
    ),
    patch: scope.type === 'session'
      ? createFailurePatch(validation.errorMessage)
      : undefined,
    generatedOutput: createGeneratedOutput('failed', validation.errorMessage),
  }
}
```

Why:
- prevents wasted generation work
- avoids storage/signing side effects on invalid input
- lets the dispatcher persist generation failure metadata safely

## Rule 10: Route adapters should preserve tool failures

When a tool returns a structured failure, routes should preserve:
- `success: false`
- `code`
- `error`

Pattern:

```ts
if (isToolFailure(result)) {
  return NextResponse.json(
    { success: false, code: result.code, error: result.error },
    { status: getHttpStatusForToolError(result.code) },
  )
}
```

## Checklist For A New Tool

When adding a tool:
- define typed input/output in `src/types/agent.ts`
- validate input with Zod
- return `VALIDATION_ERROR` on schema/state validation failures
- choose the narrowest code from `docs/error-codes.md`
- use `toolFailure(...)` or `toolFailureFromUnknown(...)`
- keep messages user-facing and concise
- avoid direct session mutation
- return `patch` only for safe state changes
- add success coverage plus multiple failure tests
- confirm dispatcher and route behavior stay client-compatible

## Example Patterns

### File parsing

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.PARSE_ERROR,
    'Could not extract text from file.',
  ),
}
```

### Invalid model output

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.LLM_INVALID_OUTPUT,
    `Invalid rewrite payload for section "${input.section}".`,
  ),
}
```

### Missing entity

```ts
return {
  output: toolFailure(
    TOOL_ERROR_CODES.NOT_FOUND,
    'Target resume not found.',
  ),
}
```

### Unexpected exception

```ts
catch (error) {
  return {
    output: toolFailureFromUnknown(error, 'Analyze gap failed.'),
  }
}
```
