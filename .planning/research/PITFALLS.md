# Pitfalls Research: Agent Reliability and Response Continuity

## High-Risk Mistakes

- Treating the incident as a frontend-only rendering bug before proving what code is deployed. The missing live log fields are a strong warning sign.
- Fixing the fallback copy without capturing which recovery branch fired. That hides whether the underlying issue is truncation, empty output, or deployment drift.
- Increasing token limits or swapping models blindly. A larger model can still repeat the wrong deterministic fallback if the logic is wrong.
- Testing only helper functions. This bug spans route import state, SSE transport, and rendered transcript output.

## Integration Pitfalls

- Losing the latest user message while recovery code only looks at saved session state.
- Concatenating streamed text and recovery fallback text into one message without clear ownership of the final visible assistant turn.
- Letting route-level build metadata differ from what is logged inside `agent-loop.ts`, which creates another parity blind spot.
- Making confirm-phase and dialog-phase model routing diverge from the documented env contract.

## Guardrails

- Every live incident fix should leave behind a concrete proof seam: header, log field, test, or replayable transcript.
- Recovery code should preserve the latest intent first, then degrade gracefully.
- UI assertions should validate the final visible assistant copy, not only that a stream completed.
- Keep the milestone narrow: prove, harden, verify.
