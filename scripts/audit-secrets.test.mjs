import { describe, expect, it } from 'vitest'

import {
  ALLOWED_TRACKED_ENV_FILES,
  SECRET_ASSIGNMENT_NAMES,
  extractAssignedCandidates,
  findSecretAssignments,
  isTrackedEnvFilePath,
  looksPlaceholder,
} from './audit-secrets.mjs'

describe('audit-secrets helpers', () => {
  it('catches literal fallback secrets after process.env expressions', () => {
    const findings = findSecretAssignments(
      'scripts/example.mjs',
      "OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'live-secret-value',",
    )

    expect(findings).toEqual([
      {
        path: 'scripts/example.mjs',
        line: 1,
        reason: 'Suspicious committed value for OPENAI_API_KEY',
      },
    ])
  })

  it('extracts only committed string literals from process.env fallback expressions', () => {
    expect(
      extractAssignedCandidates("process.env.CRON_SECRET ?? 'fallback-secret'"),
    ).toEqual(['fallback-secret'])
  })

  it('does not treat generic test or sandbox strings as safe placeholders', () => {
    expect(looksPlaceholder('test-secret-123')).toBe(false)
    expect(looksPlaceholder('sandbox-token-456')).toBe(false)
    expect(looksPlaceholder('sk_test_1234567890abcdef')).toBe(false)
  })

  it('still allows the committed fake placeholder values used in templates and CI', () => {
    expect(looksPlaceholder('dummy')).toBe(true)
    expect(looksPlaceholder('sk-test-dummy')).toBe(true)
    expect(looksPlaceholder('sk_test_replace_me')).toBe(true)
    expect(looksPlaceholder('https://your-project.supabase.co')).toBe(true)
  })

  it('covers database and cron secrets in the assignment allowlist', () => {
    expect(SECRET_ASSIGNMENT_NAMES.has('DATABASE_URL')).toBe(true)
    expect(SECRET_ASSIGNMENT_NAMES.has('DIRECT_URL')).toBe(true)
    expect(SECRET_ASSIGNMENT_NAMES.has('CRON_SECRET')).toBe(true)
    expect(SECRET_ASSIGNMENT_NAMES.has('STAGING_DB_URL')).toBe(true)
  })

  it('treats nested env files as tracked env files but only allows the root templates', () => {
    expect(isTrackedEnvFilePath('docs/.env.staging')).toBe(true)
    expect(isTrackedEnvFilePath('tests/fixtures/.env')).toBe(true)
    expect(ALLOWED_TRACKED_ENV_FILES.has('docs/.env.staging')).toBe(false)
    expect(ALLOWED_TRACKED_ENV_FILES.has('.env.example')).toBe(true)
  })
})
