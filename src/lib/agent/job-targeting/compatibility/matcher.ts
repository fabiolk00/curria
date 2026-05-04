import type {
  CatalogCategory,
  CatalogTerm,
  JobTargetingCatalogPack,
  LoadedJobTargetingCatalog,
} from '@/lib/agent/job-targeting/catalog/catalog-types'
import type {
  ClaimPermission,
  EvidenceQualifier,
  InternalEvidenceLevel,
  ProductEvidenceGroup,
  RequirementEvidence,
  RequirementEvidenceSource,
  RequirementImportance,
  RequirementKind,
} from '@/lib/agent/job-targeting/compatibility/types'
import {
  detectEvidencePolarity,
  isWeakEvidenceQualifier,
} from './evidence-qualifiers'

export const JOB_COMPATIBILITY_MATCHER_VERSION = 'job-compat-matcher-v1'

export const MATCHER_PRECEDENCE = [
  'exact',
  'catalog_alias',
  'catalog_anti_equivalence',
  'catalog_category',
  'llm_ambiguous',
  'fallback',
] as const satisfies readonly RequirementEvidenceSource[]

export interface MatcherRequirement {
  id: string
  text: string
  normalizedText?: string
  kind?: RequirementKind
  importance?: RequirementImportance
}

export interface MatcherResumeEvidence {
  id: string
  text: string
  normalizedText?: string
  section?: string
  sourceKind?: string
  cvPath?: string
  sourceConfidence?: number
  qualifier?: EvidenceQualifier
}

export type LLMResolverOutput = {
  suggestedEvidenceLevel:
    | 'strong_contextual_inference'
    | 'semantic_bridge_only'
    | 'unsupported_gap'
  evidenceIds?: string[]
  confidence: number
  rationale: string
  supportingResumeSpans: string[]
  matchedResumeTerms: string[]
}

export type RequirementEvidenceAmbiguityResolver = (input: {
  requirement: MatcherRequirement
  decomposedSignals: MatcherRequirement[]
  resumeEvidence: MatcherResumeEvidence[]
  catalog: LoadedJobTargetingCatalog
}) => LLMResolverOutput | null | undefined

export interface ClassifyRequirementEvidenceInput {
  requirement: MatcherRequirement
  decomposedSignals?: MatcherRequirement[]
  resumeEvidence: MatcherResumeEvidence[]
  catalog: LoadedJobTargetingCatalog
  ambiguityResolver?: RequirementEvidenceAmbiguityResolver
}

type CatalogIndex = {
  catalogIds: string[]
  catalogVersions: Record<string, string>
  termsById: Map<string, IndexedTerm>
  categoriesById: Map<string, IndexedCategory>
  antiEquivalences: Array<{
    leftTermId: string
    rightTermId: string
  }>
}

type IndexedTerm = {
  catalogId: string
  term: CatalogTerm
  labelTokens: string[]
  aliasTokens: string[][]
}

type IndexedCategory = {
  catalogId: string
  category: CatalogCategory
}

type TermOccurrence = {
  term: IndexedTerm
  matchLevel: 'exact' | 'catalog_alias'
  evidence?: MatcherResumeEvidence
}

type CategoryOccurrence = {
  category: IndexedCategory
}

type MatchCandidate = {
  group: ProductEvidenceGroup
  source: RequirementEvidenceSource
  level: InternalEvidenceLevel
  permission: ClaimPermission
  evidence: MatcherResumeEvidence[]
  requirementTermIds: string[]
  resumeTermIds: string[]
  categoryIds: string[]
  prohibitedTerms: string[]
  confidence: number
  rationaleCode: string
  antiEquivalenceTermIds?: string[]
  ambiguityResolved?: boolean
}

const stopWords = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'com',
  'da',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'for',
  'in',
  'including',
  'of',
  'or',
  'para',
  'por',
  'related',
  'the',
  'to',
  'with',
])

