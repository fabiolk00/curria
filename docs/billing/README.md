---
title: Billing Documentation
audience: [developers, operations]
related:
  - ../INDEX.md
  - IMPLEMENTATION.md
status: current
updated: 2026-04-07
---

# Billing Documentation

Use this folder for the canonical billing and credit-system documentation.

- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - billing architecture, trust model, and webhook semantics
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - migration and rollout notes
- [MONITORING.md](./MONITORING.md) - alerts, queries, and operator workflows
- [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) - operational fixes and incident handling

Recent additions covered by these docs:

- checkout billing-info normalization and Asaas `customerData.phone` mapping
- webhook reconciliation for one-time payments that arrive with `checkoutSession` but no `externalReference`
- UI display-total persistence for dynamic credit denominators in the dashboard
- hardening of generic text primary-key generation so billing and app writes do not depend on missing schema defaults

Historical validation snapshots were removed on purpose. For current rollout verification, use:

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- [../staging/VALIDATION_PLAN.md](../staging/VALIDATION_PLAN.md)
- [../PRODUCTION-READINESS-CHECKLIST.md](../PRODUCTION-READINESS-CHECKLIST.md)
- [../database-conventions.md](../database-conventions.md)
