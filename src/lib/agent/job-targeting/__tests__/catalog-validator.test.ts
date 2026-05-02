import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import genericTaxonomy from '@/lib/agent/job-targeting/catalog/generic-taxonomy.json'
import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'
import {
  JobTargetingCatalogValidationError,
  validateJobTargetingCatalogPack,
} from '@/lib/agent/job-targeting/catalog/catalog-validator'

const tempDirs: string[] = []

const validPack = {
  id: 'catalog.valid',
  version: '2026-05-02',
  domain: 'generic-test',
  goldenCaseIds: ['catalog-contract'],
  requirementKinds: ['skill', 'experience', 'education'],
  scoreDimensions: [
    { id: 'skills', weight: 0.34 },
    { id: 'experience', weight: 0.46 },
    { id: 'education', weight: 0.2 },
  ],
  sectionWeights: {
    skills: 0.34,
    experience: 0.46,
    education: 0.2,
  },
  adjacentDiscount: 0.5,
  terms: [
    {
      id: 'term.primary',
      label: 'Primary requirement',
      goldenCaseIds: ['catalog-contract'],
      aliases: [
        {
          value: 'Alternate requirement label',
          goldenCaseIds: ['catalog-contract'],
        },
      ],
      categoryIds: ['category.primary'],
    },
  ],
  categories: [
    {
      id: 'category.primary',
      label: 'Primary category',
      goldenCaseIds: ['catalog-contract'],
      equivalentCategoryIds: [
        {
          categoryId: 'category.related',
          goldenCaseIds: ['catalog-contract'],
        },
      ],
      adjacentCategoryIds: [
        {
          categoryId: 'category.adjacent',
          goldenCaseIds: ['catalog-contract'],
        },
      ],
    },
  ],
  antiEquivalences: [
    {
      leftTermId: 'term.primary',
      rightTermId: 'term.blocked',
      goldenCaseIds: ['catalog-contract'],
    },
  ],
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true })
    }
  }
})

function writeTempCatalogPack(pack: unknown) {
  const tempDir = mkdtempSync(join(tmpdir(), 'job-targeting-catalog-'))
  const filePath = join(tempDir, 'catalog-pack.json')
  tempDirs.push(tempDir)
  writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf8')
  return filePath
}

function expectValidationPath(input: unknown, path: string) {
  expect(() => validateJobTargetingCatalogPack(input, 'test-pack')).toThrow(JobTargetingCatalogValidationError)

  try {
    validateJobTargetingCatalogPack(input, 'test-pack')
  } catch (error) {
    expect(error).toBeInstanceOf(JobTargetingCatalogValidationError)
    expect((error as JobTargetingCatalogValidationError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path }),
      ]),
    )
  }
}

describe('job targeting catalog validator', () => {
  it('accepts versioned catalog packs with required audit fields', () => {
    const parsed = validateJobTargetingCatalogPack(validPack, 'test-pack')

    expect(parsed.id).toBe('catalog.valid')
    expect(parsed.version).toBe('2026-05-02')
    expect(parsed.terms[0]?.aliases[0]?.goldenCaseIds).toEqual(['catalog-contract'])
    expect(parsed.categories[0]?.adjacentCategoryIds[0]?.goldenCaseIds).toEqual(['catalog-contract'])
  })

  it('rejects packs missing required top-level fields', () => {
    const { goldenCaseIds: _goldenCaseIds, ...missingGoldenCases } = validPack

    expectValidationPath(missingGoldenCases, 'goldenCaseIds')
  })

  it('rejects catalog terms without non-empty goldenCaseIds', () => {
    const invalidPack = {
      ...validPack,
      terms: [
        {
          ...validPack.terms[0],
          goldenCaseIds: [],
        },
      ],
    }

    expectValidationPath(invalidPack, 'terms.0.goldenCaseIds')
  })

  it('rejects aliases without non-empty goldenCaseIds', () => {
    const invalidPack = {
      ...validPack,
      terms: [
        {
          ...validPack.terms[0],
          aliases: [
            {
              value: 'Alternate requirement label',
              goldenCaseIds: [],
            },
          ],
        },
      ],
    }

    expectValidationPath(invalidPack, 'terms.0.aliases.0.goldenCaseIds')
  })

  it('rejects category relationships without non-empty goldenCaseIds', () => {
    const invalidPack = {
      ...validPack,
      categories: [
        {
          ...validPack.categories[0],
          adjacentCategoryIds: [
            {
              categoryId: 'category.adjacent',
              goldenCaseIds: [],
            },
          ],
        },
      ],
    }

    expectValidationPath(invalidPack, 'categories.0.adjacentCategoryIds.0.goldenCaseIds')
  })

  it('rejects anti-equivalences without non-empty goldenCaseIds', () => {
    const invalidPack = {
      ...validPack,
      antiEquivalences: [
        {
          leftTermId: 'term.primary',
          rightTermId: 'term.blocked',
          goldenCaseIds: [],
        },
      ],
    }

    expectValidationPath(invalidPack, 'antiEquivalences.0.goldenCaseIds')
  })

  it('validates the generic taxonomy without domain examples', () => {
    const parsed = validateJobTargetingCatalogPack(genericTaxonomy, 'generic-taxonomy')
    const source = readFileSync('src/lib/agent/job-targeting/catalog/generic-taxonomy.json', 'utf8')
    const forbiddenDomainExamples = [
      /Power\s*BI/i,
      /Power\s*Query/i,
      /Totvs/i,
      /Java/i,
      /Salesforce/i,
      /SAP/i,
      /Google\s*Ads/i,
      /Excel/i,
      /Tableau/i,
      /HubSpot/i,
      /AutoCAD/i,
      /\bCRM\b/i,
      /\bERP\b/i,
    ]

    expect(parsed.id).toBe('generic-taxonomy')
    expect(parsed.terms).toEqual([])
    expect(parsed.antiEquivalences).toEqual([])
    forbiddenDomainExamples.forEach((pattern) => {
      expect(source).not.toMatch(pattern)
    })
  })
})

describe('job targeting catalog loader', () => {
  it('loads validated generic taxonomy and domain packs with audit metadata', async () => {
    const domainPackPath = writeTempCatalogPack({
      ...validPack,
      id: 'catalog.domain',
      version: '2026-05-03',
      domain: 'domain-test',
    })

    const loaded = await loadJobTargetingCatalog({
      genericTaxonomyPath: 'src/lib/agent/job-targeting/catalog/generic-taxonomy.json',
      domainPackPaths: [domainPackPath],
    })

    expect(loaded.genericTaxonomy.id).toBe('generic-taxonomy')
    expect(loaded.domainPacks).toHaveLength(1)
    expect(loaded.domainPacks[0]?.id).toBe('catalog.domain')
    expect(loaded.metadata.catalogIds).toEqual(['generic-taxonomy', 'catalog.domain'])
    expect(loaded.metadata.catalogVersions).toEqual({
      'generic-taxonomy': '2026-05-02',
      'catalog.domain': '2026-05-03',
    })
  })

  it('does not swallow validation failures from requested catalog paths', async () => {
    const invalidDomainPackPath = writeTempCatalogPack({
      ...validPack,
      id: 'catalog.invalid',
      terms: [
        {
          ...validPack.terms[0],
          goldenCaseIds: [],
        },
      ],
    })

    await expect(loadJobTargetingCatalog({
      genericTaxonomyPath: 'src/lib/agent/job-targeting/catalog/generic-taxonomy.json',
      domainPackPaths: [invalidDomainPackPath],
    })).rejects.toThrow(JobTargetingCatalogValidationError)
  })
})
