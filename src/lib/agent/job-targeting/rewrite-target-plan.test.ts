import { describe, expect, it } from 'vitest'

import { buildRewriteTargetPlan } from '@/lib/agent/job-targeting/rewrite-target-plan'
import type { CoreRequirement } from '@/types/agent'

function requirement(overrides: Partial<CoreRequirement>): CoreRequirement {
  return {
    signal: 'SQL',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
    ...overrides,
  }
}

describe('buildRewriteTargetPlan', () => {
  it('separates allowed, bridge, and forbidden claims for each rewrite section', () => {
    const plan = buildRewriteTargetPlan({
      targetRole: 'Analista de BI',
      targetRoleConfidence: 'high',
      coreRequirements: [
        requirement({ signal: 'SQL' }),
        requirement({
          signal: 'DAX',
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
        }),
        requirement({
          signal: 'modelagem semântica',
          evidenceLevel: 'strong_contextual_inference',
          rewritePermission: 'can_bridge_carefully',
        }),
      ],
      preferredRequirements: [],
      supportedSignals: ['Power BI', 'SQL'],
      adjacentSignals: ['dashboards'],
      unsupportedSignals: ['DAX'],
    })

    const summaryInstruction = plan.sectionInstructions.find((instruction) => instruction.section === 'summary')
    const skillsInstruction = plan.sectionInstructions.find((instruction) => instruction.section === 'skills')

    expect(summaryInstruction).toMatchObject({
      priority: 'high',
      allowedClaims: expect.arrayContaining(['Power BI', 'SQL']),
      bridgeClaims: expect.arrayContaining(['dashboards', 'modelagem semântica']),
      forbiddenClaims: expect.arrayContaining(['DAX']),
    })
    expect(summaryInstruction?.instruction).toMatch(/não|Nao/i)
    expect(skillsInstruction?.instruction).toMatch(/Não adicione|Nao adicione/i)
  })
})
