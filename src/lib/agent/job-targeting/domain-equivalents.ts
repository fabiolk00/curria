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
  includesNormalizedPhrase,
  normalizeSemanticText,
} from '@/lib/agent/job-targeting/semantic-normalization'
import type { EvidenceLevel, RewritePermission } from '@/types/agent'

export type RequirementSubSignal = {
  originalRequirement: string
  signal: string
  kind: 'tool' | 'domain' | 'education' | 'experience' | 'business_context' | 'unknown'
  requiredness: 'required' | 'preferred' | 'unknown'
}

export type DomainEquivalentRule = {
  jobSignals: string[]
  resumeSignals: string[]
  evidenceLevel: Extract<EvidenceLevel, 'technical_equivalent' | 'strong_contextual_inference' | 'semantic_bridge_only'>
  rewritePermission: Extract<RewritePermission, 'can_claim_normalized' | 'can_bridge_carefully' | 'can_mention_as_related_context'>
}

export type DomainResumeEvidenceEntry = {
  term: string
  span: string
  normalized: string
  canonical: string
}

export type DomainEquivalentMatch = {
  evidenceLevel: DomainEquivalentRule['evidenceLevel']
  confidence: number
  matchedResumeTerms: string[]
  supportingResumeSpans: string[]
  rationale: string
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
  terms: CatalogTermRef[]
  categories: CatalogCategoryRef[]
  categoriesById: Map<string, CatalogCategoryRef>
  antiEquivalentPairs: Set<string>
}

type CatalogSignalMatch = {
  terms: CatalogTermRef[]
  categories: CatalogCategoryRef[]
}

const GENERIC_TAXONOMY_PATH = 'src/lib/agent/job-targeting/catalog/generic-taxonomy.json'
const DOMAIN_PACKS_DIR = 'src/lib/agent/job-targeting/catalog/domain-packs'

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

export function loadDomainEquivalentCatalog() {
  return loadJobTargetingCatalog({
    genericTaxonomyPath: GENERIC_TAXONOMY_PATH,
    domainPackPaths: listDomainPackPaths(),
  })
}

