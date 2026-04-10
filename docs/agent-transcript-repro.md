---
title: Agent Transcript Replay
audience:
  - operators
  - developers
related:
  - ./agent-runtime-parity.md
  - ./openai/README.md
  - ./launch-readiness.md
status: current
updated: 2026-04-10
---

# Agent Transcript Replay

Use this runbook when a deployed chat turn looks wrong to the user even though the backend fixes are already merged.

The replay flow is intentionally paired with the Phase 5 parity check:

1. prove which `/api/agent` build is serving traffic
2. replay the representative vacancy -> `reescreva` sequence
3. capture the exact SSE transcript and final assistant text

## When To Use This

Run this after a deploy or when you need to investigate a user-visible transcript issue such as:

- repeated vacancy bootstrap text
- a `reescreva` follow-up that returns the wrong continuation
- a visible assistant bubble that does not match the backend recovery behavior proven in tests

## Step 1: Confirm Runtime Parity First

Before replaying the dialog, verify the deployment is actually serving the expected release and model contract:

```bash
npm run agent:parity -- \
  --url https://your-app.example.com \
  --expected-release abc123def456 \
  --expected-release-source vercel_commit \
  --expected-agent-model gpt-5-mini \
  --expected-dialog-model gpt-5-mini
```

If parity fails, stop there. Do not trust transcript debugging until the deployment matches the expected release.

## Step 2: Capture the Representative Dialog Replay

Export an authenticated app cookie from a browser session that already has profile data and available credits, then run:

```bash
npm run agent:replay-dialog -- \
  --url https://your-app.example.com \
  --cookie "__session=..." \
  --format markdown \
  --output test-results/agent-replay.md
```

What this does:

- sends the representative vacancy text to `/api/agent`
- reuses the returned session ID for a follow-up `reescreva`
- captures safe provenance headers from both turns
- stores the SSE event sequence and final assistant text

You can override the built-in representative prompts if needed:

```bash
npm run agent:replay-dialog -- \
  --url https://your-app.example.com \
  --cookie "__session=..." \
  --vacancy-text "Cole aqui a vaga exata" \
  --follow-up-text "reescreva meu resumo" \
  --format json
```

## What Good Output Looks Like

The replay artifact should show:

- the same `X-Agent-Release` and model headers across both turns
- a session ID from the vacancy turn that is reused by the follow-up turn
- non-empty final assistant text for the `reescreva` follow-up
- no fallback backslide into the old vacancy bootstrap acknowledgement

## Compare With Repo Verification

If the live replay looks suspicious, compare it with the focused repo checks:

```bash
npm test -- \
  src/components/dashboard/chat-interface.test.tsx \
  src/components/dashboard/chat-interface.route-stream.test.tsx \
  src/app/api/agent/route.model-selection.test.ts \
  src/app/api/agent/route.sse.test.ts \
  scripts/replay-agent-dialog.test.ts

npm run test:e2e -- tests/e2e/chat-transcript.spec.ts --project=chromium
```

Interpretation:

- repo checks pass, live replay fails: deployment or runtime config drift
- repo checks fail too: regression is reproducible locally and should be fixed before further rollout
- parity fails before replay: solve deployment mismatch first

## Artifact Handling

The replay artifact never stores the auth cookie, but it does include:

- request URL
- release and model headers
- session IDs
- SSE events
- final assistant text

Treat the output as internal diagnostic evidence and store it with the incident or deploy notes.
