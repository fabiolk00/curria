# Phase 93 Research

## Current Seam

The ATS enhancement summary path is currently controlled in three places:

1. `src/lib/agent/tools/rewrite-resume-full.ts`
   - builds summary instructions
   - decides whether the rewrite is still too close / structurally noisy
   - triggers the assertive second pass
2. `src/lib/agent/tools/rewrite-section.ts`
   - sanitizes raw summary payloads
   - strips section labels
   - deduplicates exact repeated sentences
3. downstream ATS tests
   - already prove retry behavior for labels / duplication / empty cleanup

## Observed Gap

The current guardrails reject obvious structural noise, but they do not yet push hard enough on:

- repeated domain phrasing across adjacent sentences
- weak first-line openings such as `Profissional com mais de X anos...`
- summaries that spend the second sentence restating experience instead of adding stack / impact / scope
- overlong safe phrasing that is not invalid enough to trigger a retry

## Recommended Shape

Use a narrow two-part hardening:

1. Strengthen summary instructions in `rewrite-resume-full.ts`
   - ask for one strong opening sentence plus one optional additive sentence
   - explicitly forbid repeated domain wording and repeated experience phrasing
   - prioritize identity, seniority, focus, then stack / impact
2. Expand summary-noise detection in `rewrite-resume-full.ts`
   - mark more than two sentences as noisy
   - mark weak opening templates as noisy
   - mark repeated dominant-domain phrasing across the whole summary as noisy
   - keep using the existing assertive second pass instead of inventing a new repair stage

`rewrite-section.ts` only needs minimal support if a final cleanup helper can safely normalize repeated leading clauses without altering facts. It should stay conservative.

## Lowest-Risk Implementation Surface

- `src/lib/agent/tools/rewrite-resume-full.ts`
  - summary instructions
  - summary noise helpers
  - retry trigger remains in the same place
- `src/lib/agent/tools/rewrite-section.ts`
  - optional small cleanup helper only if needed for exact lexical consolidation
- tests
  - `src/lib/agent/tools/pipeline.test.ts`
  - `src/lib/agent/tools/rewrite-section.test.ts`

## Test Focus

Add focused coverage for:

- redundant BI / experience phrasing triggering the assertive retry
- stronger first-line positioning instructions
- dense stack-preserving summary staying valid
- no change to ATS gates / score policy behavior

## Non-Goals

- no ATS gate changes
- no score-policy changes
- no preview / export / UI changes
- no experience rewrite changes
