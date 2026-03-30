export const TOOL_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  LLM_INVALID_OUTPUT: 'LLM_INVALID_OUTPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  GENERATION_ERROR: 'GENERATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ToolErrorCode = typeof TOOL_ERROR_CODES[keyof typeof TOOL_ERROR_CODES]

export type ToolFailure = Readonly<{
  success: false
  code: ToolErrorCode
  error: string
}>

type ErrorWithStatus = Error & {
  code?: unknown
  status?: unknown
}

const MAX_TOOL_ERROR_MESSAGE_LENGTH = 500

const TOOL_ERROR_CODE_SET = new Set<ToolErrorCode>(Object.values(TOOL_ERROR_CODES))

const HTTP_STATUS_TO_TOOL_ERROR_CODE: Readonly<Partial<Record<number, ToolErrorCode>>> = {
  401: TOOL_ERROR_CODES.UNAUTHORIZED,
  404: TOOL_ERROR_CODES.NOT_FOUND,
  429: TOOL_ERROR_CODES.RATE_LIMITED,
}

export const TOOL_ERROR_HTTP_STATUS: Readonly<Record<ToolErrorCode, number>> = {
  [TOOL_ERROR_CODES.VALIDATION_ERROR]: 400,
  [TOOL_ERROR_CODES.PARSE_ERROR]: 400,
  [TOOL_ERROR_CODES.LLM_INVALID_OUTPUT]: 500,
  [TOOL_ERROR_CODES.NOT_FOUND]: 404,
  [TOOL_ERROR_CODES.UNAUTHORIZED]: 401,
  [TOOL_ERROR_CODES.GENERATION_ERROR]: 500,
  [TOOL_ERROR_CODES.RATE_LIMITED]: 429,
  [TOOL_ERROR_CODES.INTERNAL_ERROR]: 500,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function getToolErrorCodeForStatus(status?: number): ToolErrorCode | undefined {
  return status === undefined
    ? undefined
    : HTTP_STATUS_TO_TOOL_ERROR_CODE[status]
}

function capToolErrorMessage(message: string): string {
  return message.length > MAX_TOOL_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_TOOL_ERROR_MESSAGE_LENGTH - 1)}…`
    : message
}

export function isToolErrorCode(value: unknown): value is ToolErrorCode {
  return typeof value === 'string' && TOOL_ERROR_CODE_SET.has(value as ToolErrorCode)
}

export function toolFailure(code: ToolErrorCode, error: string): ToolFailure {
  return {
    success: false,
    code,
    error,
  }
}

export function isToolFailure(value: unknown): value is ToolFailure {
  if (!isRecord(value)) {
    return false
  }

  return value.success === false
    && isToolErrorCode(value.code)
    && typeof value.error === 'string'
}

export function resolveToolErrorCode(
  error: unknown,
  fallbackCode: ToolErrorCode = TOOL_ERROR_CODES.INTERNAL_ERROR,
): ToolErrorCode {
  if (isToolFailure(error)) {
    return error.code
  }

  if (error instanceof Error) {
    const typedError = error as ErrorWithStatus
    if (isToolErrorCode(typedError.code)) {
      return typedError.code
    }

    return getToolErrorCodeForStatus(readNumber(typedError.status)) ?? fallbackCode
  }

  if (!isRecord(error)) {
    return fallbackCode
  }

  if (isToolErrorCode(error.code)) {
    return error.code
  }

  return getToolErrorCodeForStatus(readNumber(error.status)) ?? fallbackCode
}

export function toolFailureFromUnknown(
  error: unknown,
  message?: string,
  fallbackCode: ToolErrorCode = TOOL_ERROR_CODES.INTERNAL_ERROR,
): ToolFailure {
  const providedMessage = typeof message === 'string'
    ? message.trim()
    : undefined
  const baseMessage = providedMessage && providedMessage.length > 0
    ? providedMessage
    : getToolErrorMessage(error) ?? 'An error occurred.'

  return toolFailure(
    resolveToolErrorCode(error, fallbackCode),
    capToolErrorMessage(baseMessage),
  )
}

export function getHttpStatusForToolError(code: ToolErrorCode): number {
  return TOOL_ERROR_HTTP_STATUS[code]
}

export function getToolErrorMessage(error: unknown): string | undefined {
  if (isToolFailure(error)) {
    return error.error
  }

  if (error instanceof Error) {
    return readString(error.message)
  }

  if (!isRecord(error)) {
    return undefined
  }

  return readString(error.error) ?? readString(error.message)
}
