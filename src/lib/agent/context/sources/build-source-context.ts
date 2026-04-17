import { buildCareerFitPromptSnapshot, buildProfileAuditSnapshot } from '@/lib/agent/profile-review'
import { localizeTargetFitReason, localizeTargetFitSummary } from '@/lib/agent/target-fit'
import { resolveCanonicalResumeSource, resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'
import type {
  AgentContextActionType,
  AgentContextBlock,
  AgentContextResumeTarget,
  AgentContextWorkflowMode,
  BuildAgentContextInput,
} from '@/lib/agent/context/types'
import type { Session } from '@/types/agent'

export function buildPreloadedResumeContext(session: Session): string {
  if (!session.cvState.fullName?.trim() || session.agentState.sourceResumeText) {
    return ''
  }

  return `The user's resume is already loaded from their saved profile.
Do not ask the user to upload a resume. Do not call parse_file.
If any cvState fields look incomplete, mention it briefly and continue with the strongest available context.`
}

function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0) return ''
  if (text.length <= maxLen) return text
  if (maxLen <= 12) return text.slice(0, maxLen)
  return `${text.slice(0, maxLen - 12)}\n[truncated]`
}

function safeJoin(items: string[], fallback: string, limit = 5): string {
  const cleaned = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)

  return cleaned.length > 0 ? cleaned.join(', ') : fallback
}

function hasStructuredResumeData(session: Session): boolean {
  return Boolean(
    session.cvState.summary.trim()
    || session.cvState.skills.length > 0
    || session.cvState.experience.length > 0
    || session.cvState.education.length > 0
    || (session.cvState.certifications?.length ?? 0) > 0,
  )
}

function buildCvStateJsonContext(session: Session, maxChars: number): string {
  return `<user_resume_data>
\`\`\`json
${truncate(JSON.stringify(session.cvState, null, 2), maxChars)}
\`\`\`
</user_resume_data>`
}

function formatExperiencePreview(entry: Session['cvState']['experience'][number]): string {
  const location = entry.location?.trim()
  const period = [entry.startDate, entry.endDate].filter(Boolean).join(' - ')
  const bullets = entry.bullets
    .slice(0, 1)
    .map((bullet) => `  - ${truncate(bullet.trim(), 140)}`)
    .join('\n')

  return [
    `- ${entry.title.trim()} at ${entry.company.trim()}${location ? `, ${location}` : ''}${period ? ` (${period})` : ''}`,
    bullets,
  ].filter(Boolean).join('\n')
}

function buildCompactCvStateContext(session: Session, maxChars: number): string {
  const lines: string[] = []

  if (session.cvState.fullName.trim()) {
    lines.push(`Name: ${session.cvState.fullName.trim()}`)
  }

  const contactLine = [
    session.cvState.email?.trim(),
    session.cvState.phone?.trim(),
    session.cvState.linkedin?.trim(),
    session.cvState.location?.trim(),
  ].filter(Boolean).join(' | ')

  if (contactLine) {
    lines.push(`Contact: ${contactLine}`)
  }

  if (session.cvState.summary.trim()) {
    lines.push(`Summary: ${truncate(session.cvState.summary.trim(), 240)}`)
  }

  if (session.cvState.skills.length > 0) {
    lines.push(`Skills: ${session.cvState.skills.slice(0, 8).join(', ')}`)
  }

  if (session.cvState.experience.length > 0) {
    lines.push('Experience:')
    for (const experience of session.cvState.experience.slice(0, 3)) {
      lines.push(formatExperiencePreview(experience))
    }
  }

  if (session.cvState.education.length > 0) {
    lines.push('Education:')
    for (const education of session.cvState.education.slice(0, 2)) {
      const gpa = education.gpa?.trim() ? `, GPA ${education.gpa.trim()}` : ''
      lines.push(`- ${education.degree.trim()} at ${education.institution.trim()} (${education.year.trim()}${gpa})`)
    }
  }

  if ((session.cvState.certifications?.length ?? 0) > 0) {
    lines.push('Certifications:')
    for (const certification of session.cvState.certifications?.slice(0, 2) ?? []) {
      const year = certification.year?.trim() ? ` (${certification.year.trim()})` : ''
      lines.push(`- ${certification.name.trim()} by ${certification.issuer.trim()}${year}`)
    }
  }

  return `<user_resume_data>
${truncate(lines.join('\n'), maxChars)}
</user_resume_data>`
}

function buildOptimizedResumeContext(session: Session, maxChars: number): string {
  if (!session.agentState.optimizedCvState) {
    return ''
  }

  return `<optimized_resume_data>
\`\`\`json
${truncate(JSON.stringify(session.agentState.optimizedCvState, null, 2), maxChars)}
\`\`\`
</optimized_resume_data>`
}

function buildResumeTextContext(session: Session, maxChars: number): string {
  if (!session.agentState.sourceResumeText?.trim()) {
    return ''
  }

  if (session.phase !== 'intake' && hasStructuredResumeData(session)) {
    return ''
  }

  return `<user_resume_text>
${truncate(session.agentState.sourceResumeText, maxChars)}
</user_resume_text>`
}

