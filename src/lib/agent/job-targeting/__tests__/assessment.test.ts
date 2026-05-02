import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import { calculateJobCompatibilityScore } from '@/lib/agent/job-targeting/compatibility/score'
import type {
  ClaimPolicyItem,
  JobCompatibilityAssessment,
  RequirementEvidence,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

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
    claimPolicy: {
      allowedRequirementIds: string[]
      cautiousRequirementIds: string[]
      forbiddenRequirementIds: string[]
    }
    score: {
      algorithm: 'job-compat-score-v1'
    }
  }
}

function readGoldenCases(): GoldenCase[] {
  return readdirSync(goldenCasesDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => JSON.parse(readFileSync(join(goldenCasesDir, fileName), 'utf8')) as GoldenCase)
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

function toTargetJobDescription(fixture: GoldenCase): string {
  const required = fixture.input.job.requirements
    .filter((requirement) => requirement.priority === 'required')
    .map((requirement) => `- ${requirement.text}`)
  const preferred = fixture.input.job.requirements
    .filter((requirement) => requirement.priority === 'preferred')
    .map((requirement) => `- ${requirement.text}`)

  return [
    'Required qualifications:',
    ...required,
    'Preferred qualifications:',
    ...preferred,
  ].join('\n')
}

function fixtureIdsForRequirements(
  assessmentRequirements: RequirementEvidence[],
  fixture: GoldenCase,
): string[] {
  const fixtureIdsByText = new Map(
    fixture.input.job.requirements.map((requirement) => [requirement.text, requirement.id]),
  )

  return assessmentRequirements
    .map((requirement) => fixtureIdsByText.get(requirement.originalRequirement))
    .filter((id): id is string => Boolean(id))
    .sort()
}

function fixtureIdsForClaims(
  claims: ClaimPolicyItem[],
  assessment: JobCompatibilityAssessment,
  fixture: GoldenCase,
): string[] {
  const requirementsById = new Map(assessment.requirements.map((requirement) => [requirement.id, requirement]))

  return claims
    .flatMap((claim) => claim.requirementIds)
    .map((requirementId) => requirementsById.get(requirementId))
    .filter((requirement): requirement is RequirementEvidence => Boolean(requirement))
    .map((requirement) => fixture.input.job.requirements.find((item) => (
      item.text === requirement.originalRequirement
    ))?.id)
    .filter((id): id is string => Boolean(id))
    .sort()
}

describe('job compatibility assessment', () => {
  it('runs every locked golden fixture through the public assessment entrypoint', async () => {
    const fixtures = readGoldenCases()

    expect(fixtures.map((fixture) => fixture.id).sort()).toEqual([...lockedGoldenCaseIds].sort())

    for (const fixture of fixtures) {
      const assessment = await evaluateJobCompatibility({
        cvState: toCvState(fixture),
        targetJobDescription: toTargetJobDescription(fixture),
        gapAnalysis: fixture.input.gapAnalysis,
        userId: `user-${fixture.id}`,
        sessionId: `session-${fixture.id}`,
      })

      expect(fixtureIdsForRequirements(assessment.supportedRequirements, fixture), fixture.id)
        .toEqual([...fixture.expected.supportedRequirementIds].sort())
      expect(fixtureIdsForRequirements(assessment.adjacentRequirements, fixture), fixture.id)
        .toEqual([...fixture.expected.adjacentRequirementIds].sort())
      expect(fixtureIdsForRequirements(assessment.unsupportedRequirements, fixture), fixture.id)
        .toEqual([...fixture.expected.unsupportedRequirementIds].sort())
      expect(fixtureIdsForClaims(assessment.claimPolicy.allowedClaims, assessment, fixture), fixture.id)
        .toEqual([...fixture.expected.claimPolicy.allowedRequirementIds].sort())
      expect(fixtureIdsForClaims(assessment.claimPolicy.cautiousClaims, assessment, fixture), fixture.id)
        .toEqual([...fixture.expected.claimPolicy.cautiousRequirementIds].sort())
      expect(fixtureIdsForClaims(assessment.claimPolicy.forbiddenClaims, assessment, fixture), fixture.id)
        .toEqual([...fixture.expected.claimPolicy.forbiddenRequirementIds].sort())
      expect(assessment.criticalGaps.map((gap) => gap.id).sort(), fixture.id)
        .toEqual([...fixture.expected.criticalGapIds].sort())
      expect(assessment.reviewNeededGaps.map((gap) => gap.id).sort(), fixture.id)
        .toEqual([...fixture.expected.reviewNeededGapIds].sort())
      expect(assessment.lowFit.blocking, fixture.id).toBe(fixture.expected.lowFit.expected)
      expect(assessment.scoreBreakdown.version, fixture.id).toBe(fixture.expected.score.algorithm)
      expect(assessment.scoreBreakdown.total, fixture.id)
        .toBe(calculateJobCompatibilityScore(assessment.requirements).total)
      expect(assessment.audit.counters, fixture.id).toMatchObject({
        requirements: fixture.input.job.requirements.length,
        supported: fixture.expected.supportedRequirementIds.length,
        adjacent: fixture.expected.adjacentRequirementIds.length,
        unsupported: fixture.expected.unsupportedRequirementIds.length,
        allowedClaims: fixture.expected.claimPolicy.allowedRequirementIds.length,
        cautiousClaims: fixture.expected.claimPolicy.cautiousRequirementIds.length,
        forbiddenClaims: fixture.expected.claimPolicy.forbiddenRequirementIds.length,
      })
      expect(assessment.audit.runIds, fixture.id).toEqual({
        userId: `user-${fixture.id}`,
        sessionId: `session-${fixture.id}`,
      })
      expect(assessment.catalog.catalogIds.length, fixture.id).toBeGreaterThan(0)
    }
  })
})