export function classifyRequirementEvidence({
  requirement,
  decomposedSignals = [],
  resumeEvidence,
  catalog,
  ambiguityResolver,
}: ClassifyRequirementEvidenceInput): RequirementEvidence {
  const catalogIndex = buildCatalogIndex(catalog)
  const requirementText = requirement.normalizedText ?? requirement.text
  const requirementTerms = findTermOccurrences(requirementText, catalogIndex)
  const requirementCategories = requirementTerms.length === 0
    ? findCategoryOccurrences(requirementText, catalogIndex)
    : []
  const evidenceTerms = resumeEvidence.flatMap((item) => (
    findTermOccurrences(item.normalizedText ?? item.text, catalogIndex)
      .map((occurrence) => ({ ...occurrence, evidence: item }))
  ))

  const sameTermMatch = findSameTermMatch(requirementTerms, evidenceTerms, 'exact', catalogIndex)
    ?? findSameTermMatch(requirementTerms, evidenceTerms, 'catalog_alias', catalogIndex)
  const directTextMatch = requirementTerms.length === 0 || requirement.kind === 'education'
    ? findDirectTextMatch(requirement, resumeEvidence)
    : null
  const antiEquivalenceMatch = findAntiEquivalenceMatch(requirement, requirementTerms, evidenceTerms, catalogIndex)
  const categoryMatch = findCategoryMatch(requirement, requirementTerms, evidenceTerms, catalogIndex, 'catalog_category')
    ?? findCategoryLabelMatch(requirement, requirementCategories, evidenceTerms, catalogIndex, 'catalog_category')
  const adjacentMatch = findCategoryMatch(requirement, requirementTerms, evidenceTerms, catalogIndex, 'adjacent_category')
    ?? findCategoryLabelMatch(requirement, requirementCategories, evidenceTerms, catalogIndex, 'adjacent_category')
  const resolverMatch = findResolverMatch({
    requirement,
    decomposedSignals,
    resumeEvidence,
    catalog,
    ambiguityResolver,
  })

  return toRequirementEvidence({
    requirement,
    catalogIndex,
    candidate: sameTermMatch
      ?? directTextMatch
      ?? antiEquivalenceMatch
      ?? categoryMatch
      ?? adjacentMatch
      ?? resolverMatch
      ?? unsupportedCandidate(requirement),
  })
}

function buildCatalogIndex(catalog: LoadedJobTargetingCatalog): CatalogIndex {
  const packs = [catalog.genericTaxonomy, ...catalog.domainPacks]
  const termsById = new Map<string, IndexedTerm>()
  const categoriesById = new Map<string, IndexedCategory>()
  const antiEquivalences: CatalogIndex['antiEquivalences'] = []

  packs.forEach((pack) => {
    pack.terms.forEach((term) => {
      termsById.set(term.id, {
        catalogId: pack.id,
        term,
        labelTokens: tokens(term.label),
        aliasTokens: term.aliases.map((alias) => tokens(alias.value)),
      })
    })

    pack.categories.forEach((category) => {
      categoriesById.set(category.id, {
        catalogId: pack.id,
        category,
      })
    })

    pack.antiEquivalences.forEach((antiEquivalence) => {
      antiEquivalences.push({
        leftTermId: antiEquivalence.leftTermId,
        rightTermId: antiEquivalence.rightTermId,
      })
    })
  })

  return {
    catalogIds: packs.map((pack) => pack.id),
    catalogVersions: versionsByPackId(packs),
    termsById,
    categoriesById,
    antiEquivalences,
  }
}

function versionsByPackId(packs: JobTargetingCatalogPack[]): Record<string, string> {
  return Object.fromEntries(packs.map((pack) => [pack.id, pack.version]))
}

function findTermOccurrences(value: string, catalogIndex: CatalogIndex): TermOccurrence[] {
  const valueTokens = tokens(value)
  const occurrences: TermOccurrence[] = []

  catalogIndex.termsById.forEach((term) => {
    if (containsTokenSequence(valueTokens, term.labelTokens)) {
      occurrences.push({ term, matchLevel: 'exact' })
      return
    }

    if (term.aliasTokens.some((aliasTokens) => containsTokenSequence(valueTokens, aliasTokens))) {
      occurrences.push({ term, matchLevel: 'catalog_alias' })
    }
  })

  return occurrences
}

function findCategoryOccurrences(value: string, catalogIndex: CatalogIndex): CategoryOccurrence[] {
  const valueTokens = tokens(value)
  const occurrences: CategoryOccurrence[] = []

  catalogIndex.categoriesById.forEach((category) => {
    if (containsTokenSequence(valueTokens, tokens(category.category.label))) {
      occurrences.push({ category })
    }
  })

  return occurrences
}