function buildValues(term: CatalogTerm): string[] {
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

function buildPairKey(leftTermId: string, rightTermId: string): string {
  return [leftTermId, rightTermId].sort().join('::')
}

function buildCatalogIndex(): CatalogIndex {
  const packs = loadCatalogPacksSync()
  const terms = packs.flatMap((pack) => pack.terms.map((term) => {
    const values = buildValues(term)

    return {
      packId: pack.id,
      term,
      values,
    }
  }))
  const categories = packs.flatMap((pack) => pack.categories.map((category) => {
    const values = buildCategoryValues(category)

    return {
      packId: pack.id,
      category,
      values,
    }
  }))
  const categoriesById = new Map(categories.map((categoryRef) => [categoryRef.category.id, categoryRef]))
  const antiEquivalentPairs = new Set(
    packs.flatMap((pack) => pack.antiEquivalences.map((antiEquivalence) => (
      buildPairKey(antiEquivalence.leftTermId, antiEquivalence.rightTermId)
    ))),
  )

  return {
    terms,
    categories,
    categoriesById,
    antiEquivalentPairs,
  }
}

function getCatalogIndex(): CatalogIndex {
  cachedCatalogIndex ??= buildCatalogIndex()
  return cachedCatalogIndex
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function signalMatchesCatalogValues(signal: string, values: string[]): boolean {
  const normalizedSignal = normalizeSemanticText(signal)
  const canonicalSignal = buildCanonicalSignal(signal)

  return values.some((value) => {
    const normalizedValue = normalizeSemanticText(value)
    const canonicalValue = buildCanonicalSignal(value)

    return Boolean(
      normalizedSignal
      && normalizedValue
      && canonicalSignal
      && canonicalValue
      && (
        canonicalSignal === canonicalValue
        || includesNormalizedPhrase(normalizedSignal, normalizedValue)
      ),
    )
  })
}

function findCatalogSignalMatches(signal: string, index: CatalogIndex): CatalogSignalMatch {
  const terms = index.terms.filter((termRef) => signalMatchesCatalogValues(signal, termRef.values))
  const categories = index.categories.filter((categoryRef) => signalMatchesCatalogValues(signal, categoryRef.values))

  return {
    terms,
    categories,
  }
}

function findResumeCatalogEvidence(
  resumeEvidence: DomainResumeEvidenceEntry[],
  index: CatalogIndex,
): Array<{
  evidence: DomainResumeEvidenceEntry
  terms: CatalogTermRef[]
  categories: CatalogCategoryRef[]
}> {
  return resumeEvidence
    .map((evidence) => {
      const termMatches = index.terms.filter((termRef) => (
        signalMatchesCatalogValues(evidence.term, termRef.values)
        || signalMatchesCatalogValues(evidence.span, termRef.values)
      ))
      const categoryMatches = index.categories.filter((categoryRef) => (
        signalMatchesCatalogValues(evidence.term, categoryRef.values)
        || signalMatchesCatalogValues(evidence.span, categoryRef.values)
      ))

      return {
        evidence,
        terms: termMatches,
        categories: categoryMatches,
      }
    })
    .filter((entry) => entry.terms.length > 0 || entry.categories.length > 0)
}

function requirednessForRequirement(requirement: string): RequirementSubSignal['requiredness'] {
  const normalized = normalizeSemanticText(requirement)

  if (/\b(?:desejavel|desejaveis|diferencial|nice to have|preferred)\b/u.test(normalized)) {
    return 'preferred'
  }

  if (/\b(?:requisito|obrigatorio|required|mandatory|dominio|experiencia|vivencia|conhecimento)\b/u.test(normalized)) {
    return 'required'
  }

  return 'unknown'
}

function kindForSignal(signal: string): RequirementSubSignal['kind'] {
  const normalized = normalizeSemanticText(signal)

  if (/\b(?:formacao|graduacao|bacharelado|licenciatura|degree|education|academic|curso)\b/u.test(normalized)) {
    return 'education'
  }

  if (/\b(?:experiencia|vivencia|atuacao|background|track record)\b/u.test(normalized)) {
    return 'experience'
  }

  if (/\b(?:negocio|business|cliente|stakeholder|mercado|operacao|processo|area)\b/u.test(normalized)) {
    return 'business_context'
  }

  const index = getCatalogIndex()
  const catalogMatch = findCatalogSignalMatches(signal, index)
  if (catalogMatch.terms.length > 0) {
    return 'tool'
  }

  if (catalogMatch.categories.length > 0) {
    return 'domain'
  }

  return 'unknown'
}

function cleanSubSignal(value: string): string {
  return value
    .replace(/^[\-*\u2022]\s*/u, '')
    .replace(/^experi[eê]ncia\s+(?:com|em)\s+/iu, '')
    .replace(/^viv[eê]ncia\s+(?:com|em)\s+/iu, '')
    .replace(/^conhecimento\s+(?:em|com)\s+/iu, '')
    .replace(/^dom[ií]nio\s+(?:de|em)\s+/iu, '')
    .replace(/^como\s+/iu, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.;:]+$/u, '')
    .trim()
}

function pushSubSignal(
  result: RequirementSubSignal[],
  originalRequirement: string,
  signal: string,
  requiredness: RequirementSubSignal['requiredness'],
): void {
  const cleaned = cleanSubSignal(signal)
  const canonical = buildCanonicalSignal(cleaned)
  if (!cleaned || !canonical) {
    return
  }

  if (result.some((entry) => buildCanonicalSignal(entry.signal) === canonical)) {
    return
  }

  result.push({
    originalRequirement,
    signal: cleaned,
    kind: kindForSignal(cleaned),
    requiredness,
  })
}

export function decomposeRequirementSignal(requirement: string): RequirementSubSignal[] {
  const requiredness = requirednessForRequirement(requirement)
  const result: RequirementSubSignal[] = []
  const index = getCatalogIndex()

  pushSubSignal(result, requirement, requirement, requiredness)

  index.terms.forEach((termRef) => {
    if (signalMatchesCatalogValues(requirement, termRef.values)) {
      termRef.values
        .filter((value) => signalMatchesCatalogValues(requirement, [value]))
        .forEach((value) => pushSubSignal(result, requirement, value, requiredness))
    }
  })

  index.categories.forEach((categoryRef) => {
    if (signalMatchesCatalogValues(requirement, categoryRef.values)) {
      categoryRef.values
        .filter((value) => signalMatchesCatalogValues(requirement, [value]))
        .forEach((value) => pushSubSignal(result, requirement, value, requiredness))
    }
  })

  requirement
    .split(/[,;]|\s+\bou\b\s+|\s+\bor\b\s+/iu)
    .map((part) => cleanSubSignal(part))
    .filter((part) => part.split(/\s+/u).filter(Boolean).length <= 6)
    .forEach((signal) => pushSubSignal(result, requirement, signal, requiredness))

  return result
}

function categoryHasRelationship(
  category: CatalogCategory,
  targetCategoryId: string,
  relationship: 'equivalent' | 'adjacent',
): boolean {
  const relationships = relationship === 'equivalent'
    ? category.equivalentCategoryIds
    : category.adjacentCategoryIds

  return relationships.some((item) => item.categoryId === targetCategoryId)
}

function categoriesAreRelated(
  leftCategory: CatalogCategoryRef,
  rightCategory: CatalogCategoryRef,
  relationship: 'equivalent' | 'adjacent',
): boolean {
  if (leftCategory.category.id === rightCategory.category.id) {
    return relationship === 'equivalent'
  }

  return categoryHasRelationship(leftCategory.category, rightCategory.category.id, relationship)
    || categoryHasRelationship(rightCategory.category, leftCategory.category.id, relationship)
}

function termPairIsBlocked(leftTerm: CatalogTermRef, rightTerm: CatalogTermRef, index: CatalogIndex): boolean {
  return index.antiEquivalentPairs.has(buildPairKey(leftTerm.term.id, rightTerm.term.id))
}

function termPairHasRelationship(
  leftTerm: CatalogTermRef,
  rightTerm: CatalogTermRef,
  index: CatalogIndex,
  relationship: 'equivalent' | 'adjacent',
): boolean {
  if (termPairIsBlocked(leftTerm, rightTerm, index)) {
    return false
  }

  return leftTerm.term.id === rightTerm.term.id && relationship === 'equivalent'
}

function categoryAndTermHaveRelationship(
  categoryRef: CatalogCategoryRef,
  termRef: CatalogTermRef,
  index: CatalogIndex,
  relationship: 'equivalent' | 'adjacent',
): boolean {
  return termRef.term.categoryIds.some((termCategoryId) => {
    const termCategory = index.categoriesById.get(termCategoryId)

    return Boolean(termCategory && categoriesAreRelated(categoryRef, termCategory, relationship))
  })
}

function termsHaveCategoryRelationship(
  leftTermRef: CatalogTermRef,
  rightTermRef: CatalogTermRef,
  index: CatalogIndex,
  relationship: 'equivalent' | 'adjacent',
): boolean {
  if (termPairIsBlocked(leftTermRef, rightTermRef, index)) {
    return false
  }

  return leftTermRef.term.categoryIds.some((leftCategoryId) => {
    const leftCategory = index.categoriesById.get(leftCategoryId)

    return Boolean(leftCategory && rightTermRef.term.categoryIds.some((rightCategoryId) => {
      const rightCategory = index.categoriesById.get(rightCategoryId)

      return Boolean(rightCategory && categoriesAreRelated(leftCategory, rightCategory, relationship))
    }))
  })
}

function collectRuleResumeMatches(
  resumeCatalogEvidence: ReturnType<typeof findResumeCatalogEvidence>,
  matchingJobSignals: CatalogSignalMatch[],
  relationship: 'equivalent' | 'adjacent',
  index: CatalogIndex,
): DomainResumeEvidenceEntry[] {
  const matches = resumeCatalogEvidence.filter((resumeEntry) => matchingJobSignals.some((jobMatch) => (
    jobMatch.terms.some((jobTerm) => resumeEntry.terms.some((resumeTerm) => (
      termPairHasRelationship(jobTerm, resumeTerm, index, relationship)
      || termsHaveCategoryRelationship(jobTerm, resumeTerm, index, relationship)
    )))
    || jobMatch.categories.some((jobCategory) => resumeEntry.terms.some((resumeTerm) => (
      categoryAndTermHaveRelationship(jobCategory, resumeTerm, index, relationship)
    )))
    || jobMatch.categories.some((jobCategory) => resumeEntry.categories.some((resumeCategory) => (
      categoriesAreRelated(jobCategory, resumeCategory, relationship)
    )))
  )))

  return Array.from(new Map(matches.map((entry) => [`${entry.evidence.term}|${entry.evidence.span}`, entry.evidence])).values())
}

function jobMatchesIncludeBlockedTermPair(
  matchingJobSignals: CatalogSignalMatch[],
  index: CatalogIndex,
): boolean {
  const termsById = new Map<string, CatalogTermRef>()

  matchingJobSignals.forEach((match) => {
    match.terms.forEach((termRef) => {
      termsById.set(termRef.term.id, termRef)
    })
  })

  const terms = Array.from(termsById.values())
  for (let leftIndex = 0; leftIndex < terms.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < terms.length; rightIndex += 1) {
      const leftTerm = terms[leftIndex]
      const rightTerm = terms[rightIndex]

      if (leftTerm && rightTerm && termPairIsBlocked(leftTerm, rightTerm, index)) {
        return true
      }
    }
  }

  return false
}

