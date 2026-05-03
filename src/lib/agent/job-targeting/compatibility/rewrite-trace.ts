import type {
  GeneratedClaimTrace,
  GeneratedClaimTraceSection,
  JobCompatibilityClaimPolicy,
  SectionRewritePlan,
  SectionRewriteItemPermissionLevel,
  SectionRewriteItemSource,
} from '@/lib/agent/job-targeting/compatibility/types'
import {
  canonicalizeClaimSignal,
  containsCanonicalClaimSignal,
  uniqueByCanonicalClaimSignal,
} from '@/lib/agent/job-targeting/compatibility/claim-signal'
import type { CVState } from '@/types/cv'
import type { RewriteClaimTraceItem } from '@/types/agent'

type SectionItem = {
  section: GeneratedClaimTraceSection
  path: string
  text: string
}

export function buildSectionRewritePlan(params: {
  section: GeneratedClaimTraceSection
  originalCvState: CVState
  generatedCvState: CVState
  claimPolicy: JobCompatibilityClaimPolicy
  modelClaimTraceItems?: RewriteClaimTraceItem[]
}): SectionRewritePlan {
  const originalItems = flattenSection(params.originalCvState, params.section)
  const originalTexts = new Set(originalItems.map((item) => normalize(item.text)))
  const originalByPath = new Map(originalItems.map((item) => [item.path, item]))
  const modelTraceByPath = new Map(
    (params.modelClaimTraceItems ?? []).map((item) => [item.targetPath, item]),
  )
  const items = flattenSection(params.generatedCvState, params.section).map((item) => {
    const modelTrace = modelTraceByPath.get(item.path)
    const claimMatch = matchClaims(item.text, params.claimPolicy, modelTrace)
    const preservedOriginal = originalTexts.has(normalize(item.text))
    const formattingOnly = !preservedOriginal
      && claimMatch.claimPolicyIds.length === 0
      && isFormattingOnlyRewrite({
        originalText: originalByPath.get(item.path)?.text,
        generatedText: item.text,
        section: params.section,
        claimPolicy: params.claimPolicy,
      })
    const prohibitedTermsAcknowledged = findProhibitedTerms(item.text, params.claimPolicy)
    const unclassifiedNewText = !preservedOriginal && !formattingOnly && claimMatch.claimPolicyIds.length === 0
    const source: SectionRewriteItemSource = preservedOriginal
      ? 'preserved_original'
      : formattingOnly
        ? 'formatting_only'
        : 'new_generated_text'
    const classificationStatus: SectionRewritePlan['items'][number]['classificationStatus'] =
      claimMatch.claimPolicyIds.length > 0
        ? 'claim_policy_matched'
        : preservedOriginal
          ? 'original_preserved'
          : formattingOnly
            ? 'formatting_only'
            : 'unclassified_new_text'
    const permissionLevel: SectionRewriteItemPermissionLevel =
      source === 'preserved_original' || source === 'formatting_only'
        ? source
        : claimMatch.permissionLevel

    return {
      targetPath: item.path,
      intendedText: item.text,
      source,
      claimPolicyIds: claimMatch.claimPolicyIds,
      expressedSignals: claimMatch.expressedSignals,
      evidenceBasis: claimMatch.evidenceBasis,
      permissionLevel,
      prohibitedTermsAcknowledged,
      unclassifiedText: unclassifiedNewText ? item.text : undefined,
      classificationStatus,
      ...((preservedOriginal || formattingOnly) && claimMatch.claimPolicyIds.length === 0
        ? {
          expressedSignals: [],
          evidenceBasis: [],
        }
        : {}),
    }
  })

  return {
    section: params.section,
    items,
  }
}

