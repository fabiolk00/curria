import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const fixtureDir = 'src/lib/agent/job-targeting/__fixtures__/golden-cases'

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

const nonEmptyString = z.string().trim().min(1)
const nonEmptyStringArray = z.array(nonEmptyString).min(1)

const expectationSchema = z.object({
  supportedRequirementIds: nonEmptyStringArray,
  adjacentRequirementIds: z.array(nonEmptyString),
  unsupportedRequirementIds: z.array(nonEmptyString),
  criticalGapIds: z.array(nonEmptyString),
  reviewNeededGapIds: z.array(nonEmptyString),
  lowFit: z.object({
    expected: z.boolean(),
    reasons: z.array(nonEmptyString),
  }),
  claimPolicy: z.object({
    allowedRequirementIds: z.array(nonEmptyString),
    cautiousRequirementIds: z.array(nonEmptyString),
    forbiddenRequirementIds: z.array(nonEmptyString),
    requiredCautiousVerbalizations: z.array(nonEmptyString),
    prohibitedClaimTerms: z.array(nonEmptyString),
  }),
  score: z.object({
    algorithm: z.literal('job-compat-score-v1'),
    expectedPercent: z.number().int().min(0).max(100),
    minimumPercent: z.number().int().min(0).max(100),
    maximumPercent: z.number().int().min(0).max(100),
    sectionScores: z.object({
      skills: z.number().min(0).max(1),
      experience: z.number().min(0).max(1),
      education: z.number().min(0).max(1),
    }),
  }).refine(
    (score) => score.minimumPercent <= score.expectedPercent && score.expectedPercent <= score.maximumPercent,
    'expectedPercent must be inside the inclusive score range',
  ),
})

const goldenCaseSchema = z.object({
  id: z.enum(lockedGoldenCaseIds),
  title: nonEmptyString,
  domain: nonEmptyString,
  objective: nonEmptyString,
  input: z.object({
    cv: z.object({
      headline: nonEmptyString,
      summary: nonEmptyString,
      skills: nonEmptyStringArray,
      experience: z.array(z.object({
        title: nonEmptyString,
        company: nonEmptyString,
        bullets: nonEmptyStringArray,
      })).min(1),
      education: z.array(z.object({
        degree: nonEmptyString,
        institution: nonEmptyString,
      })).min(1),
    }),
    job: z.object({
      title: nonEmptyString,
      description: nonEmptyString,
      requirements: z.array(z.object({
        id: nonEmptyString,
        kind: z.enum(['skill', 'experience', 'education']),
        text: nonEmptyString,
        priority: z.enum(['required', 'preferred']),
      })).min(1),
    }),
    gapAnalysis: z.object({
      criticalGaps: z.array(z.object({
        id: nonEmptyString,
        text: nonEmptyString,
      })),
      reviewNeededGaps: z.array(z.object({
        id: nonEmptyString,
        text: nonEmptyString,
      })),
    }),
  }),
  expected: expectationSchema,
})

function readGoldenCase(fileName: string) {
  const raw = readFileSync(join(fixtureDir, fileName), 'utf8')
  return goldenCaseSchema.parse(JSON.parse(raw))
}

describe('job targeting golden case fixtures', () => {
  it('contains exactly the eight locked fixture files', () => {
    expect(existsSync(fixtureDir)).toBe(true)

    const jsonFiles = readdirSync(fixtureDir)
      .filter((fileName) => fileName.endsWith('.json'))
      .sort()
    const expectedFiles = lockedGoldenCaseIds
      .map((id) => `${id}.json`)
      .sort()

    expect(jsonFiles).toEqual(expectedFiles)
  })

  it('keeps locked fixture ids unique and aligned with file names', () => {
    const cases = lockedGoldenCaseIds.map((id) => readGoldenCase(`${id}.json`))
    const ids = cases.map((fixture) => fixture.id)

    expect(new Set(ids).size).toBe(lockedGoldenCaseIds.length)
    expect(ids.sort()).toEqual([...lockedGoldenCaseIds].sort())

    cases.forEach((fixture, index) => {
      expect(fixture.id).toBe(lockedGoldenCaseIds[index])
    })
  })

  it('requires explicit evidence groups, claim policy, gap, low-fit, and score expectations', () => {
    lockedGoldenCaseIds.forEach((id) => {
      const fixture = readGoldenCase(`${id}.json`)
      const expected = fixture.expected
      const groupedRequirementIds = [
        ...expected.supportedRequirementIds,
        ...expected.adjacentRequirementIds,
        ...expected.unsupportedRequirementIds,
      ]
      const policyRequirementIds = [
        ...expected.claimPolicy.allowedRequirementIds,
        ...expected.claimPolicy.cautiousRequirementIds,
        ...expected.claimPolicy.forbiddenRequirementIds,
      ]
      const criticalGapIds = fixture.input.gapAnalysis.criticalGaps.map((gap) => gap.id)
      const reviewNeededGapIds = fixture.input.gapAnalysis.reviewNeededGaps.map((gap) => gap.id)

      expect(groupedRequirementIds.length).toBeGreaterThan(0)
      expect(new Set(groupedRequirementIds).size).toBe(groupedRequirementIds.length)
      expect(expected.claimPolicy.allowedRequirementIds.sort()).toEqual(expected.supportedRequirementIds.sort())
      expect(expected.claimPolicy.cautiousRequirementIds.sort()).toEqual(expected.adjacentRequirementIds.sort())
      expect(expected.claimPolicy.forbiddenRequirementIds.sort()).toEqual(expected.unsupportedRequirementIds.sort())
      expect(policyRequirementIds.sort()).toEqual(groupedRequirementIds.sort())
      expect(expected.criticalGapIds.sort()).toEqual(criticalGapIds.sort())
      expect(expected.reviewNeededGapIds.sort()).toEqual(reviewNeededGapIds.sort())

      if (expected.adjacentRequirementIds.length > 0) {
        expect(expected.claimPolicy.requiredCautiousVerbalizations.length).toBeGreaterThan(0)
      }

      if (expected.unsupportedRequirementIds.length > 0) {
        expect(expected.claimPolicy.prohibitedClaimTerms.length).toBeGreaterThan(0)
      }
    })
  })
})
