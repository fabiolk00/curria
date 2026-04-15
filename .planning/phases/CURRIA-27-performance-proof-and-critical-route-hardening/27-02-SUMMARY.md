# 27-02 Summary

## Outcome

Phase 27-02 consolidates the milestone's before/after proof into one operator-facing narrative that explains what materially improved response time and what remains qualitative versus measured.

## Before / After Narrative

### Before v1.3

- the main agent route had limited stage-level visibility into first visible response timing
- existing-session setup and ATS-related preparation could block the user before meaningful chat output appeared
- simple dialog continuation turns could still burn model retries before the runtime returned a useful continuation
- adjacent routes like generation, download, and import-status tracking had weaker latency/degradation evidence

### After v1.3

- Phase 24 introduced request-stage timing and explicit first-response observability for the agent path
- Phase 25 moved existing-session setup deeper into SSE, surfaced earlier preparation progress, and deferred ordinary ATS rewrite work out of the normal chat path
- Phase 26 extracted runtime intent detection, added a deterministic `dialog_continue` fast path, and tightened history/tool/output budgets by phase
- Phase 27 added structured latency and degradation logs to generation, download, and import-status routes

## What is measured versus qualitative

- measured in code and logs:
  - first-response timing markers in the main agent route
  - phase-specific runtime budgets
  - route-level latency logs for generation, file download, and import-status routes
- qualitative but test-backed:
  - simpler continuation chat turns now avoid unnecessary model work
  - ordinary ATS resume-only chat no longer waits on inline rewrite work
  - existing-session chat can surface visible progress earlier

## Operator Guidance

- use the `agent.request.*`, `agent.turn.*`, and `agent.stream.*` logs to inspect the main chat path
- use:
  - `api.session.generate.*`
  - `api.file.download_urls_*`
  - `api.profile.upload_status.*`
  - `api.profile.status.*`
  to distinguish adjacent latency and degradation behavior
- treat the milestone as a response-time hardening cycle, not a benchmark-reporting cycle; the repo now has stronger evidence, but any external latency claims should still be based on production measurements
