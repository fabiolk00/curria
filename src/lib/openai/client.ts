import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

export function resolveOpenAIBaseUrl(envValue = process.env.OPENAI_BASE_URL): string {
  const trimmed = envValue?.trim()

  if (!trimmed) {
    return DEFAULT_OPENAI_BASE_URL
  }

  try {
    const parsed = new URL(trimmed)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`)
    }

    return trimmed.replace(/\/+$/, '')
  } catch {
    console.warn(
      `[openai] Ignoring invalid OPENAI_BASE_URL "${trimmed}" and falling back to the default API base URL.`,
    )
    return DEFAULT_OPENAI_BASE_URL
  }
}

export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const baseURL = resolveOpenAIBaseUrl()
    console.log('[openai:getOpenAIClient] Initializing OpenAI client')
    console.log('[openai:getOpenAIClient] baseURL:', baseURL)
    console.log('[openai:getOpenAIClient] OPENAI_API_KEY exists:', Boolean(process.env.OPENAI_API_KEY))

    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? 'test-key',
      baseURL,
    })

    console.log('[openai:getOpenAIClient] Client created successfully')
  }

  return openaiInstance
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAIClient(), prop, receiver)
  },
})
