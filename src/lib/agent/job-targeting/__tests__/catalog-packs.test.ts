import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { JobTargetingCatalogPack } from '@/lib/agent/job-targeting/catalog/catalog-types'
import {
  getDefaultJobTargetingDomainPackPaths,
  loadJobTargetingCatalog,
} from '@/lib/agent/job-targeting/catalog/catalog-loader'

const requiredPackIds = [
  'business-admin',
  'data-bi',
  'finance',
  'hr',
  'marketing',
  'operations',
  'sales',
  'software-engineering',
]

const lockedGoldenCaseIds = [
  'data-bi-good-fit-with-specific-gaps',
  'data-bi-tool-without-related-transform-tool',
  'correlated-education-good-fit',
  'software-engineering-low-fit-from-data-profile',
  'erp-specific-tool-missing',
  'automation-adjacent-without-rpa',
  'marketing-ads-good-fit-with-missing-crm',
  'finance-analyst-missing-accounting-system',
]

const goldenCasesDir = 'src/lib/agent/job-targeting/__fixtures__/golden-cases'

async function readGoldenFixtureIds(): Promise<string[]> {
  if (!existsSync(goldenCasesDir)) {
    return []
  }

  const fileNames = (await readdir(goldenCasesDir)).filter((fileName) => fileName.endsWith('.json'))
  const ids = await Promise.all(fileNames.map(async (fileName) => {
    const rawFixture = await readFile(join(goldenCasesDir, fileName), 'utf8')
    const parsedFixture = JSON.parse(rawFixture) as { id?: unknown }

    return typeof parsedFixture.id === 'string'
      ? parsedFixture.id
      : basename(fileName, '.json')
  }))

  return ids.sort()
}

function collectPackGoldenCaseIds(pack: JobTargetingCatalogPack): string[] {
  const ids = new Set<string>(pack.goldenCaseIds)

  pack.terms.forEach((term) => {
    term.goldenCaseIds.forEach((id) => ids.add(id))
    term.aliases.forEach((alias) => alias.goldenCaseIds.forEach((id) => ids.add(id)))
  })

  pack.categories.forEach((category) => {
    category.goldenCaseIds.forEach((id) => ids.add(id))
    category.equivalentCategoryIds.forEach((relationship) => {
      relationship.goldenCaseIds.forEach((id) => ids.add(id))
    })
    category.adjacentCategoryIds.forEach((relationship) => {
      relationship.goldenCaseIds.forEach((id) => ids.add(id))
    })
  })

  pack.antiEquivalences.forEach((antiEquivalence) => {
    antiEquivalence.goldenCaseIds.forEach((id) => ids.add(id))
  })

  return [...ids].sort()
}

function expectGovernance(
  governance: JobTargetingCatalogPack['governance'],
  context: string,
) {
  expect(governance.validatedBy, `${context} missing validatedBy`).toEqual(expect.any(String))
  expect(governance.validatedAt, `${context} missing validatedAt`).toEqual(expect.any(String))
  expect(governance.reviewRequired, `${context} must require review`).toBe(true)
  expect(['low', 'medium', 'high'], `${context} invalid semantic risk`).toContain(governance.semanticRiskLevel)
  expect(governance.rationale, `${context} missing rationale`).toEqual(expect.any(String))
  expect(governance.goldenCaseIds.length, `${context} missing golden cases`).toBeGreaterThan(0)
  if (governance.semanticRiskLevel === 'high') {
    expect(governance.reviewers?.length ?? 0, `${context} high risk needs reviewers`).toBeGreaterThanOrEqual(2)
  }
}

function expectPackGovernance(pack: JobTargetingCatalogPack) {
  expectGovernance(pack.governance, `${pack.id}`)

  pack.terms.forEach((term) => {
    expectGovernance(term.governance, `${pack.id}:${term.id}`)
    term.aliases.forEach((alias) => {
      expectGovernance(alias.governance, `${pack.id}:${term.id}:${alias.value}`)
    })
  })

  pack.categories.forEach((category) => {
    expectGovernance(category.governance, `${pack.id}:${category.id}`)
    category.equivalentCategoryIds.forEach((relationship) => {
      expectGovernance(relationship.governance, `${pack.id}:${category.id}:equivalent:${relationship.categoryId}`)
    })
    category.adjacentCategoryIds.forEach((relationship) => {
      expectGovernance(relationship.governance, `${pack.id}:${category.id}:adjacent:${relationship.categoryId}`)
    })
  })

  pack.antiEquivalences.forEach((antiEquivalence) => {
    expectGovernance(
      antiEquivalence.governance,
      `${pack.id}:${antiEquivalence.leftTermId}:${antiEquivalence.rightTermId}`,
    )
    expect(antiEquivalence.governance.rationale).toEqual(expect.any(String))
  })
}

