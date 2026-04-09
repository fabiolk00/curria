import OpenAI, { APIError } from 'openai'
import { Stream } from 'openai/streaming'

const OPENAI_RETRYABLE_STATUS_CODES = [429, 500, 502, 503] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Parses a Retry-After header value into milliseconds.
 * Returns null if the header is missing, unparsable, or non-positive.
 */
function parseRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof APIError)) return null

  const header = error.headers?.['retry-after']
  if (!header) return null

  const seconds = Number(header)
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  return seconds * 1000
}

/**
 * Wraps an OpenAI API call with exponential backoff retry logic.
 * Supports per-attempt timeout via AbortController, Retry-After header,
 * and an external abort signal (e.g. client disconnect).
 * @param fn - Function that makes the OpenAI API call (receives an AbortSignal for timeout)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Per-attempt timeout in milliseconds (optional)
 * @param externalSignal - External AbortSignal (e.g. from req.signal) to cancel on client disconnect
 * @returns Promise resolving to ChatCompletion
 */
export async function callOpenAIWithRetry(
  fn: (signal?: AbortSignal) => Promise<OpenAI.Chat.Completions.ChatCompletion>,
  maxRetries = 3,
  timeoutMs?: number,
  externalSignal?: AbortSignal,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check if already cancelled before starting an attempt
    if (externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let onExternalAbort: (() => void) | undefined

    try {
      controller = new AbortController()

      if (timeoutMs) {
        timer = setTimeout(() => controller!.abort(), timeoutMs)
      }

      // Forward external signal (client disconnect) to the per-attempt controller
      if (externalSignal) {
        onExternalAbort = () => controller!.abort()
        externalSignal.addEventListener('abort', onExternalAbort)
      }

      const result = await fn(controller.signal)
      return result
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof APIError &&
        OPENAI_RETRYABLE_STATUS_CODES.includes(error.status as (typeof OPENAI_RETRYABLE_STATUS_CODES)[number])

      if (!isRetryable || attempt === maxRetries) {
        throw error
      }

      const exponentialDelay = Math.pow(2, attempt - 1) * 1000
      const retryAfterMs = parseRetryAfterMs(error)
      const delay = Math.min(
        retryAfterMs != null ? Math.max(retryAfterMs, exponentialDelay) : exponentialDelay,
        30_000,
      )
      await sleep(delay)
    } finally {
      if (timer) clearTimeout(timer)
      if (onExternalAbort && externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    }
  }

  throw lastError
}

async function callOpenAIWithRetryGeneric<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  maxRetries = 3,
  timeoutMs?: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let onExternalAbort: (() => void) | undefined

    try {
      controller = new AbortController()

      if (timeoutMs) {
        timer = setTimeout(() => controller!.abort(), timeoutMs)
      }

      if (externalSignal) {
        onExternalAbort = () => controller!.abort()
        externalSignal.addEventListener('abort', onExternalAbort)
      }

      const result = await fn(controller.signal)
      return result
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof APIError &&
        OPENAI_RETRYABLE_STATUS_CODES.includes(error.status as (typeof OPENAI_RETRYABLE_STATUS_CODES)[number])

      if (!isRetryable || attempt === maxRetries) {
        throw error
      }

      const exponentialDelay = Math.pow(2, attempt - 1) * 1000
      const retryAfterMs = parseRetryAfterMs(error)
      const delay = Math.min(
        retryAfterMs != null ? Math.max(retryAfterMs, exponentialDelay) : exponentialDelay,
        30_000,
      )
      await sleep(delay)
    } finally {
      if (timer) clearTimeout(timer)
      if (onExternalAbort && externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    }
  }

  throw lastError
}

/**
 * Calls OpenAI chat completion API with retry logic.
 * This is the primary method used by API routes.
 * @param openaiClient - OpenAI client instance
 * @param params - ChatCompletion creation parameters
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Per-attempt timeout in milliseconds (optional)
 * @returns Promise resolving to ChatCompletion
 */
async function createChatCompletionWithRetry(
  openaiClient: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  maxRetries = 3,
  timeoutMs?: number,
  externalSignal?: AbortSignal,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return callOpenAIWithRetryGeneric(
    (signal) => openaiClient.chat.completions.create(params, { signal }),
    maxRetries,
    timeoutMs,
    externalSignal,
  )
}

export async function createChatCompletionStreamWithRetry(
  openaiClient: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  maxRetries = 3,
  timeoutMs?: number,
  externalSignal?: AbortSignal,
): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  return callOpenAIWithRetryGeneric(
    (signal) => openaiClient.chat.completions.create(params, { signal }) as Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>,
    maxRetries,
    timeoutMs,
    externalSignal,
  )
}

export function getChatCompletionText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  return response.choices[0]?.message?.content ?? ''
}

export function getChatCompletionUsage(response: OpenAI.Chat.Completions.ChatCompletion): {
  inputTokens: number
  outputTokens: number
} {
  return {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
