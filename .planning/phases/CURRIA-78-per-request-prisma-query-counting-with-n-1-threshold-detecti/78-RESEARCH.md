# Phase 78: Per-request Prisma query counting with N+1 threshold detection - Research

**Researched:** 2026-04-21
**Domain:** Request-scoped Supabase/PostgREST query observability in Next.js API routes [VERIFIED: codebase grep]
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Preserve the requested architecture shape where it still makes sense: AsyncLocalStorage request context plus a reusable route wrapper plus global DB client instrumentation.
- Implement instrumentation at the live DB seam (`getSupabaseAdminClient()` / Supabase fetch pipeline) instead of introducing an unused Prisma client layer.
- Keep event names DB-generic (`db.request_queries`, `db.n_plus_one_threshold_exceeded`) so the observability contract remains useful even though the concrete transport is Supabase/PostgREST requests rather than Prisma query events.
- Scope wrapper rollout to the highest-value existing API routes first: `/api/agent`, `/api/session/[id]`, `/api/file/[sessionId]`, and `/api/session/[id]/generate`.
- Bound in-memory sampling and truncate sampled request descriptors to keep production safety.

### Claude's Discretion

### Deferred Ideas (OUT OF SCOPE)
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Preserve the brownfield product surface unless scope explicitly changes. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over new feature breadth. [VERIFIED: CLAUDE.md]
- Keep route handlers thin. [VERIFIED: CLAUDE.md]
- Validate external input with `zod`. [VERIFIED: CLAUDE.md]
- Prefer structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical truth and preserve existing agent dispatcher / `ToolPatch` patterns when touching agent flows. [VERIFIED: CLAUDE.md]
- Do not introduce broad rewrites; prefer small, test-backed changes around existing route and domain seams. [VERIFIED: CLAUDE.md]

## Summary

The live DB seam is the cached Supabase admin client in [`src/lib/db/supabase-admin.ts`](../../../../src/lib/db/supabase-admin.ts), not a Prisma singleton. That client is created once and is reused by repositories across the targeted routes, so the production-safe equivalent of Prisma query events is to wrap the Supabase client's custom `global.fetch` and record only PostgREST requests while an `AsyncLocalStorage` store is active. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js] [CITED: https://nodejs.org/api/async_context.html]

The route layer already has two patterns that Phase 78 should follow: thin route files that delegate to route/context modules for non-streaming endpoints, and explicit request lifecycle logging inside the agent orchestrator for the streaming `/api/agent` path. The clean fit is one reusable request-query context helper, one reusable Supabase fetch wrapper installed inside `getSupabaseAdminClient()`, and one reusable route helper for non-streaming handlers, while `/api/agent` flushes request query metrics inside its existing completion / failure logging points. [VERIFIED: codebase grep]

