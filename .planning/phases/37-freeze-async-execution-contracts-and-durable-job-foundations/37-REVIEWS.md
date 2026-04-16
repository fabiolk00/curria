# Phase 37 Cross-AI Reviews

**Reviewed:** 2026-04-16
**Phase:** 37 - Freeze async execution contracts and durable job foundations
**Requested mode:** `--all`
**Plans reviewed:** `37-01-PLAN.md`

## Reviewer Availability

| Reviewer | Status | Notes |
|----------|--------|-------|
| `claude` | Blocked | CLI is installed, but review execution failed with: `Your organization does not have access to Claude. Please login again or contact your administrator.` |
| `codex` | Completed | Fallback external-style review completed in read-only mode against the phase docs. |
| `gemini` | Not available | CLI not installed on this machine. |
| `opencode` | Not available | CLI not installed on this machine. |

## Consensus Summary

Only one reviewer completed, so there is no multi-reviewer consensus to compute.

The completed review found four planning issues to resolve before execution:

1. The proposed frozen `AgentActionType` only covers heavy actions and may force a contract change in Phase 38 when synchronous lightweight chat still needs classification and execution-mode routing.
2. The generic `jobs` contract does not freeze any duplicate-dispatch or idempotency safeguard, which risks a schema or contract break once retries and reconnects appear in later phases.
3. The verification plan does not prove user-scoped access control on job reads or listing, even though ownership isolation is part of the threat model.
4. The phase freezes internal status types, but it does not yet freeze a canonical persisted read model or DTO that downstream polling, SSE, and UI code can share without drift.

## Codex Review

## Findings
1. **High - Frozen `AgentActionType` excludes the synchronous side of the Phase 38 orchestrator contract**  
Why it matters: Phase 37 is supposed to freeze the shared `AgentActionType` and execution-mode contract before later work splits, but the plan hard-codes `AgentActionType = 'ats_enhancement' | 'job_targeting' | 'artifact_generation'`. That covers only heavy actions. Phase 38 still needs action classification and execution-mode routing while lightweight chat remains synchronous, so this contract will likely need to change in the next phase, which defeats the "freeze first, parallelize later" goal and invites contract drift across Phases 38-40.  
Files: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:127-131`, `.planning/ROADMAP.md:29`, `.planning/ROADMAP.md:42-44`, `.planning/ROADMAP.md:82`, `.planning/REQUIREMENTS.md:10-11`

2. **High - The durable job foundation omits duplicate-dispatch/idempotency safeguards that later phases explicitly need**  
Why it matters: the schema and dispatch contract enumerate lifecycle, refs, and ownership fields, but they do not reserve any `idempotencyKey` or equivalent dedupe mechanism on the generic `jobs` record. In a same-app, retry-prone async model, `/api/agent` retries, reconnects, or repeated classifications can enqueue the same heavy action more than once. Phase 39 already requires avoiding duplicate destructive updates, and the research explicitly calls out idempotency as a key concern with an existing precedent in `resume_generations`. If this is not part of the frozen foundation now, later phases may need a breaking schema/contract change.  
Files: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:127`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:142`, `.planning/ROADMAP.md:57`, `.planning/ROADMAP.md:82`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:226`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:340`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:466`

3. **Medium - The plan claims to mitigate job ownership risks, but the verification strategy does not prove user-scoped access control**  
Why it matters: T-37-01 says generic jobs must be scoped by internal app user IDs, and the research calls out cross-user job lookup by guessed `jobId` as a concrete threat. But the planned tests only cover contract shape, claim fencing, and source selection; they do not verify that `getJob`, `listJobsForUser`, or any future status read path rejects cross-user access. That leaves a data-exposure hole in the foundation that later polling/SSE/status work may build on.  
Files: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:98-102`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:142`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-VALIDATION.md:41-44`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-VALIDATION.md:52-54`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:60`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:224`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:436`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-RESEARCH.md:444`

4. **Medium - Phase 37 says it freezes canonical status "vocabulary and shape," but the plan does not actually freeze a consumer-facing read model**  
Why it matters: the context says durable status reads are canonical and that Phase 37 should freeze the status vocabulary and shape so UI, polling, and SSE can all consume the same persisted contract. The plan only freezes internal TypeScript unions, repository helpers, and unit tests. There is no canonical serialized DTO, no persistence-to-read mapping contract, and no verification of how later consumers are supposed to read the job state consistently. Since Phases 38 and 39 are meant to proceed in parallel once Phase 37 is stable, this is a contract-drift risk.  
Files: `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-CONTEXT.md:22-24`, `.planning/ROADMAP.md:29-31`, `.planning/ROADMAP.md:68-70`, `.planning/ROADMAP.md:82`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:127`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-01-PLAN.md:142`, `.planning/phases/37-freeze-async-execution-contracts-and-durable-job-foundations/37-VALIDATION.md:52-54`

## Open Questions
1. Is `AgentActionType` intended to represent only heavy async-capable actions, with synchronous chat classified through a separate contract? If yes, that separation should be explicit now so Phase 38 does not have to reopen the frozen contract.
2. Where is duplicate-dispatch protection supposed to live for ATS, targeting, and artifact jobs: on the generic `jobs` table itself, in the dispatch payload, or only in downstream domain tables such as `resume_generations`?
3. What exact persisted read shape is downstream code supposed to treat as canonical for status: raw row fields, a repository DTO, or a future route payload?

## Verdict

Phase 37 is **not ready for execution as written**. The foundation is directionally sound, but the current plan leaves a likely Phase 38 contract change, does not freeze duplicate-dispatch protection, and does not verify the ownership boundary it claims to establish.
