# Phase 41 Context - Refactor agent context into layered workflow, action, and source builders

## Decisions

- This phase happens after the async execution refactor is stabilized and must build on the durable orchestration foundation from Phases 37 to 40 instead of reopening it.
- The agent context system must stop relying on a single broad "do everything" prompt and move to workflow-specific context assembly with explicit layers:
  1. system/base rules
  2. workflow mode instructions
  3. action-specific execution contract
  4. session state
  5. relevant user/source content
  6. output schema and guardrails
- The architecture must improve reliability across lightweight chat, ATS enhancement, job targeting, and artifact-generation support flows.
- The builder must make source-of-truth selection explicit for `cvState`, `optimizedCvState`, `jobTarget`, analysis outputs, rewrite validation, and generated artifact metadata.
- Rewrite flows must be schema-first and should not rely on freeform assistant prose as their contract.
- Context composition must be inspectable so we can explain which workflow, action, source blocks, and schema were used for a given run.
- Preserve the current execution architecture: no redesign of the async runtime, `/api/agent` orchestration boundary, billing logic, or artifact rendering templates in this phase.
- Preserve current business behavior. This is a context architecture refactor, not a product-rules rewrite.

## Claude's Discretion

- Align the new context action taxonomy with the current repo contracts where possible instead of forcing a breaking rename.
- Choose the narrowest brownfield-safe file structure under `src/lib/agent/context/` as long as the architectural separation remains explicit.
- Decide which existing prompt builders in rewrite and validation flows should be moved immediately onto shared context helpers versus only sharing base/workflow/source contracts in Phase 41.
- Decide how much context debug metadata should be logged versus kept available for tests and internal inspection.

## Deferred Ideas

- Redesigning the async job runtime or dispatch model.
- Replacing `/api/agent` as the public entry point.
- Changing credits logic, ATS scoring formulas, job-targeting business rules, or artifact rendering templates.
- Adding new websocket infrastructure, cancellation UX, retry buttons, or broad product-surface redesign.
