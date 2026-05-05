import {
  buildCanonicalSignal,
  hasLexicalAliasMatch,
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

export const DOMAIN_EQUIVALENT_RULES: DomainEquivalentRule[] = []

export function loadDomainEquivalentCatalog() {
  return {
    metadata: {
      catalogIds: [],
      catalogVersions: {},
    },
    genericTaxonomy: undefined,
    domainPacks: [],
  }
}

function requirednessForRequirement(value: string): RequirementSubSignal['requiredness'] {
  if (/\b(?:desejavel|preferencial|nice to have|preferred|diferencial)\b/iu.test(value)) {
    return 'preferred'
  }

  if (/\b(?:required|obrigatorio|necessario|requisito|must have)\b/iu.test(value)) {
    return 'required'
  }

  return 'unknown'
}

function kindForSignal(value: string): RequirementSubSignal['kind'] {
  if (/\b(?:certifica[cç][aã]o|certification|bacharel|bachelor|gradua[cç][aã]o|degree)\b/iu.test(value)) {
    return 'education'
  }

  if (/\b(?:respons[aá]vel|conduzir|liderar|desenvolver|implementar|atuar|experience|experiencia)\b/iu.test(value)) {
    return 'experience'
  }

  if (/\b(?:neg[oó]cio|stakeholder|cliente|business|comercial|financeiro|marketing|opera[cç][oõ]es)\b/iu.test(value)) {
    return 'business_context'
  }

  if (value.split(/\s+/u).length <= 3) {
    return 'tool'
  }

  return 'unknown'
}

function cleanSubSignal(value: string): string {
  return value
    .replace(/^[\s\-*•:;,.]+/u, '')
    .replace(/\s+/gu, ' ')
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

  if (!cleaned || !canonical || result.some((item) => buildCanonicalSignal(item.signal) === canonical)) {
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

  pushSubSignal(result, requirement, requirement, requiredness)
  requirement
    .split(/[,;]|\s+\bou\b\s+|\s+\bor\b\s+/iu)
    .map(cleanSubSignal)
    .filter((part) => part.split(/\s+/u).filter(Boolean).length <= 6)
    .forEach((signal) => pushSubSignal(result, requirement, signal, requiredness))

  return result
}

function lexicalMatch(jobSignal: string, evidence: DomainResumeEvidenceEntry): boolean {
  const normalizedJobSignal = normalizeSemanticText(jobSignal)
  const canonicalJobSignal = buildCanonicalSignal(jobSignal)

  if (!normalizedJobSignal || !canonicalJobSignal) {
    return false
  }

  return Boolean(
    evidence.canonical === canonicalJobSignal
    || includesNormalizedPhrase(evidence.normalized, normalizedJobSignal)
    || includesNormalizedPhrase(normalizedJobSignal, evidence.normalized)
    || hasLexicalAliasMatch(jobSignal, evidence.term)
    || hasLexicalAliasMatch(jobSignal, evidence.span),
  )
}

export function findDomainEquivalentMatch(
  jobSignal: string,
  resumeEvidence: DomainResumeEvidenceEntry[],
): DomainEquivalentMatch | null {
  const subSignals = decomposeRequirementSignal(jobSignal)
  const candidates = subSignals.length > 0 ? subSignals.map((entry) => entry.signal) : [jobSignal]
  const matches = resumeEvidence.filter((evidence) => (
    candidates.some((candidate) => lexicalMatch(candidate, evidence))
  ))

  if (matches.length === 0) {
    return null
  }

  return {
    evidenceLevel: 'strong_contextual_inference',
    confidence: 0.72,
    matchedResumeTerms: matches.map((entry) => entry.term),
    supportingResumeSpans: matches.map((entry) => entry.span),
    rationale: 'The job signal is supported by lexical resume evidence; no catalog equivalence was used.',
  }
}