function findSameTermMatch(
  requirementTerms: TermOccurrence[],
  evidenceTerms: TermOccurrence[],
  requestedLevel: 'exact' | 'catalog_alias',
  catalogIndex: CatalogIndex,
): MatchCandidate | null {
  for (const requirementTerm of requirementTerms) {
    if (hasBlockingSpecificRequirementTerm(requirementTerm, requirementTerms, evidenceTerms, catalogIndex)) {
      continue
    }

    const matches = evidenceTerms.filter((evidenceTerm) => (
      evidenceTerm.term.term.id === requirementTerm.term.term.id
      && (
        requestedLevel === 'catalog_alias'
        || (requirementTerm.matchLevel === 'exact' && evidenceTerm.matchLevel === 'exact')
      )
      && evidenceTerm.evidence
    ))

    if (matches.length === 0) {
      continue
    }
    const firstMatch = matches[0]
    const evidence = uniqueById(matches
      .map((match) => match.evidence)
      .filter((item): item is MatcherResumeEvidence => Boolean(item)))

    const source = requirementTerm.matchLevel === 'exact' && firstMatch?.matchLevel === 'exact'
      ? 'exact'
      : 'catalog_alias'

    if (source !== requestedLevel) {
      continue
    }

    return {
      group: 'supported',
      source,
      level: source === 'exact' ? 'explicit' : 'catalog_alias',
      permission: source === 'exact' ? 'can_claim_directly' : 'can_claim_normalized',
      evidence,
      requirementTermIds: [requirementTerm.term.term.id],
      resumeTermIds: unique(matches.map((match) => match.term.term.id)),
      categoryIds: requirementTerm.term.term.categoryIds,
      prohibitedTerms: [],
      confidence: source === 'exact' ? 1 : 0.92,
      rationaleCode: source,
    }
  }

  return null
}

function hasBlockingSpecificRequirementTerm(
  candidateRequirementTerm: TermOccurrence,
  requirementTerms: TermOccurrence[],
  evidenceTerms: TermOccurrence[],
  catalogIndex: CatalogIndex,
): boolean {
  const candidateTermId = candidateRequirementTerm.term.term.id

  return catalogIndex.antiEquivalences.some((antiEquivalence) => {
    if (antiEquivalence.rightTermId !== candidateTermId) {
      return false
    }

    const specificTermId = antiEquivalence.leftTermId
    const requirementNamesSpecificTerm = requirementTerms.some((requirementTerm) => (
      requirementTerm.term.term.id === specificTermId
    ))
    const evidenceNamesSpecificTerm = evidenceTerms.some((evidenceTerm) => (
      evidenceTerm.term.term.id === specificTermId && evidenceTerm.evidence
    ))

    return requirementNamesSpecificTerm && !evidenceNamesSpecificTerm
  })
}

function findDirectTextMatch(
  requirement: MatcherRequirement,
  resumeEvidence: MatcherResumeEvidence[],
): MatchCandidate | null {
  if (requirement.kind === 'education') {
    return findEducationTextMatch(requirement, resumeEvidence)
  }

  const requirementTokens = meaningfulTokens(requirement.text)
  const matches = resumeEvidence
    .map((item) => ({ item, score: textOverlapScore(requirementTokens, meaningfulTokens(item.text)) }))
    .filter(({ score }) => score.overlapCount > 0)
    .sort((left, right) => right.score.score - left.score.score)
  const match = matches[0]

  if (!match) {
    return null
  }

  if (
    match.score.containsPhrase
    || (match.score.overlapCount >= 2 && match.score.score >= 0.5)
  ) {
      const supportingEvidence = uniqueById(matches
        .filter(({ score }) => score.containsPhrase || score.score >= 0.34)
        .map(({ item }) => item))

      return {
        group: 'supported',
        source: 'exact',
        level: 'explicit',
        permission: 'can_claim_directly',
        evidence: supportingEvidence,
        requirementTermIds: [],
        resumeTermIds: [],
        categoryIds: [],
        prohibitedTerms: [],
        confidence: Math.max(0.72, match.score.score),
      rationaleCode: 'direct_text_match',
    }
  }

  return null
}