**Primary recommendation:** Instrument `getSupabaseAdminClient()` once with a custom `global.fetch`, count only `/rest/v1/` requests inside an `AsyncLocalStorage` request store, and emit one structured summary plus one threshold warning per tracked request. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js] [CITED: https://nodejs.org/api/async_context.html]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node `AsyncLocalStorage` | built-in; stable since Node 16.4.0 [CITED: https://nodejs.org/api/async_context.html] | Request-scoped state propagation across async work | Preferred by Node over hand-rolled `async_hooks` state because it is performant and memory-safe. [CITED: https://nodejs.org/api/async_context.html] |
| `@supabase/supabase-js` | repo-installed `2.103.0`; npm latest `2.104.0` published 2026-04-20 [VERIFIED: local package] [VERIFIED: npm registry] | Live DB/storage/auth client seam used by repositories | The client accepts `global.fetch`, which is the narrowest shared interception point for current runtime DB access. [VERIFIED: local package] |
| `next` | repo-installed `14.2.3` [VERIFIED: local package] | Existing App Router runtime | Target routes are App Router handlers already structured around thin adapters. [VERIFIED: codebase grep] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/observability/structured-log.ts` | local helper [VERIFIED: codebase grep] | Canonical structured logging sink | Use for both request summary and threshold warning events so the phase matches existing observability conventions. [VERIFIED: codebase grep] |
| `vitest` | repo-installed `1.6.1`; npm latest `4.1.5` published 2026-04-21 [VERIFIED: local package] [VERIFIED: npm registry] | Existing automated test framework | Use for request context unit tests, Supabase seam tests, and route wrapper regressions. [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase `global.fetch` instrumentation | Per-repository manual counters | Rejected because it is invasive, misses shared repository paths, and does not satisfy the "global DB client instrumentation" decision. [VERIFIED: codebase grep] |
| Request-scoped ALS store | Passing counter objects through every repo call | Rejected because it would widen many signatures and break the existing thin-route / deep-domain split. [VERIFIED: codebase grep] |
| Live seam instrumentation | Introducing a dormant Prisma client just for metrics | Rejected because the runtime does not use Prisma for these requests. [VERIFIED: codebase grep] |

**Installation:** No new packages are required for this phase. [VERIFIED: codebase grep]

## Architecture Patterns

### Recommended Project Structure
```text
src/lib/observability/
├── request-query-context.ts      # AsyncLocalStorage store, counters, sampling, flush helpers
├── request-query-tracking.ts     # Supabase fetch wrapper + DB-request classification
└── request-query-context.test.ts # unit tests for store and flush behavior

src/lib/routes/shared/
└── with-request-query-tracking.ts # wrapper for non-streaming route handlers
```

### Pattern 1: Global Supabase fetch instrumentation at the existing seam
**What:** Install one custom fetch inside `getSupabaseAdminClient()` and keep the cached client singleton. Only increment counters when the request is inside an active ALS context and the URL path is a DB path such as `/rest/v1/...`. [VERIFIED: codebase grep] [VERIFIED: local package]

**When to use:** Always for this phase, because every targeted route already reaches PostgREST through `getSupabaseAdminClient()`-backed repositories. [VERIFIED: codebase grep]

**Why this seam:** `supabase-js` passes the custom fetch to PostgREST, storage, auth, and functions clients, so filtering to `/rest/v1/` avoids counting storage/auth traffic from the same singleton. [VERIFIED: local package]

**Example:**
```ts
// Source: local Supabase client types + Node AsyncLocalStorage docs
import { AsyncLocalStorage } from 'node:async_hooks'

type RequestQueryStore = {
  requestMethod: string
  requestPath: string
  startedAt: number
  queryCount: number
  totalDbLatencyMs: number
  thresholdExceeded: boolean
  sampledRequests: string[]
}

const requestQueryStorage = new AsyncLocalStorage<RequestQueryStore>()

export function createTrackedSupabaseFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const store = requestQueryStorage.getStore()
    if (!store) {
      return baseFetch(input, init)
    }

    const url = new URL(typeof input === 'string' ? input : input.url)
    if (!url.pathname.startsWith('/rest/v1/')) {
      return baseFetch(input, init)
    }

    const startedAt = Date.now()
    try {
      return await baseFetch(input, init)
    } finally {
      const latencyMs = Date.now() - startedAt
      store.queryCount += 1
      store.totalDbLatencyMs += latencyMs
      // sample + threshold logic here
    }
  }
}
```

### Pattern 2: Route wrapper for non-streaming handlers, explicit flush inside `/api/agent`
**What:** Use one `withRequestQueryTracking(...)` helper to `run()` the ALS store and emit final logs for ordinary route handlers. For `/api/agent`, initialize the store at request start but flush metrics where the stream already logs completion/failure inside `handleAgentPost`. [VERIFIED: codebase grep]

**When to use:** Wrapper for `/api/session/[id]`, `/api/file/[sessionId]`, and `/api/session/[id]/generate`; explicit flush for `/api/agent` because the returned `Response` is streaming and route return time is not request completion time. [VERIFIED: codebase grep]

**Example:**
```ts
// Source: local route patterns
export async function GET(req: NextRequest, ctx: RouteContext) {
  return withRequestQueryTracking(req, async () => {
    return resolveAndRespond(req, ctx)
  })
}

