import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type {
  CatalogGovernance,
  LoadedJobTargetingCatalog,
} from '@/lib/agent/job-targeting/catalog/catalog-types'
import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'
import {
  classifyRequirementEvidence,
  type MatcherResumeEvidence,
  type MatcherRequirement,
} from '@/lib/agent/job-targeting/compatibility/matcher'
import { extractResumeEvidence } from '@/lib/agent/job-targeting/compatibility/evidence-extraction'
import type { RequirementEvidence } from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

const domainPackPaths = [
  'src/lib/agent/job-targeting/catalog/domain-packs/data-bi.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/software-engineering.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/finance.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/marketing.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/operations.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/sales.json',
  'src/lib/agent/job-targeting/catalog/domain-packs/hr.json',
]

const goldenCasesDir = 'src/lib/agent/job-targeting/__fixtures__/golden-cases'

const lockedGoldenCaseIds = [
  'data-bi-good-fit-with-specific-gaps',
  'data-bi-tool-without-related-transform-tool',
  'correlated-education-good-fit',
  'software-engineering-low-fit-from-data-profile',
  'erp-specific-tool-missing',
  'automation-adjacent-without-rpa',
  'marketing-ads-good-fit-with-missing-crm',
  'finance-analyst-missing-accounting-system',
] as const

function governance(goldenCaseIds = ['case']): CatalogGovernance {
  return {
    validatedBy: 'matcher-test',
    validatedAt: '2026-05-02',
    reviewRequired: true,
    semanticRiskLevel: 'low',
    rationale: 'Test catalog relationship for generic matcher behavior.',
    goldenCaseIds,
  }
}

type GoldenRequirement = {
  id: string
  kind: 'skill' | 'experience' | 'education'
  text: string
  priority: 'required' | 'preferred'
}

type GoldenCase = {
  id: string
  input: {
    cv: {
      headline: string
      summary: string
      skills: string[]
      experience: Array<{
        title: string
        company: string
        bullets: string[]
      }>
      education: Array<{
        degree: string
        institution: string
      }>
    }
    job: {
      requirements: GoldenRequirement[]
    }
    gapAnalysis: {
      criticalGaps: Array<{ id: string; text: string }>
      reviewNeededGaps: Array<{ id: string; text: string }>
    }
  }
  expected: {
    supportedRequirementIds: string[]
    adjacentRequirementIds: string[]
    unsupportedRequirementIds: string[]
    criticalGapIds: string[]
    reviewNeededGapIds: string[]
    lowFit: {
      expected: boolean
    }
  }
}

function requirement(
  overrides: Partial<MatcherRequirement> & Pick<MatcherRequirement, 'id' | 'text'>,
): MatcherRequirement {
  return {
    kind: 'skill',
    importance: 'core',
    ...overrides,
  }
}

function evidence(items: Array<Partial<MatcherResumeEvidence> & Pick<MatcherResumeEvidence, 'id' | 'text'>>): MatcherResumeEvidence[] {
  return items.map((item) => ({
    section: 'skills',
    sourceKind: 'skill',
    cvPath: `skills.${item.id}`,
    ...item,
  }))
}

function groupIds(results: RequirementEvidence[], group: RequirementEvidence['productGroup']): string[] {
  return results
    .filter((result) => result.productGroup === group)
    .map((result) => result.id)
    .sort()
}

function toCvState(fixture: GoldenCase): CVState {
  return {
    fullName: 'Fixture User',
    email: 'fixture@example.com',
    phone: '+55 11 99999-9999',
    summary: `${fixture.input.cv.headline}. ${fixture.input.cv.summary}`,
    skills: fixture.input.cv.skills,
    experience: fixture.input.cv.experience.map((entry) => ({
      title: entry.title,
      company: entry.company,
      startDate: '2022',
      endDate: 'present',
      bullets: entry.bullets,
    })),
    education: fixture.input.cv.education.map((entry) => ({
      degree: entry.degree,
      institution: entry.institution,
      year: '2020',
    })),
  }
}

function toMatcherRequirement(requirement: GoldenRequirement): MatcherRequirement {
  return {
    id: requirement.id,
    text: requirement.text,
    kind: requirement.kind === 'experience' ? 'responsibility' : requirement.kind,
    importance: requirement.priority === 'required' ? 'core' : 'differential',
  }
}

function readGoldenCases(): GoldenCase[] {
  return readdirSync(goldenCasesDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => JSON.parse(readFileSync(join(goldenCasesDir, fileName), 'utf8')) as GoldenCase)
}

