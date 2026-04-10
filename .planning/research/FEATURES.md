# Feature Research: Agent Reliability and Response Continuity

## Table Stakes

### Deployment and Runtime Proof

- Operator can identify which build or commit served a real `/api/agent` request.
- Live logs show the selected model, assistant text length, recovery usage, and fallback branch.
- Post-deploy verification confirms the running environment matches the repo contract.

### Dialog Continuity

- A follow-up like `reescreva` yields a concrete rewrite or a short next-step reply, not a repeated vacancy bootstrap.
- Latest user intent is preserved across truncation or recovery attempts.
- New target-job context pasted during `dialog` is not lost when the main turn fails.

### Transcript Integrity

- One user request results in one coherent assistant message in the rendered chat transcript.
- Recoveries do not append stale or duplicate assistant copy into the same visible turn.
- The UI can distinguish a valid degraded fallback from an interrupted or malformed stream.

### Verification

- Route-level tests prove the real `/api/agent` path uses the intended model and fallback behavior.
- Browser or transcript-level checks prove what the user sees matches the backend result.

## Differentiators Worth Keeping

- Phase-aware fallbacks that feel like natural conversation rather than generic retry text.
- Operator evidence that can explain whether a production report came from old code, wrong config, or an actual new bug.
- Small, focused fixes that preserve the existing product funnel instead of forcing users through a redesigned chat workflow.

## Anti-Features for This Milestone

- Full chat redesign or styling overhaul.
- Generic “AI copilot” expansion beyond resume optimization.
- Large prompt rewrites that mix copy polish with reliability work.
- New onboarding, billing, or application-tracking scope unrelated to the agent continuity issue.