function jobMatchesIncludeAntiEquivalentTerm(
  matchingJobSignals: CatalogSignalMatch[],
  index: CatalogIndex,
): boolean {
  return matchingJobSignals.some((match) => match.terms.some((termRef) => (
    Array.from(index.antiEquivalentPairs).some((pairKey) => pairKey.split('::').includes(termRef.term.id))
  )))
}

function buildDomainEquivalentRules(): DomainEquivalentRule[] {
  const index = getCatalogIndex()
  const equivalentRules = index.categories
    .filter((categoryRef) => categoryRef.category.equivalentCategoryIds.length > 0)
    .map((categoryRef) => {
      const equivalentCategories = categoryRef.category.equivalentCategoryIds
        .map((relationship) => index.categoriesById.get(relationship.categoryId))
        .filter((category): category is CatalogCategoryRef => Boolean(category))

      return {
        jobSignals: uniqueValues(categoryRef.values),
        resumeSignals: uniqueValues(equivalentCategories.flatMap((category) => category.values)),
        evidenceLevel: 'technical_equivalent',
        rewritePermission: 'can_claim_normalized',
      } satisfies DomainEquivalentRule
    })

  const adjacentRules = index.categories
    .filter((categoryRef) => categoryRef.category.adjacentCategoryIds.length > 0)
    .map((categoryRef) => {
      const adjacentCategories = categoryRef.category.adjacentCategoryIds
        .map((relationship) => index.categoriesById.get(relationship.categoryId))
        .filter((category): category is CatalogCategoryRef => Boolean(category))

      return {
        jobSignals: uniqueValues(categoryRef.values),
        resumeSignals: uniqueValues(adjacentCategories.flatMap((category) => category.values)),
        evidenceLevel: 'strong_contextual_inference',
        rewritePermission: 'can_bridge_carefully',
      } satisfies DomainEquivalentRule
    })

  return [...equivalentRules, ...adjacentRules]
}

