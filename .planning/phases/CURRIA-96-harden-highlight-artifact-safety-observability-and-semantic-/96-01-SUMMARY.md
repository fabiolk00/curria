## Summary

- Hardened highlight segmentation so direct callers no longer duplicate text when ranges are unsorted, duplicated, overlapping, or partially out of bounds.
- Switched experience-bullet `itemId` generation from positional indices to semantic hash-based identities, while preserving `experienceIndex` and `bulletIndex` as debug metadata.
- Tightened highlight detection observability by distinguishing invalid model payloads from valid empty results and emitting explicit warn/metric signals.
- Strengthened prompt and local validation guardrails to prefer compact phrase-level spans and reject visually noisy long-range highlights by default.
