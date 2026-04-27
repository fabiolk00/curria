import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import {
  buildAcronym,
  buildCanonicalSignal,
  buildLexicalVariants,
  computeTokenOverlap,
  hasLexicalAliasMatch,
  includesNormalizedPhrase,
  normalizeSemanticText,
} from '@/lib/agent/job-targeting/semantic-normalization'
import type { EvidenceLevel, RewritePermission, TargetEvidence, TargetingPlan } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type ResumeEvidenceEntry = {
  term: string
  span: string
  source: 'summary' | 'skills' | 'experience_title' | 'experience_bullet' | 'education' | 'certification'
  normalized: string
  canonical: string
}

type ClassifiedEvidenceItem = {
  jobSignal: string
  evidenceLevel: EvidenceLevel
  confidence: number
  matchedResumeTerms: string[]
  supportingResumeSpans: string[]
  rationale: string
}

type TargetSignal = {
  value: string
  source: 'target_role' | 'focus_keyword' | 'must_emphasize' | 'missing_gap'
}

function buildResumeEvidenceEntries(cvState: CVState): ResumeEvidenceEntry[] {
  const entries: ResumeEvidenceEntry[] = []

  const pushEntry = (term: string, span: string, source: ResumeEvidenceEntry['source']) => {
    const trimmedTerm = term.trim()
    const trimmedSpan = span.trim()

    if (!trimmedTerm || !trimmedSpan) {
      return
    }

    entries.push({
      term: trimmedTerm,
      span: trimmedSpan,
      source,
      normalized: normalizeSemanticText(trimmedTerm),
      canonical: buildCanonicalSignal(trimmedTerm),
    })
  }

  pushEntry(cvState.summary, cvState.summary, 'summary')

  cvState.skills.forEach((skill) => {
    pushEntry(skill, skill, 'skills')
  })

  cvState.experience.forEach((entry) => {
    pushEntry(entry.title, `${entry.title} @ ${entry.company}`, 'experience_title')
    entry.bullets.forEach((bullet) => {
      pushEntry(bullet, `${entry.title} @ ${entry.company}: ${bullet}`, 'experience_bullet')
    })
  })

  cvState.education.forEach((entry) => {
    pushEntry(`${entry.degree} ${entry.institution} ${entry.year ?? ''}`.trim(), `${entry.degree} - ${entry.institution}${entry.year ? ` (${entry.year})` : ''}`, 'education')
  })

  ;(cvState.certifications ?? []).forEach((entry) => {
    pushEntry(`${entry.name} ${entry.issuer} ${entry.year ?? ''}`.trim(), `${entry.name} - ${entry.issuer}${entry.year ? ` (${entry.year})` : ''}`, 'certification')
  })

  return entries
}

function collectTargetSignals(targetingPlan: TargetingPlan): TargetSignal[] {
  const rawSignals: TargetSignal[] = []

  if (targetingPlan.targetRoleConfidence !== 'low' && targetingPlan.targetRole.trim()) {
    rawSignals.push({
      value: targetingPlan.targetRole.trim(),
      source: 'target_role',
    })
  }

  targetingPlan.mustEmphasize.forEach((value) => {
    rawSignals.push({ value, source: 'must_emphasize' })
  })
  targetingPlan.focusKeywords.forEach((value) => {
    rawSignals.push({ value, source: 'focus_keyword' })
  })
  targetingPlan.missingButCannotInvent.forEach((value) => {
    rawSignals.push({ value, source: 'missing_gap' })
  })

  const seen = new Set<string>()

  return rawSignals.filter((signal) => {
    const canonical = buildCanonicalSignal(signal.value)
    if (!canonical || seen.has(canonical)) {
      return false
    }

    seen.add(canonical)
    return true
  })
}

function resolveRewritePermission(level: EvidenceLevel): RewritePermission {
  switch (level) {
    case 'explicit':
      return 'can_claim_directly'
    case 'normalized_alias':
    case 'technical_equivalent':
      return 'can_claim_normalized'
    case 'strong_contextual_inference':
      return 'can_bridge_carefully'
    case 'semantic_bridge_only':
      return 'can_mention_as_related_context'
    case 'unsupported_gap':
      return 'must_not_claim'
  }
}

function resolveValidationSeverity(level: EvidenceLevel): TargetEvidence['validationSeverityIfViolated'] {
  switch (level) {
    case 'explicit':
    case 'normalized_alias':
    case 'technical_equivalent':
      return 'none'
    case 'strong_contextual_inference':
      return 'warning'
    case 'semantic_bridge_only':
      return 'major'
    case 'unsupported_gap':
      return 'critical'
  }
}