function findEducationTextMatch(
  requirement: MatcherRequirement,
  resumeEvidence: MatcherResumeEvidence[],
): MatchCandidate | null {
  const educationEvidence = resumeEvidence.filter((item) => item.section === 'education')
  const alternatives = educationAlternatives(requirement.text)

  for (const item of educationEvidence) {
    const itemTokens = meaningfulTokens(item.text)
    const alternativeIndex = alternatives.findIndex((alternative) => (
      alternative.length > 0 && containsTokenSequence(itemTokens, alternative)
    ))

    if (alternativeIndex >= 0) {
      const isPrimaryAlternative = alternativeIndex === 0

      return {
        group: isPrimaryAlternative ? 'supported' : 'adjacent',
        source: isPrimaryAlternative ? 'exact' : 'composite_decomposition',
        level: isPrimaryAlternative ? 'explicit' : 'semantic_bridge_only',
        permission: isPrimaryAlternative ? 'can_claim_directly' : 'can_bridge_carefully',
        evidence: [item],
        requirementTermIds: [],
        resumeTermIds: [],
        categoryIds: [],
        prohibitedTerms: [],
        confidence: isPrimaryAlternative ? 0.86 : 0.62,
        rationaleCode: isPrimaryAlternative ? 'education_text_match' : 'education_related_match',
      }
    }

    const score = textOverlapScore(meaningfulTokens(requirement.text), itemTokens)

    if (score.overlapCount >= 1 && score.score >= 0.34) {
      return {
        group: 'supported',
        source: 'exact',
        level: 'explicit',
        permission: 'can_claim_directly',
        evidence: [item],
        requirementTermIds: [],
        resumeTermIds: [],
        categoryIds: [],
        prohibitedTerms: [],
        confidence: Math.max(0.7, score.score),
        rationaleCode: 'education_text_match',
      }
    }
  }

  return null
}

function findAntiEquivalenceMatch(
  requirement: MatcherRequirement,
  requirementTerms: TermOccurrence[],
  evidenceTerms: TermOccurrence[],
  catalogIndex: CatalogIndex,
): MatchCandidate | null {
  for (const antiEquivalence of catalogIndex.antiEquivalences) {
    const requirementTerm = requirementTerms.find((occurrence) => (
      occurrence.term.term.id === antiEquivalence.leftTermId
      || occurrence.term.term.id === antiEquivalence.rightTermId
    ))

    if (!requirementTerm) {
      continue
    }

    const oppositeTermId = requirementTerm.term.term.id === antiEquivalence.leftTermId
      ? antiEquivalence.rightTermId
      : antiEquivalence.leftTermId
    const evidenceTerm = evidenceTerms.find((occurrence) => occurrence.term.term.id === oppositeTermId)

    if (!evidenceTerm?.evidence) {
      continue
    }

    const hasAdjacentRelationship = hasCategoryRelationship(
      requirementTerm.term.term.categoryIds,
      evidenceTerm.term.term.categoryIds,
      catalogIndex,
      'adjacent_category',
    )
    const hasAdjacentTextSupport = hasResidualRequirementSupport(
      requirement,
      requirementTerm.term,
      evidenceTerm.evidence,
    )
    const shouldRemainAdjacent = hasAdjacentRelationship && hasAdjacentTextSupport

    return {
      group: shouldRemainAdjacent ? 'adjacent' : 'unsupported',
      source: 'catalog_anti_equivalence',
      level: shouldRemainAdjacent ? 'semantic_bridge_only' : 'unsupported_gap',
      permission: shouldRemainAdjacent ? 'can_mention_as_related_context' : 'must_not_claim',
      evidence: [evidenceTerm.evidence],
      requirementTermIds: [requirementTerm.term.term.id],
      resumeTermIds: [evidenceTerm.term.term.id],
      categoryIds: [...requirementTerm.term.term.categoryIds, ...evidenceTerm.term.term.categoryIds],
      prohibitedTerms: shouldRemainAdjacent ? [] : [requirementTerm.term.term.label],
      confidence: shouldRemainAdjacent ? 0.56 : 0.98,
      rationaleCode: shouldRemainAdjacent
        ? 'catalog_anti_equivalence_adjacent'
        : 'catalog_anti_equivalence_blocked',
      antiEquivalenceTermIds: [requirementTerm.term.term.id, evidenceTerm.term.term.id],
    }
  }

  return null
}

