# Research Summary: Agent Reliability and Response Continuity

## Stack Additions

- No new vendor or transport is required.
- The strongest additions are deployment provenance on `/api/agent`, richer structured logging, and deeper route/SSE verification on the existing stack.

## Feature Table Stakes

- Prove which build, model, and recovery path served a live request.
- Make dialog follow-ups like `reescreva` continue the resume task instead of repeating vacancy bootstrap text.
- Ensure the rendered chat transcript reflects one coherent assistant turn per request.
- Verify the behavior through real route seams, not only loop helpers.

## Watch Out For

- Do not assume production is running the latest agent-loop code until the live route exposes proof.
- Do not blame the model alone when truncation, fallback logic, and transcript assembly all sit on the same path.
- Do not close the milestone with only unit-level confidence; the user-visible bug is end to end.

## Recommended Requirement Groups

- Runtime provenance and deployment parity
- Dialog continuity and model-routing correctness
- Transcript integrity and end-to-end regression coverage
