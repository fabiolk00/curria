# Requirements: CurrIA

**Defined:** 2026-04-10
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.1 Requirements

### Runtime Provenance

- [ ] **OPS-04**: Operator can identify which build or commit served a real `/api/agent` request.
- [ ] **OPS-05**: Completed `/api/agent` turns log the selected model, assistant text length, recovery usage, and fallback branch.
- [ ] **OPS-06**: Team can run a documented post-deploy check that confirms live `/api/agent` config and runtime parity after rollout.

### Dialog Continuity

- [ ] **AGNT-01**: User can send a follow-up rewrite request in `dialog` and receive a concrete rewrite or a non-repetitive continuation response.
- [ ] **AGNT-02**: Dialog and confirm turns use the resolved model contract, including explicit `OPENAI_DIALOG_MODEL` overrides when present and agent-model fallback when absent.
- [ ] **AGNT-03**: Truncation and empty-response recovery preserve the latest rewrite intent and target-job context instead of reverting to stale bootstrap behavior.

### Transcript Integrity and Verification

- [ ] **UX-01**: One chat request renders as one coherent assistant turn in the visible transcript, even when recovery or fallback paths are used.
- [ ] **QA-04**: Automated verification covers live-route model selection, dialog recovery, and the final rendered assistant output for rewrite flows.
- [ ] **QA-05**: Team can reproduce and inspect a representative `reescreva` incident with committed route or transcript evidence.

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
| OPS-04 | TBD | Pending |
| OPS-05 | TBD | Pending |
| OPS-06 | TBD | Pending |
| AGNT-01 | TBD | Pending |
| AGNT-02 | TBD | Pending |
| AGNT-03 | TBD | Pending |
| UX-01 | TBD | Pending |
| QA-04 | TBD | Pending |
| QA-05 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 0
- Unmapped: 9

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial milestone definition*
