import { describe, expect, it, vi } from 'vitest'

import {
  classifyRequirementWithLlm,
  classifyRequirementsWithLlm,
  type LlmRequirementResolver,
} from './llm-matcher'
import type { MatcherRequirement, MatcherResumeEvidence } from './matcher'

const requirement = {
  id: 'req-1',
  text: 'Conhecimento em Qlik',
  kind: 'tool',
  importance: 'core',
} satisfies MatcherRequirement

const evidence = [{
  id: 'ev-1',
  text: 'Liderou migracao de 30 aplicacoes Qlik Sense para Qlik Cloud',
  section: 'experience',
  sourceKind: 'experience_bullet',
  cvPath: 'experience[0].bullets[0]',
  sourceConfidence: 1,
  qualifier: 'strong',
}] satisfies MatcherResumeEvidence[]

function resolverFor(content: string): LlmRequirementResolver {
  return vi.fn(async () => ({
    content,
    inputTokens: 100,
    outputTokens: 20,
  }))
}

describe('LLM job matcher', () => {
  it('maps valid supported output to RequirementEvidence', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      resolver: resolverFor(JSON.stringify({
        evidenceLevel: 'supported',
        rewritePermission: 'can_claim_directly',
        confidence: 0.91,
        reasoning: 'Qlik product-family evidence',
      })),
    })

    expect(result.requirement).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'strong_contextual_inference',
      rewritePermission: 'can_claim_directly',
      source: 'llm_semantic',
      confidence: 0.91,
      catalogTermIds: [],
      catalogCategoryIds: [],
    })
    expect(result.requirement.audit).toMatchObject({
      promptVersion: 'job-matcher-llm-v2',
      model: 'gpt-4.1-mini-2025-04-14',
    })
  })

  it('falls back conservatively for invalid JSON', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      resolver: resolverFor('{invalid'),
    })

    expect(result.requirement).toMatchObject({
      productGroup: 'unsupported',
      rewritePermission: 'must_not_claim',
      confidence: 0,
      rationale: 'classification_failed',
      source: 'fallback',
    })
    expect(result.fallbackReason).toBe('classification_failed')
  })

  it('falls back conservatively for invalid enum values', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      resolver: resolverFor(JSON.stringify({
        evidenceLevel: 'equivalent',
        rewritePermission: 'can_claim_directly',
        confidence: 0.91,
        reasoning: 'bad enum',
      })),
    })

    expect(result.fallbackReason).toBe('classification_failed')
    expect(result.requirement.rewritePermission).toBe('must_not_claim')
  })

  it('reclassifies low confidence as unsupported without treating it as schema failure', async () => {
    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      confidenceThreshold: 0.5,
      resolver: resolverFor(JSON.stringify({
        evidenceLevel: 'adjacent',
        rewritePermission: 'can_bridge_to_target_role',
        confidence: 0.49,
        reasoning: 'weak relation',
      })),
    })

    expect(result.requirement).toMatchObject({
      productGroup: 'unsupported',
      rewritePermission: 'must_not_claim',
      rationale: 'low_confidence_reclassified',
    })
    expect(result.fallbackReason).toBe('low_confidence_reclassified')
  })

  it('retries rate limits before per-requirement fallback', async () => {
    const rateLimit = Object.assign(new Error('rate_limit_exceeded'), { status: 429 })
    const resolver = vi.fn()
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          evidenceLevel: 'supported',
          rewritePermission: 'can_claim_directly',
          confidence: 0.9,
          reasoning: 'after retry',
        }),
        inputTokens: 10,
        outputTokens: 5,
      })

    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      retryConfig: {
        maxRetries: 3,
        initialBackoffMs: 1,
        backoffMultiplier: 1,
        retryJitter: false,
      },
      resolver,
    })

    expect(resolver).toHaveBeenCalledTimes(2)
    expect(result.retryCount).toBe(1)
    expect(result.fallbackReason).toBeUndefined()
    expect(result.requirement.productGroup).toBe('supported')
  })

  it('keeps operational retry exhaustion separate from classification_failed', async () => {
    const resolver = vi.fn(async () => {
      throw Object.assign(new Error('temporarily_unavailable'), { status: 503 })
    })

    const result = await classifyRequirementWithLlm({
      requirement,
      resumeEvidence: evidence,
      evidenceBullets: evidence.map((item) => item.text),
      retryConfig: {
        maxRetries: 1,
        initialBackoffMs: 1,
        backoffMultiplier: 1,
        retryJitter: false,
      },
      resolver,
    })

    expect(result.fallbackReason).toBe('llm_provider_error_retries_exhausted')
    expect(result.fallbackReason).not.toBe('classification_failed')
  })

  it('respects per-session concurrency and isolates requirement failures', async () => {
    let active = 0
    let maxActive = 0
    const requirements = Array.from({ length: 5 }, (_, index) => ({
      ...requirement,
      id: `req-${index + 1}`,
      text: `Requirement ${index + 1}`,
    }))
    const resolver = vi.fn(async ({ requirement: currentRequirement }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1

      if (currentRequirement.id === 'req-3') {
        return { content: '{invalid' }
      }

      return {
        content: JSON.stringify({
          evidenceLevel: 'supported',
          rewritePermission: 'can_claim_directly',
          confidence: 0.8,
          reasoning: 'ok',
        }),
      }
    })

    const result = await classifyRequirementsWithLlm({
      requirements,
      resumeEvidence: evidence,
      resolver,
      maxConcurrentRequirementCalls: 2,
    })

    expect(resolver).toHaveBeenCalledTimes(5)
    expect(maxActive).toBeLessThanOrEqual(2)
    expect(result.requirements).toHaveLength(5)
    expect(result.requirements.filter((item) => item.productGroup === 'supported')).toHaveLength(4)
    expect(result.requirements.find((item) => item.id === 'req-3')?.productGroup).toBe('unsupported')
  })
})
