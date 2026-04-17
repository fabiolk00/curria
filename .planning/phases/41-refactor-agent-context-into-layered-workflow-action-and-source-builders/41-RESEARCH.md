# Phase 41: Refactor agent context into layered workflow, action, and source builders - Research

**Researched:** 2026-04-16  
**Domain:** Brownfield agent context composition and source-of-truth selection  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Build on the durable async foundation from Phases 37 to 40; do not reopen that architecture. [VERIFIED: 41-CONTEXT.md]
- Replace the single broad prompt approach with explicit layers: base rules, workflow rules, action contract, session state, source content, and output guardrails. [VERIFIED: 41-CONTEXT.md]
- Make context reliable across lightweight chat, ATS enhancement, job targeting, and artifact-support flows. [VERIFIED: 41-CONTEXT.md]
- Make source-of-truth selection explicit for `cvState`, `optimizedCvState`, target-job data, validation state, and generated artifact metadata. [VERIFIED: 41-CONTEXT.md]
- Preserve business behavior and keep async runtime, orchestration, billing, and rendering out of scope. [VERIFIED: 41-CONTEXT.md]

### Claude's Discretion
- Align new context actions with current repo contracts instead of forcing a breaking rename. [VERIFIED: 41-CONTEXT.md]
- Use the smallest brownfield-safe `src/lib/agent/context/` structure that still keeps layers explicit. [VERIFIED: 41-CONTEXT.md]
- Decide how much shared prompt logic to centralize immediately across rewrite helpers. [VERIFIED: 41-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)
- Async runtime redesign, `/api/agent` replacement, billing changes, ATS/job-targeting rule changes, artifact template changes, cancel/retry UX, and broad redesign. [VERIFIED: 41-CONTEXT.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | Agent context is assembled through explicit layered builders instead of one monolithic phase-oriented prompt builder. [VERIFIED: .planning/REQUIREMENTS.md] | Replace `src/lib/agent/context-builder.ts` internals with a typed `src/lib/agent/context/` module and keep `buildSystemPrompt(...)` as the compatibility export. [VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/agent-loop.ts] |
| CTX-02 | Source-of-truth selection is explicit, typed, and inspectable across canonical, optimized, target, validation, and artifact metadata states. [VERIFIED: .planning/REQUIREMENTS.md] | Reuse Phase 37 source-of-truth helpers and current session types; expose a debug object recording selected blocks and snapshot source. [VERIFIED: src/lib/jobs/source-of-truth.ts][VERIFIED: src/types/agent.ts] |
| TEST-02 | Regression coverage proves lightweight chat stays minimal, rewrite flows get workflow-specific context, and composition remains inspectable. [VERIFIED: .planning/REQUIREMENTS.md] | Extend existing prompt and pipeline tests instead of creating a new harness. [VERIFIED: src/lib/agent/context-builder.test.ts][VERIFIED: src/lib/agent/__tests__/streaming-prompt-regression.test.ts][VERIFIED: src/lib/agent/tools/pipeline.test.ts] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Preserve the brownfield product surface unless scope is widened. [VERIFIED: CLAUDE.md]
- Prefer reliability, observability, and verification over feature breadth. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical truth and `agentState` as operational context only. [VERIFIED: CLAUDE.md]
- Preserve existing dispatcher and `ToolPatch` patterns. [VERIFIED: CLAUDE.md]

## Summary

The runtime architecture gap from earlier phases is already closed. The remaining problem is prompt and context drift: `src/lib/agent/context-builder.ts` still builds one large phase-based system prompt, while `src/lib/agent/tools/rewrite-resume-full.ts` builds separate workflow-specific prompt strings by hand. [VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts]

The safest approach is to introduce a typed `src/lib/agent/context/` module with explicit base, workflow, action, source, schema, and debug layers, while keeping `buildSystemPrompt(...)` as the external compatibility seam used by `agent-loop`. [VERIFIED: src/lib/agent/agent-loop.ts][VERIFIED: src/lib/agent/context-builder.ts]

**Primary recommendation:** Refactor prompt composition behind a new `buildAgentContext(...)` entry point, pass `userMessage` into the `agent-loop` prompt seam so context can be action-aware, and centralize shared base/workflow/source guardrails used by both chat and deterministic rewrite flows. [VERIFIED: src/lib/agent/agent-loop.ts][VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts]

## Standard Stack

| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Next.js | Repo `14.2.3`; latest npm `16.2.4` | Preserve the existing agent route/runtime boundaries this phase must not widen. | Brownfield refactor only. [VERIFIED: package.json][VERIFIED: npm registry] |
| TypeScript | Repo `5.8.3`; latest npm `5.9.3` | Freeze builder inputs, source selection, and debug metadata as explicit contracts. | This phase is primarily a type-and-structure refactor. [VERIFIED: package.json][VERIFIED: npm registry] |
| Repo `src/types/agent.ts` and `src/lib/jobs/source-of-truth.ts` | Repo-local | Canonical session/workflow/source contracts. | Reuse existing contracts instead of inventing parallel DTOs. [VERIFIED: src/types/agent.ts][VERIFIED: src/lib/jobs/source-of-truth.ts] |
| Vitest | Repo `1.6.0`; latest npm `4.1.4` | Extend prompt and pipeline regression coverage. | Existing tests already cover the active seams. [VERIFIED: package.json][VERIFIED: vitest.config.ts][VERIFIED: npm registry] |

## Architecture Patterns

### Recommended Project Structure

```text
src/lib/agent/context/
  base/
  workflows/
  actions/
  sources/
  schemas/
  debug/
  types.ts
  index.ts
src/lib/agent/context-builder.ts
src/lib/agent/agent-loop.ts
src/lib/agent/tools/rewrite-resume-full.ts
```

### Recommended Patterns

- Compatibility wrapper over a new context engine: preserve `buildSystemPrompt(...)` while replacing its internals. [VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/agent-loop.ts]
- Explicit source selection through existing durable helpers: reuse `resolveCanonicalResumeSource(...)` and `resolveEffectiveResumeSource(...)`. [VERIFIED: src/lib/jobs/source-of-truth.ts]
- Minimal chat, rich rewrite contracts: keep lightweight chat small while centralizing shared guardrails used by rewrite flows. [VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts]

### Anti-Patterns to Avoid

- Another giant prompt builder under a new folder name. [VERIFIED: src/lib/agent/context-builder.ts]
- Silent preference for `optimizedCvState` whenever it exists. [VERIFIED: src/lib/jobs/source-of-truth.ts]
- Breaking the `buildSystemPrompt(...)` seam all at once. [VERIFIED: src/lib/agent/agent-loop.ts]
- Letting rewrite flows fall back to freeform prose contracts. [VERIFIED: src/lib/agent/tools/rewrite-section.ts][VERIFIED: src/lib/agent/tools/validate-rewrite.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resume source selection | New ad hoc snapshot rules | `resolveCanonicalResumeSource(...)` / `resolveEffectiveResumeSource(...)` | Phase 37 already froze these semantics. [VERIFIED: src/lib/jobs/source-of-truth.ts] |
| Workflow vocabulary drift | A second unrelated action taxonomy | Current `WorkflowMode`, durable action types, and an explicit mapped context action layer | This phase should reduce drift. [VERIFIED: src/types/agent.ts][VERIFIED: src/types/jobs.ts][VERIFIED: src/lib/agent/action-classification.ts] |
| Duplicated prompt safety text | Per-file honesty/factuality paragraphs | Shared base guardrail builders | Current duplication is the debt this phase should remove. [VERIFIED: src/lib/agent/context-builder.ts][VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts] |

## Common Pitfalls

1. Cosmetic refactor only: files move, but context decisions stay implicit. Prevent this with inspectable debug metadata. [VERIFIED: src/lib/agent/context-builder.ts]
2. Chat prompt bloat: lightweight chat accidentally inherits ATS/targeting/full schema context. Keep a minimal source set for chat. [VERIFIED: src/lib/agent/context-builder.test.ts]
3. Rewrite drift persists: deterministic rewrite helpers keep separate guardrails while the new context engine evolves separately. Centralize shared base/workflow/source contracts. [VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts][VERIFIED: src/lib/agent/context-builder.ts]

## Open Questions

1. Fully move deterministic rewrite helpers onto shared action builders now, or only centralize shared base/workflow/source contracts?
   - Recommendation: centralize shared contracts now and keep section-specific rewrite wording close to the deterministic pipeline unless extraction is obviously safe. [VERIFIED: src/lib/agent/tools/rewrite-resume-full.ts]

2. Log context debug metadata or keep it internal?
   - Recommendation: expose structural debug metadata to tests and callers first; log only high-level identifiers if there is clear operator value. [VERIFIED: src/lib/observability/structured-log.ts]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Typecheck and Vitest | Yes | `v24.14.0` | - |
| npm | Typecheck and Vitest | Yes | `11.9.0` | - |
| Git | Commit docs and code | Yes | `2.53.0.windows.2` | - |

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.0` |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run typecheck && npx vitest run src/lib/agent/context-builder.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/rewrite-section.test.ts src/lib/agent/tools/validate-rewrite.test.ts` |
| Full suite command | `npm test` |

### Wave 0 Gaps
- Add at least one debug-metadata-focused context test.
- Extend streaming prompt regression for `buildSystemPrompt(session, userMessage?)`.
- Extend a rewrite-path test to prove shared guardrails are reused.

## Security Domain

- Preserve prompt-injection boundaries around user-provided resume and job content. [VERIFIED: src/lib/agent/context-builder.ts]
- Keep debug metadata structural, not raw prompt/body dumps. [VERIFIED: CLAUDE.md]
- Preserve deterministic rewrite business rules and validation coverage. [VERIFIED: src/lib/agent/tools/pipeline.test.ts]

## Sources

- `CLAUDE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/41-refactor-agent-context-into-layered-workflow-action-and-source-builders/41-CONTEXT.md`
- `src/lib/agent/context-builder.ts`
- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/jobs/source-of-truth.ts`
- `src/lib/agent/action-classification.ts`
- `src/types/agent.ts`
- `src/types/jobs.ts`
- `src/lib/agent/context-builder.test.ts`
- `src/lib/agent/__tests__/streaming-prompt-regression.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `vitest.config.ts`
- `package.json`

## Metadata

- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH
