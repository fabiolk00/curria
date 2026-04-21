# Real Resume Freeze Gate

## Purpose

Freeze the ATS enhancement preview semantics after repo-local contracts are green, then validate the behavior on 15 real resumes.

## Repo-local truth

- The repo now has explicit automated contracts for summary and experience preview semantics.
- PDF export behavior is intentionally outside this change set and must remain unchanged.
- The repo does not include a committed corpus of 15 real user resumes, so this gate must be run manually with real inputs in a safe environment.

## Rating rubric

Rate each resume preview as:

- `good`: summary is clean and readable, no leakage, experience highlighting feels intentional
- `acceptable`: minor roughness, but contracts hold and preview is product-acceptable
- `poor`: contracts may hold, but preview still feels noisy, misleading, or low-value
- `fail`: one of the freeze contracts is broken

## Hard fail checks per resume

1. Summary has zero green semantic highlights.
2. Summary shows no raw JSON/object leakage.
3. Experience has zero full-line highlights.
4. No bullet has more than one highlighted span.
5. No experience entry highlights more than two bullets.
6. ATS-relevant inline skills only highlight when contextual.
7. No-target ATS summary contains no `Resumo Profissional:` or `Professional Summary:` prefix inside content.

## Pass rule

- At least `12/15` rated `good` or `acceptable`
- No more than `2/15` rated `poor`
- `0/15` rated `fail`

## Validation sheet

| Resume | Summary clean | No leakage | No full-line exp | <=1 span/bullet | <=2 bullets/entry | Contextual ATS skills | No internal summary label | Rating | Notes |
|--------|---------------|------------|------------------|-----------------|-------------------|-----------------------|---------------------------|--------|-------|
| 01 |  |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |  |
| 04 |  |  |  |  |  |  |  |  |  |
| 05 |  |  |  |  |  |  |  |  |  |
| 06 |  |  |  |  |  |  |  |  |  |
| 07 |  |  |  |  |  |  |  |  |  |
| 08 |  |  |  |  |  |  |  |  |  |
| 09 |  |  |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  |  |
| 11 |  |  |  |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |  |  |  |
| 14 |  |  |  |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |  |  |  |

## Outcome summary

- Good:
- Acceptable:
- Poor:
- Fail:
- Result: `pending`
