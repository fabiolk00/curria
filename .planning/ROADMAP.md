# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.1 Agent Reliability and Response Continuity` after the `v1.0` launch-hardening baseline shipped. The new work focuses on a live agent reliability incident: short dialog follow-ups like `reescreva` can still truncate, degrade, and surface repeated vacancy bootstrap copy. The phases therefore prove live `/api/agent` parity first, then harden dialog recovery and model routing, and finally verify the exact transcript the user sees.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 5**.
- Decimal phases (for urgent insertions) appear between surrounding integers in numeric order.

- [ ] **Phase 5: Deployed Agent Parity and Evidence** - Prove which build, model, and recovery path the live `/api/agent` route is serving.
- [ ] **Phase 6: Dialog Continuity and Model Routing Hardening** - Eliminate truncation-driven repetition and keep dialog or confirm turns on the intended model contract.
- [ ] **Phase 7: Transcript Integrity and End-to-End Agent Verification** - Prove the final rendered chat transcript matches the backend stream and recovery behavior.

## Phase Details

### Phase 5: Deployed Agent Parity and Evidence
**Goal**: Make live `/api/agent` requests self-identifying and observable enough to confirm the deployed route, selected model, and recovery path.
**Depends on**: Nothing (first phase of milestone v1.1)
**Requirements**: [OPS-04, OPS-05, OPS-06]
**Success Criteria** (what must be TRUE):
  1. A real `/api/agent` request exposes build or commit provenance that operators can correlate with the current repo state.
  2. Completed turns log selected model, assistant text length, recovery usage, and fallback branch in a stable structured format.
  3. A documented post-deploy check proves whether a live environment is serving the expected config and route behavior.
**Plans**: 3 plans

Plans:
- [x] 05-01: Add build and request provenance to the live `/api/agent` route and structured logs
- [ ] 05-02: Document and script the post-deploy parity check for operators
- [ ] 05-03: Add regression coverage for provenance and log-schema guarantees

### Phase 6: Dialog Continuity and Model Routing Hardening
**Goal**: Ensure rewrite follow-ups continue the conversation usefully and that dialog or confirm paths honor the intended model contract.
**Depends on**: Phase 5
**Requirements**: [AGNT-01, AGNT-02, AGNT-03]
**Success Criteria** (what must be TRUE):
  1. A `dialog` follow-up like `reescreva` returns a concrete rewrite or a short non-repetitive continuation response.
  2. Recovery paths preserve the latest rewrite intent and latest target-job context instead of reverting to stale bootstrap copy.
  3. Dialog and confirm requests use the documented resolved model behavior, including explicit override handling when configured.
**Plans**: 3 plans

Plans:
- [ ] 06-01: Tighten dialog fallback selection and latest-intent preservation in the agent loop
- [ ] 06-02: Align per-phase model routing with the documented env contract
- [ ] 06-03: Add targeted regressions for truncation, empty-response recovery, and repeat-request flows

### Phase 7: Transcript Integrity and End-to-End Agent Verification
**Goal**: Verify that the assistant message the user sees matches the backend stream outcome and stays stable under degraded paths.
**Depends on**: Phase 5, Phase 6
**Requirements**: [UX-01, QA-04, QA-05]
**Success Criteria** (what must be TRUE):
  1. One user request produces one coherent assistant turn in the visible transcript, even when recovery or fallback logic runs.
  2. Route-level or browser-level tests catch repeated bootstrap text, stale fallbacks, and transcript-assembly regressions.
  3. The original `reescreva` incident can be reproduced, inspected, and closed with committed evidence.
**Plans**: 3 plans

Plans:
- [ ] 07-01: Harden chat transcript assembly around recovered and fallback turns
- [ ] 07-02: Add end-to-end SSE and transcript verification for the real `/api/agent` path
- [ ] 07-03: Capture operator repro guidance and closeout evidence for the original incident

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Deployed Agent Parity and Evidence | 1/3 | In Progress|  |
| 6. Dialog Continuity and Model Routing Hardening | 0/3 | Pending | - |
| 7. Transcript Integrity and End-to-End Agent Verification | 0/3 | Pending | - |
