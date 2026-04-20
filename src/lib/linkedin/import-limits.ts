export const FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_MESSAGE =
  'No teste gratuito, a importação do LinkedIn pode ser usada apenas 1 vez. Faça upgrade para continuar.'
export const PAID_LINKEDIN_IMPORT_LIMIT_MESSAGE =
  'Você atingiu o limite de 2 importações do LinkedIn por hora. Tente novamente em instantes.'

export class LinkedInImportLimitError extends Error {
  readonly code = 'LINKEDIN_IMPORT_LIMIT_REACHED'
  readonly status = 429
  readonly retryAfterSeconds?: number

  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'LinkedInImportLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type LimitErrorInput = {
  details?: string | null
  message?: string | null
}

function parseRetryAfterSeconds(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

export function toLinkedInImportLimitError(
  input: LimitErrorInput | null | undefined,
): LinkedInImportLimitError | null {
  const message = input?.message ?? ''

  if (message.includes('FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_REACHED')) {
    return new LinkedInImportLimitError(FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_MESSAGE)
  }

  if (message.includes('PAID_LINKEDIN_IMPORT_RATE_LIMIT_REACHED')) {
    return new LinkedInImportLimitError(
      PAID_LINKEDIN_IMPORT_LIMIT_MESSAGE,
      parseRetryAfterSeconds(input?.details),
    )
  }

  return null
}
