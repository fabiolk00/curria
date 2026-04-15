# Requirements: CurrIA

**Defined:** 2026-04-15
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.2 Requirements

### Tooling Baseline

- [ ] **HYG-01**: Contributors can run one documented toolchain that surfaces unused imports, unused exports, orphan files, and unused dependencies in this repo.
- [ ] **HYG-02**: The repo documents false-positive guardrails for Next.js routes, dynamic imports, string-driven handlers, and background jobs before code deletion happens.

### Import and Local Cleanup

- [ ] **CLEAN-01**: Unused imports are automatically removable through repo-standard lint tooling in the agreed code scopes.
- [ ] **CLEAN-02**: Low-risk unused locals and parameters can be cleaned or explicitly ignored without breaking current build and test behavior.

### Dead Export and File Reduction

- [ ] **DEAD-01**: The team can inventory candidate dead exports and orphan files, review them manually, and safely remove verified dead code.

### Dependency and Enforcement Hardening

- [ ] **DEPS-01**: Unused dependencies can be identified and removed with regression proof that the repo still builds and tests correctly.
- [ ] **ENF-01**: Ongoing hygiene enforcement is wired into lint, TypeScript, editor, or CI flows only at scopes the brownfield repo can actually sustain.

## v1.3 Requirements

### Deferred Cleanup Depth

- **DEAD-02**: The repo can detect and reduce dead test utilities, fixture drift, and legacy planning helpers beyond the main runtime tree.
- **ENF-02**: `noUnusedLocals` and `noUnusedParameters` can run at broader or global scope without creating blocking noise for valid dynamic seams.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bulk deletion of all static-tool findings in one pass | Too risky for a brownfield Next.js app with dynamic runtime seams |
| Full repo-wide formatter churn unrelated to dead code | Would bury the cleanup signal in avoidable diff noise |
| Re-architecting runtime flows just to satisfy static analysis | Cleanup should follow product constraints, not replace them |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HYG-01 | Phase 20 | Pending |
| HYG-02 | Phase 20 | Pending |
| CLEAN-01 | Phase 21 | Pending |
| CLEAN-02 | Phase 21 | Pending |
| DEAD-01 | Phase 22 | Pending |
| DEPS-01 | Phase 23 | Pending |
| ENF-01 | Phase 23 | Pending |

**Coverage:**
- v1.2 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after initial v1.2 definition*