function buildTargetJobContext(session: Session, resumeTarget: AgentContextResumeTarget | null | undefined, maxChars: number): string {
  const targetJobDescription = resumeTarget?.targetJobDescription?.trim()
    || session.agentState.targetJobDescription?.trim()

  if (!targetJobDescription) {
    return ''
  }

  return `<target_job_description>
${truncate(targetJobDescription, maxChars)}
</target_job_description>`
}

function buildAnalysisSnapshotContext(session: Session): string {
  const lines: string[] = []

  if (session.atsScore) {
    lines.push(`ATS score: ${session.atsScore.total}/100.`)
    const topIssue = session.atsScore.issues[0]
    const topSuggestion = session.atsScore.suggestions[0]
    if (topIssue) lines.push(`Top issue: ${topIssue.section} - ${truncate(topIssue.message, 160)}`)
    if (topSuggestion) lines.push(`Top suggestion: ${truncate(topSuggestion, 160)}`)
  }

  if (session.agentState.gapAnalysis) {
    const result = session.agentState.gapAnalysis.result
    lines.push(`Gap match: ${result.matchScore}/100.`)
    lines.push(`Missing skills: ${safeJoin(result.missingSkills, 'none', 3)}.`)
    lines.push(`Weak areas: ${safeJoin(result.weakAreas, 'none', 3)}.`)
  } else if (session.agentState.targetFitAssessment) {
    lines.push(`Fit: ${session.agentState.targetFitAssessment.level}. ${truncate(localizeTargetFitSummary(session.agentState.targetFitAssessment.summary), 220)}`)
    lines.push(`Reasons: ${safeJoin(session.agentState.targetFitAssessment.reasons.map(localizeTargetFitReason), 'none', 2)}.`)
  }

  return lines.join('\n')
}

function buildValidationContext(session: Session): string {
  const validation = session.agentState.rewriteValidation
  if (!validation) {
    return ''
  }

  const issues = validation.issues
    .slice(0, 4)
    .map((issue) => `- [${issue.severity}] ${issue.section ?? 'resume'}: ${issue.message}`)
    .join('\n')

  return [
    `Validation status: ${validation.valid ? 'valid' : 'invalid'}.`,
    issues ? `Issues:\n${issues}` : '',
  ].filter(Boolean).join('\n')
}

function buildRewriteHistoryContext(session: Session): string {
  const entries = Object.entries(session.agentState.rewriteHistory)
    .sort(([, left], [, right]) => {
      const leftTime = left?.updatedAt ? new Date(left.updatedAt).getTime() : 0
      const rightTime = right?.updatedAt ? new Date(right.updatedAt).getTime() : 0
      return rightTime - leftTime
    })
    .slice(0, 2)

  return entries.map(([section, payload]) => {
    const keywords = payload?.keywordsAdded.length
      ? `keywords: ${payload.keywordsAdded.slice(0, 4).join(', ')}`
      : 'keywords: none'
    return `- ${section}: ${keywords}; last rewrite at ${payload?.updatedAt ?? 'unknown'}`
  }).join('\n')
}

function buildGeneratedOutputContext(
  session: Session,
  actionType: AgentContextActionType,
  workflowMode: AgentContextWorkflowMode,
  generatedOutputOverride?: BuildAgentContextInput['generatedOutputOverride'],
): string {
  const generatedOutput = generatedOutputOverride ?? session.generatedOutput
  if (generatedOutput.status === 'idle' && workflowMode !== 'artifact_support' && actionType !== 'prepare_generation_support') {
    return ''
  }

  return [
    `Generation status: ${generatedOutput.status}.`,
    generatedOutput.generatedAt ? `Generated at: ${generatedOutput.generatedAt}.` : '',
    generatedOutput.error ? `Generation error: ${generatedOutput.error}.` : '',
  ].filter(Boolean).join('\n')
}

function buildSessionPhaseContext(session: Session): string {
  switch (session.phase) {
    case 'intake':
      return `## Current phase: INTAKE
Goal: receive the target vacancy and move into analysis quickly.`
    case 'analysis':
      return `## Current phase: ANALYSIS
Goal: give a short ATS read and move toward grounded next steps.`
    case 'dialog':
      return `## Current phase: DIALOG
Goal: improve the resume through targeted edits and grounded explanation.`
    case 'confirm':
      return `## Current phase: CONFIRM
Goal: summarize and confirm before generation.`
    case 'generation':
      return `## Current phase: GENERATION
Goal: prepare or explain file generation using the authoritative snapshot.`
  }
}

function buildSessionStateContext(session: Session, workflowMode: AgentContextWorkflowMode): string {
  return [
    `Workflow mode: ${workflowMode}.`,
    session.agentState.rewriteStatus ? `Rewrite status: ${session.agentState.rewriteStatus}.` : '',
    session.agentState.optimizedCvState ? 'An optimized resume snapshot is available.' : 'No optimized resume snapshot is available.',
    session.agentState.targetJobDescription?.trim() ? 'A target job description is available.' : 'No target job description is available.',
  ].filter(Boolean).join('\n')
}

