import { executeWithStageRetry, shapeRewriteCurrentContent } from '@/lib/agent/ats-enhancement-retry'
import {
  executeWithStageRetry as executeJobTargetingWithRetry,
  shapeTargetJobDescription,
  shapeTargetingRewriteCurrentContent,
} from '@/lib/agent/job-targeting-retry'
import { buildActionContext } from '@/lib/agent/context/actions/build-action-context'
import { buildBaseGuardrails } from '@/lib/agent/context/base/build-base-guardrails'
import { buildBaseSystemContext } from '@/lib/agent/context/base/build-base-system-context'
import { buildOutputContractContext } from '@/lib/agent/context/schemas/build-output-contract-context'
import { buildWorkflowContext } from '@/lib/agent/context/workflows/build-workflow-context'
import { buildRewritePlan } from '@/lib/agent/tools/build-rewrite-plan'
import { formatResumeRewriteGuardrails } from '@/lib/agent/tools/resume-rewrite-guidelines'
import { buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import { rewriteSection } from '@/lib/agent/tools/rewrite-section'
import type { AtsAnalysisResult, RewriteSectionInput, TargetingPlan } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type RewriteSectionName = RewriteSectionInput['section']

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchesFocusSignal(value: string, signals: string[]): boolean {
  const normalizedValue = normalize(value)

  return signals.some((signal) => {
    const normalizedSignal = normalize(signal)
    return normalizedSignal.length >= 3
      && (normalizedValue.includes(normalizedSignal) || normalizedSignal.includes(normalizedValue))
  })
}

function sanitizeJobTargetedSkills(
  originalSkills: CVState['skills'],
  rewrittenSkills: CVState['skills'],
  targetingPlan: TargetingPlan,
): CVState['skills'] {
  const originalEntries = originalSkills.reduce<Array<{ value: string; normalized: string; originalIndex: number }>>((entries, skill, originalIndex) => {
    const normalized = normalize(skill)
    if (!normalized || entries.some((entry) => entry.normalized === normalized)) {
      return entries
    }

    entries.push({ value: skill, normalized, originalIndex })
    return entries
  }, [])

  const rewrittenOrder = new Map<string, number>()
  rewrittenSkills.forEach((skill, index) => {
    const normalized = normalize(skill)
    if (normalized && !rewrittenOrder.has(normalized)) {
      rewrittenOrder.set(normalized, index)
    }
  })

  const focusSignals = targetingPlan.mustEmphasize.length > 0
    ? targetingPlan.mustEmphasize
    : targetingPlan.focusKeywords

  return [...originalEntries]
    .sort((left, right) => {
      const leftFocus = matchesFocusSignal(left.value, focusSignals) ? 1 : 0
      const rightFocus = matchesFocusSignal(right.value, focusSignals) ? 1 : 0
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus
      }

      const leftRewrittenIndex = rewrittenOrder.get(left.normalized)
      const rightRewrittenIndex = rewrittenOrder.get(right.normalized)

      if (leftRewrittenIndex !== undefined && rightRewrittenIndex !== undefined) {
        return leftRewrittenIndex - rightRewrittenIndex
      }

      if (leftRewrittenIndex !== undefined || rightRewrittenIndex !== undefined) {
        return leftRewrittenIndex !== undefined ? -1 : 1
      }

      return left.originalIndex - right.originalIndex
    })
    .map((entry) => entry.value)
}

function buildAtsResumeStyleGuide(): string {
  return [
    buildBaseSystemContext(),
    buildWorkflowContext('ats_enhancement'),
    buildActionContext('rewrite_resume_for_ats'),
    buildOutputContractContext('rewrite_resume_for_ats'),
    buildBaseGuardrails(),
    'Optimize for ATS parsing, semantic keyword matching, and human readability at the same time.',
    'Keep facts from the original resume intact while improving wording, structure, readability, and prioritization.',
    'Apply every resume rewrite guardrail rigorously before making any improvement.',
    'Resume rewrite contract:',
    formatResumeRewriteGuardrails(),
  ].join('\n')
}