function expectPackReferencesToResolve(pack: JobTargetingCatalogPack) {
  const termIds = new Set(pack.terms.map((term) => term.id))
  const categoryIds = new Set(pack.categories.map((category) => category.id))

  pack.terms.forEach((term) => {
    term.categoryIds.forEach((categoryId) => {
      expect(categoryIds, `${pack.id}:${term.id} references missing category ${categoryId}`).toContain(categoryId)
    })
  })

  pack.categories.forEach((category) => {
    category.parentCategoryIds.forEach((categoryId) => {
      expect(categoryIds, `${pack.id}:${category.id} references missing parent ${categoryId}`).toContain(categoryId)
    })
    category.equivalentCategoryIds.forEach((relationship) => {
      expect(categoryIds, `${pack.id}:${category.id} references missing equivalent ${relationship.categoryId}`).toContain(relationship.categoryId)
    })
    category.adjacentCategoryIds.forEach((relationship) => {
      expect(categoryIds, `${pack.id}:${category.id} references missing adjacent ${relationship.categoryId}`).toContain(relationship.categoryId)
    })
  })

  pack.antiEquivalences.forEach((antiEquivalence) => {
    expect(termIds, `${pack.id} anti-equivalence references missing left term ${antiEquivalence.leftTermId}`).toContain(antiEquivalence.leftTermId)
    expect(termIds, `${pack.id} anti-equivalence references missing right term ${antiEquivalence.rightTermId}`).toContain(antiEquivalence.rightTermId)
  })
}

describe('job targeting catalog domain packs', () => {
  it('loads all required versioned packs through the catalog loader', async () => {
    const domainPackPaths = await getDefaultJobTargetingDomainPackPaths()
    const loaded = await loadJobTargetingCatalog()

    expect(domainPackPaths.map((packPath) => basename(packPath))).toEqual(
      requiredPackIds.map((packId) => `${packId}.json`),
    )
    expect(loaded.domainPacks.map((pack) => pack.id)).toEqual(requiredPackIds)
    expect(loaded.metadata.catalogIds).toEqual(['generic-taxonomy', ...requiredPackIds])
    requiredPackIds.forEach((packId) => {
      expect(loaded.metadata.catalogVersions[packId]).toBe('2026-05-02')
    })
  })

  it('keeps concrete domain examples in catalog data', async () => {
    const domainPackPaths = await getDefaultJobTargetingDomainPackPaths()
    const rawPacks = await Promise.all(domainPackPaths.map((packPath) => readFile(packPath, 'utf8')))
    const packSource = rawPacks.join('\n')
    const requiredExamples = [
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

    requiredExamples.forEach((pattern) => {
      expect(packSource).toMatch(pattern)
    })
  })

  it('uses locked golden cases for every matching-affecting record', async () => {
    const loaded = await loadJobTargetingCatalog()
    const allCatalogGoldenCaseIds = new Set<string>()

    loaded.domainPacks.forEach((pack) => {
      expectPackReferencesToResolve(pack)
      expectPackGovernance(pack)
      collectPackGoldenCaseIds(pack).forEach((id) => {
        expect(lockedGoldenCaseIds, `${pack.id} references unlocked golden case ${id}`).toContain(id)
        allCatalogGoldenCaseIds.add(id)
      })
    })

    lockedGoldenCaseIds.forEach((id) => {
      expect(allCatalogGoldenCaseIds).toContain(id)
    })
  })

  it('references every available golden fixture id from catalog goldenCaseIds', async () => {
    const loaded = await loadJobTargetingCatalog()
    const fixtureIds = await readGoldenFixtureIds()
    const allCatalogGoldenCaseIds = new Set(loaded.domainPacks.flatMap(collectPackGoldenCaseIds))

    expect(new Set(fixtureIds).size).toBe(fixtureIds.length)
    fixtureIds.forEach((id) => {
      expect(lockedGoldenCaseIds, `unexpected golden fixture ${id}`).toContain(id)
      expect(allCatalogGoldenCaseIds).toContain(id)
    })
  })
})
