import { describe, expect, it } from 'vitest'

import {
  buildAssessmentDisplayScore,
  buildGapPresentation,
  MAX_CRITICAL_GAP_ITEMS,
  VERY_LOW_ADHERENCE_LABEL,
} from '@/lib/agent/job-targeting/compatibility/presentation'
import type { JobCompatibilityGap, RequirementKind } from '@/lib/agent/job-targeting/compatibility/types'

function gap(signal: string, kind: RequirementKind = 'unknown'): JobCompatibilityGap {
  return {
    id: `gap-${signal}`,
    signal,
    kind,
    importance: 'core',
    severity: 'critical',
    rationale: 'No evidence in CV.',
    requirementIds: [`req-${signal}`],
    prohibitedTerms: [signal],
  }
}

describe('job compatibility presentation', () => {
  it('adds a display-only floor and label for technical score zero', () => {
    expect(buildAssessmentDisplayScore(0)).toEqual({
      displayScore: 5,
      scoreLabel: VERY_LOW_ADHERENCE_LABEL,
    })

    expect(buildAssessmentDisplayScore(42)).toEqual({ displayScore: 42 })
  })

  it('groups critical gaps and limits the UI list to at most five items', () => {
    const presentation = buildGapPresentation({
      criticalGaps: [
        gap('Power Query', 'tool'),
        gap('Tableau', 'tool'),
        gap('Indicadores financeiros', 'business_domain'),
        gap('Demonstrações financeiras', 'business_domain'),
        gap('Formação superior', 'education'),
        gap('Liderança de operações'),
      ],
      reviewNeededGaps: [gap('Power BI', 'tool')],
    })

    const criticalItems = presentation.criticalGroups.flatMap((group) => group.items)

    expect(criticalItems).toHaveLength(MAX_CRITICAL_GAP_ITEMS)
    expect(presentation.criticalGroups).toEqual([
      {
        title: 'Ferramentas específicas não evidenciadas',
        items: ['Power Query', 'Tableau'],
      },
      {
        title: 'Experiência de domínio não evidenciada',
        items: ['Indicadores financeiros', 'Demonstrações financeiras'],
      },
      {
        title: 'Formação ou certificações não evidenciadas',
        items: ['Formação superior'],
      },
    ])
    expect(presentation.reviewNeededGroups).toEqual([{
      title: 'Ferramentas específicas não evidenciadas',
      items: ['Power BI'],
    }])
  })
})
