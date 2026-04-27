import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type { SafeTargetingEmphasis, TargetEvidence, TargetedRewritePermissions } from '@/types/agent'

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const canonical = buildCanonicalSignal(value)
      if (!canonical || seen.has(canonical)) {
        return false
      }

      seen.add(canonical)
      return true
    })
}

function pruneContainedValues(values: string[]): string[] {
  return values.filter((value, index) => {
    const canonical = buildCanonicalSignal(value)
    if (!canonical) {
      return false
    }

    return !values.some((candidate, candidateIndex) => {
      if (candidateIndex === index) {
        return false
      }

      const candidateCanonical = buildCanonicalSignal(candidate)
      return Boolean(
        candidateCanonical
        && candidateCanonical.length > canonical.length
        && candidateCanonical.includes(canonical),
      )
    })
  })
}

function isDirectEvidence(evidence: TargetEvidence): boolean {
  return evidence.rewritePermission === 'can_claim_directly'
    || evidence.rewritePermission === 'can_claim_normalized'
}

function buildSupportingTerms(evidence: TargetEvidence): string[] {
  return dedupe([
    ...evidence.matchedResumeTerms,
    ...evidence.supportingResumeSpans
      .map((span) => span.includes(':') ? span.split(':').slice(1).join(':').trim() : span.trim())
      .filter((span) => span.split(/\s+/u).length <= 6),
  ]).slice(0, 3)
}

function buildSafeWording(evidence: TargetEvidence, supportingTerms: string[]): string {
  const supportingContext = supportingTerms.join(', ')

  if (!supportingContext) {
    return evidence.rewritePermission === 'can_mention_as_related_context'
      ? `contextos relacionados a ${evidence.canonicalSignal}`
      : `experiência relacionada a ${evidence.canonicalSignal}`
  }

  return evidence.rewritePermission === 'can_mention_as_related_context'
    ? `${supportingContext} aplicáveis a contextos de ${evidence.canonicalSignal}`
    : `experiência relacionada a ${evidence.canonicalSignal} a partir de ${supportingContext}`
}

export function buildSafeTargetingEmphasis(params: {
  targetEvidence: TargetEvidence[]
  rewritePermissions: TargetedRewritePermissions
  mustEmphasize: string[]
}): SafeTargetingEmphasis {
  const directEvidence = params.targetEvidence.filter(isDirectEvidence)
  const bridgeEvidence = params.targetEvidence.filter((evidence) =>
    evidence.rewritePermission === 'can_bridge_carefully'
    || evidence.rewritePermission === 'can_mention_as_related_context')

  const allowedCanonicals = new Set(directEvidence.map((evidence) => buildCanonicalSignal(evidence.canonicalSignal)))

  return {
    safeDirectEmphasis: pruneContainedValues(dedupe([
      ...directEvidence.flatMap((evidence) => [
        ...evidence.matchedResumeTerms.filter((value) => value.split(/\s+/u).length <= 4),
        evidence.canonicalSignal.split(/\s+/u).length <= 4 ? evidence.canonicalSignal : '',
        ...evidence.allowedRewriteForms.filter((value) => value.split(/\s+/u).length <= 4),
      ]),
      ...params.rewritePermissions.directClaimsAllowed,
      ...params.rewritePermissions.normalizedClaimsAllowed,
      ...params.rewritePermissions.skillsSurfaceAllowed,
      ...params.mustEmphasize.filter((value) =>
        value.split(/\s+/u).length <= 4
        || allowedCanonicals.has(buildCanonicalSignal(value))),
    ])).slice(0, 16),
    cautiousBridgeEmphasis: bridgeEvidence
      .map((evidence) => {
        const supportingTerms = buildSupportingTerms(evidence)

        return {
          jobSignal: evidence.canonicalSignal,
          safeWording: buildSafeWording(evidence, supportingTerms),
          supportingTerms,
          forbiddenWording: dedupe([
            evidence.canonicalSignal,
            ...evidence.forbiddenRewriteForms,
          ]),
        }
      })
      .slice(0, 10),
    forbiddenDirectClaims: dedupe([
      ...params.rewritePermissions.forbiddenClaims,
      ...params.targetEvidence
        .filter((evidence) => !isDirectEvidence(evidence))
        .flatMap((evidence) => [
          evidence.canonicalSignal,
          ...evidence.forbiddenRewriteForms,
        ]),
    ]),
  }
}