function hasLowFitInput(results: RequirementEvidence[], requirements: GoldenRequirement[]): boolean {
  const requiredIds = new Set(
    requirements
      .filter((item) => item.priority === 'required')
      .map((item) => item.id),
  )
  const unsupportedRequiredCount = results.filter((result) => (
    requiredIds.has(result.id)
    && result.productGroup === 'unsupported'
  )).length
  const supportedOrAdjacentCount = results.filter((result) => (
    result.productGroup !== 'unsupported'
  )).length

  return unsupportedRequiredCount >= 3 && supportedOrAdjacentCount <= 2
}

describe('catalog-driven requirement evidence matcher', () => {
  it('uses deterministic precedence from exact match through unsupported fallback', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const precedenceEvidence = evidence([
      { id: 'exact', text: 'Power Query' },
      { id: 'alias', text: 'BI dashboards' },
      { id: 'blocked', text: 'Power BI dashboarding with SQL extracts' },
      { id: 'adjacent', text: 'Power Automate workflow automation' },
    ])

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'exact', text: 'Power Query transformations' }),
      resumeEvidence: precedenceEvidence,
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'explicit',
      rewritePermission: 'can_claim_directly',
      source: 'exact',
      supportingResumeSpans: [expect.objectContaining({ id: 'exact' })],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'alias', text: 'Advanced Power BI delivery' }),
      resumeEvidence: evidence([{ id: 'alias', text: 'BI dashboards' }]),
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'catalog_alias',
      rewritePermission: 'can_claim_normalized',
      source: 'catalog_alias',
      supportingResumeSpans: [expect.objectContaining({ id: 'alias' })],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'anti', text: 'Power Query data transformations' }),
      resumeEvidence: evidence([{ id: 'blocked', text: 'Power BI dashboarding with SQL extracts' }]),
      catalog,
    })).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
      source: 'catalog_anti_equivalence',
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'adjacent', text: 'RPA automation concepts' }),
      resumeEvidence: precedenceEvidence,
      catalog,
    })).toMatchObject({
      productGroup: 'adjacent',
      evidenceLevel: 'semantic_bridge_only',
      rewritePermission: 'can_mention_as_related_context',
      source: 'catalog_anti_equivalence',
      supportingResumeSpans: [expect.objectContaining({ id: 'adjacent' })],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'unsupported', text: 'Spark pipelines' }),
      resumeEvidence: precedenceEvidence,
      catalog,
    })).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
      source: 'fallback',
      supportingResumeSpans: [],
    })
  })

  it('supports explicit category equivalence without requiring domain-specific runtime rules', () => {
    const catalog: LoadedJobTargetingCatalog = {
      genericTaxonomy: {
        id: 'generic-taxonomy',
        version: 'test',
        domain: 'generic',
        goldenCaseIds: ['case'],
        governance: governance(),
        requirementKinds: ['skill'],
        scoreDimensions: [{ id: 'skills', weight: 1 }],
        sectionWeights: { skills: 1, experience: 0, education: 0 },
        adjacentDiscount: 0.5,
        terms: [
          {
            id: 'term.required',
            label: 'Required Term',
            goldenCaseIds: ['case'],
            governance: governance(),
            aliases: [],
            categoryIds: ['category.required'],
          },
          {
            id: 'term.evidence',
            label: 'Evidence Term',
            goldenCaseIds: ['case'],
            governance: governance(),
            aliases: [],
            categoryIds: ['category.evidence'],
          },
        ],
        categories: [
          {
            id: 'category.required',
            label: 'Required Category',
            goldenCaseIds: ['case'],
            governance: governance(),
            parentCategoryIds: [],
            equivalentCategoryIds: [{
              categoryId: 'category.evidence',
              goldenCaseIds: ['case'],
              governance: governance(),
            }],
            adjacentCategoryIds: [],
          },
          {
            id: 'category.evidence',
            label: 'Evidence Category',
            goldenCaseIds: ['case'],
            governance: governance(),
            parentCategoryIds: [],
            equivalentCategoryIds: [],
            adjacentCategoryIds: [],
          },
        ],
        antiEquivalences: [],
      },
      domainPacks: [],
      metadata: {
        catalogIds: ['generic-taxonomy'],
        catalogVersions: { 'generic-taxonomy': 'test' },
      },
    }

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'category', text: 'Required Term' }),
      resumeEvidence: evidence([{ id: 'category-evidence', text: 'Evidence Term' }]),
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'category_equivalent',
      rewritePermission: 'can_claim_normalized',
      source: 'catalog_category',
      supportingResumeSpans: [expect.objectContaining({ id: 'category-evidence' })],
    })
  })

  it('falls back to unsupported when the optional ambiguity resolver is absent or inconclusive', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const ambiguousInput = {
      requirement: requirement({ id: 'ambiguous', text: 'Cross-functional platform ownership' }),
      resumeEvidence: evidence([{ id: 'ambiguous-evidence', text: 'Partnered with leaders on recurring initiatives' }]),
      catalog,
    }

    expect(classifyRequirementEvidence(ambiguousInput)).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      source: 'fallback',
    })
    expect(classifyRequirementEvidence({
      ...ambiguousInput,
      ambiguityResolver: () => null,
    })).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      source: 'fallback',
    })
  })

  it('keeps the ambiguity resolver capped at adjacent evidence', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const result = classifyRequirementEvidence({
      requirement: requirement({ id: 'ambiguous-strong', text: 'Cross-functional platform ownership' }),
      resumeEvidence: evidence([{ id: 'ambiguous-evidence', text: 'Partnered with leaders on recurring initiatives' }]),
      catalog,
      ambiguityResolver: () => ({
        suggestedEvidenceLevel: 'strong_contextual_inference',
        confidence: 0.95,
        rationale: 'related context only',
        supportingResumeSpans: ['Partnered with leaders on recurring initiatives'],
        matchedResumeTerms: ['Partnered with leaders'],
        evidenceIds: ['ambiguous-evidence'],
      }),
    })

    expect(result).toMatchObject({
      productGroup: 'adjacent',
      evidenceLevel: 'strong_contextual_inference',
      rewritePermission: 'can_bridge_carefully',
      source: 'llm_ambiguous',
    })
  })

  it('treats invalid ambiguity resolver output as unsupported', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const result = classifyRequirementEvidence({
      requirement: requirement({ id: 'ambiguous-invalid', text: 'Cross-functional platform ownership' }),
      resumeEvidence: evidence([{ id: 'ambiguous-evidence', text: 'Partnered with leaders on recurring initiatives' }]),
      catalog,
      ambiguityResolver: () => ({
        suggestedEvidenceLevel: 'explicit',
        confidence: 0.95,
        rationale: 'invalid promotion',
        supportingResumeSpans: ['Partnered with leaders'],
        matchedResumeTerms: ['Partnered with leaders'],
      } as never),
    })

    expect(result).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
    })
  })

  it('does not let the ambiguity resolver bypass anti-equivalence', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const result = classifyRequirementEvidence({
      requirement: requirement({ id: 'anti-before-llm', text: 'Power Query data transformations' }),
      resumeEvidence: evidence([{ id: 'blocked', text: 'Power BI dashboarding with SQL extracts' }]),
      catalog,
      ambiguityResolver: () => ({
        suggestedEvidenceLevel: 'strong_contextual_inference',
        confidence: 0.99,
        rationale: 'should not win',
        supportingResumeSpans: ['Power BI dashboarding with SQL extracts'],
        matchedResumeTerms: ['Power BI'],
        evidenceIds: ['blocked'],
      }),
    })

    expect(result).toMatchObject({
      productGroup: 'unsupported',
      source: 'catalog_anti_equivalence',
      rewritePermission: 'must_not_claim',
    })
  })

  it('never promotes resolver output without supporting spans to supported', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const result = classifyRequirementEvidence({
      requirement: requirement({ id: 'ambiguous-no-spans', text: 'Cross-functional platform ownership' }),
      resumeEvidence: evidence([{ id: 'ambiguous-evidence', text: 'Partnered with leaders on recurring initiatives' }]),
      catalog,
      ambiguityResolver: () => ({
        suggestedEvidenceLevel: 'strong_contextual_inference',
        confidence: 0.95,
        rationale: 'missing spans',
        supportingResumeSpans: [],
        matchedResumeTerms: [],
      }),
    })

    expect(result).toMatchObject({
      productGroup: 'adjacent',
      evidenceLevel: 'semantic_bridge_only',
      rewritePermission: 'can_mention_as_related_context',
    })
  })

  it('uses the strongest resume evidence source when the same term appears in skills and experience', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const result = classifyRequirementEvidence({
      requirement: requirement({ id: 'source-confidence', text: 'Power BI' }),
      resumeEvidence: evidence([
        {
          id: 'skills-only',
          text: 'Power BI',
          section: 'skills',
          sourceKind: 'skill',
          sourceConfidence: 0.65,
        },
        {
          id: 'experience-proof',
          text: 'Delivered Power BI dashboards for executives',
          section: 'experience',
          sourceKind: 'experience_bullet',
          sourceConfidence: 1,
        },
      ]),
      catalog,
    })

    expect(result.productGroup).toBe('supported')
    expect(result.confidence).toBe(1)
    expect(result.supportingResumeSpans.map((span) => span.id)).toEqual([
      'skills-only',
      'experience-proof',
    ])
  })

  it('downgrades weak source confidence and negative qualifiers conservatively', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'summary-only', text: 'Power BI' }),
      resumeEvidence: evidence([{
        id: 'summary-only',
        text: 'Power BI',
        section: 'summary',
        sourceKind: 'summary_sentence',
        sourceConfidence: 0.55,
      }]),
      catalog,
    })).toMatchObject({
      productGroup: 'adjacent',
      rewritePermission: 'can_bridge_carefully',
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'negative', text: 'Power BI' }),
      resumeEvidence: evidence([{
        id: 'negative',
        text: 'Sem experiência com Power BI',
        section: 'experience',
        sourceKind: 'experience_bullet',
        sourceConfidence: 1,
        qualifier: 'negative',
      }]),
      catalog,
    })).toMatchObject({
      productGroup: 'unsupported',
      rewritePermission: 'must_not_claim',
    })
  })

  it('supports generic dashboard evidence from visualization wording without implying named BI tools', async () => {
    const catalog = await loadJobTargetingCatalog()

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'dashboards', text: 'Dashboards' }),
      resumeEvidence: evidence([{
        id: 'visualizacoes',
        text: 'Tratou bases em planilhas e criou visualizacoes simples em Looker Studio',
      }]),
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'catalog_alias',
      rewritePermission: 'can_claim_normalized',
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'power-bi', text: 'Power BI' }),
      resumeEvidence: evidence([{
        id: 'visualizacoes',
        text: 'Tratou bases em planilhas e criou visualizacoes simples em Looker Studio',
      }]),
      catalog,
    })).toMatchObject({
      productGroup: 'unsupported',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
    })
  })

  it('normalizes healthcare agenda control requirements to scheduling evidence', async () => {
    const catalog = await loadJobTargetingCatalog()

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'controle-agendas', text: 'Controle de agendas' }),
      resumeEvidence: evidence([{ id: 'agendamento', text: 'agendamento' }]),
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      evidenceLevel: 'catalog_alias',
      rewritePermission: 'can_claim_normalized',
    })
  })

  it('does not treat term mentions in negative evidence as support', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })

    const negativeCases = [
      {
        requirementText: 'SQL',
        evidenceText: 'Não possui experiência registrada com SQL',
      },
      {
        requirementText: 'SAP FI',
        evidenceText: 'Sem experiência com SAP FI',
      },
      {
        requirementText: 'Node.js',
        evidenceText: 'Ainda não registra experiência direta com Node.js',
      },
      {
        requirementText: 'Kubernetes',
        evidenceText: 'Without experience in Kubernetes',
      },
      {
        requirementText: 'Salesforce',
        evidenceText: 'Sem foco em Salesforce',
      },
    ]

    negativeCases.forEach(({ requirementText, evidenceText }) => {
      expect(classifyRequirementEvidence({
        requirement: requirement({ id: requirementText, text: requirementText }),
        resumeEvidence: evidence([{ id: requirementText, text: evidenceText }]),
        catalog,
      }), requirementText).toMatchObject({
        productGroup: 'unsupported',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
      })
    })
  })

  it('keeps normal positive evidence supporting the same terms', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'sql-positive', text: 'SQL' }),
      resumeEvidence: evidence([{ id: 'sql-positive', text: 'Criou consultas SQL para relatorios gerenciais' }]),
      catalog,
    })).toMatchObject({
      productGroup: 'supported',
      rewritePermission: 'can_claim_directly',
    })
  })

  it('runs all locked golden fixtures through matcher-level classifications', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })
    const fixtures = readGoldenCases()

    expect(fixtures.map((fixture) => fixture.id).sort()).toEqual([...lockedGoldenCaseIds].sort())

    fixtures.forEach((fixture) => {
      const resumeEvidence = extractResumeEvidence(toCvState(fixture))
      const results = fixture.input.job.requirements.map((item) => classifyRequirementEvidence({
        requirement: toMatcherRequirement(item),
        decomposedSignals: fixture.input.job.requirements.map(toMatcherRequirement),
        resumeEvidence,
        catalog,
      }))

      expect(groupIds(results, 'supported'), fixture.id).toEqual([...fixture.expected.supportedRequirementIds].sort())
      expect(groupIds(results, 'adjacent'), fixture.id).toEqual([...fixture.expected.adjacentRequirementIds].sort())
      expect(groupIds(results, 'unsupported'), fixture.id).toEqual([...fixture.expected.unsupportedRequirementIds].sort())
      expect(fixture.input.gapAnalysis.criticalGaps.map((gap) => gap.id).sort(), fixture.id)
        .toEqual([...fixture.expected.criticalGapIds].sort())
      expect(fixture.input.gapAnalysis.reviewNeededGaps.map((gap) => gap.id).sort(), fixture.id)
        .toEqual([...fixture.expected.reviewNeededGapIds].sort())
      expect(hasLowFitInput(results, fixture.input.job.requirements), fixture.id)
        .toBe(fixture.expected.lowFit.expected)
    })
  })
})
