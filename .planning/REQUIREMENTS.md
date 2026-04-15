# Requirements: CurrIA

**Defined:** 2026-04-15
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.5 Requirements

### Verification Closure

- [x] **VER-01**: Completed phases can produce committed `VERIFICATION.md` artifacts that map shipped requirements, evidence, residual gaps, and verification status in the format expected by `gsd-audit-milestone`.
- [x] **VER-02**: Milestone audit can determine recent shipped requirement coverage from committed verification artifacts instead of relying on summary-only inference or missing-proof fallbacks.

### Planning and Archive Integrity

- [x] **DOC-01**: Roadmap, traceability, archive, and state metadata stay consistent through milestone closeout, including inserted decimal phases and shipped plan counts.
- [x] **DOC-02**: Completing a milestone leaves a clean planning surface for the next cycle, including accurate shipped stats, archived proof files, cleared phase directories, and a fresh active requirements file.

### Runtime Residual Budget

- [x] **PERF-04**: The remaining non-E2E runtime outliers are profiled with committed evidence that identifies which suites dominate the post-`v1.4` budget.
- [x] **PERF-05**: The repo either reduces the dominant residual non-E2E bottlenecks further or records an explicit accepted runtime budget and gate so future drift is visible and intentional.

### Rewrite State Coherence

- [x] **COH-01**: When deterministic ATS enhancement or job targeting has already produced `optimizedCvState`, later chat rewrite requests and deterministic helper flows use that effective optimized source instead of stale base `cvState`.
- [x] **COH-02**: Target resume derivation paths, including tool-driven target resume creation after ATS enhancement, remain consistent with the latest optimized resume state and are protected by committed regression coverage.

### Freeform Vacancy Robustness

- [x] **VAC-01**: Job targeting derives useful targeting context from arbitrary pasted vacancy text by prioritizing skills, responsibilities, and other semantic signals even when no clean role title is present.
- [x] **VAC-02**: Under freeform vacancy input, job-targeting rewrites remain factually grounded and reduce preventable validation failures caused by unsupported skill injection or weak `targetRole` parsing.

## Future Requirements

| Requirement | Why Deferred |
|-------------|--------------|
| Broader CI sharding or distributed test execution redesign | First prove whether the remaining runtime pain is suite-specific or needs infrastructure work |
| Major redesign of all GSD archive tooling beyond the current closeout path | The immediate need is reliable milestone proof and metadata integrity, not a platform rewrite |
| New product-surface feature breadth unrelated to proof, archive hygiene, or runtime residuals | The highest leverage right now is closing the operational debt left by `v1.4` |

## Out of Scope

| Feature | Reason |
|---------|--------|
| New resume-product breadth unrelated to verification or runtime proof | This milestone is for delivery confidence, not feature expansion |
| Broad frontend redesign of workspace or dashboard screens | UI changes do not address the current archive and runtime debt |
| Replatforming test runners, auth, billing, or storage providers | Brownfield hardening is safer than provider churn here |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VER-01 | Phase 32 | Complete |
| VER-02 | Phase 32 | Complete |
| DOC-01 | Phase 33 | Complete |
| DOC-02 | Phase 33 | Complete |
| PERF-04 | Phase 34 | Complete |
| PERF-05 | Phase 34 | Complete |
| COH-01 | Phase 35 | Complete |
| COH-02 | Phase 35 | Complete |
| VAC-01 | Phase 36 | Complete |
| VAC-02 | Phase 36 | Complete |

**Coverage:**
- v1.5 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
