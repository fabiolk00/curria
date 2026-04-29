import { describe, expect, it } from 'vitest'

import { formatExternalReference, parseExternalReference } from './external-reference'

describe('Asaas externalReference formatting', () => {
  it('formats and parses the compact v1 externalReference format', () => {
    const value = formatExternalReference('usr_123', 'chk_456')

    expect(value).toBe('curria:v1:c:chk_456')
    expect(parseExternalReference(value)).toEqual({
      version: 'v1',
      checkoutReference: 'chk_456',
    })
  })

  it('parses the strict legacy app user format only', () => {
    expect(parseExternalReference('usr_ABC123')).toEqual({
      version: 'legacy',
      appUserId: 'usr_ABC123',
    })
    expect(parseExternalReference('u_123')).toBeNull()
    expect(parseExternalReference('usr-invalid')).toBeNull()
  })

  it('continues to parse previously-issued v1 references that included the app user id', () => {
    expect(parseExternalReference('curria:v1:u:usr_123:c:chk_456')).toEqual({
      version: 'v1',
      appUserId: 'usr_123',
      checkoutReference: 'chk_456',
    })
  })

  it('rejects invalid formats and invalid formatting inputs', () => {
    expect(parseExternalReference('curria:v2:c:chk_456')).toBeNull()
    expect(parseExternalReference('garbage')).toBeNull()
    expect(() => formatExternalReference('bad user', 'chk_456')).toThrow()
    expect(() => formatExternalReference('usr_123', 'bad reference!')).toThrow()
  })
})
