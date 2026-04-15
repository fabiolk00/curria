# 12-01 Summary

Implemented shared OpenAI resilience in `src/lib/openai/chat.ts` with:

- bounded per-attempt timeout handling
- bounded retry backoff
- process-local circuit breaker transitions (`closed`, `open`, `half_open`)
- structured logs for timeouts, retries, breaker opens, half-open probes, closes, and short-circuits

Wired the protection context into the highest-risk call sites:

- `src/lib/agent/agent-loop.ts`
- `src/lib/agent/tools/parse-file.ts`
- `src/lib/agent/tools/resume-ingestion.ts`
- `src/lib/agent/tools/rewrite-section.ts`
- `src/lib/agent/tools/gap-analysis.ts`
- `src/lib/resume-targets/create-target-resume.ts`

Verification:

- `pnpm vitest run src/lib/openai/chat.test.ts`
- `pnpm tsc --noEmit`
