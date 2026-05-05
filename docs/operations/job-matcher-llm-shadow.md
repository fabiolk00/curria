# Job Matcher LLM Shadow

This rollout keeps the legacy/catalog matcher operational until cutover gates are approved. The LLM matcher runs only in shadow mode and records metrics under `job_targeting.matcher.llm.*`.

Prompt version: `job-matcher-llm-v4`
Model: `gpt-4.1-mini-2025-04-14`

Pricing audit:
- Source: https://platform.openai.com/docs/models/gpt-4.1-mini
- Consulted: 2026-05-05
- Input: USD 0.40 / 1M tokens
- Output: USD 1.60 / 1M tokens
- Formula: `(inputTokens / 1_000_000 * 0.40) + (outputTokens / 1_000_000 * 1.60)`

Manual protected validation:

```bash
npm run test:job-matcher:llm
```

Each golden case runs 3 times. Non-flexible cases require 3/3 exact allowed outcomes; flexible cases declare allowed outcomes in the script before execution.

Prompt change note:
`job-matcher-llm-v2` tightened the semantic contract for specific named tools,
adjacent bridge permissions, formal certifications, and end-to-end responsibility
wording after the first real golden run exposed ambiguous v1 behavior.
`job-matcher-llm-v3` further blocks adjacent classification for competing tools
and makes explicit end-to-end lifecycle evidence direct support after v2 returned
2/3 on two non-flexible cases.
`job-matcher-llm-v4` clarifies that related base technology or platform evidence
is adjacent, not unsupported, while still treating competing products as unsupported.