function buildForbiddenRewriteForms(signal: string, level: EvidenceLevel): string[] {
  if (level === 'explicit' || level === 'normalized_alias' || level === 'technical_equivalent') {
    return []
  }

  const canonical = buildCanonicalSignal(signal)
  if (!canonical) {
    return []
  }

  return [
    canonical,
    `especialista em ${canonical}`,
    `expert em ${canonical}`,
    `advanced ${canonical}`,
    `lead ${canonical}`,
    `owner of ${canonical}`,
  ]
}

function buildAllowedRewriteForms(signal: string, matchedResumeTerms: string[], level: EvidenceLevel): string[] {
  const canonical = buildCanonicalSignal(signal)

  if (level === 'semantic_bridge_only' || level === 'unsupported_gap') {
    return Array.from(new Set(matchedResumeTerms.map((term) => term.trim()).filter(Boolean)))
  }

  return Array.from(new Set([
    canonical,
    ...matchedResumeTerms.map((term) => term.trim()),
  ].filter(Boolean)))
}

function canonicalizeDisplaySignal(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function containsApiAndRestTokens(value: string): boolean {
  const normalized = normalizeSemanticText(value)
  return /\bapis?\b/u.test(normalized) && /\brest(?:ful)?\b/u.test(normalized)
}

function buildTargetEvidenceRecord(signal: string, item: ClassifiedEvidenceItem): TargetEvidence {
  const canonicalSignal = canonicalizeDisplaySignal(signal)
  const evidenceLevel = item.evidenceLevel

  return {
    jobSignal: signal,
    canonicalSignal,
    evidenceLevel,
    rewritePermission: resolveRewritePermission(evidenceLevel),
    matchedResumeTerms: Array.from(new Set(item.matchedResumeTerms.map((value) => value.trim()).filter(Boolean))),
    supportingResumeSpans: Array.from(new Set(item.supportingResumeSpans.map((value) => value.trim()).filter(Boolean))).slice(0, 5),
    rationale: item.rationale.trim(),
    confidence: Math.max(0, Math.min(1, item.confidence)),
    allowedRewriteForms: buildAllowedRewriteForms(signal, item.matchedResumeTerms, evidenceLevel),
    forbiddenRewriteForms: buildForbiddenRewriteForms(signal, evidenceLevel),
    validationSeverityIfViolated: resolveValidationSeverity(evidenceLevel),
  }
}

function classifyDeterministically(signal: TargetSignal, resumeEvidence: ResumeEvidenceEntry[]): TargetEvidence | null {
  const normalizedSignal = normalizeSemanticText(signal.value)
  const canonicalSignal = buildCanonicalSignal(signal.value)

  if (!normalizedSignal || !canonicalSignal) {
    return null
  }

  const explicitMatches = resumeEvidence.filter((entry) =>
    entry.normalized === normalizedSignal
    || includesNormalizedPhrase(entry.normalized, normalizedSignal)
    || includesNormalizedPhrase(normalizedSignal, entry.normalized),
  )

  if (explicitMatches.length > 0) {
    return buildTargetEvidenceRecord(signal.value, {
      jobSignal: signal.value,
      evidenceLevel: 'explicit',
      confidence: 1,
      matchedResumeTerms: explicitMatches.map((entry) => entry.term),
      supportingResumeSpans: explicitMatches.map((entry) => entry.span),
      rationale: 'The job signal appears directly in the original resume evidence.',
    })
  }

  const aliasMatches = resumeEvidence.filter((entry) => hasLexicalAliasMatch(signal.value, entry.term))
  if (aliasMatches.length > 0) {
    return buildTargetEvidenceRecord(signal.value, {
      jobSignal: signal.value,
      evidenceLevel: 'normalized_alias',
      confidence: 0.92,
      matchedResumeTerms: aliasMatches.map((entry) => entry.term),
      supportingResumeSpans: aliasMatches.map((entry) => entry.span),
      rationale: 'The job signal is a lexical or canonical variant of resume evidence already present.',
    })
  }

  if (containsApiAndRestTokens(signal.value)) {
    const restApiMatches = resumeEvidence.filter((entry) =>
      containsApiAndRestTokens(entry.term) || containsApiAndRestTokens(entry.span))

    if (restApiMatches.length > 0) {
      return buildTargetEvidenceRecord(signal.value, {
        jobSignal: signal.value,
        evidenceLevel: 'technical_equivalent',
        confidence: 0.89,
        matchedResumeTerms: restApiMatches.map((entry) => entry.term),
        supportingResumeSpans: restApiMatches.map((entry) => entry.span),
        rationale: 'The resume contains matching API and REST evidence in the same span, supporting REST API experience as a technical equivalent.',
      })
    }
  }

  const signalAcronym = buildAcronym(signal.value)
  if (signalAcronym) {
    const acronymMatches = resumeEvidence.filter((entry) => buildAcronym(entry.term) === signalAcronym)
    if (acronymMatches.length > 0) {
      return buildTargetEvidenceRecord(signal.value, {
        jobSignal: signal.value,
        evidenceLevel: 'normalized_alias',
        confidence: 0.9,
        matchedResumeTerms: acronymMatches.map((entry) => entry.term),
        supportingResumeSpans: acronymMatches.map((entry) => entry.span),
        rationale: 'The job signal shares the same expanded/acronym form as the original resume evidence.',
      })
    }
  }

  return null
}

function buildResumeEvidenceDigest(resumeEvidence: ResumeEvidenceEntry[]): string {
  return resumeEvidence
    .map((entry, index) => `${index + 1}. [${entry.source}] ${entry.span}`)
    .join('\n')
}

function groundMatchedTerms(matchedResumeTerms: string[], resumeEvidence: ResumeEvidenceEntry[]): string[] {
  return Array.from(new Set(
    matchedResumeTerms.filter((term) => {
      const normalizedTerm = normalizeSemanticText(term)
      return resumeEvidence.some((entry) =>
        entry.normalized === normalizedTerm
        || includesNormalizedPhrase(entry.normalized, normalizedTerm)
        || includesNormalizedPhrase(normalizedTerm, entry.normalized),
      )
    }),
  ))
}

function groundSupportingSpans(supportingResumeSpans: string[], resumeEvidence: ResumeEvidenceEntry[]): string[] {
  return Array.from(new Set(
    supportingResumeSpans.filter((span) => {
      const normalizedSpan = normalizeSemanticText(span)
      return resumeEvidence.some((entry) =>
        includesNormalizedPhrase(normalizeSemanticText(entry.span), normalizedSpan)
        || includesNormalizedPhrase(normalizedSpan, normalizeSemanticText(entry.span)),
      )
    }),
  ))
}

function buildDefaultUnsupported(signal: TargetSignal): TargetEvidence {
  return buildTargetEvidenceRecord(signal.value, {
    jobSignal: signal.value,
    evidenceLevel: 'unsupported_gap',
    confidence: signal.source === 'missing_gap' ? 0.95 : 0.7,
    matchedResumeTerms: [],
    supportingResumeSpans: [],
    rationale: signal.source === 'missing_gap'
      ? 'The target signal remains a real gap with no sufficient supporting evidence in the original resume.'
      : 'No sufficient supporting evidence for this target signal was found in the original resume.',
  })
}

async function classifyUnresolvedSignalsWithLLM(params: {
  unresolvedSignals: TargetSignal[]
  resumeEvidence: ResumeEvidenceEntry[]
  userId?: string
  sessionId?: string
}): Promise<Map<string, TargetEvidence>> {
  const results = new Map<string, TargetEvidence>()

  if (params.unresolvedSignals.length === 0) {
    return results
  }

  try {
    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structuredModel,
        max_completion_tokens: 900,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You classify how safely a job requirement can be reflected in a targeted resume rewrite.

Return only JSON with this shape:
{
  "items": [
    {
      "jobSignal": string,
      "evidenceLevel": "technical_equivalent" | "strong_contextual_inference" | "semantic_bridge_only" | "unsupported_gap",
      "confidence": number,
      "matchedResumeTerms": string[],
      "supportingResumeSpans": string[],
      "rationale": string
    }
  ]
}

Rules:
- Be conservative.
- Use only the provided resume evidence.
- Do not invent tools, industries, certifications, or seniority.
- "technical_equivalent" means the resume evidence is close enough to support canonical wording.
- "strong_contextual_inference" means there is strong adjacent evidence, but the rewrite must stay cautious.
- "semantic_bridge_only" means mention only adjacent real experience, never as a direct claim.
- "unsupported_gap" means the signal must not be claimed.
- supportingResumeSpans must quote only from the provided evidence lines.`,
          },
          {
            role: 'user',
            content: [
              'Unresolved job signals:',
              params.unresolvedSignals.map((item) => `- ${item.value} [source=${item.source}]`).join('\n'),
              '',
              'Original resume evidence:',
              buildResumeEvidenceDigest(params.resumeEvidence),
            ].join('\n'),
          },
        ],
      }, { signal }),
      3,
      AGENT_CONFIG.timeout,
      undefined,
      {
        operation: 'job_targeting_evidence_classification',
        workflowMode: 'job_targeting',
        stage: 'targeting_plan',
        model: MODEL_CONFIG.structuredModel,
        sessionId: params.sessionId,
        userId: params.userId,
      },
    )

    const usage = getChatCompletionUsage(response)
    if (params.userId && params.sessionId) {
      trackApiUsage({
        userId: params.userId,
        sessionId: params.sessionId,
        model: MODEL_CONFIG.structuredModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        endpoint: 'rewriter',
      }).catch(() => {})
    }

    const rawText = getChatCompletionText(response)
    const parsed = JSON.parse(rawText) as {
      items?: Array<{
        jobSignal?: unknown
        evidenceLevel?: unknown
        confidence?: unknown
        matchedResumeTerms?: unknown
        supportingResumeSpans?: unknown
        rationale?: unknown
      }>
    }

    const validLevels = new Set<EvidenceLevel>([
      'technical_equivalent',
      'strong_contextual_inference',
      'semantic_bridge_only',
      'unsupported_gap',
    ])

    for (const item of parsed.items ?? []) {
      const jobSignal = typeof item.jobSignal === 'string' ? item.jobSignal.trim() : ''
      const evidenceLevel = typeof item.evidenceLevel === 'string' && validLevels.has(item.evidenceLevel as EvidenceLevel)
        ? item.evidenceLevel as EvidenceLevel
        : null

      if (!jobSignal || !evidenceLevel) {
        continue
      }

      const matchingSignal = params.unresolvedSignals.find((signal) => buildCanonicalSignal(signal.value) === buildCanonicalSignal(jobSignal))
      if (!matchingSignal) {
        continue
      }

      const confidence = typeof item.confidence === 'number'
        ? item.confidence
        : 0.5
      const rawMatchedResumeTerms = Array.isArray(item.matchedResumeTerms)
        ? item.matchedResumeTerms.filter((value): value is string => typeof value === 'string')
        : []
      const rawSupportingResumeSpans = Array.isArray(item.supportingResumeSpans)
        ? item.supportingResumeSpans.filter((value): value is string => typeof value === 'string')
        : []
      const matchedResumeTerms = groundMatchedTerms(rawMatchedResumeTerms, params.resumeEvidence)
      const supportingResumeSpans = groundSupportingSpans(rawSupportingResumeSpans, params.resumeEvidence)
      const rationale = typeof item.rationale === 'string'
        ? item.rationale
        : 'LLM classification did not provide a rationale.'

      if (
        evidenceLevel !== 'unsupported_gap'
        && matchedResumeTerms.length === 0
        && supportingResumeSpans.length === 0
      ) {
        results.set(buildCanonicalSignal(matchingSignal.value), buildDefaultUnsupported(matchingSignal))
        continue
      }

      const inferredSupportingSpans = supportingResumeSpans.length > 0
        ? supportingResumeSpans
        : params.resumeEvidence
            .filter((entry) => matchedResumeTerms.some((term) => hasLexicalAliasMatch(term, entry.term)))
            .map((entry) => entry.span)

      results.set(buildCanonicalSignal(matchingSignal.value), buildTargetEvidenceRecord(matchingSignal.value, {
        jobSignal: matchingSignal.value,
        evidenceLevel,
        confidence,
        matchedResumeTerms,
        supportingResumeSpans: inferredSupportingSpans,
        rationale,
      }))
    }
  } catch {
    return results
  }

  return results
}

export async function classifyTargetEvidence(params: {
  cvState: CVState
  targetingPlan: TargetingPlan
  gapAnalysis: GapAnalysisResult
  userId?: string
  sessionId?: string
}): Promise<TargetEvidence[]> {
  const resumeEvidence = buildResumeEvidenceEntries(params.cvState)
  const signals = collectTargetSignals(params.targetingPlan)

  if (resumeEvidence.length === 0) {
    return signals.map(buildDefaultUnsupported)
  }

  const deterministicMatches = new Map<string, TargetEvidence>()
  const unresolvedSignals: TargetSignal[] = []

  signals.forEach((signal) => {
    const deterministic = classifyDeterministically(signal, resumeEvidence)
    if (deterministic) {
      deterministicMatches.set(buildCanonicalSignal(signal.value), deterministic)
      return
    }

    unresolvedSignals.push(signal)
  })

  const llmMatches = await classifyUnresolvedSignalsWithLLM({
    unresolvedSignals,
    resumeEvidence,
    userId: params.userId,
    sessionId: params.sessionId,
  })

  return signals.map((signal) => {
    const canonical = buildCanonicalSignal(signal.value)

    return deterministicMatches.get(canonical)
      ?? llmMatches.get(canonical)
      ?? buildDefaultUnsupported(signal)
  })
}