function buildJobTargetingStyleGuide(targetJobDescription: string): string {
  const shapedTargetJob = shapeTargetJobDescription(targetJobDescription)

  return [
    buildBaseSystemContext(),
    buildWorkflowContext('job_targeting'),
    buildActionContext('rewrite_resume_for_job_target'),
    buildOutputContractContext('rewrite_resume_for_job_target'),
    buildBaseGuardrails(),
    'Maximize alignment to the target vacancy only with facts already present in the original resume.',
    'Apply every resume rewrite guardrail rigorously before making any improvement.',
    'Resume rewrite contract:',
    formatResumeRewriteGuardrails(),
    shapedTargetJob.compacted
      ? `The target job description was compacted for cost control. Use only this grounded subset as targeting context:\n${shapedTargetJob.content}`
      : `Use this target job description as context:\n${shapedTargetJob.content}`,
  ].join('\n')
}

function buildSectionInstructions(
  section: RewriteSectionName,
  atsAnalysis: AtsAnalysisResult,
  rewritePlan: ReturnType<typeof buildRewritePlan>,
): string {
  const sectionPlan = rewritePlan.sections[section]
  const shared = [
    buildAtsResumeStyleGuide(),
    `Use the ATS analysis findings as guidance: ${atsAnalysis.recommendations.join(' | ') || 'focus on clarity, structure, and ATS readability.'}`,
    `Shared rewrite narrative: ${rewritePlan.sharedNarrative}`,
    `Section goal: ${sectionPlan.goal}`,
    sectionPlan.keywordFocus.length > 0 ? `Prefer these grounded keywords when supported: ${sectionPlan.keywordFocus.join(', ')}.` : '',
    sectionPlan.factualAnchors.length > 0 ? `Stay anchored to these facts: ${sectionPlan.factualAnchors.join(' | ')}.` : '',
    ...sectionPlan.instructions,
  ]

  switch (section) {
    case 'summary':
      return [
        ...shared,
        'Rewrite only the professional summary.',
        'Use 4 to 6 concise lines that clarify professional positioning, seniority, core stack, domain context, and type of business impact.',
        'Preserve grounded technical scope, business context, and supported achievements that strengthen positioning; do not flatten the profile into generic claims.',
        'Avoid empty cliches and preserve factual truth.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        'Rewrite only the experience section.',
        'Preserve the same companies, titles, dates, and factual scope.',
        'Keep or clarify every grounded tool, system, responsibility, stakeholder scope, and metric already present in the original experience.',
        'Every bullet must start with a strong action verb in pt-BR and follow action + what was done + result, impact, or purpose when available.',
        'Do not merge, trim, or generalize bullets when that would remove relevant technical detail or business context.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        'Rewrite and reorder only the skills section.',
        'Keep only real skills already evidenced by the resume and remove redundancy.',
        'Preserve technical breadth and specificity; do not replace specific tools, platforms, or methods with vague umbrella labels.',
      ].join('\n\n')
    case 'education':
      return [
        ...shared,
        'Rewrite only the education section.',
        'Preserve institutions, degree names, and years exactly while improving formatting consistency.',
      ].join('\n\n')
    case 'certifications':
      return [
        ...shared,
        'Rewrite only the certifications section.',
        'Preserve certification names, issuers, and years exactly while improving ordering and consistency.',
      ].join('\n\n')
  }
}

