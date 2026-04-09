type LogLevel = 'info' | 'warn' | 'error'

type LogValue = string | number | boolean | null | undefined

type LogFields = Record<string, LogValue>

type ErrorShape = {
  name?: string
  message?: string
  code?: string
  status?: number
}

function cleanFields(fields: LogFields): Record<string, Exclude<LogValue, undefined>> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, Exclude<LogValue, undefined>] => entry[1] !== undefined),
  )
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

function readErrorShape(value: unknown): ErrorShape {
  if (value instanceof Error) {
    const withStatus = value as Error & { code?: unknown; status?: unknown }

    return {
      name: value.name,
      message: value.message,
      code: readString(withStatus.code),
      status: readNumber(withStatus.status),
    }
  }

  if (!isRecord(value)) {
    return {}
  }

  return {
    name: readString(value.name),
    message: readString(value.message),
    code: readString(value.code),
    status: readNumber(value.status),
  }
}

export function serializeError(error: unknown): LogFields {
  const details = readErrorShape(error)

  return {
    errorName: details.name,
    errorMessage: details.message,
    errorCode: details.code,
    errorStatus: details.status,
  }
}

function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...cleanFields(fields),
  }

  const line = JSON.stringify(payload)

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.info(line)
}

export function logInfo(event: string, fields: LogFields = {}): void {
  logEvent('info', event, fields)
}

export function logWarn(event: string, fields: LogFields = {}): void {
  logEvent('warn', event, fields)
}

export function logError(event: string, fields: LogFields = {}): void {
  logEvent('error', event, fields)
}
