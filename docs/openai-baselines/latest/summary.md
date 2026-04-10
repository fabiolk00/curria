# OpenAI Agent Baseline

- Window start: `2026-04-03T00:26:52.875Z`
- Generated at: `2026-04-10T00:26:54.274Z`

## Usage

| Endpoint | Calls | Models | Median Input | Median Output | Median Total | Median Cost (cents) | Total Cost (USD) |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| agent | 40 | gpt-5-nano | 3294 | 1840 | 4776 | 1 | 0.40 |
| gap_analysis | 25 | gpt-5-nano | 1575 | 1200 | 2775 | 1 | 0.25 |
| target_resume | 0 | n/a | 0 | 0 | 0 | 0 | 0.00 |

## Generation Summary

- Session outputs: ready=0, failed=2, generating=0, idle=19, missing=0
- Target resume outputs: ready=0, failed=0, generating=0, idle=0, missing=0

## Notes
- Token, model, and cost baselines come from api_usage.
- Turn-level truncation and empty-fallback rates now depend on structured logs emitted by agent.turn.completed and agent.response.* events.
- Use this report as the cost baseline before testing any agentModel promotion beyond combo_a.
