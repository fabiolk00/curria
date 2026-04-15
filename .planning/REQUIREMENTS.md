# Requirements: CurrIA

**Defined:** 2026-04-15
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.4 Requirements

### Agent Runtime Modularization

- **AGENT-01**: The main agent route and loop are decomposed into explicit services for message preparation, vacancy detection, and pre-loop setup without changing current user-visible behavior by default.
- **AGENT-02**: Retry, recovery, streaming, and persistence responsibilities are extracted into narrower services with clear handoff boundaries instead of staying embedded in one oversized runtime path.
- **AGENT-03**: The extracted agent-service boundaries are protected by targeted automated tests that preserve canonical `cvState`, operational `agentState`, and deterministic generation contracts.

### Authenticated and Billing Trust Boundaries

- **SEC-01**: Checkout and external return flows derive trusted app URLs from canonical configuration, not raw request origin, and reject unsafe return targets.
- **SEC-02**: Sensitive authenticated mutations explicitly validate expected origin or CSRF context and fail closed when trust signals are missing or invalid.
- **SEC-03**: Billing and other external callback or redirect paths enforce the intended header and trust-boundary contract with committed regression proof and operator-visible logging.

### Generation Stability and Release Hygiene

- **REL-01**: The long vacancy generation flow completes reliably through workspace, template, preview, and download-critical steps with committed regression coverage.
- **REL-02**: Broken user-facing encoding artifacts are removed from the product surface and protected from easy reintroduction.
- **REL-03**: CI blocks merges when critical workspace, preview, generation-state, or release-stability regressions are detected.

## Future Requirements

| Requirement | Why Deferred |
|-------------|--------------|
| PDF profile upload or broader onboarding expansion | Explicitly deferred until the current hardening milestone is complete |
| New resume-product breadth beyond the current funnel | Reliability, security, and release safety are higher leverage right now |
| Broad UX redesign of workspace or dashboard flows | The milestone is focused on brownfield hardening, not a visual rewrite |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replacing core auth, billing, storage, or AI providers | The milestone should harden the existing platform instead of replatforming it |
| Global architectural rewrite beyond the targeted agent-service slices | Smaller extractions are safer than a sweeping brownfield rewrite |
| Feature work unrelated to agent maintainability, security boundaries, or generation stability | Scope discipline matters more than breadth in this cycle |
| Turning CI into a broad all-repo gate overhaul unrelated to release-critical flows | The new gates should stay focused on high-value regressions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGENT-01 | Phase 28 | Planned |
| AGENT-02 | Phase 29 | Planned |
| AGENT-03 | Phase 29 | Planned |
| SEC-01 | Phase 30 | Planned |
| SEC-02 | Phase 30 | Planned |
| SEC-03 | Phase 30 | Planned |
| REL-01 | Phase 31 | Planned |
| REL-02 | Phase 31 | Planned |
| REL-03 | Phase 31 | Planned |

**Coverage:**
- v1.4 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
