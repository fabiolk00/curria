import { describe, expect, it } from 'vitest'

import { resolveOpenAIBaseUrl } from './client'

describe('resolveOpenAIBaseUrl', () => {
  it('returns the default base URL when the env is empty', () => {
    expect(resolveOpenAIBaseUrl(undefined)).toBe('https://api.openai.com/v1')
    expect(resolveOpenAIBaseUrl('')).toBe('https://api.openai.com/v1')
  })

  it('accepts absolute http and https URLs', () => {
    expect(resolveOpenAIBaseUrl('https://example.com/v1')).toBe('https://example.com/v1')
    expect(resolveOpenAIBaseUrl('http://localhost:4000/proxy')).toBe('http://localhost:4000/proxy')
  })

  it('falls back when the env contains a relative URL like /pipeline', () => {
    expect(resolveOpenAIBaseUrl('/pipeline')).toBe('https://api.openai.com/v1')
  })

  it('strips trailing slashes from valid absolute URLs', () => {
    expect(resolveOpenAIBaseUrl('https://example.com/v1///')).toBe('https://example.com/v1')
  })
})