export const DOMAIN_EQUIVALENT_RULES: DomainEquivalentRule[] = buildDomainEquivalentRules()

export function findDomainEquivalentMatch(
  jobSignal: string,
  resumeEvidence: DomainResumeEvidenceEntry[],
): DomainEquivalentMatch | null {
  const index = getCatalogIndex()
  const subSignals = decomposeRequirementSignal(jobSignal)
  const candidates = subSignals.length > 0 ? subSignals.map((entry) => entry.signal) : [jobSignal]
  const jobMatches = candidates
    .map((candidate) => findCatalogSignalMatches(candidate, index))
    .filter((match) => match.terms.length > 0 || match.categories.length > 0)

  if (jobMatches.length === 0) {
    return null
  }

  const resumeCatalogEvidence = findResumeCatalogEvidence(resumeEvidence, index)
  if (resumeCatalogEvidence.length === 0) {
    return null
  }

  const equivalentMatches = collectRuleResumeMatches(resumeCatalogEvidence, jobMatches, 'equivalent', index)
  if (equivalentMatches.length > 0) {
    return {
      evidenceLevel: 'technical_equivalent',
      confidence: 0.88,
      matchedResumeTerms: equivalentMatches.map((entry) => entry.term),
      supportingResumeSpans: equivalentMatches.map((entry) => entry.span),
      rationale: 'The job signal is supported by catalog-equivalent resume evidence.',
    }
  }

  if (
    jobMatchesIncludeBlockedTermPair(jobMatches, index)
    || jobMatchesIncludeAntiEquivalentTerm(jobMatches, index)
  ) {
    return null
  }

  const adjacentMatches = collectRuleResumeMatches(resumeCatalogEvidence, jobMatches, 'adjacent', index)
  if (adjacentMatches.length > 0) {
    return {
      evidenceLevel: 'strong_contextual_inference',
      confidence: 0.78,
      matchedResumeTerms: adjacentMatches.map((entry) => entry.term),
      supportingResumeSpans: adjacentMatches.map((entry) => entry.span),
      rationale: 'The job signal is supported by adjacent catalog evidence and must remain cautious.',
    }
  }

  return null
}
