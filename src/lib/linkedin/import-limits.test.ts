import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_MESSAGE,
  LinkedInImportLimitError,
  PAID_LINKEDIN_IMPORT_LIMIT_MESSAGE,
  toLinkedInImportLimitError,
} from './import-limits'

describe('toLinkedInImportLimitError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the free-trial RPC rejection to a user-facing limit error', () => {
    expect(
      toLinkedInImportLimitError({
        message: 'FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_REACHED',
      }),
    ).toMatchObject({
      message: FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_MESSAGE,
      code: 'LINKEDIN_IMPORT_LIMIT_REACHED',
      status: 429,
    } satisfies Partial<LinkedInImportLimitError>)
  })

  it('maps the paid hourly RPC rejection and preserves retry-after', () => {
    expect(
      toLinkedInImportLimitError({
        message: 'PAID_LINKEDIN_IMPORT_RATE_LIMIT_REACHED',
        details: '347',
      }),
    ).toMatchObject({
      message: PAID_LINKEDIN_IMPORT_LIMIT_MESSAGE,
      code: 'LINKEDIN_IMPORT_LIMIT_REACHED',
      status: 429,
      retryAfterSeconds: 347,
    } satisfies Partial<LinkedInImportLimitError>)
  })

  it('returns null for unrelated failures', () => {
    expect(
      toLinkedInImportLimitError({
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBeNull()
  })
})
