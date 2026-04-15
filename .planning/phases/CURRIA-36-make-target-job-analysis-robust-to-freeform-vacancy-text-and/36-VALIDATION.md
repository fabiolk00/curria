# Phase 36 Validation

Phase 36 only succeeds if freeform vacancy text can drive a grounded job-targeting plan without brittle title parsing becoming the main failure mode.

Validation focus:

- job targeting must keep working when the vacancy contains headings, recruiter prose, or no explicit role label
- the system must still prioritize vacancy semantics such as skills and responsibilities
- the rewrite flow must reduce preventable `skills` validation failures without weakening honesty guarantees
- the user-facing failure explanation must better distinguish factual blockers from likely vacancy-parsing bugs

Evidence required:

- targeting-plan tests for heading-heavy and prose-heavy vacancy text
- pipeline or rewrite regressions proving unsupported skills are sanitized back to grounded resume evidence before final validation
- workspace-modal proof for expanded suspicious-role detection where helpful

Failure conditions:

- `targetRole` still ends up as obvious headings or long recruiter sentences
- the rewrite prompt still depends on `targetRole` as the primary anchor when confidence is low
- unsupported vacancy-only skills continue to fail whole runs even when the original resume provides enough grounded overlap to produce a useful output
