## Summary

- Replaced the deterministic preview-highlight engine with a persisted highlight artifact generated from the final rewritten `cvState`.
- Added deterministic flattening, local range validation, renderer helpers, and a single-call LLM highlight detector.
- Integrated highlight generation after ATS enhancement and job targeting rewrites, stored the result in `agentState.highlightState`, and cleared stale highlights after optimized manual edits.
- Updated the comparison APIs/UI to consume the separate highlight artifact without changing the `cvState` content tree.
- Removed legacy metric-preservation heuristics, observability helpers, and preview-highlight tests that belonged to the old architecture.
