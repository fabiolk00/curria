# Requirements: CurrIA

**Defined:** 2026-04-10
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.1 Requirements

### Runtime Provenance

- [x] **OPS-04**: Operator can identify which build or commit served a real `/api/agent` request.
- [x] **OPS-05**: Completed `/api/agent` turns log the selected model, assistant text length, recovery usage, and fallback branch.
- [x] **OPS-06**: Team can run a documented post-deploy check that confirms live `/api/agent` config and runtime parity after rollout.

### Dialog Continuity

- [x] **AGNT-01**: User can send a follow-up rewrite request in `dialog` and receive a concrete rewrite or a non-repetitive continuation response.
- [x] **AGNT-02**: Dialog and confirm turns use the resolved model contract, including explicit `OPENAI_DIALOG_MODEL` overrides when present and agent-model fallback when absent.
- [x] **AGNT-03**: Truncation and empty-response recovery preserve the latest rewrite intent and target-job context instead of reverting to stale bootstrap behavior.

### Transcript Integrity and Verification

- [x] **UX-01**: One chat request renders as one coherent assistant turn in the visible transcript, even when recovery or fallback paths are used.
- [x] **QA-04**: Automated verification covers live-route model selection, dialog recovery, and the final rendered assistant output for rewrite flows.
- [x] **QA-05**: Team can reproduce and inspect a representative `reescreva` incident with committed route or transcript evidence.

## v1.2 Requirements

### Guided Rewriting Experience

- **AGNT-04**: User can request multi-section rewriting with explicit section-choice guidance in the chat flow.
- **UX-02**: Chat transcript can expose user-friendly recovery annotations when a response was degraded but still usable.

### Deployment Guardrails

- **OPS-07**: CI or deploy checks block promotion when `/api/agent` provenance or required log fields drift from the documented contract.

## Out of Scope

| Feature | Reason |
|---------|--------|
| PDF and DOCX profile upload onboarding | Still deferred from the previous milestone; it does not address the current agent continuity incident |
| Billing or pricing changes | v1.0 already validated billing behavior; this milestone is about agent reliability and transcript trust |
| Broad UI redesign of the dashboard chat | Visual polish is secondary to proving and fixing runtime behavior |
| Full prompt-system rewrite | Too broad for the current bug; keep the milestone focused on proven failure seams |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPS-04 | Phase 5 | Complete |
| OPS-05 | Phase 5 | Complete |
| OPS-06 | Phase 5 | Complete |
| AGNT-01 | Phase 6 | Complete |
| AGNT-02 | Phase 6 | Complete |
| AGNT-03 | Phase 6 | Complete |
| UX-01 | Phase 7 | Complete |
| QA-04 | Phase 7 | Complete |
| QA-05 | Phase 7 | Complete |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after completing Phase 7*
