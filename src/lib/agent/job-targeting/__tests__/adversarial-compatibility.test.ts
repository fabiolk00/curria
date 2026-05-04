import { describe, expect, it } from 'vitest'

import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'
import {
  classifyRequirementEvidence,
  type MatcherResumeEvidence,
} from '@/lib/agent/job-targeting/compatibility/matcher'

function evidence(overrides: Partial<MatcherResumeEvidence> & Pick<MatcherResumeEvidence, 'id' | 'text'>): MatcherResumeEvidence[] {
  return [{
    section: 'experience',
    sourceKind: 'experience_bullet',
    cvPath: `experience.${overrides.id}`,
    sourceConfidence: 1,
    ...overrides,
  }]
}

describe('adversarial compatibility cases', () => {
  it('does not support a requirement from explicit negative evidence', async () => {
    const catalog = await loadJobTargetingCatalog()
    const result = classifyRequirementEvidence({
      requirement: { id: 'negative', text: 'Power BI', kind: 'skill', importance: 'core' },
      resumeEvidence: evidence({
        id: 'negative',
        text: 'Sem experiência com Power BI',
        qualifier: 'negative',
      }),
      catalog,
    })

    expect(result.productGroup).toBe('unsupported')
  })

  it('downgrades basic or introductory evidence for an advanced requirement', async () => {
    const catalog = await loadJobTargetingCatalog()
    const result = classifyRequirementEvidence({
      requirement: { id: 'advanced', text: 'Power BI avancado', kind: 'skill', importance: 'core' },
      resumeEvidence: evidence({
        id: 'basic',
        text: 'Conhecimento basico em Power BI',
        qualifier: 'basic',
      }),
      catalog,
    })

    expect(result.productGroup).toBe('adjacent')
  })

  it('does not inflate score-relevant confidence from skill stuffing alone', async () => {
    const catalog = await loadJobTargetingCatalog()
    const result = classifyRequirementEvidence({
      requirement: { id: 'skill-stuffing', text: 'Power BI', kind: 'skill', importance: 'core' },
      resumeEvidence: evidence({
        id: 'skill-only',
        text: 'Power BI',
        section: 'skills',
        sourceKind: 'skill',
        sourceConfidence: 0.65,
      }),
      catalog,
    })

    expect(result.productGroup).toBe('supported')
    expect(result.confidence).toBe(0.65)
  })

  it('supports a generic category request when a cataloged specific tool is explicit', async () => {
    const catalog = await loadJobTargetingCatalog()
    const result = classifyRequirementEvidence({
      requirement: { id: 'generic-category', text: 'Data visualization tools', kind: 'tool', importance: 'core' },
      resumeEvidence: evidence({
        id: 'specific-tool',
        text: 'Power BI',
        section: 'experience',
        sourceKind: 'experience_bullet',
      }),
      catalog,
    })

    expect(['supported', 'adjacent']).toContain(result.productGroup)
  })

  it('falls back conservatively for uncataloged domains without explicit evidence', async () => {
    const catalog = await loadJobTargetingCatalog()
    const result = classifyRequirementEvidence({
      requirement: { id: 'unknown-domain', text: 'specialized laboratory workflow ownership', kind: 'responsibility', importance: 'core' },
      resumeEvidence: evidence({
        id: 'unrelated',
        text: 'Maintained recurring customer support reports',
      }),
      catalog,
    })

    expect(result.productGroup).toBe('unsupported')
  })
})