function hasResidualRequirementSupport(
  requirement: MatcherRequirement,
  requirementTerm: IndexedTerm,
  evidence: MatcherResumeEvidence,
): boolean {
  const termTokens = new Set(requirementTerm.labelTokens)
  const residualRequirementTokens = meaningfulTokens(requirement.text)
    .filter((token) => !termTokens.has(token))

  if (residualRequirementTokens.length === 0) {
    return true
  }

  const score = textOverlapScore(residualRequirementTokens, meaningfulTokens(evidence.text))

  return score.overlapCount >= 1 && score.score >= 0.34
}

function findCategoryMatch(
  requirement: MatcherRequirement,
  requirementTerms: TermOccurrence[],
  evidenceTerms: TermOccurrence[],
  catalogIndex: CatalogIndex,
  level: 'catalog_category' | 'adjacent_category',
): MatchCandidate | null {
  for (const requirementTerm of requirementTerms) {
    const match = evidenceTerms.find((evidenceTerm) => (
      hasCategoryRelationship(
        requirementTerm.term.term.categoryIds,
        evidenceTerm.term.term.categoryIds,
        catalogIndex,
        level,
      )
    ))

    if (!match?.evidence || !hasResidualRequirementSupport(requirement, requirementTerm.term, match.evidence)) {
      continue
    }

    return {
      group: level === 'catalog_category' ? 'supported' : 'adjacent',
      source: 'catalog_category',
      level: level === 'catalog_category' ? 'category_equivalent' : 'semantic_bridge_only',
      permission: level === 'catalog_category' ? 'can_claim_normalized' : 'can_bridge_carefully',
      evidence: [match.evidence],
      requirementTermIds: [requirementTerm.term.term.id],
      resumeTermIds: [match.term.term.id],
      categoryIds: [...requirementTerm.term.term.categoryIds, ...match.term.term.categoryIds],
      prohibitedTerms: [],
      confidence: level === 'catalog_category' ? 0.82 : 0.58,
      rationaleCode: level,
    }
  }

  return null
}

function findCategoryLabelMatch(
  requirement: MatcherRequirement,
  requirementCategories: CategoryOccurrence[],
  evidenceTerms: TermOccurrence[],
  catalogIndex: CatalogIndex,
  level: 'catalog_category' | 'adjacent_category',
): MatchCandidate | null {
  for (const requirementCategory of requirementCategories) {
    const matches = evidenceTerms.filter((evidenceTerm) => (
      evidenceTerm.evidence
      && (
        hasCategoryRelationship(
          [requirementCategory.category.category.id],
          evidenceTerm.term.term.categoryIds,
          catalogIndex,
          level,
        )
        || (
          level === 'catalog_category'
          && evidenceTerm.term.term.categoryIds.includes(requirementCategory.category.category.id)
        )
      )
    ))

    if (matches.length === 0) {
      continue
    }

    return {
      group: level === 'catalog_category' ? 'supported' : 'adjacent',
      source: 'catalog_category',
      level: level === 'catalog_category' ? 'category_equivalent' : 'semantic_bridge_only',
      permission: level === 'catalog_category' ? 'can_claim_normalized' : 'can_bridge_carefully',
      evidence: uniqueById(matches
        .map((match) => match.evidence)
        .filter((item): item is MatcherResumeEvidence => Boolean(item))),
      requirementTermIds: [],
      resumeTermIds: unique(matches.map((match) => match.term.term.id)),
      categoryIds: unique([
        requirementCategory.category.category.id,
        ...matches.flatMap((match) => match.term.term.categoryIds),
      ]),
      prohibitedTerms: [],
      confidence: level === 'catalog_category' ? 0.78 : 0.54,
      rationaleCode: `${level}_label`,
    }
  }

  return null
}

function hasCategoryRelationship(
  leftCategoryIds: string[],
  rightCategoryIds: string[],
  catalogIndex: CatalogIndex,
  level: 'catalog_category' | 'adjacent_category',
): boolean {
  return leftCategoryIds.some((leftCategoryId) => (
    rightCategoryIds.some((rightCategoryId) => (
      categoryRelatesTo(leftCategoryId, rightCategoryId, catalogIndex, level)
      || categoryRelatesTo(rightCategoryId, leftCategoryId, catalogIndex, level)
    ))
  ))
}

