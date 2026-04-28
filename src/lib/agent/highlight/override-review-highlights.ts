import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  buildExperienceBulletHighlightItemIds,
  createSummaryHighlightItemId,
  type CvHighlightReason,
  type CvHighlightState,
  type CvResolvedHighlight,
} from '@/lib/resume/cv-highlight-artifact'
import type { Session, ValidationIssue } from '@/types/agent'
import type { CVState } from '@/types/cv'

type ReviewSeverity = 'supported' | 'caution' | 'risk'

type ReviewItem = NonNullable<CvHighlightState['reviewItems']>[number]

function findRange(text: string, fragment: string): { start: number; end: number } | null {
  const normalizedText = text.toLocaleLowerCase()
  const normalizedFragment = fragment.trim().toLocaleLowerCase()
  if (normalizedFragment.length < 3) {
    return null
  }

  const start = normalizedText.indexOf(normalizedFragment)
  return start >= 0 ? { start, end: start + fragment.trim().length } : null
}

function addRange(
  highlights: Map<string, CvResolvedHighlight>,
  input: {
    itemId: string
    section: 'summary' | 'experience'
    text: string
    fragment: string
    reason: CvHighlightReason
  },
): boolean {
  const range = findRange(input.text, input.fragment)
  if (!range) {
    return false
  }

  const existing = highlights.get(input.itemId) ?? {
    itemId: input.itemId,
    section: input.section,
    ranges: [],
  }

  if (!existing.ranges.some((item) => item.start === range.start && item.end === range.end)) {
    existing.ranges.push({
      ...range,
      reason: input.reason,
    })
  }

  highlights.set(input.itemId, existing)
  return true
}

function addFragmentHighlights(params: {
  cvState: CVState
  highlights: Map<string, CvResolvedHighlight>
  fragments: string[]
  severity: ReviewSeverity
}): number {
  let count = 0
  const reason = params.severity
  const bulletItemIds = params.cvState.experience.map((entry) => buildExperienceBulletHighlightItemIds(entry))

  params.fragments.forEach((fragment) => {
    const trimmed = fragment.trim()
    if (!trimmed) {
      return
    }

    if (addRange(params.highlights, {
      itemId: createSummaryHighlightItemId(),
      section: 'summary',
      text: params.cvState.summary ?? '',
      fragment: trimmed,
      reason,
    })) {
      count += 1
      return
    }

    params.cvState.experience.some((entry, experienceIndex) => (
      entry.bullets.some((bullet, bulletIndex) => {
        const added = addRange(params.highlights, {
          itemId: bulletItemIds[experienceIndex]?.[bulletIndex] ?? '',
          section: 'experience',
          text: bullet,
          fragment: trimmed,
          reason,
        })
        if (added) {
          count += 1
        }
        return added
      })
    ))
  })

  return count
}

function buildIssueReviewItem(issue: ValidationIssue, inline: boolean): ReviewItem {
  const section = issue.section === 'summary'
    || issue.section === 'experience'
    || issue.section === 'skills'
    || issue.section === 'education'
    || issue.section === 'certifications'
    ? issue.section
    : undefined

  return {
    severity: 'risk',
    message: issue.userFacingExplanation ?? issue.message,
    issueType: issue.issueType,
    offendingText: issue.offendingText ?? issue.offendingSignal,
    section,
    inline,
  }
}

function issueFragments(issues: ValidationIssue[]): string[] {
  return issues.flatMap((issue) => [
    issue.offendingText,
    issue.offendingSignal,
  ]).filter((value): value is string => Boolean(value?.trim()))
}

export function shouldUseOverrideReviewHighlight(session: Session): boolean {
  const validationOverride = session.agentState.validationOverride
  return validationOverride?.enabled === true
    || validationOverride?.acceptedLowFit === true
    || validationOverride?.fallbackUsed === true
}

export function buildOverrideReviewHighlightState(params: {
  session: Session
  cvState: CVState
  generatedAt?: string
}): CvHighlightState {
  const generatedAt = params.generatedAt ?? new Date().toISOString()
  const validationOverride = params.session.agentState.validationOverride
  const targetingPlan = params.session.agentState.targetingPlan
  const highlights = new Map<string, CvResolvedHighlight>()
  const reviewItems: ReviewItem[] = []

  const supportedFragments = [
    ...(targetingPlan?.safeTargetingEmphasis?.safeDirectEmphasis ?? []),
    ...(targetingPlan?.rewritePermissions?.directClaimsAllowed ?? []),
  ]
  const cautionFragments = [
    ...(targetingPlan?.safeTargetingEmphasis?.cautiousBridgeEmphasis.map((bridge) => bridge.safeWording) ?? []),
    ...(targetingPlan?.rewritePermissions?.bridgeClaimsAllowed.map((bridge) => bridge.safeBridge) ?? []),
  ]
  const issues = validationOverride?.issues ?? params.session.agentState.rewriteValidation?.issues ?? []

  const supportedCount = addFragmentHighlights({
    cvState: params.cvState,
    highlights,
    fragments: supportedFragments,
    severity: 'supported',
  })
  const cautionCount = addFragmentHighlights({
    cvState: params.cvState,
    highlights,
    fragments: cautionFragments,
    severity: 'caution',
  })
  const riskCount = addFragmentHighlights({
    cvState: params.cvState,
    highlights,
    fragments: issueFragments(issues),
    severity: 'risk',
  })

  issues.forEach((issue) => {
    const fragments = issueFragments([issue])
    const inline = fragments.some((fragment) => (
      findRange(params.cvState.summary ?? '', fragment)
      || params.cvState.experience.some((entry) => entry.bullets.some((bullet) => findRange(bullet, fragment)))
    ))
    reviewItems.push(buildIssueReviewItem(issue, inline))
  })

  if (supportedCount > 0) {
    reviewItems.unshift({
      severity: 'supported',
      message: 'Trechos sustentados pelo currículo original foram marcados para conferência.',
      inline: true,
    })
  }

  if (cautionCount > 0) {
    reviewItems.unshift({
      severity: 'caution',
      message: 'Pontes cautelosas foram marcadas como aproximações, não como experiência direta.',
      inline: true,
    })
  }

  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    resolvedHighlights: Array.from(highlights.values()).map((highlight) => ({
      ...highlight,
      ranges: highlight.ranges.sort((left, right) => left.start - right.start),
    })),
    highlightSource: 'job_targeting',
    highlightMode: 'override_review',
    reviewItems,
    highlightGeneratedAt: generatedAt,
    generatedAt,
  }
}