function buildTargetJobSectionInstructions(
  section: RewriteSectionName,
  gapAnalysis: GapAnalysisResult,
  targetingPlan: TargetingPlan,
  targetJobDescription: string,
): string {
  const shared = [
    buildJobTargetingStyleGuide(targetJobDescription),
    targetingPlan.targetRoleConfidence === 'high'
      ? `Target role: ${targetingPlan.targetRole}`
      : 'No reliable target role title was extracted. Anchor the rewrite on the vacancy requirements, tools, responsibilities, and seniority signals instead of forcing a literal role claim.',
    targetingPlan.focusKeywords.length > 0
      ? `Vacancy semantic focus: ${targetingPlan.focusKeywords.join(', ')}.`
      : '',
    targetingPlan.mustEmphasize.length > 0
      ? `Must emphasize when factually supported: ${targetingPlan.mustEmphasize.join(', ')}.`
      : 'Must emphasize the strongest overlaps already proven in the resume.',
    targetingPlan.shouldDeemphasize.length > 0
      ? `De-emphasize when secondary to the target role: ${targetingPlan.shouldDeemphasize.join(', ')}.`
      : '',
    targetingPlan.missingButCannotInvent.length > 0
      ? `These gaps exist and cannot be invented away: ${targetingPlan.missingButCannotInvent.join(', ')}.`
      : '',
    `Gap snapshot: match score ${gapAnalysis.matchScore}/100; missing skills ${gapAnalysis.missingSkills.join(', ') || 'none'}; weak areas ${gapAnalysis.weakAreas.join(', ') || 'none'}.`,
  ].filter(Boolean)

  switch (section) {
    case 'summary':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.summary,
        'Rewrite only the professional summary.',
        targetingPlan.targetRoleConfidence === 'high'
          ? 'Use 4 to 6 concise lines aligned to the target role without claiming skills or experiences the candidate does not have.'
          : 'Use 4 to 6 concise lines aligned to the vacancy context without claiming a literal role identity, skills, or experiences the candidate does not have.',
        'Preserve grounded technical scope, business context, and supported achievements that help the recruiter understand the real profile.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.experience,
        'Rewrite only the experience section.',
        'Preserve companies, titles, dates, and factual scope.',
        'Keep or clarify every grounded tool, system, responsibility, stakeholder scope, and metric already present in the original experience.',
        'Every bullet must start with a strong action verb in pt-BR and follow action + what was done + result, impact, or purpose when available.',
        'Prioritize bullets that better match the target role and target keywords, but do not fabricate missing fit or compress away important context.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.skills,
        'Rewrite and reorder only the skills section.',
        'Keep only grounded skills already evidenced in the resume.',
        'Preserve technical breadth and specificity; do not replace specific tools, platforms, or methods with vague umbrella labels.',
      ].join('\n\n')
    case 'education':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.education,
        'Rewrite only the education section.',
        'Improve consistency only; do not create targeted claims from education.',
      ].join('\n\n')
    case 'certifications':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.certifications,
        'Rewrite only the certifications section.',
        'Reorder by target-role relevance while preserving factual data exactly.',
      ].join('\n\n')
  }
}

function applySectionData(
  cvState: CVState,
  section: RewriteSectionName,
  sectionData: unknown,
): CVState {
  switch (section) {
    case 'summary':
      return { ...cvState, summary: sectionData as string }
    case 'experience':
      return { ...cvState, experience: sectionData as CVState['experience'] }
    case 'skills':
      return { ...cvState, skills: sectionData as CVState['skills'] }
    case 'education':
      return { ...cvState, education: sectionData as CVState['education'] }
    case 'certifications':
      return { ...cvState, certifications: sectionData as CVState['certifications'] }
  }
}

function normalizeForVisibilityCheck(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateTokenSimilarity(left: string, right: string): number {
  const leftTokens = normalizeForVisibilityCheck(left).split(' ').filter(Boolean)
  const rightTokens = normalizeForVisibilityCheck(right).split(' ').filter(Boolean)

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const rightCounts = new Map<string, number>()
  rightTokens.forEach((token) => {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1)
  })

  let overlap = 0
  leftTokens.forEach((token) => {
    const count = rightCounts.get(token) ?? 0
    if (count > 0) {
      overlap += 1
      rightCounts.set(token, count - 1)
    }
  })

  return (2 * overlap) / (leftTokens.length + rightTokens.length)
}

