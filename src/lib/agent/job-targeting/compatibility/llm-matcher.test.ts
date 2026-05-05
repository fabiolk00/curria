import { describe, expect, it, vi } from 'vitest'

import {
  classifyRequirementWithLlm,
  classifyRequirementsWithLlm,
  MatcherOutputSchema,
  type LlmRequirementResolver,
} from './llm-matcher'

const requirement = {
  id: 'req-1',
  text: 'Conhecimento na ferramenta Qlik',
  normalizedText: 'conhecimento na ferramenta qlik',
  kind: 'tool' as const,
  importance: 'core' as const,
}

const resumeEvidence = [{
  id: 'ev-1',
  text: 'Liderou migracao de 30 aplicacoes Qlik Sense para Qlik Cloud',
  normalizedText: 'liderou migracao de 30 aplicacoes qlik sense para qlik cloud',
  section: 'experience',
  sourceKind: 'experience_bullet',
  cvPath: 'experience.0.bullets.0',
}]

function resolverWith(content: string): LlmRequirementResolver {
  return vi.fn(async () => ({
    content,
    inputTokens: 100,
    outputTokens: 20,
  }))
}

describe('LLM job matcher', () => {
  it('validates the fixed matcher output schema', () => {
    expect(MatcherOutputSchema.parse({
      evidenceLevel: 'supported',
      rewritePermission: 'can_claim_directly',
      confidence: 0.91,
      reasoning: 'evidencia direta',
    })).toEqual(expect.objectContaining({
      evidenceLevel: 'supported',
    }))
  })

  it('maps supported output to RequirementEvidence without catalog ids', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: resumeEvidence.map((item) => item.text),
      resolver: resolverWith(JSON.stringify({
        evidenceLevel: 'supported',
        rewritePermission: 'can_claim_directly',
        confidence: 0.91,
        reasoning: 'Qlik Sense e Qlik Cloud sustentam o requisito.',
      })),
    })

    expect(result.requirement).toEqual(expect.objectContaining({
      productGroup: 'supported',
      rewritePermission: 'can_claim_directly',
      source: 'llm_semantic',
      catalogTermIds: [],
      catalogCategoryIds: [],
    }))
  })

  it('falls back conservatively on invalid JSON and invalid enum', async () => {
    await expect(classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: [],
      resolver: resolverWith('not-json'),
    })).resolves.toEqual(expect.objectContaining({
      fallbackReason: 'classification_failed',
      requirement: expect.objectContaining({
        productGroup: 'unsupported',
        rewritePermission: 'must_not_claim',
      }),
    }))

    await expect(classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: [],
      resolver: resolverWith(JSON.stringify({
        evidenceLevel: 'direct',
        rewritePermission: 'can_claim_directly',
        confidence: 0.9,
        reasoning: 'bad enum',
      })),
    })).resolves.toEqual(expect.objectContaining({
      fallbackReason: 'classification_failed',
    }))
  })

  it('reclassifies low confidence as unsupported', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: [],
      confidenceThreshold: 0.5,
      resolver: resolverWith(JSON.stringify({
        evidenceLevel: 'supported',
        rewritePermission: 'can_claim_directly',
        confidence: 0.49,
        reasoning: 'baixo sinal',
      })),
    })

    expect(result.fallbackReason).toBe('low_confidence_reclassified')
    expect(result.requirement).toEqual(expect.objectContaining({
      productGroup: 'unsupported',
      rewritePermission: 'must_not_claim',
      rationale: 'low_confidence_reclassified',
    }))
  })

  it('retries rate limits before operational fallback', async () => {
    const resolver = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate_limit_exceeded'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('rate_limit_exceeded'), { status: 429 }))
      .mockResolvedValueOnce({
        content: JSON.stringify({
          evidenceLevel: 'adjacent',
          rewritePermission: 'can_bridge_to_target_role',
          confidence: 0.7,
          reasoning: 'evidencia relacionada',
        }),
        inputTokens: 90,
        outputTokens: 15,
      })

    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: [],
      resolver,
      retryConfig: {
        maxRetries: 3,
        initialBackoffMs: 0,
        backoffMultiplier: 2,
        retryJitter: false,
      },
    })

    expect(resolver).toHaveBeenCalledTimes(3)
    expect(result.retryCount).toBe(2)
    expect(result.fallbackReason).toBeUndefined()
    expect(result.requirement.productGroup).toBe('adjacent')
  })

  it('separates timeout fallback from classification_failed after retries are exhausted', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence,
      evidenceBullets: [],
      resolver: vi.fn(async () => {
        throw new Error('timeout')
      }),
      retryConfig: {
        maxRetries: 2,
        initialBackoffMs: 0,
        backoffMultiplier: 2,
        retryJitter: false,
      },
    })

    expect(result.retryCount).toBe(2)
    expect(result.fallbackReason).toBe('llm_timeout_retries_exhausted')
    expect(result.fallbackReason).not.toBe('classification_failed')
  })

  it('respects per-session concurrency and does not fail fast', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const resolver = vi.fn(async ({ requirement: current }) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1

      if (current.id === 'req-2') {
        throw Object.assign(new Error('temporarily_unavailable'), { status: 503 })
      }

      return {
        content: JSON.stringify({
          evidenceLevel: 'unsupported',
          rewritePermission: 'must_not_claim',
          confidence: 0.8,
          reasoning: 'sem evidencia',
        }),
      }
    })
    const requirements = Array.from({ length: 5 }, (_, index) => ({
      ...requirement,
      id: `req-${index + 1}`,
    }))

    const result = await classifyRequirementsWithLlm({
      requirements,
      resumeEvidence,
      resolver,
      maxConcurrentRequirementCalls: 2,
      retryConfig: {
        maxRetries: 0,
        initialBackoffMs: 0,
        backoffMultiplier: 2,
        retryJitter: false,
      },
    })

    expect(resolver).toHaveBeenCalledTimes(5)
    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(result.classifications).toHaveLength(5)
    expect(result.classifications[1].fallbackReason).toBe('llm_provider_error_retries_exhausted')
    expect(result.classifications.filter((item) => item.fallbackReason === undefined)).toHaveLength(4)
  })
})
