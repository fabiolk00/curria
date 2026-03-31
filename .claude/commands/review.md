# /project:review

Review the current git diff for correctness, invariant safety, and alignment with the current CurrIA architecture.

## Current Architecture Reality
- Runtime persistence uses Supabase JS, while Prisma remains the schema and migration reference
- Clerk authenticates users, but domain logic should use internal app user IDs
- `credit_accounts` is the runtime source of truth for credits
- Session state is split into `cvState`, `agentState`, and `generatedOutput`
- Tool-originated state changes must be expressed as `ToolPatch` and applied through the dispatcher
- `generate_file` reads canonical `cvState` and persists artifact metadata only

## Steps

1. Run `git diff --staged` to inspect staged changes.
2. If nothing is staged, run `git diff HEAD`.
3. Check changed files against:
   - `.claude/rules/code-style.md`
   - `.claude/rules/api-conventions.md`
   - `.claude/rules/testing.md`
4. For changes touching identity or billing, verify:
   - no new domain dependence on Clerk IDs
   - `credit_accounts` remains authoritative
   - webhook idempotency is not weakened
5. For changes touching session or agent code, verify:
   - `cvState` remains canonical resume truth
   - `agentState` is used only for operational context
   - `generatedOutput` does not store signed URLs
   - tools do not mutate session directly
   - patches are minimal and merge-safe
6. For changes touching `src/lib/agent/`, verify the model in `src/lib/agent/config.ts` is still `gpt-4o-mini` (combo_a) unless the change explicitly intends to update it.
7. For changes touching `src/lib/ats/`, verify co-located tests were updated.
8. For changes touching docs, verify they reflect the live architecture and do not reintroduce removed legacy fields like `cvState.rawText` or `cvState.targetJobDescription`.
9. Output:

```
## Summary
<what changed in plain English>

## Issues
- [CRITICAL] <blocking issue - must fix before merge>
- [WARNING]  <non-blocking but should address>
- [SUGGESTION] <optional improvement>

## Verdict
APPROVE / REQUEST CHANGES
```

If there are no issues, say so clearly and give the APPROVE verdict.

## Additional Current-Architecture Checks
- If canonical `cvState` changed through trusted ingestion or rewrite, verify a `cv_versions` snapshot is created.
- If target-specific resume functionality changed, verify `resume_targets` is used and base `cvState` is not overwritten.
- If gap analysis changed, verify the output is structured, validated, and not sourced from unstructured chat text alone.
