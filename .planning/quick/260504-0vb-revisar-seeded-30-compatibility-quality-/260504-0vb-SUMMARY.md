# Quick Task 260504-0vb: Revisar seeded-30 compatibility quality sem usar legado

**Completed:** 2026-05-04
**Status:** Done

## What Changed

- Updated `.local/job-targeting-shadow-results/seeded-30-quality-review.md`.
- Re-reviewed the current `shadow-*-00x` seeded export instead of the older review content.
- Ignored legacy impact fields as requested.

## Result

```json
{
  "approve_assessment": 0,
  "score_too_harsh": 1,
  "score_too_generous": 18,
  "missed_clear_evidence": 2,
  "false_supported_requirement": 18,
  "false_critical_gap": 0,
  "missing_real_gap": 18,
  "requirement_extraction_issue": 30,
  "needs_manual_review": 0,
  "OpenAICalls": 0
}
```

## Key Finding

The current seeded compatibility run is operationally healthy but not quality-green:

- Seed/test metadata from target job descriptions is being extracted as requirements.
- Negative CV evidence such as `nao possui` and `nao registra experiencia direta` is being treated as positive evidence in many adjacent/low cases.

Recommendation: do not run rewrite validation yet. First strip/ignore seed metadata and add a negative-evidence guard, then re-run zero-cost compatibility.
