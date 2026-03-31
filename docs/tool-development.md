# Tool Development Guide

## Goal
Add or modify tools without breaking session-state invariants.

## The contract
Every tool should follow this shape:

```ts
type ToolExecutionResult = {
  output: unknown
  patch?: ToolPatch
}
```

Rules:
- `output` must stay client-compatible
- `patch` must be minimal and typed
- tools must not mutate `session` directly
- version snapshots and target-resume writes must happen through explicit trusted persistence helpers

## Where to edit

### Types
Update:
- `src/types/agent.ts`
- `src/types/cv.ts` if the canonical resume shape changes

### Tool registration and dispatch
Update:
- `src/lib/agent/tools/index.ts`

### Tool implementation
Create or modify files under:
- `src/lib/agent/tools/`

## Tool dispatch architecture

### Current pattern
Tools are dispatched via a **registry pattern** with explicit routing:

```ts
// src/lib/agent/tools/index.ts
const TOOL_DEFINITIONS = [/* 8 tool schemas */]

function dispatchTool(toolName: string, input: unknown, session: Session) {
  // Centralized routing via switch statement (lines 430-479)
  switch (toolName) {
    case 'parse_file': return executeParseFIle(...)
    case 'score_ats': return executeScoreATS(...)
    // ... etc
    default: throw new Error(`Unknown tool: ${toolName}`)
  }
}
```

### Growth and refactoring trigger
**Current status**: 8 tools, dispatch via switch statement ✅

**Refactoring trigger**: When tool count reaches **15+**, consider migrating to a **strategy/plugin pattern**:

```ts
// Future refactor example (when needed)
const TOOL_EXECUTORS: Record<string, (input: unknown, session: Session) => Promise<ToolExecutionResult>> = {
  parse_file: executeParseFIle,
  score_ats: executeScoreATS,
  // ... etc
}

function dispatchTool(toolName: string, input: unknown, session: Session) {
  const executor = TOOL_EXECUTORS[toolName]
  if (!executor) throw new Error(`Unknown tool: ${toolName}`)
  return executor(input, session)
}
```

### Adding a new tool
1. Define input/output types in `src/types/agent.ts`
2. Create tool file in `src/lib/agent/tools/`
3. Implement `execute*()` function returning `ToolExecutionResult`
4. Add TOOL_DEFINITION schema to `TOOL_DEFINITIONS` array in `index.ts`
5. Add case in `dispatchTool()` switch statement (or executor map if refactored)
6. Add test coverage in `src/lib/agent/tools/index.test.ts`

## How to choose the right state bucket

### Put data in `cvState` when
- it is canonical resume truth
- it should drive generation
- it should survive the conversation as the official resume state

### Put data in `agentState` when
- it is operational context
- it is derived or transient
- it helps the model reason but is not canonical resume truth

### Put data in `generatedOutput` when
- it describes generated artifacts
- it must survive file generation for later retrieval or inspection

### Put data in `cv_versions` when
- you need immutable history of trusted `CVState` snapshots

### Put data in `resume_targets` when
- you are creating a target-specific derived resume that must stay separate from the canonical base state

## Validation requirements

Before returning a patch:
- parse model output explicitly
- validate with Zod or equivalent typed guards
- reject malformed results
- never persist unknown JSON directly into canonical state

Examples:
- `rewrite_section` validates section-specific payloads before updating `cvState`
- `generate_file` persists only storage metadata, never signed URLs
- `analyze_gap` validates structured comparison output before storing it in `agentState`
- `create_target_resume` validates a full target-derived `CVState` before persisting it

## Patch design rules
- patch only the field you intend to change
- do not replace full state objects when a partial patch is enough
- preserve unrelated fields through the central merge path
- if a tool fails, return `{ success: false, error: string }` and avoid a patch

## Testing expectations

When adding or changing a tool, cover:
- valid output path
- invalid output path
- resulting patch shape
- merge behavior for unrelated state
- dispatcher persistence behavior when applicable

Useful current tests:
- `src/lib/agent/tools/index.test.ts`
- `src/lib/agent/tools/rewrite-section.test.ts`
- `src/lib/agent/tools/generate-file.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `src/lib/agent/tools/gap-analysis.test.ts`
- `src/lib/db/cv-versions.test.ts`
- `src/lib/resume-targets/create-target-resume.test.ts`

## Common mistakes to avoid
- writing parsed text into `cvState`
- persisting signed URLs in `generatedOutput`
- using Clerk IDs in domain logic
- bypassing `applyToolPatch()` for tool-originated changes
- replacing all of `agentState` when only one nested field changed
- overwriting canonical base `cvState` when the feature actually needs a target-derived resume
- storing mutable resume history inside `agentState` instead of `cv_versions`
