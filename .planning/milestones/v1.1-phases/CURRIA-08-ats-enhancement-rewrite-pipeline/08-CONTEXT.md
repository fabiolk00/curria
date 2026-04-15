# Phase 8: ATS Enhancement Rewrite Pipeline - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** User task brief plus codebase inspection

<domain>
## Phase Boundary

Add a deterministic resume-improvement workflow for the "resume present, no vacancy" case.

This phase must make ATS enhancement a first-class backend pipeline instead of an emergent side-effect of ad hoc chat/tool behavior. The result should be a persisted, validated, export-ready optimized resume version.

In scope:
- formal workflow mode resolution before `runAgentLoop(...)`
- explicit ATS-general analysis state
- full structured rewrite across supported sections
- post-rewrite hallucination validation
- optimized resume persistence and versioning
- preview/export resolution that prefers optimized state when available

Out of scope for this phase:
- PDF/DOCX onboarding expansion
- broad chat UX redesign
- target-vacancy gap analysis rewrites beyond compatibility with the new workflow abstraction
</domain>

<decisions>
## Implementation Decisions

### Workflow Resolution
- Introduce a formal workflow mode concept with `resume_review`, `ats_enhancement`, and `job_targeting`.
- Resolve workflow mode in the route/backend path before invoking `runAgentLoop(...)`.
- Use these rules:
  - resume present + no vacancy -> `ats_enhancement`
  - resume present + vacancy -> `job_targeting`
  - no resume -> `resume_review`
- Persist the resolved mode in `agentState`.

### Agent State Expansion
- Extend `agentState` to explicitly track ATS analysis, rewrite lifecycle, optimized snapshot, optimization timestamps, and rewrite summaries.
- Add a rewrite-status model that can represent `idle`, `pending`, `running`, `completed`, and `failed`.
- Track whether the last rewrite happened in `ats_enhancement` or `job_targeting`.

### ATS Analysis
- Create a dedicated ATS-general analysis module separate from vacancy-gap analysis.
- The analysis must score overall ATS quality and section-level issues without requiring a target job description.
- The result must include granular issue objects and actionable recommendations.

### Full Resume Rewrite
- Add a dedicated full-resume rewrite service for the `ats_enhancement` mode.
- Rewrite all supported sections: `summary`, `experience`, `skills`, `education`, and `certifications`.
- Preserve factual truth. Never invent employers, dates, certifications, metrics, tools, or unsupported claims.
- Return a structured `CVState`, not free-form text.
- Prefer a staged approach: section rewrite plan first, then section-by-section rewriting.

### Validation and Safety
- Add a post-rewrite validation layer that compares original and optimized CV snapshots.
- Block invented companies, dates, certifications, unsupported skills/tools, and unsupported numeric claims.
- Treat validation as a gate before optimized state becomes canonical for preview/export.

### Route and Persistence Integration
- When a session has resume context and no vacancy context, the backend must imperatively execute the ATS pipeline instead of leaving the rewrite optional to `runAgentLoop(...)`.
- Persist ATS analysis, rewrite status, optimized snapshot, optimization summary, and timestamps into session state.
- Persist an explicit new resume version with metadata linking source, session, original version, and optimized snapshot.

### Rendering and Export
- Preview/export flows must render from `optimizedCvState` when it exists and is valid.
- Fallback to canonical `cvState` only when no optimized snapshot exists.

### Brownfield Constraint
- Reuse the existing ATS enhancement route and current rewrite/versioning primitives where possible.
- Avoid broad rewrites of the agent loop or generation pipeline. Prefer additive seams, thin orchestration, and test-backed changes.

### the agent's Discretion
- Exact helper names, module factoring, and RPC/schema changes needed to persist optimized metadata.
- Whether optimized snapshots remain only in `agentState` JSON or require dedicated structured DB columns in addition to version history.
- Whether export selection should be resolved in `generate_file`, upstream request shaping, or a shared resume-source resolver.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent entry and orchestration
- `src/app/api/agent/route.ts` - request shaping, session resolution, and the place where workflow mode must be resolved before `runAgentLoop(...)`
- `src/lib/agent/agent-loop.ts` - current deterministic behavior, generation gating, and existing ATS/job-targeting distinctions
- `src/lib/agent/tools/index.ts` - tool registry, patch persistence, and CV version source resolution

### Existing ATS enhancement path
- `src/app/api/profile/ats-enhancement/route.ts` - current standalone ATS enhancement flow that rewrites sections, scores ATS, and generates artifacts
- `src/app/api/profile/ats-enhancement/route.test.ts` - existing tested behavior and PT-BR ATS guidance assumptions
- `src/lib/agent/tools/rewrite-section.ts` - structured section rewrite primitive and current validation behavior

### Session and version persistence
- `src/types/agent.ts` - agent/session types that must expand for workflow mode and optimized state
- `src/lib/db/sessions.ts` - session normalization, patch merging, and transactional version persistence
- `src/lib/db/cv-versions.ts` - version labels/scope and snapshot persistence semantics
- `prisma/schema.prisma` - persisted session, CV version, target, and resume generation models

### Generation and export
- `src/lib/agent/tools/generate-file.ts` - artifact generation contract and current session-vs-target source selection
- `src/lib/resume-generation/generate-billable-resume.ts` - generation persistence and version/generation reuse rules

### Supporting contracts
- `AGENTS.md` - project workflow constraints and brownfield priorities
- `.planning/PROJECT.md` - current milestone/product focus and brownfield expectations
- `.planning/ROADMAP.md` - current phase context and ordering
</canonical_refs>

<specifics>
## Specific Ideas

- Candidate new modules:
  - `src/lib/agent/tools/ats-analysis.ts`
  - `src/lib/agent/tools/rewrite-resume-full.ts`
  - `src/lib/agent/tools/validate-rewrite.ts`
- Candidate new types:
  - `WorkflowMode`
  - `RewriteStatus`
  - `AtsAnalysisResult`
  - `RewriteValidationResult`
- Expected agent state additions:
  - `workflowMode`
  - `atsAnalysis`
  - `rewriteStatus`
  - `optimizedCvState`
  - `optimizedAt`
  - `optimizationSummary`
  - `lastRewriteMode`
- Candidate source/version metadata:
  - `source: ats_enhancement`
  - `createdAt`
  - `sessionId`
  - `originalCvVersionId`
  - optimized snapshot payload
</specifics>

<deferred>
## Deferred Ideas

- User-facing compare UI or rollback UX beyond what existing version history already enables
- New section types beyond the currently supported ATS resume structure
- Large prompt-system redesign or model-routing changes unrelated to deterministic ATS enhancement
</deferred>

---

*Phase: CURRIA-08-ats-enhancement-rewrite-pipeline*
*Context gathered: 2026-04-14 via user brief and code inspection*
