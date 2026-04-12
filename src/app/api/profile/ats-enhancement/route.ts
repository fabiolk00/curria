import { NextRequest, NextResponse } from 'next/server'

import { dispatchToolWithContext } from '@/lib/agent/tools'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { checkUserQuota } from '@/lib/db/sessions'
import { assessAtsEnhancementReadiness, buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'
import { createSession, applyToolPatchWithVersion } from '@/lib/db/sessions'
import type { ToolFailure } from '@/types/agent'

function buildSummaryInstructions(): string {
  return [
    'Rewrite the professional summary to improve general ATS performance without targeting a specific vacancy.',
    'Keep it truthful, concise, and impactful in Brazilian Portuguese.',
    'Emphasize clarity, role positioning, seniority cues, measurable outcomes when supported, and recruiter readability.',
    'Do not invent employers, tools, certifications, or achievements.',
  ].join('\n\n')
}

function buildExperienceInstructions(): string {
  return [
    'Rewrite the professional experience section to improve general ATS performance without targeting a specific vacancy.',
    'Strengthen action verbs, clarity, measurable outcomes, and keyword relevance based on the existing career history.',
    'Preserve the same roles and employers, but improve bullets for stronger ATS readability.',
    'Do not invent achievements, metrics, or technologies not grounded in the current resume.',
  ].join('\n\n')
}

function buildSkillsInstructions(): string {
  return [
    'Rewrite and reorder the skills section to improve general ATS performance without targeting a specific vacancy.',
    'Group or reorder skills for clarity, prioritize the strongest and most marketable ones first, and remove obvious redundancy.',
    'Keep the list truthful and realistic.',
  ].join('\n\n')
}

function isToolFailure(value: unknown): value is ToolFailure {
  return Boolean(
    value
    && typeof value === 'object'
    && 'success' in value
    && (value as { success?: unknown }).success === false,
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CVStateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const readiness = assessAtsEnhancementReadiness(parsed.data)
  if (!readiness.isReady) {
    return NextResponse.json({
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: readiness.reasons,
    }, { status: 400 })
  }

  const hasCredits = await checkUserQuota(appUser.id)
  if (!hasCredits) {
    return NextResponse.json({
      error: 'Seus creditos acabaram. Recarregue seu saldo para gerar uma versao ATS.',
    }, { status: 402 })
  }

  const session = await createSession(appUser.id)

  await applyToolPatchWithVersion(session, {
    cvState: parsed.data,
    agentState: {
      parseStatus: 'parsed',
      sourceResumeText: buildResumeTextFromCvState(parsed.data),
    },
  }, 'manual')

  const summaryResult = await dispatchToolWithContext('rewrite_section', {
    section: 'summary',
    current_content: parsed.data.summary.trim() || buildResumeTextFromCvState(parsed.data),
    instructions: buildSummaryInstructions(),
    target_keywords: parsed.data.skills.slice(0, 8),
  }, session)

  if (summaryResult.outputFailure) {
    return NextResponse.json({
      error: summaryResult.outputFailure.error,
      code: summaryResult.outputFailure.code,
    }, { status: 500 })
  }

  const experienceResult = await dispatchToolWithContext('rewrite_section', {
    section: 'experience',
    current_content: JSON.stringify(session.cvState.experience),
    instructions: buildExperienceInstructions(),
    target_keywords: session.cvState.skills.slice(0, 10),
  }, session)

  if (experienceResult.outputFailure) {
    return NextResponse.json({
      error: experienceResult.outputFailure.error,
      code: experienceResult.outputFailure.code,
    }, { status: 500 })
  }

  const skillsResult = await dispatchToolWithContext('rewrite_section', {
    section: 'skills',
    current_content: session.cvState.skills.join(', '),
    instructions: buildSkillsInstructions(),
    target_keywords: session.cvState.skills.slice(0, 12),
  }, session)

  if (skillsResult.outputFailure) {
    return NextResponse.json({
      error: skillsResult.outputFailure.error,
      code: skillsResult.outputFailure.code,
    }, { status: 500 })
  }

  await dispatchToolWithContext('score_ats', {
    resume_text: buildResumeTextFromCvState(session.cvState),
  }, session)

  const generationResult = await dispatchToolWithContext('generate_file', {
    cv_state: session.cvState,
    idempotency_key: `profile-ats:${session.id}`,
  }, session)

  if (generationResult.outputFailure) {
    return NextResponse.json({
      error: generationResult.outputFailure.error,
      code: generationResult.outputFailure.code,
    }, { status: 500 })
  }

  const output = generationResult.output as {
    creditsUsed?: number
    resumeGenerationId?: string
  }

  return NextResponse.json({
    success: true,
    sessionId: session.id,
    creditsUsed: output.creditsUsed ?? 0,
    resumeGenerationId: output.resumeGenerationId,
    generationType: 'ATS_ENHANCEMENT',
  })
}