export function buildGeneratedClaimTraceFromSectionPlans(
  plans: SectionRewritePlan[],
): GeneratedClaimTrace[] {
  return plans.flatMap((plan) => plan.items.map((item) => ({
    section: plan.section,
    itemPath: item.targetPath,
    generatedText: item.intendedText,
    expressedSignals: item.expressedSignals,
    usedClaimPolicyIds: item.claimPolicyIds,
    evidenceBasis: item.evidenceBasis,
    prohibitedTermsFound: item.prohibitedTermsAcknowledged,
    validationStatus: item.prohibitedTermsAcknowledged.length > 0
      ? 'invalid'
      : item.claimPolicyIds.length > 0 || item.classificationStatus === 'original_preserved'
        || item.classificationStatus === 'formatting_only'
        ? 'valid'
        : 'warning',
    rationale: item.claimPolicyIds.length > 0
      ? 'claim_policy_matched'
      : item.classificationStatus === 'formatting_only'
        ? 'formatting_only_without_new_claim'
      : item.classificationStatus === 'unclassified_new_text'
        ? 'new_text_without_claim_policy'
        : 'original_preserved_without_new_claim',
    source: item.source,
    unclassifiedText: item.unclassifiedText,
    classificationStatus: item.classificationStatus,
  })))
}

function matchClaims(
  text: string,
  claimPolicy: JobCompatibilityClaimPolicy,
  modelTrace?: RewriteClaimTraceItem,
): {
  claimPolicyIds: string[]
  expressedSignals: string[]
  evidenceBasis: string[]
  permissionLevel: 'allowed' | 'cautious'
} {
  const modelClaimIds = modelTrace?.usedClaimPolicyIds ?? []
  if (modelClaimIds.length > 0) {
    const selectedClaims = [
      ...claimPolicy.allowedClaims,
      ...claimPolicy.cautiousClaims,
    ].filter((claim) => (
      modelClaimIds.includes(claim.id)
      && claimMatchesText(text, claim.signal, [
        ...claim.allowedTerms,
        ...claim.evidenceBasis.map((basis) => basis.text),
      ])
    ))
    const unmatchedModelClaimIds = modelClaimIds.filter((id) => !selectedClaims.some((claim) => claim.id === id))
    const hasAllowedClaim = selectedClaims.some((claim) => claim.permission === 'allowed')

    if (selectedClaims.length === 0 && unmatchedModelClaimIds.length > 0) {
      return matchClaims(text, claimPolicy)
    }

    return {
      claimPolicyIds: [
        ...selectedClaims.map((claim) => claim.id),
        ...unmatchedModelClaimIds.filter((id) => !claimPolicy.allowedClaims.some((claim) => claim.id === id)
          && !claimPolicy.cautiousClaims.some((claim) => claim.id === id)),
      ],
      expressedSignals: unique([
        ...selectedClaims.map((claim) => claim.signal),
        ...(selectedClaims.length === 0 ? modelTrace?.expressedSignals ?? [] : []),
      ]),
      evidenceBasis: unique([
        ...selectedClaims.flatMap((claim) => [
          ...claim.allowedTerms,
          ...claim.evidenceBasis.map((basis) => basis.text),
        ]),
        ...(selectedClaims.length === 0 ? modelTrace?.evidenceBasis ?? [] : []),
      ]),
      permissionLevel: hasAllowedClaim ? 'allowed' : 'cautious',
    }
  }

  const allowedMatches = claimPolicy.allowedClaims.filter((claim) => claimMatchesText(text, claim.signal, [
    ...claim.allowedTerms,
    ...claim.evidenceBasis.map((basis) => basis.text),
  ]))
  const cautiousMatches = claimPolicy.cautiousClaims.filter((claim) => claimMatchesText(text, claim.signal, [
    ...claim.allowedTerms,
    ...claim.evidenceBasis.map((basis) => basis.text),
  ]))
  const matches = allowedMatches.length > 0 ? allowedMatches : cautiousMatches

  return {
    claimPolicyIds: matches.map((claim) => claim.id),
    expressedSignals: unique(matches.map((claim) => claim.signal)),
    evidenceBasis: unique(matches.flatMap((claim) => [
      ...claim.allowedTerms,
      ...claim.evidenceBasis.map((basis) => basis.text),
    ])),
    permissionLevel: allowedMatches.length > 0 ? 'allowed' : 'cautious',
  }
}

function claimMatchesText(text: string, signal: string, terms: string[]): boolean {
  const normalizedText = normalize(text)
  const candidates = buildClaimMatchCandidates([signal, ...terms])

  return candidates.some((candidate) => normalizedText.includes(candidate))
}

function buildClaimMatchCandidates(values: string[]): string[] {
  return unique(values.flatMap((value) => [
    value,
    ...splitClaimCandidatePhrases(value),
    ...extractCandidateNgrams(value),
  ]))
    .map(normalize)
    .filter((item) => item.length >= 3)
    .filter((item) => !isStopwordOnly(item))
}

