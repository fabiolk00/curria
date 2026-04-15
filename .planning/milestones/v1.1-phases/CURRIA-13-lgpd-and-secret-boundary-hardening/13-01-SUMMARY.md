# 13-01 Summary

Defined the LGPD-oriented handling contract for CurrIA data flows in `docs/operations/lgpd-data-handling.md`, covering:

- canonical resume and profile data
- vacancy and targeting context
- generated resume artifacts
- ephemeral import jobs
- billing and audit metadata

The document now ties retention, deletion, and logging expectations to real product seams instead of generic compliance language.

Verification:

- `pnpm tsc --noEmit`
- review of `docs/operations/lgpd-data-handling.md` against current profile, session, versioning, and cleanup flows
