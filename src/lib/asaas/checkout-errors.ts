export const CHECKOUT_ERROR_MESSAGE = 'Nao foi possivel iniciar o checkout. Tente novamente.'

export const ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE =
  'Voce ja possui um plano mensal ativo. Cancele o plano atual antes de contratar outro plano mensal.'

export const RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE =
  'Nao foi possivel validar seu plano atual no momento. Tente novamente.'

const KNOWN_CHECKOUT_ERROR_MESSAGES = new Set<string>([
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getCheckoutErrorMessage(
  payload: unknown,
  fallback: string = CHECKOUT_ERROR_MESSAGE,
): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') {
    return fallback
  }

  const message = payload.error.trim()
  if (!message) {
    return fallback
  }

  return KNOWN_CHECKOUT_ERROR_MESSAGES.has(message) ? message : fallback
}
