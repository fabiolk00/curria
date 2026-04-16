import { executeWithStageRetry } from '@/lib/agent/ats-enhancement-retry'
import { createCvVersion } from '@/lib/db/cv-versions'
import { updateSession } from '@/lib/db/sessions'
import { analyzeAtsGeneral } from '@/lib/agent/tools/ats-analysis'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'
import type { CVState } from '@/types/cv'

function buildWorkflowRun(
  session: Session,
  patch: Partial<NonNullable<Session['agentState']['atsWorkflowRun']>>,
): NonNullable<Session['agentState']['atsWorkflowRun']> {
  const current = session.agentState.atsWorkflowRun

  return {
    status: current?.status ?? 'idle',
    attemptCount: current?.attemptCount ?? 0,
    retriedSections: current?.retriedSections ?? [],
    compactedSections: current?.compactedSections ?? [],
    sectionAttempts: current?.sectionAttempts ?? {},
    updatedAt: new Date().toISOString(),
    ...current,
    ...patch,
  }
}

async function persistAgentState(session: Session, agentState: Session['agentState']): Promise<void> {
  await updateSession(session.id, {
    agentState,
  })
  session.agentState = agentState
}

function uniqueSections(
  issues: NonNullable<Session['agentState']['rewriteValidation']>['issues'],
): string[] {
  return Array.from(new Set(
    issues
      .map((issue) => issue.section)
      .filter((section): section is string => Boolean(section)),
  ))
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function splitIntoSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function buildEvidenceText(cvState: CVState): string {
  return [
    cvState.summary,
    cvState.skills.join(' '),
    ...cvState.experience.flatMap((entry) => [entry.title, entry.company, ...entry.bullets]),
  ].join(' ').toLowerCase()
}

function extractNumbers(text: string): string[] {
  return Array.from(text.match(/\d+(?:[.,]\d+)?%?/g) ?? [])
}

function sanitizeAtsSummary(
  originalCvState: CVState,
  optimizedCvState: CVState,
  issues: NonNullable<Session['agentState']['rewriteValidation']>['issues'],
): string {
  const optimizedSummary = optimizedCvState.summary.trim()
  if (!optimizedSummary) {
    return originalCvState.summary
  }

  const summaryIssues = issues.filter((issue) => issue.section === 'summary')
  if (summaryIssues.length === 0) {
    return optimizedSummary
  }

  const normalizedSummary = optimizedSummary.toLowerCase()
  const optimizedExperienceText = optimizedCvState.experience
    .flatMap((entry) => [entry.title, ...entry.bullets])
    .join(' ')
    .toLowerCase()
  const originalEvidenceText = buildEvidenceText(originalCvState)
  const unsupportedSkills = optimizedCvState.skills.filter((skill) => {
    const normalizedSkill = normalize(skill)
    return normalizedSummary.includes(normalizedSkill) && !originalEvidenceText.includes(normalizedSkill)
  })
  const experienceMissingSkills = optimizedCvState.skills.filter((skill) => {
    const normalizedSkill = normalize(skill)
    return normalizedSummary.includes(normalizedSkill) && !optimizedExperienceText.includes(normalizedSkill)
  })
  const originalNumbers = new Set(extractNumbers(originalEvidenceText))
  const unsupportedNumbers = extractNumbers(optimizedSummary).filter((value) => !originalNumbers.has(value))
  const bannedTokens = Array.from(new Set([
    ...unsupportedSkills.map(normalize),
    ...experienceMissingSkills.map(normalize),
    ...unsupportedNumbers.map((value) => value.toLowerCase()),
  ]))

  if (bannedTokens.length === 0) {
    return optimizedSummary
  }

  const repairedSummary = splitIntoSentences(optimizedSummary)
    .filter((sentence) => {
      const normalizedSentence = sentence.toLowerCase()
      return !bannedTokens.some((token) => normalizedSentence.includes(token))
    })
    .join(' ')
    .trim()

  return repairedSummary || originalCvState.summary
}

function buildSmartAtsRepairCvState(
  originalCvState: CVState,
  optimizedCvState: CVState,
  issues: NonNullable<Session['agentState']['rewriteValidation']>['issues'],
): {
  cvState: CVState
  notes: string[]
} {
  const repairedCvState: CVState = structuredClone(optimizedCvState)
  const notes: string[] = []
  const issueSections = new Set(uniqueSections(issues))

  if (issueSections.has('skills')) {
    const originalSkillSet = new Set(originalCvState.skills.map((skill) => normalize(skill)).filter(Boolean))
    const filteredSkills = optimizedCvState.skills.filter((skill) => originalSkillSet.has(normalize(skill)))
    repairedCvState.skills = filteredSkills.length > 0 ? filteredSkills : [...originalCvState.skills]
    notes.push('Skills ajustadas para manter apenas ferramentas comprovadas no currículo original.')
  }

  if (issueSections.has('summary')) {
    repairedCvState.summary = sanitizeAtsSummary(originalCvState, repairedCvState, issues)
    notes.push(
      repairedCvState.summary === originalCvState.summary
        ? 'Resumo suavizado para remover claims sem suporte antes da validação final.'
        : 'Resumo reescrito preservado com limpeza de menções inconsistentes.',
    )
  }

  if (issueSections.has('experience')) {
    repairedCvState.experience = structuredClone(originalCvState.experience)
    notes.push('Experiência revertida para a versão original após validação conservadora.')
  }

  if (issueSections.has('education')) {
    repairedCvState.education = structuredClone(originalCvState.education)
    notes.push('Educação revertida para a versão original após validação conservadora.')
  }

  if (issueSections.has('certifications')) {
    repairedCvState.certifications = structuredClone(originalCvState.certifications)
    notes.push('Certificações revertidas para a versão original após validação conservadora.')
  }

  return {
    cvState: repairedCvState,
    notes,
  }
}

export async function runAtsEnhancementPipeline(session: Session): Promise<{
  success: boolean
  atsAnalysis?: NonNullable<Session['agentState']['atsAnalysis']>
  optimizedCvState?: Session['agentState']['optimizedCvState']
  optimizationSummary?: Session['agentState']['optimizationSummary']
  validation?: Session['agentState']['rewriteValidation']
  error?: string
}> {
  const previousOptimizedCvState = session.agentState.optimizedCvState
    ? structuredClone(session.agentState.optimizedCvState)
    : undefined
  const previousOptimizedAt = session.agentState.optimizedAt
  const previousOptimizationSummary = session.agentState.optimizationSummary
    ? structuredClone(session.agentState.optimizationSummary)
    : undefined
  const previousLastRewriteMode = session.agentState.lastRewriteMode

  await persistAgentState(session, {
    ...session.agentState,
    rewriteStatus: 'running',
    workflowMode: 'ats_enhancement',
    atsWorkflowRun: buildWorkflowRun(session, {
      status: 'running',
      currentStage: 'analysis',
      attemptCount: 0,
      retriedSections: [],
      compactedSections: [],
      sectionAttempts: {},
      lastFailureReason: undefined,
      lastFailureSection: undefined,
      lastFailureStage: undefined,
    }),
  })

  logInfo('agent.ats_enhancement.started', {
    workflowMode: 'ats_enhancement',
    sessionId: session.id,
    userId: session.userId,
    stage: 'analysis',
  })

  const atsAnalysisResult = await executeWithStageRetry(
    async (attempt) => {
      session.agentState.atsWorkflowRun = buildWorkflowRun(session, {
        currentStage: 'analysis',
        attemptCount: attempt,
      })
      return analyzeAtsGeneral(session.cvState, session.userId, session.id)
    },
    {
      onRetry: (_error, attempt) => {
        logWarn('agent.ats_enhancement.retry', {
          workflowMode: 'ats_enhancement',
          sessionId: session.id,
          userId: session.userId,
          stage: 'analysis',
          attempt: attempt + 1,
        })
      },
    },
  ).then(({ result }) => result)

  if (!atsAnalysisResult.success || !atsAnalysisResult.result) {
    const nextAgentState: Session['agentState'] = {
      ...session.agentState,
      rewriteStatus: 'failed',
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'analysis',
        lastFailureStage: 'analysis',
        lastFailureReason: atsAnalysisResult.error ?? 'ATS analysis failed.',
      }),
    }
    await persistAgentState(session, nextAgentState)
    logError('agent.ats_enhancement.failed', {
      workflowMode: 'ats_enhancement',
      sessionId: session.id,
      userId: session.userId,
      stage: 'analysis',
      success: false,
      errorMessage: atsAnalysisResult.error ?? 'ATS analysis failed.',
    })
    return {
      success: false,
      error: atsAnalysisResult.error ?? 'ATS analysis failed.',
    }
  }

  const atsAnalysis = {
    result: atsAnalysisResult.result,
    analyzedAt: new Date().toISOString(),
  } satisfies NonNullable<Session['agentState']['atsAnalysis']>

  await persistAgentState(session, {
    ...session.agentState,
    atsWorkflowRun: buildWorkflowRun(session, {
      currentStage: 'rewrite_plan',
    }),
  })

  const rewriteResult = await rewriteResumeFull({
    mode: 'ats_enhancement',
    cvState: session.cvState,
    atsAnalysis: atsAnalysis.result,
    userId: session.userId,
    sessionId: session.id,
  })

  if (!rewriteResult.success || !rewriteResult.optimizedCvState) {
    const nextAgentState: Session['agentState'] = {
      ...session.agentState,
      atsAnalysis,
      rewriteStatus: 'failed',
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'rewrite_section',
        sectionAttempts: rewriteResult.diagnostics?.sectionAttempts ?? {},
        retriedSections: rewriteResult.diagnostics?.retriedSections ?? [],
        compactedSections: rewriteResult.diagnostics?.compactedSections ?? [],
        usageTotals: {
          sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
          retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
          compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
        },
        lastFailureStage: 'rewrite_section',
        lastFailureReason: rewriteResult.error ?? 'Full ATS rewrite failed.',
      }),
    }
    await persistAgentState(session, nextAgentState)
    logError('agent.ats_enhancement.failed', {
      workflowMode: 'ats_enhancement',
      sessionId: session.id,
      userId: session.userId,
      stage: 'rewrite_section',
      success: false,
      retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
      compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
      errorMessage: rewriteResult.error ?? 'Full ATS rewrite failed.',
    })
    return {
      success: false,
      atsAnalysis,
      error: rewriteResult.error ?? 'Full ATS rewrite failed.',
    }
  }

  logInfo('agent.ats_enhancement.rewrite_completed', {
    workflowMode: 'ats_enhancement',
    sessionId: session.id,
    userId: session.userId,
    stage: 'rewrite_section',
    sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
    retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
    compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
  })

  const validation = validateRewrite(session.cvState, rewriteResult.optimizedCvState)
  const optimizedAt = new Date().toISOString()
  const validationIssueMessages = validation.issues.map((issue) => issue.message)
  const validationIssueSections = Array.from(new Set(validation.issues.map((issue) => issue.section).filter(Boolean)))
  let finalOptimizedCvState = rewriteResult.optimizedCvState
  let finalValidation = validation
  let finalOptimizationSummary = rewriteResult.summary

  if (!validation.valid) {
    const smartRepair = buildSmartAtsRepairCvState(
      session.cvState,
      rewriteResult.optimizedCvState,
      validation.issues,
    )
    const smartRepairValidation = validateRewrite(session.cvState, smartRepair.cvState)

    if (smartRepairValidation.valid) {
      finalOptimizedCvState = smartRepair.cvState
      finalValidation = smartRepairValidation
      finalOptimizationSummary = {
        changedSections: rewriteResult.summary?.changedSections ?? [],
        notes: Array.from(new Set([
          ...(rewriteResult.summary?.notes ?? []),
          ...smartRepair.notes,
          'Reparo automático aplicado para preservar a reescrita ATS com coerência factual.',
        ])),
        keywordCoverageImprovement: rewriteResult.summary?.keywordCoverageImprovement,
      }

      logWarn('agent.ats_enhancement.validation_recovered', {
        workflowMode: 'ats_enhancement',
        sessionId: session.id,
        userId: session.userId,
        stage: 'validation',
        recoveryKind: 'smart_repair',
        originalIssueCount: validation.issues.length,
        originalIssueSections: validationIssueSections.join(', ') || undefined,
      })
    } else {
      const conservativeFallback = buildSmartAtsRepairCvState(
        session.cvState,
        smartRepair.cvState,
        smartRepairValidation.issues,
      )
      const conservativeValidation = validateRewrite(session.cvState, conservativeFallback.cvState)

      if (conservativeValidation.valid) {
        finalOptimizedCvState = conservativeFallback.cvState
        finalValidation = conservativeValidation
        finalOptimizationSummary = {
          changedSections: rewriteResult.summary?.changedSections ?? [],
          notes: Array.from(new Set([
            ...(rewriteResult.summary?.notes ?? []),
            ...smartRepair.notes,
            ...conservativeFallback.notes,
            'Fallback conservador aplicado para garantir uma versão ATS válida.',
          ])),
          keywordCoverageImprovement: rewriteResult.summary?.keywordCoverageImprovement,
        }

        logWarn('agent.ats_enhancement.validation_recovered', {
          workflowMode: 'ats_enhancement',
          sessionId: session.id,
          userId: session.userId,
          stage: 'validation',
          recoveryKind: 'conservative_fallback',
          originalIssueCount: validation.issues.length,
          originalIssueSections: validationIssueSections.join(', ') || undefined,
        })
      } else {
        finalOptimizedCvState = structuredClone(session.cvState)
        finalValidation = validateRewrite(session.cvState, finalOptimizedCvState)
        finalOptimizationSummary = {
          changedSections: [],
          notes: Array.from(new Set([
            ...(rewriteResult.summary?.notes ?? []),
            'Falha na validação ATS; a plataforma entregou a base original para evitar bloqueio da geração.',
          ])),
          keywordCoverageImprovement: rewriteResult.summary?.keywordCoverageImprovement,
        }

        logWarn('agent.ats_enhancement.validation_recovered', {
          workflowMode: 'ats_enhancement',
          sessionId: session.id,
          userId: session.userId,
          stage: 'validation',
          recoveryKind: 'original_cv_fallback',
          originalIssueCount: validation.issues.length,
          originalIssueSections: validationIssueSections.join(', ') || undefined,
        })
      }
    }
  }

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    workflowMode: 'ats_enhancement',
    atsAnalysis,
    rewriteStatus: finalValidation.valid ? 'completed' : 'failed',
    optimizedCvState: finalValidation.valid ? finalOptimizedCvState : previousOptimizedCvState,
    optimizedAt: finalValidation.valid ? optimizedAt : previousOptimizedAt,
    optimizationSummary: finalValidation.valid ? finalOptimizationSummary : previousOptimizationSummary,
    lastRewriteMode: finalValidation.valid ? 'ats_enhancement' : previousLastRewriteMode,
    rewriteValidation: finalValidation,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: finalValidation.valid ? 'completed' : 'failed',
      currentStage: finalValidation.valid ? 'persist_version' : 'validation',
      sectionAttempts: rewriteResult.diagnostics?.sectionAttempts ?? {},
      retriedSections: rewriteResult.diagnostics?.retriedSections ?? [],
      compactedSections: rewriteResult.diagnostics?.compactedSections ?? [],
      usageTotals: {
        sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
        retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
        compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
      },
      lastFailureStage: finalValidation.valid ? undefined : 'validation',
      lastFailureReason: finalValidation.valid
        ? undefined
        : validationIssueMessages[0]
          ? `ATS rewrite validation failed: ${validationIssueMessages[0]}`
          : 'ATS rewrite validation failed.',
    }),
  }

  await persistAgentState(session, nextAgentState)

  if (!finalValidation.valid) {
    logWarn('agent.ats_enhancement.validation_failed', {
      workflowMode: 'ats_enhancement',
      sessionId: session.id,
      userId: session.userId,
      stage: 'validation',
      success: false,
      issueCount: validation.issues.length,
      issueSections: validationIssueSections.join(', ') || undefined,
      issueMessages: validationIssueMessages.join(' | ') || undefined,
    })
    return {
      success: false,
      atsAnalysis,
      validation: finalValidation,
      error: 'ATS rewrite validation failed.',
    }
  }

  const validatedOptimizedCvState = finalOptimizedCvState
  const recoveredIssueCount = !validation.valid && finalValidation.valid
    ? validation.issues.length
    : undefined
  const recoveredIssueSections = !validation.valid && finalValidation.valid
    ? validationIssueSections.join(', ') || undefined
    : undefined

  try {
    await executeWithStageRetry(
      async (attempt) => {
        session.agentState.atsWorkflowRun = buildWorkflowRun(session, {
          status: 'running',
          currentStage: 'persist_version',
          attemptCount: attempt,
        })
        await createCvVersion({
          sessionId: session.id,
          snapshot: validatedOptimizedCvState,
          source: 'ats-enhancement',
        })
      },
      {
        onRetry: (_error, attempt) => {
          logWarn('agent.ats_enhancement.retry', {
            workflowMode: 'ats_enhancement',
            sessionId: session.id,
            userId: session.userId,
            stage: 'persist_version',
            attempt: attempt + 1,
          })
        },
      },
    )
  } catch (error) {
    const failedAgentState: Session['agentState'] = {
      ...session.agentState,
      rewriteStatus: 'failed',
      optimizedCvState: previousOptimizedCvState,
      optimizedAt: previousOptimizedAt,
      optimizationSummary: previousOptimizationSummary,
      lastRewriteMode: previousLastRewriteMode,
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'persist_version',
        lastFailureStage: 'persist_version',
        lastFailureReason: error instanceof Error ? error.message : 'Failed to persist ATS version.',
      }),
    }
    await persistAgentState(session, failedAgentState)
    logError('agent.ats_enhancement.failed', {
      workflowMode: 'ats_enhancement',
      sessionId: session.id,
      userId: session.userId,
      stage: 'persist_version',
      success: false,
      ...serializeError(error),
    })
    return {
      success: false,
      atsAnalysis,
      validation,
      error: error instanceof Error ? error.message : 'Failed to persist ATS version.',
    }
  }

  const completedAgentState: Session['agentState'] = {
    ...session.agentState,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: 'completed',
      currentStage: 'persist_version',
      lastFailureStage: undefined,
      lastFailureReason: undefined,
    }),
  }
  await persistAgentState(session, completedAgentState)
  logInfo('agent.ats_enhancement.completed', {
    workflowMode: 'ats_enhancement',
    sessionId: session.id,
    userId: session.userId,
    stage: 'persist_version',
    success: true,
    issueCount: finalValidation.issues.length,
    recoveredIssueCount,
    recoveredIssueSections,
    sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
    retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
    compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
  })

  return {
    success: true,
    atsAnalysis,
    optimizedCvState: finalOptimizedCvState,
    optimizationSummary: finalOptimizationSummary,
    validation: finalValidation,
  }
}
