import { readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import type {
  CatalogCategory,
  CatalogTerm,
  JobTargetingCatalogPack,
} from '@/lib/agent/job-targeting/catalog/catalog-types'
import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'
import { validateJobTargetingCatalogPack } from '@/lib/agent/job-targeting/catalog/catalog-validator'
import {
  buildCanonicalSignal,
  hasLexicalAliasMatch,
  includesNormalizedPhrase,
  normalizeSemanticText,
} from '@/lib/agent/job-targeting/semantic-normalization'

export type SkillAdjacencyRule = {
  requirementPattern: RegExp
  evidencePattern: RegExp
  relatedSuggestions: string[]
  explanationTemplate:
    | 'tooling_detail'
    | 'methodology_detail'
    | 'business_context'
    | 'integration_context'
  requirementSignals?: string[]
  evidenceSignals?: string[]
}

type CatalogTermRef = {
  packId: string
  term: CatalogTerm
  values: string[]
}

type CatalogCategoryRef = {
  packId: string
  category: CatalogCategory
  values: string[]
}

type CatalogIndex = {
  packs: JobTargetingCatalogPack[]
  terms: CatalogTermRef[]
  categories: CatalogCategoryRef[]
  categoriesById: Map<string, CatalogCategoryRef>
  termsByCategoryId: Map<string, CatalogTermRef[]>
}

const GENERIC_TAXONOMY_PATH = 'src/lib/agent/job-targeting/catalog/generic-taxonomy.json'
const DOMAIN_PACKS_DIR = 'src/lib/agent/job-targeting/catalog/domain-packs'
const EMPTY_PATTERN = /a^\b/

let cachedCatalogIndex: CatalogIndex | null = null

function resolveProjectPath(filePath: string): string {
  return isAbsolute(filePath) ? filePath : join(process.cwd(), filePath)
}

function readCatalogPack(filePath: string): JobTargetingCatalogPack {
  const raw = readFileSync(resolveProjectPath(filePath), 'utf8')
  return validateJobTargetingCatalogPack(JSON.parse(raw), filePath)
}

function listDomainPackPaths(): string[] {
  const resolvedDir = resolveProjectPath(DOMAIN_PACKS_DIR)

  return readdirSync(resolvedDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => join(DOMAIN_PACKS_DIR, fileName))
}

function loadCatalogPacksSync(): JobTargetingCatalogPack[] {
  return [
    readCatalogPack(GENERIC_TAXONOMY_PATH),
    ...listDomainPackPaths().map(readCatalogPack),
  ]
}

export function loadSkillAdjacencyCatalog() {
  return loadJobTargetingCatalog({
    genericTaxonomyPath: GENERIC_TAXONOMY_PATH,
    domainPackPaths: listDomainPackPaths(),
  })
}

function buildTermValues(term: CatalogTerm): string[] {
  return Array.from(new Set([
    term.label,
    ...term.aliases.map((alias) => alias.value),
  ].map((value) => value.trim()).filter(Boolean)))
}

function buildCategoryValues(category: CatalogCategory): string[] {
  return Array.from(new Set([
    category.label,
  ].map((value) => value.trim()).filter(Boolean)))
}

function buildCatalogIndex(): CatalogIndex {
  const packs = loadCatalogPacksSync()
  const terms = packs.flatMap((pack) => pack.terms.map((term) => ({
    packId: pack.id,
    term,
    values: buildTermValues(term),
  })))
  const categories = packs.flatMap((pack) => pack.categories.map((category) => ({
    packId: pack.id,
    category,
    values: buildCategoryValues(category),
  })))
  const categoriesById = new Map(categories.map((categoryRef) => [categoryRef.category.id, categoryRef]))
  const termsByCategoryId = new Map<string, CatalogTermRef[]>()

  terms.forEach((termRef) => {
    termRef.term.categoryIds.forEach((categoryId) => {
      const bucket = termsByCategoryId.get(categoryId) ?? []
      bucket.push(termRef)
      termsByCategoryId.set(categoryId, bucket)
    })
  })

  return {
    packs,
    terms,
    categories,
    categoriesById,
    termsByCategoryId,
  }
}

function getCatalogIndex(): CatalogIndex {
  cachedCatalogIndex ??= buildCatalogIndex()
  return cachedCatalogIndex
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(values: string[]): RegExp {
  const alternatives = uniqueValues(values)
    .map((value) => escapeRegExp(value).replace(/\s+/g, '\\s+'))

  return alternatives.length > 0
    ? new RegExp(`(?:${alternatives.join('|')})`, 'i')
    : EMPTY_PATTERN
}

function hasSharedGoldenCaseIds(left: string[], right: string[]): boolean {
  const rightIds = new Set(right)
  return left.some((id) => rightIds.has(id))
}

function getTermsForCategoryIds(index: CatalogIndex, categoryIds: string[]): CatalogTermRef[] {
  return uniqueValues(categoryIds)
    .flatMap((categoryId) => index.termsByCategoryId.get(categoryId) ?? [])
}

function getSupportingTerms(index: CatalogIndex, sourceCategory: CatalogCategoryRef, adjacentCategoryIds: string[]): CatalogTermRef[] {
  const directTerms = getTermsForCategoryIds(index, adjacentCategoryIds)
  const goldenCaseTerms = index.terms.filter((termRef) => (
    termRef.packId === sourceCategory.packId
    && hasSharedGoldenCaseIds(termRef.term.goldenCaseIds, sourceCategory.category.goldenCaseIds)
  ))

  return Array.from(new Map([...directTerms, ...goldenCaseTerms].map((termRef) => [termRef.term.id, termRef])).values())
}

function detectExplanationTemplate(categoryRef: CatalogCategoryRef): SkillAdjacencyRule['explanationTemplate'] {
  const normalized = normalizeSemanticText(`${categoryRef.category.id} ${categoryRef.category.label}`)

  if (/\b(?:integracao|integration|api|workflow|automation|automacao|system|sistema)\b/u.test(normalized)) {
    return 'integration_context'
  }

  if (/\b(?:method|methodology|practice|delivery|process|processo|ritual|planning)\b/u.test(normalized)) {
    return 'methodology_detail'
  }

  if (/\b(?:business|cliente|market|account|stakeholder|operation|operacao|analytics)\b/u.test(normalized)) {
    return 'business_context'
  }

  return 'tooling_detail'
}

function buildRulesFromCatalog(): SkillAdjacencyRule[] {
  const index = getCatalogIndex()

  return index.categories.flatMap((categoryRef) => {
    const adjacentCategoryIds = categoryRef.category.adjacentCategoryIds.map((relationship) => relationship.categoryId)
    if (adjacentCategoryIds.length === 0) {
      return []
    }

    const sourceTerms = getTermsForCategoryIds(index, [categoryRef.category.id])
    const sourceValues = uniqueValues([
      ...categoryRef.values,
      ...sourceTerms.flatMap((termRef) => termRef.values),
    ])
    const supportingCategories = adjacentCategoryIds
      .map((categoryId) => index.categoriesById.get(categoryId))
      .filter((item): item is CatalogCategoryRef => Boolean(item))
    const supportingTerms = getSupportingTerms(index, categoryRef, adjacentCategoryIds)
    const supportingValues = uniqueValues([
      ...supportingCategories.flatMap((supportingCategory) => supportingCategory.values),
      ...supportingTerms.flatMap((termRef) => termRef.values),
    ])
    const relatedSuggestions = uniqueValues(
      sourceTerms.length > 0
        ? sourceTerms.map((termRef) => termRef.term.label)
        : categoryRef.values,
    )

    if (sourceValues.length === 0 || supportingValues.length === 0) {
      return []
    }

    return [{
      requirementPattern: buildPattern(sourceValues),
      evidencePattern: buildPattern(supportingValues),
      relatedSuggestions,
      explanationTemplate: detectExplanationTemplate(categoryRef),
      requirementSignals: sourceValues,
      evidenceSignals: supportingValues,
    } satisfies SkillAdjacencyRule]
  })
}

function textMatchesSignal(text: string, signal: string): boolean {
  const normalizedText = normalizeSemanticText(text)
  const normalizedSignal = normalizeSemanticText(signal)
  const canonicalText = buildCanonicalSignal(text)
  const canonicalSignal = buildCanonicalSignal(signal)

  return Boolean(
    normalizedText
    && normalizedSignal
    && canonicalText
    && canonicalSignal
    && (
      canonicalText === canonicalSignal
      || includesNormalizedPhrase(normalizedText, normalizedSignal)
      || includesNormalizedPhrase(normalizedSignal, normalizedText)
      || hasLexicalAliasMatch(text, signal)
    ),
  )
}

function matchesAnySignal(text: string, signals: string[] | undefined, fallbackPattern: RegExp): boolean {
  return fallbackPattern.test(text)
    || Boolean(signals?.some((signal) => textMatchesSignal(text, signal)))
}

export const SKILL_ADJACENCY_RULES: SkillAdjacencyRule[] = buildRulesFromCatalog()

export function findSkillAdjacencyRule(requirement: string, evidenceSignals: string[]): {
  rule: SkillAdjacencyRule
  evidence: string[]
} | null {
  const matchingRule = SKILL_ADJACENCY_RULES.find((rule) => (
    matchesAnySignal(requirement, rule.requirementSignals, rule.requirementPattern)
  ))

  if (!matchingRule) {
    return null
  }

  const evidence = evidenceSignals.filter((signal) => (
    matchesAnySignal(signal, matchingRule.evidenceSignals, matchingRule.evidencePattern)
  ))

  if (evidence.length === 0) {
    return null
  }

  return {
    rule: matchingRule,
    evidence: Array.from(new Set(evidence)).slice(0, 4),
  }
}
