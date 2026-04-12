import type { CVState, GapAnalysisResult } from '@/types/cv'
import type { Session, TargetFitAssessment } from '@/types/agent'

type RoleFamily =
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'data'
  | 'design'
  | 'product'
  | 'qa'
  | 'mobile'
  | 'marketing'
  | 'unknown'

type SeniorityLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive' | 'unknown'

export type ProfileAuditFinding = {
  key: 'headline' | 'contact' | 'summary' | 'experience' | 'skills' | 'education' | 'proof'
  item: string
  reason: string
}

function hasMetric(text: string): boolean {
  return /(?:\d|%|r\$|usd|eur|kpi|meta|aument|reduz|cresceu|growth|lift|roi|ctr|conversion)/i.test(text)
}

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function inferProfileText(cvState: CVState): string {
  return [
    cvState.summary,
    cvState.skills.join(', '),
    ...cvState.experience.flatMap((entry) => [entry.title, entry.company, ...entry.bullets]),
  ].join('\n')
}

function inferRoleFamily(text: string): RoleFamily {
  const normalized = normalizeText(text)

  if (/\b(front[- ]?end|react|vue|angular|ui)\b/.test(normalized)) return 'frontend'
  if (/\b(back[- ]?end|api|postgres|sql server|node|java|c#)\b/.test(normalized)) return 'backend'
  if (/\b(devops|sre|kubernetes|docker|terraform|aws|azure|gcp)\b/.test(normalized)) return 'devops'
  if (/\b(data|analytics|bi|etl|machine learning|bigquery|dbt|looker|power bi)\b/.test(normalized)) return 'data'
  if (/\b(designer|ux|product design|figma)\b/.test(normalized)) return 'design'
  if (/\b(product manager|product owner|roadmap|discovery)\b/.test(normalized)) return 'product'
  if (/\b(qa|quality assurance|test automation|selenium)\b/.test(normalized)) return 'qa'
  if (/\b(mobile|android|ios|react native|flutter)\b/.test(normalized)) return 'mobile'
  if (/\b(marketing|growth|seo|crm|paid media)\b/.test(normalized)) return 'marketing'

  return 'unknown'
}

function inferSeniorityLevel(text: string): SeniorityLevel {
  const normalized = normalizeText(text)

  if (/\b(head|director|vp|chief|gerente|manager)\b/.test(normalized)) return 'executive'
  if (/\b(staff|principal|lead|lider|tech lead)\b/.test(normalized)) return 'lead'
  if (/\b(senior|sr)\b/.test(normalized)) return 'senior'
  if (/\b(pleno|mid|intermediario)\b/.test(normalized)) return 'mid'
  if (/\b(junior|jr)\b/.test(normalized)) return 'junior'
  if (/\b(estagiario|intern|trainee)\b/.test(normalized)) return 'intern'

  return 'unknown'
}

function seniorityGapIsMajor(profile: SeniorityLevel, target: SeniorityLevel): boolean {
  const rank: Record<SeniorityLevel, number> = {
    unknown: 0,
    intern: 1,
    junior: 2,
    mid: 3,
    senior: 4,
    lead: 5,
    executive: 6,
  }

  if (profile === 'unknown' || target === 'unknown') {
    return false
  }

  return rank[target] - rank[profile] >= 2
}

export function assessProfileAuditFindings(cvState: CVState): ProfileAuditFinding[] {
  const findings: ProfileAuditFinding[] = []
  const latestTitle = cvState.experience[0]?.title?.trim() ?? ''
  const summary = cvState.summary.trim()
  const skillCount = cvState.skills.filter((skill) => skill.trim().length > 0).length
  const experienceEntries = cvState.experience.filter((entry) => entry.title.trim() || entry.company.trim())
  const totalBullets = experienceEntries.reduce((total, entry) => total + entry.bullets.filter((bullet) => bullet.trim().length > 0).length, 0)
  const metricBullets = experienceEntries.flatMap((entry) => entry.bullets).filter((bullet) => hasMetric(bullet)).length
  const missingContactFields = [
    !cvState.email.trim() ? 'email' : null,
    !cvState.phone.trim() ? 'telefone' : null,
    !cvState.location?.trim() ? 'localizacao' : null,
    !cvState.linkedin?.trim() ? 'LinkedIn' : null,
  ].filter((value): value is string => Boolean(value))

  if (!latestTitle && wordCount(summary) < 10) {
    findings.push({
      key: 'headline',
      item: 'headline profissional / cargo atual',
      reason: 'Sem um cargo-alvo claro, recrutadores e ATS entendem pior o seu posicionamento e a senioridade pretendida.',
    })
  }

  if (missingContactFields.length > 0) {
    findings.push({
      key: 'contact',
      item: `informacoes de contato (${missingContactFields.join(', ')})`,
      reason: 'Contato incompleto reduz alcance com recrutadores e pode atrapalhar filtros basicos de ATS ou o retorno para entrevistas.',
    })
  }

  if (wordCount(summary) < 35) {
    findings.push({
      key: 'summary',
      item: 'resumo / sobre',
      reason: 'Um resumo curto demais perde palavras-chave, contexto de senioridade e narrativa profissional para convencer recrutadores rapidamente.',
    })
  }

  if (experienceEntries.length === 0 || totalBullets < Math.max(2, experienceEntries.length * 2)) {
    findings.push({
      key: 'experience',
      item: 'secao de experiencia',
      reason: 'Experiencias rasas ou incompletas enfraquecem a leitura de impacto real e reduzem a aderencia em vagas filtradas por historico.',
    })
  } else if (metricBullets === 0) {
    findings.push({
      key: 'experience',
      item: 'resultados mensuraveis na experiencia',
      reason: 'Sem metricas ou resultados concretos, o curriculo perde forca para recrutadores e parece mais generico para o ATS.',
    })
  }

  if (skillCount < 6) {
    findings.push({
      key: 'skills',
      item: 'secao de habilidades',
      reason: 'Poucas skills limitam correspondencia por palavra-chave e dificultam mostrar amplitude tecnica para a vaga certa.',
    })
  }

  if (cvState.education.length === 0) {
    findings.push({
      key: 'education',
      item: 'educacao',
      reason: 'Ausencia de formacao declarada pode derrubar confianca do recrutador e prejudicar filtros que exigem escolaridade minima.',
    })
  }

  if (experienceEntries.length < 2 && (cvState.certifications?.length ?? 0) === 0) {
    findings.push({
      key: 'proof',
      item: 'projetos ou certificacoes',
      reason: 'Quando a experiencia ainda e curta, projetos e certificacoes ajudam a provar profundidade, consistencia e intencao de carreira.',
    })
  }

  return findings
}

export function formatProfileAuditSummary(cvState: CVState, maxItems = 3): string | null {
  const findings = assessProfileAuditFindings(cvState).slice(0, maxItems)

  if (findings.length === 0) {
    return null
  }

  return findings
    .map((finding) => `${finding.item}: ${finding.reason}`)
    .join(' ')
}

export function buildProfileAuditSnapshot(cvState: CVState, maxItems = 4): string {
  const findings = assessProfileAuditFindings(cvState).slice(0, maxItems)

  if (findings.length === 0) {
    return 'Profile audit: no obvious ATS or recruiter-visibility weaknesses detected in the saved profile.'
  }

  return [
    'Profile audit findings:',
    ...findings.map((finding) => `- ${finding.item}: ${finding.reason}`),
  ].join('\n')
}

export function requiresCareerFitWarning(session: Pick<Session, 'agentState' | 'cvState'>): boolean {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  if (!targetJobDescription) {
    return false
  }

  const profileText = inferProfileText(session.cvState)
  const profileFamily = inferRoleFamily(profileText)
  const targetFamily = inferRoleFamily(targetJobDescription)
  const familyMismatch = profileFamily !== 'unknown' && targetFamily !== 'unknown' && profileFamily !== targetFamily
  const seniorityMismatch = seniorityGapIsMajor(
    inferSeniorityLevel(profileText),
    inferSeniorityLevel(targetJobDescription),
  )

  return Boolean(session.agentState.gapAnalysis && isWeakGapAnalysis(session.agentState.gapAnalysis.result))
    || familyMismatch
    || seniorityMismatch
}

function isWeakGapAnalysis(result: GapAnalysisResult): boolean {
  return result.matchScore < 45
    || result.missingSkills.length >= 6
    || result.weakAreas.length >= 5
}

export function hasActiveCareerFitWarning(session: Pick<Session, 'agentState'>): boolean {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  const phaseMeta = session.agentState.phaseMeta

  if (!targetJobDescription || !phaseMeta?.careerFitWarningIssuedAt) {
    return false
  }

  return phaseMeta.careerFitWarningTargetJobDescription?.trim() === targetJobDescription
}

export function hasConfirmedCareerFitOverride(session: Pick<Session, 'agentState'>): boolean {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  const phaseMeta = session.agentState.phaseMeta

  if (!targetJobDescription || !phaseMeta?.careerFitOverrideConfirmedAt) {
    return false
  }

  return phaseMeta.careerFitOverrideTargetJobDescription?.trim() === targetJobDescription
}

export function requiresCareerFitOverrideConfirmation(session: Pick<Session, 'agentState'>): boolean {
  return hasActiveCareerFitWarning(session)
    && !hasConfirmedCareerFitOverride(session)
}

export function buildCareerFitWarningText(session: Pick<Session, 'agentState' | 'cvState'>): string | null {
  const targetFit = session.agentState.targetFitAssessment
  const gapAnalysis = session.agentState.gapAnalysis?.result
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  if (!targetJobDescription) {
    return null
  }

  const gaps = [
    ...(gapAnalysis?.missingSkills.slice(0, 3) ?? []),
    ...(gapAnalysis?.weakAreas.slice(0, 2) ?? []),
  ].filter(Boolean)

  const gapSummary = gaps.length > 0
    ? `Principais gaps hoje: ${gaps.join(', ')}.`
    : 'Ainda existem lacunas importantes entre seu historico atual e o que a vaga pede.'

  const profileText = inferProfileText(session.cvState)
  const profileFamily = inferRoleFamily(profileText)
  const targetFamily = inferRoleFamily(targetJobDescription)
  const familyMismatch = profileFamily !== 'unknown' && targetFamily !== 'unknown' && profileFamily !== targetFamily
  const seniorityMismatch = seniorityGapIsMajor(
    inferSeniorityLevel(profileText),
    inferSeniorityLevel(targetJobDescription),
  )

  if (!targetFit && !gapAnalysis && !familyMismatch && !seniorityMismatch) {
    return null
  }

  const fitSummary = targetFit?.summary
    ?? (gapAnalysis
      ? `A aderencia estimada para esta vaga esta em ${gapAnalysis.matchScore}/100.`
      : 'Mesmo sem uma analise completa, ja existe um desalinhamento estrutural relevante para essa vaga.')

  const mismatchNote = familyMismatch
    ? `Seu historico atual parece mais alinhado a ${profileFamily}, enquanto esta vaga pede um foco mais claro em ${targetFamily}.`
    : seniorityMismatch
      ? 'A senioridade pedida pela vaga parece acima do que seu historico recente demonstra hoje.'
      : null

  return [
    'Preciso ser honesto: esta vaga parece um encaixe fraco para o seu perfil atual.',
    fitSummary,
    mismatchNote,
    gapSummary,
    'Seguir com a candidatura assim pode gastar seu tempo e reduzir a chance de retorno, porque reescrever o curriculo sozinho nao fecha lacunas estruturais.',
    'Minha recomendacao seria priorizar vagas mais proximas do seu nivel atual ou fortalecer esses pontos com estudo, projetos e pratica antes de insistir nessa trilha.',
    'Se mesmo assim voce quiser prosseguir, responda com "Aceito" ou diga "Entendo, mas quero continuar". Depois disso eu sigo com a otimizacao normalmente.',
  ].filter(Boolean).join(' ')
}

export function buildCareerFitPromptSnapshot(targetFitAssessment?: TargetFitAssessment, gapAnalysis?: GapAnalysisResult): string {
  if (!targetFitAssessment && !gapAnalysis) {
    return ''
  }

  const lines: string[] = [
    'If the fit is weak, give an honest realism check before generating anything and wait for explicit user confirmation to continue.',
  ]

  if (targetFitAssessment) {
    lines.push(`Current fit level: ${targetFitAssessment.level}. ${targetFitAssessment.summary}`)
  }

  if (gapAnalysis) {
    lines.push(`Current gap score: ${gapAnalysis.matchScore}/100.`)
    if (gapAnalysis.missingSkills.length > 0) {
      lines.push(`Main missing skills: ${gapAnalysis.missingSkills.slice(0, 3).join(', ')}.`)
    }
    if (gapAnalysis.weakAreas.length > 0) {
      lines.push(`Main weak areas: ${gapAnalysis.weakAreas.slice(0, 3).join(', ')}.`)
    }
  }

  return lines.join('\n')
}