// For /api/agent: create store at start, then flush at stream completion/failure.
```

### Anti-Patterns to Avoid
- **Do not create a new Supabase client per request.** The existing seam intentionally caches the admin client singleton. [VERIFIED: codebase grep]
- **Do not count all Supabase traffic.** The same client also powers storage/auth/functions fetches, so counting everything would corrupt DB query metrics. [VERIFIED: local package]
- **Do not emit one log per query in production.** The phase goal is request-scoped summary plus threshold warning, not per-query noise. [VERIFIED: 78-CONTEXT.md]
- **Do not widen the logging API just to carry rich samples unless necessary.** The current logger only accepts primitive field values, so sampled descriptors should be serialized into bounded strings or flat indexed fields. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async request scoping | Custom `async_hooks` bookkeeping | `AsyncLocalStorage` | Node explicitly recommends `AsyncLocalStorage` over custom implementations. [CITED: https://nodejs.org/api/async_context.html] |
| Global DB interception | Repo-by-repo wrappers | Supabase `global.fetch` seam | `supabase-js` already exposes the fetch hook, which reaches the active PostgREST transport. [VERIFIED: local package] |
| Route observability format | A new logger or metrics sink | Existing `logInfo` / `logWarn` / `logError` | The project already standardizes on structured server logs. [VERIFIED: CLAUDE.md] |

**Key insight:** The equivalent of Prisma query events in this codebase is not a new ORM layer; it is the PostgREST HTTP boundary inside the existing Supabase client. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Counting storage/auth traffic as DB queries
**What goes wrong:** `/api/file/[sessionId]` and generation flows can touch Supabase storage, which would inflate counts if every Supabase fetch is recorded. [VERIFIED: codebase grep] [VERIFIED: local package]
**Why it happens:** `supabase-js` reuses the configured fetch across PostgREST, storage, auth, and functions clients. [VERIFIED: local package]
**How to avoid:** Only count URLs under `/rest/v1/`; ignore `/storage/v1/`, `/auth/v1/`, and `/functions/v1/`. [VERIFIED: local package]
**Warning signs:** File-download routes exceed thresholds even when DB repository mocks stay flat. [INFERRED from verified sources]

### Pitfall 2: False inflation from built-in PostgREST retries
**What goes wrong:** A transient failure can create multiple observed HTTP DB requests for one logical client call. [CITED: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js]
**Why it happens:** In `supabase-js` v2.102.0+ PostgREST retries are enabled by default. [CITED: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js]
**How to avoid:** Treat the counter as observed DB HTTP requests, keep thresholds conservative, and log it as N+1 suspicion rather than proof. [INFERRED from verified sources]
**Warning signs:** Threshold warnings cluster around transient transport incidents rather than stable code paths. [INFERRED from verified sources]

### Pitfall 3: Logging request completion too early on streaming routes
**What goes wrong:** `/api/agent` would log low latency and incomplete query counts if the wrapper logs when the `Response` is created instead of when the stream ends. [VERIFIED: codebase grep]
**Why it happens:** The route returns an SSE `ReadableStream`, and the real work continues inside the stream callbacks. [VERIFIED: codebase grep]
**How to avoid:** Flush metrics inside `handleAgentPost` completion/failure branches that already emit `agent.request.stream_completed` or `agent.request.stream_failed`. [VERIFIED: codebase grep]
**Warning signs:** Query summaries show tiny latencies while agent logs still stream after the summary was emitted. [INFERRED from verified sources]

### Pitfall 4: Unbounded sampling and PII-heavy descriptors
**What goes wrong:** Query samples can create memory growth or leak user content into logs. [VERIFIED: 78-CONTEXT.md] [VERIFIED: CLAUDE.md]
**Why it happens:** PostgREST URLs can include long query strings and filters. [VERIFIED: local package]
**How to avoid:** Sample a small fixed number, truncate each descriptor, and store only method + normalized path + selected table/RPC identifier rather than full query strings. [VERIFIED: 78-CONTEXT.md]
**Warning signs:** Large log payloads or sampled strings containing resume/job text. [INFERRED from verified sources]

## Code Examples

Verified patterns from official and local sources:

### Configure the existing Supabase singleton with custom fetch
```ts
// Source: node_modules/@supabase/supabase-js/src/lib/types.ts
cachedSupabaseAdminClient = createClient(url, serviceRoleKey, {
  global: {
    fetch: createTrackedSupabaseFetch(fetch.bind(globalThis)),
  },
})
```

### Emit one summary and one threshold warning
```ts
// Source: local structured-log pattern
logInfo('db.request_queries', {
  requestMethod,
  requestPath,
  queryCount,
  dbLatencyMs: totalDbLatencyMs,
  latencyMs: Date.now() - startedAt,
  sampleCount: sampledRequests.length,
  sampledDbRequest1: sampledRequests[0],
})

