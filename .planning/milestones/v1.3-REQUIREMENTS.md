# Requirements: CurrIA

**Defined:** 2026-04-14
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.3 Requirements

### Agent Response Time

- **PERF-01**: The repo can measure request-stage latency for user-visible agent flows, including first SSE emission and first useful assistant response timing.
- **PERF-02**: Chat interactions respond faster in practice through reduced blocking work before visible output.

### ATS Enhancement Responsiveness

- **PERF-03**: ATS enhancement flows complete faster by removing or deferring non-essential synchronous work without compromising canonical state or billing safety.

### Runtime Efficiency

- **PERF-04**: The core agent runtime can be optimized safely through smaller orchestration boundaries, lower prompt overhead, and fewer unnecessary tool loops.

### Proof and Operational Handoff

- **PERF-05**: The milestone ends with before/after latency proof, focused regression verification, and autonomous execution guidance that keeps future work aligned to response-time priorities.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Broad feature expansion unrelated to response time | The milestone is intentionally focused on speed and runtime efficiency |
| Cosmetic refactors that do not reduce latency or improve safe optimization | Cleanup should not steal priority from agent responsiveness |
| Provider or infrastructure replacement without evidence | The milestone should optimize the existing brownfield system first |
| Billing-model changes beyond what is strictly required to preserve latency work safety | Economic correctness remains a guardrail, not a redesign target |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | Phase 24 | Planned |
| PERF-02 | Phase 24, Phase 25 | Planned |
| PERF-03 | Phase 25, Phase 26 | Planned |
| PERF-04 | Phase 26 | Planned |
| PERF-05 | Phase 27 | Planned |

**Coverage:**
- v1.3 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-04-14*