function shouldIncludeOptimizedSnapshot(actionType: AgentContextActionType, workflowMode: AgentContextWorkflowMode): boolean {
  return actionType === 'validate_rewrite'
    || actionType === 'explain_changes'
    || actionType === 'prepare_generation_support'
    || workflowMode === 'artifact_support'
}

export function buildSourceContextBlocks(input: {
  session: Session
  actionType: AgentContextActionType
  workflowMode: AgentContextWorkflowMode
  resumeTarget?: AgentContextResumeTarget | null
  generatedOutputOverride?: BuildAgentContextInput['generatedOutputOverride']
}): {
  blocks: AgentContextBlock[]
  selectedSnapshotSource: 'base' | 'optimized' | 'target_derived' | 'none'
} {
  const { session, actionType, workflowMode, resumeTarget } = input
  const blocks: AgentContextBlock[] = []

  const preloaded = buildPreloadedResumeContext(session)
  if (preloaded) {
    blocks.push({ key: 'preloaded_resume', heading: '## Resume Context', body: preloaded, minChars: 120 })
  }

  blocks.push({ key: 'session_phase', heading: '## Session Phase', body: buildSessionPhaseContext(session), minChars: 80 })
  blocks.push({ key: 'session_state', heading: '## Session State', body: buildSessionStateContext(session, workflowMode), minChars: 80 })

  const canonicalSource = resolveCanonicalResumeSource(session)
  const effectiveSource = resolveEffectiveResumeSource(session, resumeTarget ? {
    id: resumeTarget.id,
    sessionId: resumeTarget.sessionId,
    derivedCvState: resumeTarget.derivedCvState,
  } : null)

  let selectedSnapshotSource: 'base' | 'optimized' | 'target_derived' | 'none' = 'base'

  if (resumeTarget) {
    selectedSnapshotSource = 'target_derived'
  } else if (shouldIncludeOptimizedSnapshot(actionType, workflowMode) && session.agentState.optimizedCvState) {
    selectedSnapshotSource = 'optimized'
  } else if (!canonicalSource.cvState) {
    selectedSnapshotSource = 'none'
  }

  blocks.push({
    key: 'canonical_resume',
    heading: '## Canonical Resume State',
    body: session.phase === 'generation'
      ? buildCvStateJsonContext(session, 3_000)
      : buildCompactCvStateContext(session, session.phase === 'intake' ? 1_800 : 1_900),
    minChars: 300,
  })

  if (shouldIncludeOptimizedSnapshot(actionType, workflowMode) && session.agentState.optimizedCvState) {
    blocks.push({
      key: 'optimized_resume',
      heading: '## Optimized Resume State',
      body: selectedSnapshotSource === 'optimized'
        ? buildOptimizedResumeContext(session, 2_000)
        : `<optimized_resume_data>\nSelected snapshot source: ${effectiveSource.ref.snapshotSource}\n</optimized_resume_data>`,
      minChars: 180,
    })
  }

  const resumeText = buildResumeTextContext(session, 1_400)
  if (resumeText) {
    blocks.push({ key: 'resume_text', heading: '## Extracted Resume Text', body: resumeText, minChars: 180 })
  }

  if (workflowMode !== 'chat_lightweight') {
    blocks.push({ key: 'profile_audit', heading: '## Profile Audit Snapshot', body: buildProfileAuditSnapshot(session.cvState), minChars: 140 })
  }

  const targetJob = buildTargetJobContext(session, resumeTarget, 950)
  if (targetJob) {
    blocks.push({ key: 'target_job', heading: '## Target Job Description', body: targetJob, minChars: 180 })
  }

  const analysis = buildAnalysisSnapshotContext(session)
  if (analysis && workflowMode !== 'chat_lightweight') {
    blocks.push({ key: 'analysis_snapshot', heading: '## Analysis Snapshot', body: analysis, minChars: 120 })
  }

  const validation = buildValidationContext(session)
  if (validation && shouldIncludeOptimizedSnapshot(actionType, workflowMode)) {
    blocks.push({ key: 'validation_snapshot', heading: '## Rewrite Validation', body: validation, minChars: 120 })
  }

  const rewriteHistory = buildRewriteHistoryContext(session)
  if (rewriteHistory && session.phase !== 'analysis') {
    blocks.push({ key: 'rewrite_history', heading: '## Recent Rewrite History', body: rewriteHistory, minChars: 80 })
  }

  const generationState = buildGeneratedOutputContext(session, actionType, workflowMode, input.generatedOutputOverride)
  if (generationState) {
    blocks.push({ key: 'generated_output', heading: '## Generation State', body: generationState, minChars: 80 })
  }

  const careerFit = buildCareerFitPromptSnapshot(session.agentState.targetFitAssessment, session.agentState.gapAnalysis?.result)
  if (careerFit && (session.phase === 'confirm' || actionType === 'prepare_generation_support')) {
    blocks.push({ key: 'career_fit_guardrail', heading: '## Career Fit Guardrail', body: careerFit, minChars: 100 })
  }

  return {
    blocks: blocks.filter((block) => block.body.trim().length > 0),
    selectedSnapshotSource,
  }
}
