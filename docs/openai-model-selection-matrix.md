# OpenAI Model Selection Matrix

## Goal

CurrIA already runs on OpenAI. The remaining question is which OpenAI model combination gives the best cost and quality tradeoff for Brazilian Portuguese resume writing.

This document defines the bakeoff that compares three routing combinations across the same 10 resume samples.

## Current default

The codebase currently defaults to `combo_a` in [config.ts](/c:/CurrIA/src/lib/agent/config.ts):

- `agent`: `gpt-4o-mini`
- `structured`: `gpt-4o-mini`
- `vision`: `gpt-4o-mini`

## Combinations to test

| Combination | Agent | Structured | Vision | Estimated cost per sample |
| --- | --- | --- | --- | --- |
| `combo_a` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` | `$0.08-$0.12` |
| `combo_b` | `gpt-4o` | `gpt-4o-mini` | `gpt-4o-mini` | `$0.15-$0.25` |
| `combo_c` | `gpt-4-turbo` | `gpt-4-turbo` | `gpt-4-turbo` | `$0.30-$0.60` |

## Required samples

### Sample 01 - Junior Tech - Weak Summary

Original:

```text
Sou desenvolvedor de software com experiencia em Java.
Trabalho bem em equipe e sigo as boas praticas.
```

Instruction:
- showcase 2 technical achievements
- use strong action verbs
- make the text ATS-friendly
- keep it under 100 words

### Sample 02 - Mid-Level QA - Weak Bullets

Original:

```text
Testei varios sistemas. Encontrei bugs. Reportei para o time.
Participei de reunioes de planejamento.
```

Instruction:
- quantify impact
- use metrics such as test coverage and automation gains
- show business value
- keep a professional tone

### Sample 03 - Senior Backend - Weak Skills

Original:

```text
Programacao
Java, Python, Go
Arquitetura de sistemas
Lideranca tecnica
```

Instruction:
- add proficiency levels
- include frameworks and tools such as Spring, FastAPI, and gRPC
- organize by category
- make the result ATS-scannable

### Sample 04 - Sales - Weak Bullets

Original:

```text
Vendeu produtos de software. Atingiu meta de vendas.
Treinou o time de vendas.
```

Instruction:
- quantify revenue
- show growth metrics such as YoY growth and deals closed
- highlight team impact
- keep Brazilian business context

### Sample 05 - Marketing - Weak Summary

Original:

```text
Sou profissional de marketing com experiencia em digital.
Gosto de trabalhar em equipe.
```

Instruction:
- lead with measurable impact such as ROI
- mention specialties
- use marketing terminology
- keep B2B and SaaS context

### Sample 06 - Finance - Weak Education

Original:

```text
Graduacao em Contabilidade
Curso de Excel
```

Instruction:
- expand with university name, year, and GPA
- include certifications such as CFC
- include relevant professional courses
- keep finance-industry context

### Sample 07 - Operations - Weak Bullets

Original:

```text
Organizei processos. Melhorei eficiencia. Ajudei o time.
```

Instruction:
- quantify improvements such as time saved
- specify tools
- show operational impact
- use supply-chain terminology

### Sample 08 - Healthcare - Weak Summary

Original:

```text
Enfermeira experiente em cuidados de pacientes.
Boa comunicacao com pacientes.
```

Instruction:
- highlight specialties
- show leadership
- include certifications such as COREN
- mention patient-outcome context

### Sample 09 - Legal - Weak Certifications

Original:

```text
Certificado em Compliance
Curso de Direito Corporativo
```

Instruction:
- expand with full certification names such as OAB and CCJE
- include specializations
- include validity and renewal information
- mention LGPD and CVM expertise

### Sample 10 - Career Change - Weak Transition

Original:

```text
Tenho experiencia em varejo mas quero mudar para tecnologia.
Aprendi programacao e sou dedicado.
```

Instruction:
- bridge retail experience to tech value
- highlight tech skills
- show transition readiness
- create a strong tech-market entry narrative

## Evaluation rubric

Score each output from `1` to `5` on:

- Grammar and spelling
- Vocabulary and naturalness
- Professional tone
- Industry terminology
- Readability and impact

Average score per output:

```text
(grammar + vocabulary + tone + terminology + readability) / 5
```

## Test protocol

For each sample:

1. Run the prompt through `combo_a`
2. Run the same prompt through `combo_b`
3. Run the same prompt through `combo_c`
4. Remove model labels before evaluation
5. Have a native Brazilian Portuguese speaker score all three outputs
6. Record quality and cost in [portuguese-quality-test-results.md](/c:/CurrIA/docs/portuguese-quality-test-results.md)

### Automation command

Use this command to generate all 30 outputs, the blind-review packet, and the private mapping file:

```bash
npm run phase1:model-selection
```

Expected requirements:

- `OPENAI_API_KEY` must be configured in `.env` or the shell environment

Generated artifacts:

- `docs/openai-model-selection-runs/<run-id>/blind-review.md`
- `docs/openai-model-selection-runs/<run-id>/raw-results.json`
- `docs/openai-model-selection-runs/<run-id>/summary.md`
- `docs/openai-model-selection-runs/latest/` mirrored copies for the most recent run

## Blind review procedure

Use the same blind-review workflow for every sample so the evaluator is not influenced by model expectations.

### Preparation

1. Generate the three outputs for the same sample.
2. Copy them into a temporary evaluation sheet in this neutral format:

```md
## Sample 01

