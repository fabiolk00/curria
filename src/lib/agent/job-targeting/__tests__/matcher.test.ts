import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { LoadedJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-types'
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

function groupIds(results: RequirementEvidence[], group: RequirementEvidence['productEvidenceGroup']): string[] {
  return results
    .filter((result) => result.productEvidenceGroup === group)
    .map((result) => result.requirementId)
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
    kind: requirement.kind,
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
    requiredIds.has(result.requirementId)
    && result.productEvidenceGroup === 'unsupported'
  )).length
  const supportedOrAdjacentCount = results.filter((result) => (
    result.productEvidenceGroup !== 'unsupported'
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
      productEvidenceGroup: 'supported',
      internalEvidenceLevel: 'exact',
      claimPermission: 'allowed',
      evidenceIds: ['exact'],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'alias', text: 'Advanced Power BI delivery' }),
      resumeEvidence: evidence([{ id: 'alias', text: 'BI dashboards' }]),
      catalog,
    })).toMatchObject({
      productEvidenceGroup: 'supported',
      internalEvidenceLevel: 'catalog_alias',
      claimPermission: 'allowed',
      evidenceIds: ['alias'],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'anti', text: 'Power Query data transformations' }),
      resumeEvidence: evidence([{ id: 'blocked', text: 'Power BI dashboarding with SQL extracts' }]),
      catalog,
    })).toMatchObject({
      productEvidenceGroup: 'unsupported',
      internalEvidenceLevel: 'catalog_anti_equivalence',
      claimPermission: 'forbidden',
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'adjacent', text: 'RPA automation concepts' }),
      resumeEvidence: precedenceEvidence,
      catalog,
    })).toMatchObject({
      productEvidenceGroup: 'adjacent',
      claimPermission: 'cautious',
      evidenceIds: ['adjacent'],
    })

    expect(classifyRequirementEvidence({
      requirement: requirement({ id: 'unsupported', text: 'Spark pipelines' }),
      resumeEvidence: precedenceEvidence,
      catalog,
    })).toMatchObject({
      productEvidenceGroup: 'unsupported',
      internalEvidenceLevel: 'unsupported',
      claimPermission: 'forbidden',
      evidenceIds: [],
    })
  })

  it('supports explicit category equivalence without requiring domain-specific runtime rules', () => {
    const catalog: LoadedJobTargetingCatalog = {
      genericTaxonomy: {
        id: 'generic-taxonomy',
        version: 'test',
        domain: 'generic',
        goldenCaseIds: ['case'],
        requirementKinds: ['skill'],
        scoreDimensions: [{ id: 'skills', weight: 1 }],
        sectionWeights: { skills: 1, experience: 0, education: 0 },
        adjacentDiscount: 0.5,
        terms: [
          {
            id: 'term.required',
            label: 'Required Term',
            goldenCaseIds: ['case'],
            aliases: [],
            categoryIds: ['category.required'],
          },
          {
            id: 'term.evidence',
            label: 'Evidence Term',
            goldenCaseIds: ['case'],
            aliases: [],
            categoryIds: ['category.evidence'],
          },
        ],
        categories: [
          {
            id: 'category.required',
            label: 'Required Category',
            goldenCaseIds: ['case'],
            parentCategoryIds: [],
            equivalentCategoryIds: [{ categoryId: 'category.evidence', goldenCaseIds: ['case'] }],
            adjacentCategoryIds: [],
          },
          {
            id: 'category.evidence',
            label: 'Evidence Category',
            goldenCaseIds: ['case'],
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
      productEvidenceGroup: 'supported',
      internalEvidenceLevel: 'catalog_category',
      claimPermission: 'allowed',
      evidenceIds: ['category-evidence'],
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
      productEvidenceGroup: 'unsupported',
      internalEvidenceLevel: 'unsupported',
    })
    expect(classifyRequirementEvidence({
      ...ambiguousInput,
      ambiguityResolver: () => null,
    })).toMatchObject({
      productEvidenceGroup: 'unsupported',
      internalEvidenceLevel: 'unsupported',
    })
  })

  it('runs all locked golden fixtures through matcher-level classifications', async () => {
    const catalog = await loadJobTargetingCatalog({ domainPackPaths })

    readGoldenCases().forEach((fixture) => {
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
