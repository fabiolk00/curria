import { NextRequest, NextResponse } from 'next/server'

import { dispatchToolWithContext } from '@/lib/agent/tools'
import { validateGenerationCvState } from '@/lib/agent/tools/generate-file'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { checkUserQuota } from '@/lib/db/sessions'
import { ATS_SECTION_HEADINGS } from '@/lib/templates/cv-state-to-template-data'
import {
  assessAtsEnhancementReadiness,
  buildResumeTextFromCvState,
  getAtsEnhancementBlockingItems,
} from '@/lib/profile/ats-enhancement'
import { createSession, applyToolPatchWithVersion } from '@/lib/db/sessions'
import type { ToolFailure } from '@/types/agent'

function buildAtsResumeStyleGuide(): string {
  return [
    'Act as a senior ATS resume strategist for Brazilian job seekers.',
    'Write in Brazilian Portuguese (pt-BR) with professional, concise, recruiter-friendly language.',
    'Never invent employers, tools, certifications, projects, metrics, or results.',
    'Optimize for ATS parsing, semantic keyword matching, and human readability at the same time.',
    `Prefer a predictable ATS structure: ${ATS_SECTION_HEADINGS.summary.toLowerCase()}, ${ATS_SECTION_HEADINGS.skills.toLowerCase()}, ${ATS_SECTION_HEADINGS.experience.toLowerCase()}, ${ATS_SECTION_HEADINGS.education.toLowerCase()}, ${ATS_SECTION_HEADINGS.certifications.toLowerCase()}, ${ATS_SECTION_HEADINGS.languages.toLowerCase()}.`,
    'Avoid keyword stuffing, vague cliches, decorative language, and anything that sounds inflated or fictional.',
  ].join('\n')
}

function buildSummaryInstructions(): string {
  return [
    buildAtsResumeStyleGuide(),
    'Rewrite only the resumo profissional for generic ATS enhancement without a specific vacancy.',
    'Use 3 to 5 lines with this logic: profissao + senioridade/anos + especialidade + stack principal + tipo de impacto.',
    'Prioritize clarity, positioning, technologies already supported by the resume, and credible business impact.',
    'Do not use empty cliches such as proativo, dedicado, comunicativo, apaixonado por desafios.',
  ].join('\n\n')
}

function buildExperienceInstructions(): string {
  return [
    buildAtsResumeStyleGuide(),
    'Rewrite only the experiencia profissional section for generic ATS enhancement without a specific vacancy.',
    'Preserve the same cargos, empresas, datas, and factual scope.',
    'Rewrite each bullet with the logic acao + contexto + resultado ou finalidade legitima.',
    'Start bullets with strong verbs, keep them objective, and remove weak phrasing such as responsavel por.',
    'Do not invent achievements, metrics, tools, or responsibilities that are not grounded in the existing resume.',
  ].join('\n\n')
}

function buildSkillsInstructions(): string {
  return [
    buildAtsResumeStyleGuide(),
    `Rewrite and reorder only the ${ATS_SECTION_HEADINGS.skills.toLowerCase()} section for generic ATS enhancement without a specific vacancy.`,
    'Keep only real skills already supported by the resume or clearly informed by the user.',
    'Prioritize stronger market signals first and remove redundancy.',
    'Think in ATS-friendly groups such as analise de dados, business intelligence, cloud, programacao, engenharia de dados, ferramentas, and metodologias when relevant.',
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
  const missingItems = getAtsEnhancementBlockingItems(parsed.data)
  if (!readiness.isReady || missingItems.length > 0) {
    return NextResponse.json({
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: missingItems.length > 0 ? missingItems : readiness.reasons,
      missingItems,
    }, { status: 400 })
  }

  const hasCredits = await checkUserQuota(appUser.id)
  if (!hasCredits) {
    return NextResponse.json({
      error: 'Seus creditos acabaram. Recarregue seu saldo para gerar uma versao ATS.',
    }, { status: 402 })
  }

  const generationValidation = validateGenerationCvState(parsed.data)
  if (!generationValidation.success) {
    return NextResponse.json({
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: [generationValidation.errorMessage],
      missingItems: [generationValidation.errorMessage],
    }, { status: 400 })
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