### Output X
[paste output]

### Output Y
[paste output]

### Output Z
[paste output]
```

3. Randomize the order for each sample.
   - Example: for Sample 01, `X=combo_b`, `Y=combo_a`, `Z=combo_c`
   - for Sample 02, use a different order
4. Keep the mapping in a separate private note that the evaluator cannot see.

### Evaluation rules

- never show `combo_a`, `combo_b`, or `combo_c` labels to the evaluator
- do not tell the evaluator which output is the current default
- do not discuss expected cost before scoring
- ask the evaluator to score `Output X`, `Output Y`, and `Output Z` independently on all 5 rubric dimensions
- ask for short qualitative comments after scoring, not before

### After scoring

1. Convert `Output X`, `Output Y`, and `Output Z` back to their real combo names using the private mapping.
2. Transfer the scores into [portuguese-quality-test-results.md](/c:/CurrIA/docs/portuguese-quality-test-results.md).
3. Record the per-sample winner and any repeated concerns.

This procedure keeps the review repeatable and reduces bias from model reputation or expected pricing.

## Example scored output

This example shows what a fully scored output block should look like once the evaluator finishes one output.

### Example

- Sample: `Sample 01 - Junior Tech - Weak Summary`
- Scored output label: `Output Y`
- Notes: strong grammar, professional wording, but slightly generic terminology

Scores:

- Grammar and spelling: `5`
- Vocabulary and naturalness: `4`
- Professional tone: `5`
- Industry terminology: `4`
- Readability and impact: `5`

Average:

```text
(5 + 4 + 5 + 4 + 5) / 5 = 4.6
```

Interpretation:

- this output is production-usable
- the text reads naturally in Brazilian Portuguese
- the evaluator noticed only minor weakness in terminology depth, not enough to block approval

## Decision logic

- `combo_a` wins if it reaches `>= 4.0` average quality and shows no systematic Portuguese issues
- `combo_b` wins if `combo_a` is below `4.0` but `combo_b` reaches `>= 4.0`, or if `combo_b` produces a meaningful quality improvement worth the extra cost
- `combo_c` wins if both `combo_a` and `combo_b` are below `4.0`, or if only `combo_c` produces production-ready quality

Tiebreakers:

- if all combinations are `>= 4.0`, choose the cheapest
- if all combinations are `< 4.0`, choose the best quality and hold rollout until the risk is accepted explicitly

## Deliverables

After the test run, record:

- average quality per combination
- average cost per sample per combination
- wins or ties by sample
- repeated quality issues
- final selected combination

Reflect the final decision in:

- [config.ts](/c:/CurrIA/src/lib/agent/config.ts)
- [README.md](/c:/CurrIA/README.md)
- [CLAUDE.md](/c:/CurrIA/CLAUDE.md)
