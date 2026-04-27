import { describe, expect, it } from 'vitest'

import { buildSafeTargetingEmphasis } from '@/lib/agent/job-targeting/safe-targeting-emphasis'
import type { TargetEvidence, TargetedRewritePermissions } from '@/types/agent'

describe('safe targeting emphasis', () => {
  it('keeps explicit BI evidence in direct emphasis while relegating RH bridges to cautious wording', () => {
    const targetEvidence: TargetEvidence[] = [
      {
        jobSignal: 'Power Automate',
        canonicalSignal: 'Power Automate',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['Power Automate'],
        supportingResumeSpans: ['Power Automate'],
        rationale: 'Explícito no currículo.',
        confidence: 1,
        allowedRewriteForms: ['Power Automate'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'APIs REST',
        canonicalSignal: 'APIs REST',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['APIs REST'],
        supportingResumeSpans: ['APIs REST'],
        rationale: 'Explícito no currículo.',
        confidence: 1,
        allowedRewriteForms: ['APIs REST'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'People Analytics',
        canonicalSignal: 'People Analytics',
        evidenceLevel: 'semantic_bridge_only',
        rewritePermission: 'can_mention_as_related_context',
        matchedResumeTerms: ['dashboards', 'relatórios gerenciais'],
        supportingResumeSpans: ['dashboards', 'relatórios gerenciais'],
        rationale: 'Só contexto relacionado.',
        confidence: 0.71,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['People Analytics'],
        validationSeverityIfViolated: 'major',
      },
      {
        jobSignal: 'RPA',
        canonicalSignal: 'RPA',
        evidenceLevel: 'semantic_bridge_only',
        rewritePermission: 'can_bridge_carefully',
        matchedResumeTerms: ['Power Automate', 'automação de fluxos'],
        supportingResumeSpans: ['Power Automate', 'automação de fluxos'],
        rationale: 'Bridge cautelosa.',
        confidence: 0.69,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['RPA'],
        validationSeverityIfViolated: 'major',
      },
    ]

    const permissions: TargetedRewritePermissions = {
      directClaimsAllowed: ['Power Automate', 'APIs REST', 'HTML', 'CSS'],
      normalizedClaimsAllowed: [],
      bridgeClaimsAllowed: [
        {
          jobSignal: 'RPA',
          safeBridge: 'automação de fluxos com Power Automate',
          doNotSay: ['RPA', 'robôs RPA'],
        },
      ],
      relatedButNotClaimable: ['People Analytics'],
      forbiddenClaims: ['People Analytics', 'RPA', 'Power Apps', 'FLUIG', 'JavaScript'],
      skillsSurfaceAllowed: ['Power Automate', 'APIs REST', 'HTML', 'CSS'],
    }

    const emphasis = buildSafeTargetingEmphasis({
      targetEvidence,
      rewritePermissions: permissions,
      mustEmphasize: ['Power BI', 'Qlik Sense', 'Power Automate'],
    })

    expect(emphasis.safeDirectEmphasis).toEqual(expect.arrayContaining([
      'Power Automate',
      'APIs REST',
      'HTML',
      'CSS',
      'Power BI',
      'Qlik Sense',
    ]))
    expect(emphasis.cautiousBridgeEmphasis).toEqual(expect.arrayContaining([
      expect.objectContaining({
        jobSignal: 'RPA',
      }),
      expect.objectContaining({
        jobSignal: 'People Analytics',
      }),
    ]))
    expect(emphasis.forbiddenDirectClaims).toEqual(expect.arrayContaining([
      'People Analytics',
      'RPA',
      'Power Apps',
      'FLUIG',
      'JavaScript',
    ]))
  })
})
