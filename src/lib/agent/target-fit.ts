import type { TargetFitAssessment } from '@/types/agent'
import type { GapAnalysisResult } from '@/types/cv'

function buildReasons(result: GapAnalysisResult): string[] {
  const reasons = [
    ...result.missingSkills.slice(0, 2).map((skill) => `Skill ausente ou pouco evidenciada: ${skill}`),
    ...result.weakAreas.slice(0, 2).map((area) => `Ponto fraco no perfil atual: ${area}`),
  ]

  return reasons.slice(0, 3)
}

export function localizeTargetFitSummary(summary: string): string {
  const trimmed = summary.trim()

  switch (trimmed) {
    case 'The current profile appears strongly aligned with the target role, with only limited gaps to address.':
      return 'O perfil atual parece bem alinhado com a vaga-alvo, com poucas lacunas a corrigir.'
    case 'The current profile appears partially aligned with the target role, with relevant overlap but meaningful gaps still present.':
      return 'O perfil atual parece parcialmente alinhado com a vaga-alvo, com sobreposição relevante, mas ainda com lacunas importantes.'
    case 'The current profile appears weakly aligned with the target role today, with major gaps that resume rewriting alone will not fully solve.':
      return 'O perfil atual parece pouco alinhado com a vaga-alvo neste momento, com lacunas relevantes que uma reescrita de currículo sozinha não resolve.'
    default:
      return trimmed
  }
}

export function localizeTargetFitReason(reason: string): string {
  const missingSkillPrefix = 'Missing or underrepresented skill: '
  if (reason.startsWith(missingSkillPrefix)) {
    return `Skill ausente ou pouco evidenciada: ${reason.slice(missingSkillPrefix.length)}`
  }

  const weakAreaPrefix = 'Weak area in the current profile: '
  if (reason.startsWith(weakAreaPrefix)) {
    return `Ponto fraco no perfil atual: ${reason.slice(weakAreaPrefix.length)}`
  }

  return reason.trim()
}

export function deriveTargetFitAssessment(
  result: GapAnalysisResult,
  assessedAt = new Date().toISOString(),
): TargetFitAssessment {
  const missingCount = result.missingSkills.length
  const weakAreaCount = result.weakAreas.length

  let level: TargetFitAssessment['level'] = 'partial'
  if (result.matchScore >= 78 && missingCount <= 2 && weakAreaCount <= 2) {
    level = 'strong'
  } else if (
    result.matchScore < 45
    || missingCount >= 6
    || weakAreaCount >= 5
    || (result.matchScore < 55 && (missingCount >= 4 || weakAreaCount >= 3))
  ) {
    level = 'weak'
  }

  const summaryByLevel: Record<TargetFitAssessment['level'], string> = {
    strong: 'O perfil atual parece bem alinhado com a vaga-alvo, com poucas lacunas a corrigir.',
    partial: 'O perfil atual parece parcialmente alinhado com a vaga-alvo, com sobreposição relevante, mas ainda com lacunas importantes.',
    weak: 'O perfil atual parece pouco alinhado com a vaga-alvo neste momento, com lacunas relevantes que uma reescrita de currículo sozinha não resolve.',
  }

  return {
    level,
    summary: summaryByLevel[level],
    reasons: buildReasons(result),
    assessedAt,
  }
}
