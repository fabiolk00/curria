# Shadow Cases

This directory is reserved for non-sensitive synthetic shadow cases.

Real production cases must be anonymized and stored outside git under:

```txt
.local/job-targeting-shadow-cases/
```

Rules:

- Do not commit real names, emails, phone numbers, addresses, LinkedIn URLs, internal IDs, or sensitive company names.
- Preserve skills, career structure, seniority signals, and job-description requirements.
- Set `metadata.anonymized=true` for every real anonymized case.

Expected JSONL shape:

```ts
type JobTargetingShadowCase = {
  id: string
  source: 'real_anonymized' | 'synthetic' | 'golden' | 'manual_review'
  domain?: string
  cvState: CVState
  targetJobDescription: string
  gapAnalysis?: GapAnalysisResult
  metadata?: {
    originalSessionId?: string
    createdAt?: string
    anonymized: boolean
  }
}
```

If `gapAnalysis` is omitted, the batch runner uses a deterministic synthetic fallback unless `--use-real-gap-analysis` is provided. Synthetic fallback runs are useful for smoke/regression, but the analyzer marks them as `pipelineRepresentativeness=partial`.

Use the anonymizer for raw local exports:

```bash
tsx scripts/job-targeting/export-shadow-cases.ts \
  --input .local/job-targeting-shadow-cases/raw.jsonl \
  --output .local/job-targeting-shadow-cases/cases.jsonl
```
