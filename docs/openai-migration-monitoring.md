# OpenAI Model Selection Monitoring

This document defines the minimum monitoring needed for OpenAI model selection and rollout.

It focuses on:

- error rate
- cost
- latency
- output-format health
- rollout safety

## Core model routing to monitor

Current default routing from [config.ts](/c:/CurrIA/src/lib/agent/config.ts):

- active combo: `combo_a`
- `agent`: `gpt-5-nano`
- `structured`: `gpt-5-nano`
- `vision`: `gpt-5-nano`

Supported combinations:

- `combo_a`: all `gpt-5-nano`
- `combo_b`: all `gpt-5-nano`
- `combo_c`: all `gpt-5-nano`

## Metric 1 - API usage by model

Source:
- `api_usage`
- written by [usage-tracker.ts](/c:/CurrIA/src/lib/agent/usage-tracker.ts)

Purpose:
- confirm the app is using the intended model per endpoint
- detect accidental combo drift

Example query:

```sql
SELECT
  model,
  endpoint,
  COUNT(*) AS calls,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(cost_cents) AS cost_cents
FROM api_usage
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY model, endpoint
ORDER BY cost_cents DESC;
```

Alert:
- investigate if `agent`, `rewriter`, `ocr`, `gap_analysis`, or `target_resume` are using an unexpected model
- investigate if the selected `OPENAI_MODEL_COMBO` does not match observed runtime usage

## Metric 2 - Daily cost baseline

Purpose:
- verify cost stays within the expected rollout range

Example query:

```sql
SELECT
  DATE(created_at) AS day,
  SUM(cost_cents) / 100.0 AS cost_usd
FROM api_usage
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

Initial target:
- expected monthly range should be recalculated after the cheaper `gpt-5-nano` rollout settles in production

Alert:
- investigate if the 3-day average projects materially above the expected range

## Metric 3 - Error rate

Primary source:
- structured logs from `/api/agent` and tool execution

Watch for:
- `agent.request.failed`
- `agent.tool.failed`
- `LLM_INVALID_OUTPUT`
- `INTERNAL_ERROR`
- `RATE_LIMITED`

Example query pattern:

```sql
SELECT
  COUNT(*) FILTER (WHERE metadata->>'success' = 'false') AS failed_events,
  COUNT(*) AS total_events
FROM logs
WHERE message IN ('agent.request.completed', 'agent.request.failed')
  AND timestamp > NOW() - INTERVAL '24 hours';
```

Target:
- error rate `< 1%`

Alert:
- page if the error rate exceeds `1%` over a rolling 1-hour or 24-hour window

## Metric 4 - LLM invalid output rate

Purpose:
- detect prompt or model regressions in structured tools

Example query:

```sql
SELECT
  metadata->>'toolName' AS tool_name,
  COUNT(*) AS invalid_output_count
FROM logs
WHERE metadata->>'errorCode' = 'LLM_INVALID_OUTPUT'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'toolName'
ORDER BY invalid_output_count DESC;
```

Alert:
- any spike in `rewrite_section`, `analyze_gap`, `resume_ingestion`, or `create_target_resume`

## Metric 5 - Agent latency

Purpose:
- validate the selected combo does not materially regress UX

Primary source:
- `latencyMs` on `agent.request.completed`

Example query:

```sql
SELECT
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'latencyMs')::numeric) AS p95_latency_ms
FROM logs
WHERE message = 'agent.request.completed'
  AND timestamp > NOW() - INTERVAL '24 hours';
```

Target:
- p95 latency `< 10000 ms`

Alert:
- investigate if p95 exceeds 10 seconds consistently

## Metric 6 - Portuguese quality feedback

Purpose:
- validate real-world text quality after the pt-BR gate

Operationally track:
- support tickets about awkward wording
- recruiter or user complaints about resume quality
- repeated manual editing after AI rewrite

Trigger:
- any recurring complaint pattern in the first 7 days should be reviewed against the selected combo

## Launch-day dashboard

At minimum, create one dashboard showing:

- calls by model and endpoint
- daily cost
- error rate
- `LLM_INVALID_OUTPUT` counts by tool
- agent p95 latency

## Launch alerts

- Error rate > `1%`
- p95 latency > `10s`
- unexpected model usage
- abnormal cost spike
- repeated `LLM_INVALID_OUTPUT`
