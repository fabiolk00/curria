# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**Large agent orchestration modules:**
- Issue: The core AI flow is concentrated in a few very large files, which makes small behavioral changes risky and review-heavy.
- Files: `src/lib/agent/agent-loop.ts`, `src/app/api/agent/route.ts`, `src/lib/agent/tools/index.ts`, `src/lib/agent/context-builder.ts`
- Impact: Prompt, streaming, retry, and persistence changes are tightly coupled; regressions can hide in long control-flow branches.
- Fix approach: Split by responsibility first: request preprocessing, deterministic bootstrap logic, OpenAI streaming, and SSE response wiring.

**Oversized client feature components:**
- Issue: Some feature UIs own rendering, state transitions, and action orchestration in single files.
- Files: `src/components/dashboard/job-applications-tracker.tsx`, `src/components/dashboard/chat-interface.tsx`, `src/components/resume/visual-resume-editor.tsx`
- Impact: UI regressions are harder to isolate, memoization opportunities are limited, and reuse across surfaces is low.
- Fix approach: Extract form sections, toolbar blocks, and mutation handlers into focused child modules before adding more features.

## Known Bugs

**CI env variable drift from runtime names:**
- Symptoms: The committed CI workflow exports `ASAAS_API_KEY`, `UPSTASH_REDIS_URL`, and `UPSTASH_REDIS_TOKEN`, while runtime code reads `ASAAS_ACCESS_TOKEN`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.
- Files: `.github/workflows/ci.yml`, `src/lib/asaas/client.ts`, `src/lib/rate-limit.ts`, `src/app/api/webhook/clerk/route.ts`
- Trigger: Adding integration coverage that stops mocking these providers, or reusing the workflow env block in staging scripts.
- Workaround: Align workflow env names to the runtime contract before relying on provider-backed tests in CI.

## Security Considerations

**OpenAI client does not fail fast on missing API key:**
- Risk: `src/lib/openai/client.ts` falls back to `'test-key'`, which can hide bad configuration until a live request fails.
- Files: `src/lib/openai/client.ts`, `src/lib/openai/chat.ts`, `src/lib/agent/agent-loop.ts`
- Current mitigation: Requests still fail upstream if the key is invalid.
- Recommendations: Throw during initialization when `OPENAI_API_KEY` is missing outside tests, or gate the fallback behind `NODE_ENV === 'test'`.

**Server-side logging still mixes structured and ad-hoc output:**
- Risk: Sensitive operational paths may be harder to audit consistently because some routes bypass the shared JSON logger.
- Files: `src/app/api/session/route.ts`, `src/app/api/session/[id]/messages/route.ts`, `src/app/api/file/[sessionId]/route.ts`, `src/app/api/webhook/clerk/route.ts`
- Current mitigation: Critical billing and agent flows already use `src/lib/observability/structured-log.ts`.
- Recommendations: Standardize all server routes on `logInfo`, `logWarn`, and `logError`.

## Performance Bottlenecks

**In-memory document generation and upload on request path:**
- Problem: DOCX and PDF are generated in memory and uploaded during the request that triggers generation.
- Files: `src/lib/agent/tools/generate-file.ts`, `src/app/api/session/[id]/generate/route.ts`, `src/app/api/agent/route.ts`
- Cause: The current design performs validation, rendering, upload, and signing synchronously in one request cycle.
- Improvement path: Move heavy generation to a background job or queue if resume size, traffic, or template complexity grows.

**Whole-page fetch and regex stripping for job scraping:**
- Problem: Job posting extraction downloads the full HTML response and uses broad regex cleaning.
- Files: `src/lib/agent/scraper.ts`, `src/lib/agent/url-extractor.ts`
- Cause: Lightweight implementation avoids a headless browser but pays in robustness and parsing quality.
- Improvement path: Keep allowlisting, but add per-domain extraction strategies or a dedicated extraction service for brittle sources.

## Fragile Areas

**Agent phase machine and deterministic bootstrap flow:**
- Files: `src/lib/agent/agent-loop.ts`, `src/lib/agent/context-builder.ts`, `src/lib/agent/tools/index.ts`, `src/app/api/agent/route.ts`
- Why fragile: Session phase, SSE events, prompt trimming, tool loops, and recovery fallbacks all interact in one flow.
- Safe modification: Change one phase transition at a time and extend `src/lib/agent/streaming-loop.test.ts` plus `src/app/api/agent/route.test.ts`.
- Test coverage: Good, but concentrated around streaming and tool dispatch rather than every route-preprocessing edge case.

**Billing trust-anchor and webhook replay logic:**
- Files: `src/lib/asaas/event-handlers.ts`, `src/lib/asaas/idempotency.ts`, `src/app/api/webhook/asaas/route.ts`, `src/lib/asaas/billing-checkouts.ts`
- Why fragile: Correct crediting depends on checkout state, subscription metadata, and event fingerprint reconciliation staying in sync.
- Safe modification: Preserve idempotency semantics and add or update webhook tests before touching field mapping or trust-anchor rules.
- Test coverage: Strong for happy-path and duplicate-delivery logic, but still sensitive to provider payload drift.

## Scaling Limits

**Session bundle stored as JSON in a single row:**
- Current capacity: Works for the current 30-message cap and resume-sized payloads.
- Limit: Large `cvState`, `agentState`, and generated metadata will increase row size and prompt-building cost in `src/lib/agent/context-builder.ts`.
- Scaling path: Keep immutable history in `cv_versions`, keep target variants in `resume_targets`, and move bulky operational data out of `sessions` if prompt context grows.

**LinkedIn import runs inline during polling:**
- Current capacity: Suitable for occasional imports per user.
- Limit: Poll-triggered processing in `src/app/api/profile/status/[jobId]/route.ts` can tie user-facing latency to third-party fetch time.
- Scaling path: Move claimed jobs to a background worker once volume or provider latency increases.

## Dependencies at Risk

**LinkdAPI response contract:**
- Risk: The app depends on a remote JSON shape without a pinned SDK or generated client.
- Impact: Profile import in `src/lib/linkedin/linkdapi.ts` and `src/lib/linkedin/extract-profile.ts` can break if provider fields rename or disappear.
- Migration plan: Introduce tighter schema validation around the provider payload and isolate fallback mappings for alternate import providers.

## Missing Critical Features

**No end-to-end browser coverage for the highest-value paths:**
- Problem: Auth, checkout, chat streaming, target resume generation, and signed artifact download are validated through unit/integration tests only.
- Blocks: Safe refactors across the full user journey from login to generated resume delivery.

## Test Coverage Gaps

**Middleware, scraping, and Clerk webhook coverage are thinner than core billing/agent coverage:**
- What's not tested: Security-header behavior in `src/middleware.ts`, scrape robustness in `src/lib/agent/scraper.ts`, and the full Clerk webhook path in `src/app/api/webhook/clerk/route.ts`
- Files: `src/middleware.ts`, `src/lib/agent/scraper.ts`, `src/app/api/webhook/clerk/route.ts`, `src/lib/rate-limit.ts`
- Risk: Security, dedupe, or auth bootstrap regressions may slip through because the most extensive test coverage lives elsewhere.
- Priority: High

---

*Concerns audit: 2026-04-09*