function categoryRelatesTo(
  leftCategoryId: string,
  rightCategoryId: string,
  catalogIndex: CatalogIndex,
  level: 'catalog_category' | 'adjacent_category',
): boolean {
  const category = catalogIndex.categoriesById.get(leftCategoryId)?.category

  if (!category) {
    return false
  }

  const relationships = level === 'catalog_category'
    ? category.equivalentCategoryIds
    : category.adjacentCategoryIds

  return relationships.some((relationship) => relationship.categoryId === rightCategoryId)
}

function findResolverMatch({
  requirement,
  decomposedSignals,
  resumeEvidence,
  catalog,
  ambiguityResolver,
}: Required<Pick<ClassifyRequirementEvidenceInput, 'requirement' | 'resumeEvidence' | 'catalog'>>
  & Pick<ClassifyRequirementEvidenceInput, 'decomposedSignals' | 'ambiguityResolver'>): MatchCandidate | null {
  const decision = ambiguityResolver?.({
    requirement,
    decomposedSignals: decomposedSignals ?? [],
    resumeEvidence,
    catalog,
  })

  if (!decision) {
    return null
  }

  if (!isValidResolverDecision(decision)) {
    return unsupportedCandidate(requirement)
  }

  const evidenceById = new Map(resumeEvidence.map((item) => [item.id, item]))
  const matchedEvidence = (decision.evidenceIds ?? [])
    .map((id) => evidenceById.get(id))
    .filter((item): item is MatcherResumeEvidence => Boolean(item))
  const hasSupportingSpans = decision.supportingResumeSpans.some((span) => span.trim())
    || matchedEvidence.length > 0
  const suggestedLevel = hasSupportingSpans
    ? decision.suggestedEvidenceLevel
    : 'semantic_bridge_only'
  const group = suggestedLevel === 'unsupported_gap' ? 'unsupported' : 'adjacent'

  return {
    group,
    source: 'llm_ambiguous',
    level: suggestedLevel,
    permission: permissionForResolverLevel(suggestedLevel),
    evidence: matchedEvidence,
    requirementTermIds: [],
    resumeTermIds: [],
    categoryIds: [],
    prohibitedTerms: suggestedLevel === 'unsupported_gap' ? [requirement.text] : [],
    confidence: decision.confidence ?? 0.5,
    rationaleCode: decision.rationale || 'llm_ambiguity_resolved',
    ambiguityResolved: true,
  }
}

function isValidResolverDecision(decision: LLMResolverOutput): boolean {
  if (!Number.isFinite(decision.confidence) || decision.confidence < 0 || decision.confidence > 1) {
    return false
  }

  return decision.suggestedEvidenceLevel === 'strong_contextual_inference'
    || decision.suggestedEvidenceLevel === 'semantic_bridge_only'
    || decision.suggestedEvidenceLevel === 'unsupported_gap'
}

function unsupportedCandidate(requirement: MatcherRequirement): MatchCandidate {
  return {
    group: 'unsupported',
    source: 'fallback',
    level: 'unsupported_gap',
    permission: 'must_not_claim',
    evidence: [],
    requirementTermIds: [],
    resumeTermIds: [],
    categoryIds: [],
    prohibitedTerms: [requirement.text],
    confidence: 0,
    rationaleCode: 'unsupported_fallback',
  }
}

