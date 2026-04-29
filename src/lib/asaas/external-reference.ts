const APP_USER_ID_REGEX = /^usr_[A-Za-z0-9]+$/
const CHECKOUT_REFERENCE_REGEX = /^[A-Za-z0-9_-]+$/
const V1_EXTERNAL_REFERENCE_REGEX = /^curria:v1:c:([A-Za-z0-9_-]+)$/
const V1_EXTERNAL_REFERENCE_WITH_USER_REGEX = /^curria:v1:u:(usr_[A-Za-z0-9]+):c:([A-Za-z0-9_-]+)$/

export type ParsedExternalReference =
  | {
      version: 'v1'
      checkoutReference: string
      appUserId?: string
    }
  | {
      version: 'legacy'
      appUserId: string
      checkoutReference?: undefined
    }

function isValidAppUserId(value: string): boolean {
  return APP_USER_ID_REGEX.test(value)
}

function isValidCheckoutReference(value: string): boolean {
  return CHECKOUT_REFERENCE_REGEX.test(value)
}

export function formatExternalReference(appUserId: string, checkoutReference: string): string {
  if (!isValidAppUserId(appUserId)) {
    throw new Error(`Invalid app user id for externalReference: ${appUserId}`)
  }

  if (!isValidCheckoutReference(checkoutReference)) {
    throw new Error(`Invalid checkout reference for externalReference: ${checkoutReference}`)
  }

  return `curria:v1:c:${checkoutReference}`
}

export function parseExternalReference(value: string): ParsedExternalReference | null {
  const v1Match = V1_EXTERNAL_REFERENCE_REGEX.exec(value)
  if (v1Match) {
    const [, checkoutReference] = v1Match
    return {
      version: 'v1',
      checkoutReference,
    }
  }

  const v1LegacyShapeMatch = V1_EXTERNAL_REFERENCE_WITH_USER_REGEX.exec(value)
  if (v1LegacyShapeMatch) {
    const [, appUserId, checkoutReference] = v1LegacyShapeMatch
    return {
      version: 'v1',
      appUserId,
      checkoutReference,
    }
  }

  if (APP_USER_ID_REGEX.test(value)) {
    return {
      version: 'legacy',
      appUserId: value,
    }
  }

  return null
}
