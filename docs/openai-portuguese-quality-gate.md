# Brazilian Portuguese Quality Gate - OpenAI Model Selection

## Goal

This document defines the mandatory pt-BR language quality gate before locking the final OpenAI model routing for production.

CurrIA already runs on OpenAI in code. What remains is selecting the best OpenAI model combination for Brazilian Portuguese resume quality and cost.

Use this document together with:

- [openai-model-selection-matrix.md](/c:/CurrIA/docs/openai-model-selection-matrix.md)
- [portuguese-quality-test-results.md](/c:/CurrIA/docs/portuguese-quality-test-results.md)

## Decision question

Which OpenAI model combination produces Brazilian Portuguese resume output that is strong enough for production at the lowest acceptable cost?

The tested combinations are:

- `combo_a`: all `gpt-4o-mini`
- `combo_b`: `gpt-4o` for agent and `gpt-4o-mini` for structured and vision
- `combo_c`: all `gpt-4-turbo`

## Mandatory decision rule

- `combo_a` is acceptable only if its final average is `>= 4.0/5.0`
- if `combo_a` is below `4.0`, evaluate whether `combo_b` clears the quality bar
- if both `combo_a` and `combo_b` are below `4.0`, evaluate whether `combo_c` is the only production-safe option
- if every tested combination is below `4.0`, hold rollout and escalate before changing production defaults

If the result is close or debatable, quality wins over cost.

## Test scope

The gate must cover the OpenAI flows most sensitive to writing quality:

- `rewrite_section`
- `create_target_resume`
- conversational agent responses that guide resume improvement

Analytical and structured flows such as ingestion, gap analysis, and OCR may be observed during the test run, but they are not the primary focus of this language gate. The focus is text the user could realistically send to a recruiter.

## Evaluator requirements

- native Brazilian Portuguese speaker
- ideally someone with recruiting, HR, resume review, or career guidance experience
- must evaluate final output, not model preference
- must use the same rubric across all samples

## Test setup

### Required samples

Run the gate with 10 samples covering a diverse set of profiles:

1. Intern or junior in technology
2. Mid-level technology professional
3. Senior technology professional
4. Sales or commercial
5. Marketing or content
6. Finance or administrative
7. Operations or logistics
8. Healthcare
9. Legal or compliance
10. Career-change or weak generic resume

### Recommended distribution

- 5 samples focused on `rewrite_section`
- 3 samples focused on `create_target_resume`
- 2 samples focused on conversational agent output

### Required input material

For each sample, prepare:

- the original weak resume section or source text
- the exact same instruction or prompt for all tested combinations
- the target job description when applicable
- the exercised operation

## Comparison protocol

For each sample:

1. run `combo_a` with the original prompt
2. run `combo_b` with the same prompt and same input
3. run `combo_c` with the same prompt and same input
4. remove any visible model label before human evaluation
5. ask the evaluator to score all outputs using the rubric below
6. record short qualitative comments and cost per sample

### Protocol rules

- same input for every tested combination
- same prompt
- no manual editing before evaluation
- compare final output, not latency
- store raw outputs for later audit if needed

## Evaluation rubric

Use a 1 to 5 scale for each dimension.

### 1. Grammar and spelling

- 1: frequent errors, low-confidence output
- 3: minor slips, still acceptable
- 5: flawless for professional use

### 2. Vocabulary and naturalness

- 1: sounds translated, robotic, or artificial
- 3: partly natural, but inconsistent
- 5: natural Brazilian Portuguese for a professional context

### 3. Professional tone

- 1: too casual, too exaggerated, or inappropriate
- 3: acceptable, but generic
- 5: professional, credible, and appropriate for a resume

### 4. Industry terminology precision

- 1: inaccurate or weak terminology
- 3: functional but shallow
- 5: precise language for the candidate's field and seniority

### 5. Readability and impact

- 1: would require substantial rewriting
- 3: usable with adjustments
- 5: clear, strong, and close to ready for use

## Data collection template

Use this block for each sample:

```md
## Sample 01

- Operation:
- Profile:
- Prompt used:
- Input summary:

### Combo A
- Grammar:
- Vocabulary:
- Professional tone:
- Terminology:
- Readability/impact:
- Average:
- Cost:
- Comments:

### Combo B
- Grammar:
- Vocabulary:
- Professional tone:
- Terminology:
- Readability/impact:
- Average:
- Cost:
- Comments:

### Combo C
- Grammar:
- Vocabulary:
- Professional tone:
- Terminology:
- Readability/impact:
- Average:
- Cost:
- Comments:

### Comparison
- Winner:
- Perceived difference:
- Is the winner production-ready for this sample? Yes/No
```

Record the final scored outputs in:

- [portuguese-quality-test-results.md](/c:/CurrIA/docs/portuguese-quality-test-results.md)

## Final consolidation

After all 10 samples, consolidate:

- global average for each combination
- average cost per sample for each combination
- average by operation when relevant
- strongest qualities by combination
- recurring weaknesses by combination
- final recommendation: `COMBO_A`, `COMBO_B`, `COMBO_C`, or `HOLD`

## Mandatory action by result

### If Combo A wins

- set `OPENAI_MODEL_COMBO=combo_a`
- update docs to show `gpt-5-mini` across agent, structured, and vision
- deploy the cheaper routing

### If Combo B wins

- keep `OPENAI_MODEL_COMBO=combo_b`
- keep the current routing:
  - `agent`: `gpt-5.4-mini`
  - `structured`: `gpt-5-mini`
  - `vision`: `gpt-5-mini`
- document why the extra quality justified the extra cost

### If Combo C wins

- set `OPENAI_MODEL_COMBO=combo_c`
- update docs to show `gpt-5` across agent, structured, and vision
- document why only the premium routing met quality expectations

### If all combinations fail

- do not change the current production default automatically
- keep the best-known safe combination in place until a product decision is made
- investigate prompt changes, targeted routing, or a renewed provider evaluation

## Recommended timeline

- sample preparation: 30 min
- API runs: 2 h
- human evaluation: 2 to 3 h
- final consolidation: 30 min

Estimated total: 5 to 6 hours

## Gate invariants

- this gate is mandatory
- this gate decides the final production model combination
- passing technical tests does not replace this evaluation
- the final model routing should only be committed and pushed after this result
