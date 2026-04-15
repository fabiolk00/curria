# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.2 Code Hygiene and Dead Code Reduction` after `v1.1` shipped deterministic resume pipelines and boundary hardening. The new work is intentionally narrower and more operational: reduce dead code, dependency drift, and maintenance noise without breaking dynamic brownfield seams or creating churn-heavy cleanup diffs.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 20**.

### Phase 20: Dead-Code Tooling and Safety Baseline
**Goal**: Establish a repo-native hygiene toolchain and explicit safety rules before any broad cleanup starts.
**Depends on**: Nothing (first phase of milestone v1.2)
**Requirements**: [HYG-01, HYG-02]
**Success Criteria** (what must be TRUE):
  1. Contributors can run documented commands that surface unused imports, exports, orphan files, and dependencies in this repo.
  2. The project documents which dead-code findings require manual review because of Next.js routes, dynamic imports, string-driven handlers, or background jobs.
  3. Package scripts and baseline docs exist so cleanup work is repeatable instead of ad hoc.
**Plans**: 3 plans

Plans:
- [ ] 20-01: Add dead-code tooling, scripts, and scoped lint autofix baseline
- [ ] 20-02: Document false-positive guardrails and repo cleanup workflow
- [ ] 20-03: Add focused verification for the new hygiene toolchain

### Phase 21: Import and Local Cleanup Sweep
**Goal**: Remove low-risk unused imports and locals in agreed scopes without changing runtime behavior.
**Depends on**: Phase 20
**Requirements**: [CLEAN-01, CLEAN-02]
**Success Criteria** (what must be TRUE):
  1. Unused imports are removed through repo-standard lint or organize-import flows in targeted scopes.
  2. Low-risk unused locals or parameters are either removed or intentionally marked with stable ignore conventions.
  3. Cleanup passes with typecheck, lint, and relevant focused tests.
**Plans**: 3 plans

Plans:
- [ ] 21-01: Run and validate staged unused-import cleanup
- [ ] 21-02: Remove or mark low-risk unused locals and parameters
- [ ] 21-03: Add regression proof for cleaned scopes

### Phase 22: Dead Exports and Orphan File Reduction
**Goal**: Inventory and reduce dead exports or orphan files with manual validation for dynamic-runtime seams.
**Depends on**: Phase 20, Phase 21
**Requirements**: [DEAD-01]
**Success Criteria** (what must be TRUE):
  1. Candidate dead exports and orphan files are identified through repo tooling and reviewed manually before deletion.
  2. Dynamic-runtime seams are preserved where static tooling would otherwise produce false positives.
  3. Verified dead code is removed with focused regression coverage where needed.
**Plans**: 3 plans

Plans:
- [ ] 22-01: Inventory dead exports and orphan files with review notes
- [ ] 22-02: Remove verified dead exports and files in low-risk slices
- [ ] 22-03: Lock in coverage for dynamic-runtime exceptions and deletions

### Phase 23: Dependency Cleanup and Sustained Enforcement
**Goal**: Remove truly unused dependencies and turn the cleanup into sustainable hygiene gates the repo can support.
**Depends on**: Phase 20, Phase 21, Phase 22
**Requirements**: [DEPS-01, ENF-01]
**Success Criteria** (what must be TRUE):
  1. Unused dependencies are identified, reviewed, and removed without regressing build or runtime behavior.
  2. The repo adopts ongoing hygiene enforcement only at scopes proven safe for the brownfield codebase.
  3. CI, TypeScript, lint, and editor guidance reflect the final agreed maintenance baseline.
**Plans**: 3 plans

Plans:
- [ ] 23-01: Remove verified unused dependencies and validate runtime safety
- [ ] 23-02: Decide and implement sustainable TypeScript or lint enforcement scope
- [ ] 23-03: Update CI and contributor workflow for ongoing dead-code hygiene

## Progress

**Execution Order:**
Phases execute in numeric order: 20 -> 21 -> 22 -> 23

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 20. Dead-Code Tooling and Safety Baseline | 0/3 | Not started | - |
| 21. Import and Local Cleanup Sweep | 0/3 | Not started | - |
| 22. Dead Exports and Orphan File Reduction | 0/3 | Not started | - |
| 23. Dependency Cleanup and Sustained Enforcement | 0/3 | Not started | - |
