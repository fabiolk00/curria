import OpenAI, { APIError } from 'openai'

export const OPENAI_RETRYABLE_STATUS_CODES = [429, 500, 502, 503] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Wraps an OpenAI API call with exponential backoff retry logic.
 * @param fn - Function that makes the OpenAI API call
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise resolving to ChatCompletion
 */
export async function callOpenAIWithRetry(
  fn: () => Promise<OpenAI.Chat.Completions.ChatCompletion>,
  maxRetries = 3,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof APIError &&
        OPENAI_RETRYABLE_STATUS_CODES.includes(error.status as (typeof OPENAI_RETRYABLE_STATUS_CODES)[number])

      if (!isRetryable || attempt === maxRetries) {
        throw error
      }

      const delay = Math.pow(2, attempt - 1) * 1000
      await sleep(delay)
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
 * @returns Promise resolving to ChatCompletion
 */
export async function createChatCompletionWithRetry(
  openaiClient: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return callOpenAIWithRetry(() => openaiClient.chat.completions.create(params), maxRetries)
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
