import { describe, expect, it } from 'vitest'

import {
  TABLE_CONVENTIONS,
  auditDatabaseConventions,
  formatAuditFindings,
} from './schema-guardrails'

describe('database schema guardrails', () => {
  it('classifies the credit reservation billing tables explicitly', () => {
    expect(TABLE_CONVENTIONS.credit_reservations).toBeDefined()
    expect(TABLE_CONVENTIONS.credit_ledger_entries).toBeDefined()
  })

  it('keeps managed tables and SQL functions aligned with id and timestamp conventions', () => {
    const findings = auditDatabaseConventions(process.cwd())

    expect(findings, formatAuditFindings(findings)).toEqual([])
  })
})