function toRequirementEvidence({
  requirement,
  catalogIndex,
  candidate,
}: {
  requirement: MatcherRequirement
  catalogIndex: CatalogIndex
  candidate: MatchCandidate
}): RequirementEvidence {
  const finalCandidate = applyEvidenceStrengthPolicy(requirement, candidate, catalogIndex)
  const requirementTermLabels = labelsForTermIds(finalCandidate.requirementTermIds, catalogIndex)
  const resumeTermLabels = labelsForTermIds(finalCandidate.resumeTermIds, catalogIndex)
  const extractedSignals = unique([
    ...requirementTermLabels,
    ...(requirementTermLabels.length === 0 ? [requirement.text] : []),
  ])
  const matchedResumeTerms = unique([
    ...resumeTermLabels,
    ...finalCandidate.evidence.map((item) => item.text),
  ])
  const catalogTermIds = unique([...finalCandidate.requirementTermIds, ...finalCandidate.resumeTermIds])

  return {
    id: requirement.id,
    originalRequirement: requirement.text,
    normalizedRequirement: requirement.normalizedText ?? normalizeTextForAudit(requirement.text),
    extractedSignals,
    kind: requirement.kind ?? 'unknown',
    importance: requirement.importance ?? 'secondary',
    productGroup: finalCandidate.group,
    evidenceLevel: finalCandidate.level,
    rewritePermission: finalCandidate.permission,
    matchedResumeTerms,
    supportingResumeSpans: finalCandidate.evidence.map((item) => ({
      id: item.id,
      text: item.text,
      ...(item.section === undefined ? {} : { section: item.section }),
      ...(item.sourceKind === undefined ? {} : { sourceKind: item.sourceKind }),
      ...(item.cvPath === undefined ? {} : { cvPath: item.cvPath }),
    })),
    confidence: finalCandidate.confidence,
    rationale: finalCandidate.rationaleCode,
    source: finalCandidate.source,
    catalogTermIds,
    catalogCategoryIds: unique(finalCandidate.categoryIds),
    prohibitedTerms: unique(finalCandidate.prohibitedTerms),
    audit: {
      matcherVersion: JOB_COMPATIBILITY_MATCHER_VERSION,
      precedence: MATCHER_PRECEDENCE,
      catalogIds: catalogIndex.catalogIds,
      catalogVersions: catalogIndex.catalogVersions,
      catalogTermIds,
      catalogCategoryIds: unique(finalCandidate.categoryIds),
      ...(finalCandidate.antiEquivalenceTermIds === undefined
        ? {}
        : { antiEquivalenceTermIds: unique(finalCandidate.antiEquivalenceTermIds) }),
      ...(finalCandidate.ambiguityResolved === undefined ? {} : { ambiguityResolved: finalCandidate.ambiguityResolved }),
    },
  }
}

function applyEvidenceStrengthPolicy(
  requirement: MatcherRequirement,
  candidate: MatchCandidate,
  catalogIndex: CatalogIndex,
): MatchCandidate {
  if (candidate.group === 'unsupported' || candidate.evidence.length === 0) {
    return candidate
  }

  const relevantTerms = unique([
    requirement.text,
    ...labelsForTermIds(candidate.requirementTermIds, catalogIndex),
    ...labelsForTermIds(candidate.resumeTermIds, catalogIndex),
  ])
  const positiveEvidence = candidate.evidence.filter((item) => (
    !isNegativeEvidenceForTerms(item.text, relevantTerms)
  ))

  if (positiveEvidence.length === 0) {
    return {
      ...candidate,
      group: 'unsupported',
      level: 'unsupported_gap',
      permission: 'must_not_claim',
      prohibitedTerms: unique([...candidate.prohibitedTerms, requirement.text]),
      confidence: Math.min(candidate.confidence, 0.2),
      rationaleCode: `${candidate.rationaleCode}:negative_evidence`,
    }
  }

  const candidateWithPositiveEvidence = positiveEvidence.length === candidate.evidence.length
    ? candidate
    : {
        ...candidate,
        evidence: positiveEvidence,
        rationaleCode: `${candidate.rationaleCode}:negative_evidence_filtered`,
      }

  const strongestSourceConfidence = Math.max(
    ...candidateWithPositiveEvidence.evidence.map((item) => item.sourceConfidence ?? 0.75),
  )
  const qualifiers = candidateWithPositiveEvidence.evidence.map((item) => item.qualifier ?? 'unknown')
  const hasNegativeEvidence = qualifiers.includes('negative')
  const hasWeakEvidence = qualifiers.some(isWeakEvidenceQualifier)
  const confidence = roundTo(candidateWithPositiveEvidence.confidence * strongestSourceConfidence, 2)

  if (hasNegativeEvidence) {
    return {
      ...candidateWithPositiveEvidence,
      group: 'unsupported',
      level: 'unsupported_gap',
      permission: 'must_not_claim',
      prohibitedTerms: unique([...candidateWithPositiveEvidence.prohibitedTerms, requirement.text]),
      confidence: Math.min(confidence, 0.2),
      rationaleCode: `${candidateWithPositiveEvidence.rationaleCode}:negative_evidence`,
    }
  }

  if (
    candidateWithPositiveEvidence.group === 'supported'
    && (
      confidence < 0.6
      || (hasWeakEvidence && !requirementAllowsWeakEvidence(requirement.text))
    )
  ) {
    return {
      ...candidateWithPositiveEvidence,
      group: 'adjacent',
      level: 'semantic_bridge_only',
      permission: 'can_bridge_carefully',
      confidence,
      rationaleCode: `${candidateWithPositiveEvidence.rationaleCode}:reduced_by_evidence_strength`,
    }
  }

  return {
    ...candidateWithPositiveEvidence,
    confidence,
  }
}