function splitClaimCandidatePhrases(value: string): string[] {
  return value
    .split(/[,;|/()[\]\n\r]+|\s+(?:and|or|e|ou)\s+/iu)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractCandidateNgrams(value: string): string[] {
  const tokens = normalize(value).split(' ').filter((token) => token.length >= 2)
  const candidates: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    for (let size = 2; size <= 3; size += 1) {
      const slice = tokens.slice(index, index + size)
      if (slice.length === size && !slice.every(isStopword)) {
        candidates.push(slice.join(' '))
      }
    }
  }

  return candidates
}

function findProhibitedTerms(
  text: string,
  claimPolicy: JobCompatibilityClaimPolicy,
): string[] {
  const normalizedText = normalize(text)

  return unique([
    ...claimPolicy.forbiddenClaims,
    ...claimPolicy.cautiousClaims,
  ].flatMap((claim) => claim.prohibitedTerms)
    .filter((term) => {
      const normalizedTerm = normalize(term)
      return normalizedTerm.length >= 3 && normalizedText.includes(normalizedTerm)
    }))
}

function isFormattingOnlyRewrite(params: {
  originalText?: string
  generatedText: string
  section: GeneratedClaimTraceSection
  claimPolicy: JobCompatibilityClaimPolicy
}): boolean {
  if (!params.originalText?.trim()) {
    return false
  }

  if (params.section === 'skills') {
    return false
  }

  if (findProhibitedTerms(params.generatedText, params.claimPolicy).some((term) => (
    !containsCanonicalClaimSignal(params.originalText ?? '', term)
  ))) {
    return false
  }

  const original = normalize(params.originalText)
  const generated = normalize(params.generatedText)
  if (!original || !generated) {
    return false
  }

  return tokenSimilarity(original, generated) >= 0.62
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = left.split(' ').filter((token) => token.length >= 3 && !isStopword(token))
  const rightTokens = right.split(' ').filter((token) => token.length >= 3 && !isStopword(token))
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length
  const smaller = Math.min(leftSet.size, rightSet.size)

  return smaller === 0 ? 0 : intersection / smaller
}

function isStopwordOnly(value: string): boolean {
  return value.split(' ').filter(Boolean).every(isStopword)
}

function isStopword(token: string): boolean {
  return new Set([
    'a',
    'as',
    'o',
    'os',
    'de',
    'da',
    'do',
    'das',
    'dos',
    'e',
    'ou',
    'em',
    'com',
    'para',
    'por',
    'ao',
    'aos',
    'na',
    'no',
    'nas',
    'nos',
    'the',
    'and',
    'or',
    'of',
    'to',
    'in',
    'for',
    'with',
    'using',
  ]).has(token)
}

function flattenSection(cvState: CVState, section: GeneratedClaimTraceSection): SectionItem[] {
  switch (section) {
    case 'summary':
      return [{ section, path: 'summary', text: cvState.summary }]
    case 'skills':
      return cvState.skills.map((skill, index) => ({ section, path: `skills.${index}`, text: skill }))
    case 'experience':
      return cvState.experience.flatMap((entry, entryIndex) => [
        {
          section,
          path: `experience.${entryIndex}.title`,
          text: [entry.title, entry.company].filter(Boolean).join(' '),
        },
        ...entry.bullets.map((bullet, bulletIndex) => ({
          section,
          path: `experience.${entryIndex}.bullets.${bulletIndex}`,
          text: bullet,
        })),
      ])
    case 'education':
      return cvState.education.map((entry, index) => ({
        section,
        path: `education.${index}`,
        text: [entry.degree, entry.institution, entry.year, entry.gpa].filter(Boolean).join(' '),
      }))
    case 'certifications':
      return (cvState.certifications ?? []).map((entry, index) => ({
        section,
        path: `certifications.${index}`,
        text: [entry.name, entry.issuer, entry.year].filter(Boolean).join(' '),
      }))
  }
}

function normalize(value: string): string {
  return canonicalizeClaimSignal(value)
}

function unique(values: string[]): string[] {
  return uniqueByCanonicalClaimSignal(values)
}