function isVisibleRewriteTooClose(
  section: RewriteSectionName,
  currentCvState: CVState,
  nextSectionData: unknown,
): boolean {
  switch (section) {
    case 'summary': {
      const currentSummary = normalizeForVisibilityCheck(currentCvState.summary)
      const nextSummary = normalizeForVisibilityCheck(nextSectionData as string)
      return Boolean(
        currentSummary
        && nextSummary
        && (
          currentSummary === nextSummary
          || calculateTokenSimilarity(currentSummary, nextSummary) >= 0.88
        ),
      )
    }
    case 'skills': {
      return JSON.stringify(currentCvState.skills) === JSON.stringify(nextSectionData as CVState['skills'])
    }
    case 'experience': {
      const currentBullets = currentCvState.experience.flatMap((entry) => entry.bullets.map(normalizeForVisibilityCheck))
      const nextBullets = (nextSectionData as CVState['experience']).flatMap((entry) => entry.bullets.map(normalizeForVisibilityCheck))
      const unchangedBullets = nextBullets.filter((bullet, index) => currentBullets[index] === bullet).length
      const averageSimilarity = nextBullets.length > 0
        ? nextBullets.reduce((total, bullet, index) => total + calculateTokenSimilarity(currentBullets[index] ?? '', bullet), 0) / nextBullets.length
        : 0

      return nextBullets.length > 0 && (
        unchangedBullets / nextBullets.length >= 0.7
        || averageSimilarity >= 0.9
      )
    }
    default:
      return false
  }
}

function buildAssertiveRewriteInstructions(section: RewriteSectionName): string {
  switch (section) {
    case 'summary':
      return 'The previous rewrite stayed too close to the original wording. Rewrite the summary again with clearly different sentence structure, stronger positioning, and tighter language while preserving the exact facts.'
    case 'experience':
      return 'The previous rewrite stayed too close to the original wording. Rewrite every bullet more assertively with stronger action verbs and clearer business context while preserving the exact facts and dates.'
    case 'skills':
      return 'The previous rewrite kept the original ordering. Reorder and consolidate the skills more intentionally for ATS emphasis, but keep only grounded skills.'
    default:
      return 'The previous rewrite stayed too close to the original. Rewrite again with more visible improvement while preserving the exact facts.'
  }
}

type AtsRewriteParams = {
  mode: 'ats_enhancement'
  cvState: CVState
  atsAnalysis: AtsAnalysisResult
  userId: string
  sessionId: string
}

type JobTargetingRewriteParams = {
  mode: 'job_targeting'
  cvState: CVState
  targetJobDescription: string
  gapAnalysis: GapAnalysisResult
  targetingPlan?: TargetingPlan
  userId: string
  sessionId: string
}

