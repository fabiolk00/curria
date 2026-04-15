# Phase 13 Context

## Why This Phase Exists

CurrIA is a Brazilian application that handles resumes, job descriptions, and generated artifacts, but the roadmap and requirements currently do not explicitly cover LGPD-sensitive behavior. At the same time, the repo documents powerful backend secrets and a test-only auth bypass that both need stronger guardrails.

## Problems To Solve

- LGPD-sensitive resume and vacancy data handling is not explicitly modeled in requirements or implementation contracts.
- Secret boundaries need clearer verification between server-only modules and any client or edge surface.
- The E2E auth bypass must stay impossible to enable accidentally outside test contexts.

## Acceptance Lens

This phase is done when LGPD-sensitive data handling is explicit, secret boundaries are auditable, and the E2E auth seam is guarded and verified.

## Requirements

- SEC-01
- SEC-02
