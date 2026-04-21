# Route Review Checklist

Use this checklist when reviewing changes to semantically dense routes.

For the full operating procedure, cadence, gates, hotspot review, and verdict format, see [review-plan.md](./review-plan.md).

- Does the route inline repeated business policy instead of delegating to `policy.ts` or `decision.ts`?
- Is signed URL emission gated by an explicit decision-layer outcome?
- Is preview lock interpreted in `decision.ts` or `policy.ts` instead of `response.ts`?
- Does `response.ts` only map explicit outcomes?
- Does `context.ts` only resolve request scope and typed inputs?
- Are precedence-sensitive branches covered by tests?
- Does this route actually need the full pattern, or is it a simple CRUD surface that should stay simpler?
