# REVIEW-FIX

Integrated the review follow-up directly into the final Phase 106 state:

- aligned the `job_targeting` pipeline regression with the new severity model so medium warnings no longer masquerade as blocking failures
- kept `issues` as a shared compatibility alias while introducing `blocked`, `hardIssues`, and `softWarnings`, which let ATS consumers remain untouched
- validated the shared-file isolation explicitly through ATS route, scoring, context-builder, and pipeline regression coverage
