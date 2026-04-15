import { executeWithStageRetry, shapeRewriteCurrentContent } from '@/lib/agent/ats-enhancement-retry'
import {
  executeWithStageRetry as executeJobTargetingWithRetry,
  shapeTargetJobDescription,
  shapeTargetingRewriteCurrentContent,
} from '@/lib/agent/job-targeting-retry'
import { buildRewritePlan } from '@/lib/agent/tools/build-rewrite-plan'
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
    'Act as a senior ATS resume strategist for Brazilian job seekers.',
    'Write in Brazilian Portuguese (pt-BR) with professional, concise, recruiter-friendly language.',
    'Never invent employers, tools, certifications, projects, metrics, or results.',
    'Optimize for ATS parsing, semantic keyword matching, and human readability at the same time.',
    'Keep facts from the original resume intact while improving wording, structure, readability, and prioritization.',
  ].join('\n')
}

function buildJobTargetingStyleGuide(targetJobDescription: string): string {
  const shapedTargetJob = shapeTargetJobDescription(targetJobDescription)

  return [
    'Act as a senior resume strategist adapting a real resume to a specific target role.',
    'Write in Brazilian Portuguese (pt-BR) with professional, concise, recruiter-friendly language.',
    'Never invent employers, titles, tools, certifications, metrics, projects, or dates.',
    'Maximize alignment to the target vacancy only with facts already present in the original resume.',
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
        'Use 3 to 5 concise lines that clarify professional positioning, seniority, core stack, and type of business impact.',
        'Avoid empty cliches and preserve factual truth.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        'Rewrite only the experience section.',
        'Preserve the same companies, titles, dates, and factual scope.',
        'Rewrite bullets using action + context + result or purpose, without inventing metrics.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        'Rewrite and reorder only the skills section.',
        'Keep only real skills already evidenced by the resume and remove redundancy.',
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
          ? 'Use 3 to 5 concise lines aligned to the target role without claiming skills or experiences the candidate does not have.'
          : 'Use 3 to 5 concise lines aligned to the vacancy context without claiming a literal role identity, skills, or experiences the candidate does not have.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.experience,
        'Rewrite only the experience section.',
        'Preserve companies, titles, dates, and factual scope.',
        'Prioritize bullets that better match the target role and target keywords, but do not fabricate missing fit.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.skills,
        'Rewrite and reorder only the skills section.',
        'Keep only grounded skills already evidenced in the resume.',
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

      let result: Awaited<ReturnType<typeof rewriteSection>>
      let attempts = 0

      try {
        const execution = await (params.mode === 'job_targeting' ? executeJobTargetingWithRetry : executeWithStageRetry)(
          async () => {
            const rewriteResult = await rewriteSection({
              section,
              current_content: currentContent,
              instructions: params.mode === 'job_targeting'
                ? buildTargetJobSectionInstructions(
                    section,
                    params.gapAnalysis,
                    targetingPlan!,
                    params.targetJobDescription,
                  )
                : buildSectionInstructions(section, params.atsAnalysis, rewritePlan!),
              target_keywords: params.mode === 'job_targeting'
                ? targetingPlan!.mustEmphasize
                : rewritePlan!.keywordFocus,
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

      sectionAttempts[section] = attempts

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

      optimizedCvState = applySectionData(
        optimizedCvState,
        section,
        params.mode === 'job_targeting' && section === 'skills'
          ? sanitizeJobTargetedSkills(
              params.cvState.skills,
              result.output.section_data as CVState['skills'],
              targetingPlan!,
            )
          : result.output.section_data,
      )
      changedSections.push(section)
      notes.push(...result.output.changes_made)
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