if (queryCount > threshold) {
  logWarn('db.n_plus_one_threshold_exceeded', {
    requestMethod,
    requestPath,
    queryCount,
    threshold,
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma `$on('query')`-style counting on an ORM singleton | Transport-level interception via the active data client fetch seam | Current codebase runtime already uses Supabase admin client, not a live Prisma client. [VERIFIED: codebase grep] | The right unit is PostgREST DB HTTP requests, not ORM query events. [VERIFIED: codebase grep] |
| Manual async state plumbing | `AsyncLocalStorage` | Stable in Node since v16.4.0. [CITED: https://nodejs.org/api/async_context.html] | Lower-risk request scoping with less signature churn. [CITED: https://nodejs.org/api/async_context.html] |

**Deprecated/outdated:**
- Adding a dormant Prisma singleton only for instrumentation is outdated for this phase because it would not observe live route traffic. [VERIFIED: codebase grep]

## Assumptions Log

All material claims in this research were verified in this session or cited from official docs.

## Open Questions

1. **What exact default threshold should trigger the warning?**
   - What we know: The context requires a configurable threshold and N+1 suspicion logging. [VERIFIED: 78-CONTEXT.md]
   - What's unclear: No locked numeric default was provided. [VERIFIED: 78-CONTEXT.md]
   - Recommendation: Choose a conservative default in code plus env override, and keep the event wording as "suspicion". [INFERRED from verified sources]

2. **Should sample fields remain flat strings or should the logger type widen to allow arrays?**
   - What we know: `structured-log.ts` currently types fields as primitives only. [VERIFIED: codebase grep]
   - What's unclear: Whether wider structured log values are acceptable across the broader app. [VERIFIED: codebase grep]
   - Recommendation: Prefer flat indexed string fields for Phase 78 to avoid cross-cutting logger changes. [INFERRED from verified sources]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `AsyncLocalStorage`, Next route runtime, tests | ✓ | `v24.14.0` [VERIFIED: local command] | — |
| `@supabase/supabase-js` | Live DB seam instrumentation | ✓ | `2.103.0` [VERIFIED: local package] | — |
| `vitest` | Phase tests | ✓ | `1.6.1` [VERIFIED: local package] | — |

**Missing dependencies with no fallback:** None. [VERIFIED: local command]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.1` [VERIFIED: local package] |
| Config file | existing `vitest` project setup via repo scripts [VERIFIED: package.json] |
| Quick run command | `npx vitest run "src/lib/observability/request-query-context.test.ts" "src/lib/observability/request-query-tracking.test.ts" "src/app/api/agent/route.test.ts" "src/app/api/session/[id]/route.test.ts" "src/app/api/file/[sessionId]/route.test.ts" "src/app/api/session/[id]/generate/route.test.ts"` [VERIFIED: 78-CONTEXT.md] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PH78-1 | ALS store isolates counts per request and resets after completion | unit | `npx vitest run "src/lib/observability/request-query-context.test.ts"` | ❌ Wave 0 |
| PH78-2 | Supabase fetch wrapper counts `/rest/v1/` only and ignores non-DB paths | unit | `npx vitest run "src/lib/observability/request-query-tracking.test.ts"` | ❌ Wave 0 |
| PH78-3 | Threshold warning emits once when request count exceeds configured limit | unit | `npx vitest run "src/lib/observability/request-query-context.test.ts"` | ❌ Wave 0 |
| PH78-4 | `/api/session/[id]`, `/api/file/[sessionId]`, and `/api/session/[id]/generate` log request summary without changing behavior | route | `npx vitest run "src/app/api/session/[id]/route.test.ts" "src/app/api/file/[sessionId]/route.test.ts" "src/app/api/session/[id]/generate/route.test.ts"` | ✅ |
| PH78-5 | `/api/agent` flushes metrics at stream completion/failure, not at response creation | route | `npx vitest run "src/app/api/agent/route.test.ts"` | ✅ |

### Sampling Rate
- **Per task commit:** Run the targeted Vitest commands above. [VERIFIED: 78-CONTEXT.md]
- **Per wave merge:** Run `npm run typecheck` and the targeted Vitest commands. [VERIFIED: 78-CONTEXT.md]
- **Phase gate:** Full targeted suite plus `npm run typecheck` green before `/gsd-verify-work`. [VERIFIED: 78-CONTEXT.md]

### Wave 0 Gaps
- [ ] `src/lib/observability/request-query-context.test.ts` — request store lifecycle, threshold, bounded sampling. [INFERRED from verified sources]
- [ ] `src/lib/observability/request-query-tracking.test.ts` — URL classification and fetch instrumentation. [INFERRED from verified sources]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth model changes in this phase. [VERIFIED: codebase grep] |
| V3 Session Management | no | No session/token changes in this phase. [VERIFIED: codebase grep] |
| V4 Access Control | no | No authorization policy changes in this phase. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Normalize and truncate logged request descriptors; do not log raw query strings or resume text. [VERIFIED: CLAUDE.md] [VERIFIED: 78-CONTEXT.md] |
| V6 Cryptography | no | No new crypto or secrets handling is required. [VERIFIED: codebase grep] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sensitive query details leaking into logs | Information Disclosure | Log only normalized DB path descriptors, bound sample count, and truncate strings. [VERIFIED: 78-CONTEXT.md] |
| Cross-request counter leakage | Information Disclosure / Tampering | Create the store with `AsyncLocalStorage.run()` per request and do not hold mutable global counters. [CITED: https://nodejs.org/api/async_context.html] |
| Log amplification under hot paths | Denial of Service | Emit one summary and at most one threshold warning per request. [VERIFIED: 78-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)
- Node.js AsyncLocalStorage docs: https://nodejs.org/api/async_context.html - stable status, preferred usage, context-loss caveats.
- Supabase automatic retries docs: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js - `global.fetch` seam and default PostgREST retry behavior.
- Local installed `@supabase/supabase-js` source: `node_modules/@supabase/supabase-js/src/lib/types.ts`, `node_modules/@supabase/supabase-js/src/SupabaseClient.ts` - exact option shape and fetch fan-out across rest/storage/auth/functions.
- Local runtime seam and routes: `src/lib/db/supabase-admin.ts`, `src/lib/agent/request-orchestrator.ts`, `src/lib/routes/file-access/context.ts`, `src/lib/routes/session-generate/context.ts`, and targeted route files/tests.

### Secondary (MEDIUM confidence)
- npm registry metadata for `@supabase/supabase-js`, `vitest`, and `next` - current published versions and publish dates. [VERIFIED: npm registry]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - the phase reuses existing runtime libraries and official Node/Supabase capabilities. [VERIFIED: local package] [CITED: https://nodejs.org/api/async_context.html]
- Architecture: HIGH - the live seam and route lifecycle are directly visible in the codebase. [VERIFIED: codebase grep]
- Pitfalls: HIGH - the main pitfalls are directly implied by current route patterns, current logger types, and official Supabase retry behavior. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js]

**Research date:** 2026-04-21
**Valid until:** 2026-05-21