function isNegativeEvidenceForTerms(text: string, terms: string[]): boolean {
  return terms.some((term) => detectEvidencePolarity(text, term) === 'negative')
}

function requirementAllowsWeakEvidence(value: string): boolean {
  return /\b(?:b[aá]sic[ao]|basic|introduct[oó]ri[ao]|introductory|familiarity|no[cç][oõ]es)\b/iu.test(value)
}

function permissionForGroup(group: ProductEvidenceGroup): ClaimPermission {
  if (group === 'supported') {
    return 'can_claim_normalized'
  }

  if (group === 'adjacent') {
    return 'can_bridge_carefully'
  }

  return 'must_not_claim'
}

function permissionForResolverLevel(level: LLMResolverOutput['suggestedEvidenceLevel']): ClaimPermission {
  if (level === 'strong_contextual_inference') {
    return 'can_bridge_carefully'
  }

  if (level === 'semantic_bridge_only') {
    return 'can_mention_as_related_context'
  }

  return 'must_not_claim'
}

function evidenceLevelForGroup(group: ProductEvidenceGroup): InternalEvidenceLevel {
  if (group === 'supported') {
    return 'strong_contextual_inference'
  }

  if (group === 'adjacent') {
    return 'semantic_bridge_only'
  }

  return 'unsupported_gap'
}

function labelsForTermIds(termIds: string[], catalogIndex: CatalogIndex): string[] {
  return termIds
    .map((termId) => catalogIndex.termsById.get(termId)?.term.label)
    .filter((label): label is string => Boolean(label))
}

function normalizeTextForAudit(value: string): string {
  return tokens(value).join(' ')
}

function educationAlternatives(value: string): string[][] {
  return value
    .replace(/\bor\b/giu, ',')
    .split(',')
    .map((item) => item.replace(/\b(?:degree|bacharelado|bachelor|licenciatura|technologist)\s+(?:in|em)?\b/giu, ' '))
    .map(meaningfulTokens)
    .filter((item) => item.length > 0)
}

function textOverlapScore(
  requirementTokens: string[],
  evidenceTokens: string[],
): {
  overlapCount: number
  score: number
  containsPhrase: boolean
} {
  const uniqueRequirementTokens = unique(requirementTokens)
  const uniqueEvidenceTokens = unique(evidenceTokens)
  const overlapCount = uniqueRequirementTokens
    .filter((token) => uniqueEvidenceTokens.includes(token))
    .length
  const denominator = Math.max(1, Math.min(uniqueRequirementTokens.length, uniqueEvidenceTokens.length))

  return {
    overlapCount,
    score: overlapCount / denominator,
    containsPhrase: containsTokenSequence(uniqueRequirementTokens, uniqueEvidenceTokens)
      || containsTokenSequence(uniqueEvidenceTokens, uniqueRequirementTokens),
  }
}

function containsTokenSequence(sourceTokens: string[], candidateTokens: string[]): boolean {
  if (candidateTokens.length === 0 || candidateTokens.length > sourceTokens.length) {
    return false
  }

  return sourceTokens.some((_, index) => (
    candidateTokens.every((token, offset) => sourceTokens[index + offset] === token)
  ))
}

function meaningfulTokens(value: string): string[] {
  return tokens(value).filter((token) => !stopWords.has(token))
}

function tokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(stemToken)
}

function stemToken(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) {
    return token.slice(0, -3)
  }

  if (token.length > 6 && token.endsWith('tion')) {
    return token.slice(0, -3)
  }

  if (token.length > 4 && token.endsWith('ed')) {
    return token.slice(0, -2)
  }

  if (token.length > 5 && token.endsWith('e')) {
    return token.slice(0, -1)
  }

  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1)
  }

  return token
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }

    seen.add(item.id)
    return true
  })
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
