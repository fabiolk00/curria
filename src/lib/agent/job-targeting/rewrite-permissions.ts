import type { BridgeClaimInstruction, TargetEvidence, TargetedRewritePermissions } from '@/types/agent'
import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import { buildRewritePermissionsFromAssessment as buildAdapterRewritePermissionsFromAssessment } from '@/lib/agent/job-targeting/compatibility/legacy-adapters'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()

  return values.filter((value) => {
    const canonical = buildCanonicalSignal(value)
    if (!canonical || seen.has(canonical)) {
      return false
    }

    seen.add(canonical)
    return true
  })
}

function buildBridgeClaimInstruction(evidence: TargetEvidence): BridgeClaimInstruction {
  const anchors = evidence.matchedResumeTerms.length > 0
    ? evidence.matchedResumeTerms.join(', ')
    : evidence.supportingResumeSpans[0] ?? evidence.canonicalSignal

  if (evidence.rewritePermission === 'can_bridge_carefully') {
    return {
      jobSignal: evidence.canonicalSignal,
  safeBridge: `When relevant, connect ${evidence.canonicalSignal} to adjacent real evidence such as ${anchors} using cautious language like "experiência relacionada a", "atuação com", "base em", or "contexto de". Do not present it as direct mastery.`,
      doNotSay: evidence.forbiddenRewriteForms,
    }
  }

  return {
    jobSignal: evidence.canonicalSignal,
    safeBridge: `Do not claim ${evidence.canonicalSignal} directly. If needed, only mention adjacent real context such as ${anchors} without stating the candidate executed or mastered the missing requirement.`,
    doNotSay: evidence.forbiddenRewriteForms,
  }
}

function isAllowedOnSkillsSurface(evidence: TargetEvidence): boolean {
  return evidence.rewritePermission === 'can_claim_directly'
    || (
      evidence.rewritePermission === 'can_claim_normalized'
      && evidence.confidence >= 0.75
    )
}

export function buildTargetedRewritePermissions(targetEvidence: TargetEvidence[]): TargetedRewritePermissions {
  const directClaimsAllowed = dedupe(
    targetEvidence
      .filter((evidence) => evidence.rewritePermission === 'can_claim_directly')
      .map((evidence) => evidence.canonicalSignal),
  )

  const normalizedClaimsAllowed = dedupe(
    targetEvidence
      .filter((evidence) => evidence.rewritePermission === 'can_claim_normalized')
      .map((evidence) => evidence.canonicalSignal),
  )

  const bridgeClaimsAllowed = targetEvidence
    .filter((evidence) =>
      evidence.rewritePermission === 'can_bridge_carefully'
      || evidence.rewritePermission === 'can_mention_as_related_context')
    .map(buildBridgeClaimInstruction)

  const relatedButNotClaimable = dedupe(
    targetEvidence
      .filter((evidence) => evidence.rewritePermission === 'can_mention_as_related_context')
      .map((evidence) => evidence.canonicalSignal),
  )

  const forbiddenClaims = dedupe(
    targetEvidence
      .filter((evidence) => evidence.rewritePermission === 'must_not_claim')
      .map((evidence) => evidence.canonicalSignal),
  )

  const skillsSurfaceAllowed = dedupe(
    targetEvidence
      .filter(isAllowedOnSkillsSurface)
      .map((evidence) => evidence.canonicalSignal),
  )

  return {
    directClaimsAllowed,
    normalizedClaimsAllowed,
    bridgeClaimsAllowed,
    relatedButNotClaimable,
    forbiddenClaims,
    skillsSurfaceAllowed,
  }
}

export function buildTargetedRewritePermissionsFromAssessment(
  assessment: JobCompatibilityAssessment,
): TargetedRewritePermissions {
  return buildAdapterRewritePermissionsFromAssessment(assessment)
}