export async function rewriteResumeFull(params: AtsRewriteParams | JobTargetingRewriteParams): Promise<{
  success: boolean
  optimizedCvState?: CVState
  summary?: {
    changedSections: RewriteSectionName[]
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
  diagnostics?: {
    sectionAttempts: Partial<Record<RewriteSectionName, number>>
    retriedSections: RewriteSectionName[]
    compactedSections: RewriteSectionName[]
  }
  error?: string
}> {
  try {
    let optimizedCvState: CVState = structuredClone(params.cvState)
    const changedSections: RewriteSectionName[] = []
    const notes: string[] = []
    const sectionAttempts: Partial<Record<RewriteSectionName, number>> = {}
    const retriedSections: RewriteSectionName[] = []
    const compactedSections: RewriteSectionName[] = []
    const sections: RewriteSectionName[] = ['summary', 'experience', 'skills', 'education', 'certifications']
    const rewritePlan = params.mode === 'ats_enhancement'
      ? buildRewritePlan(params.cvState, params.atsAnalysis)
      : undefined
    const targetingPlan = params.mode === 'job_targeting'
      ? (params.targetingPlan ?? buildTargetingPlan({
          cvState: params.cvState,
          targetJobDescription: params.targetJobDescription,
          gapAnalysis: params.gapAnalysis,
        }))
      : undefined

    for (const section of sections) {
      const shapeResult = params.mode === 'job_targeting'
        ? shapeTargetingRewriteCurrentContent(optimizedCvState, section)
        : shapeRewriteCurrentContent(optimizedCvState, section)
      const { content: currentContent, compacted } = shapeResult

      if (!currentContent.trim() || currentContent.trim() === '[]') {
        continue
      }

      if (compacted) {
        compactedSections.push(section)
      }

      const baseInstructions = params.mode === 'job_targeting'
        ? buildTargetJobSectionInstructions(
            section,
            params.gapAnalysis,
            targetingPlan!,
            params.targetJobDescription,
          )
        : buildSectionInstructions(section, params.atsAnalysis, rewritePlan!)
      const targetKeywords = params.mode === 'job_targeting'
        ? targetingPlan!.mustEmphasize
        : rewritePlan!.keywordFocus

      let result: Awaited<ReturnType<typeof rewriteSection>>
      let attempts = 0

      try {
        const execution = await (params.mode === 'job_targeting' ? executeJobTargetingWithRetry : executeWithStageRetry)(
          async () => {
            const rewriteResult = await rewriteSection({
              section,
              current_content: currentContent,
              instructions: baseInstructions,
              target_keywords: targetKeywords,
            }, params.userId, params.sessionId)

            if (!rewriteResult.output.success) {
              throw new Error(rewriteResult.output.error)
            }

            return rewriteResult
          },
          {
            onRetry: () => {
              if (!retriedSections.includes(section)) {
                retriedSections.push(section)
              }
            },
          },
        )

        result = execution.result
        attempts = execution.attempts
      } catch (error) {
        sectionAttempts[section] = Math.max(1, sectionAttempts[section] ?? 0, retriedSections.includes(section) ? 2 : 1)
        return {
          success: false,
          diagnostics: {
            sectionAttempts,
            retriedSections,
            compactedSections,
          },
          error: error instanceof Error ? error.message : 'Failed to rewrite full resume.',
        }
      }

      if (!result.output.success) {
        return {
          success: false,
          diagnostics: {
            sectionAttempts,
            retriedSections,
            compactedSections,
          },
          error: result.output.error,
        }
      }

      let sectionData = params.mode === 'job_targeting' && section === 'skills'
        ? sanitizeJobTargetedSkills(
            params.cvState.skills,
            result.output.section_data as CVState['skills'],
            targetingPlan!,
          )
        : result.output.section_data

      if (
        ['summary', 'experience', 'skills'].includes(section)
        && isVisibleRewriteTooClose(section, optimizedCvState, sectionData)
      ) {
        if (!retriedSections.includes(section)) {
          retriedSections.push(section)
        }

        try {
          const assertiveExecution = await (params.mode === 'job_targeting' ? executeJobTargetingWithRetry : executeWithStageRetry)(
            async () => {
              const rewriteResult = await rewriteSection({
                section,
                current_content: currentContent,
                instructions: `${baseInstructions}\n\n${buildAssertiveRewriteInstructions(section)}`,
                target_keywords: targetKeywords,
              }, params.userId, params.sessionId)

              if (!rewriteResult.output.success) {
                throw new Error(rewriteResult.output.error)
              }

              return rewriteResult
            },
            {
              onRetry: () => {
                if (!retriedSections.includes(section)) {
                  retriedSections.push(section)
                }
              },
            },
          )

          attempts += assertiveExecution.attempts

          if (assertiveExecution.result.output.success) {
            const assertiveSectionData = params.mode === 'job_targeting' && section === 'skills'
              ? sanitizeJobTargetedSkills(
                  params.cvState.skills,
                  assertiveExecution.result.output.section_data as CVState['skills'],
                  targetingPlan!,
                )
              : assertiveExecution.result.output.section_data

            result = assertiveExecution.result
            sectionData = assertiveSectionData
          }
        } catch {
          attempts += 1
        }
      }

      sectionAttempts[section] = attempts

      optimizedCvState = applySectionData(
        optimizedCvState,
        section,
        sectionData,
      )
      changedSections.push(section)
      if (result.output.success) {
        notes.push(...result.output.changes_made)
      }
    }

    return {
      success: true,
      optimizedCvState,
      summary: {
        changedSections,
        notes: Array.from(new Set(notes)),
        keywordCoverageImprovement: params.mode === 'job_targeting'
          ? Array.from(new Set(targetingPlan?.mustEmphasize ?? []))
          : undefined,
      },
      diagnostics: {
        sectionAttempts,
        retriedSections,
        compactedSections,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rewrite full resume.',
    }
  }
}
