const CHECKOUT_ERROR_MESSAGE = 'Não foi possível iniciar o checkout. Tente novamente.'
export const CHECKOUT_BILLING_SETUP_ERROR_MESSAGE =
  'O checkout não está configurado corretamente neste ambiente. Tente novamente mais tarde.'

export const ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE =
  'Você já possui um plano mensal ativo. Cancele o plano atual antes de contratar outro plano mensal.'

export const RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE =
  'Não foi possível validar seu plano atual no momento. Tente novamente.'

const KNOWN_CHECKOUT_ERROR_MESSAGES = new Set<string>([
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  CHECKOUT_BILLING_SETUP_ERROR_MESSAGE,
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
