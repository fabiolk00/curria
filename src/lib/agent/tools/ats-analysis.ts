import { scoreATS } from '@/lib/ats/score'
import { buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'
import type { AtsAnalysisIssue, AtsAnalysisResult } from '@/types/agent'
import type { CVState } from '@/types/cv'

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function countNonEmptySkills(cvState: CVState): number {
  return cvState.skills.filter((skill) => skill.trim().length > 0).length
}

function isDateRangeConsistent(startDate: string, endDate: string): boolean {
  if (!startDate.trim() || !endDate.trim()) {
    return false
  }

  if (endDate === 'present') {
    return true
  }

  return true
}

function normalizeIssueSeverity(severity: 'critical' | 'warning' | 'info'): AtsAnalysisIssue['severity'] {
  switch (severity) {
    case 'critical':
      return 'high'
    case 'warning':
      return 'medium'
    default:
      return 'low'
  }
}

function buildDerivedIssues(cvState: CVState): AtsAnalysisIssue[] {
  const issues: AtsAnalysisIssue[] = []

  if (!cvState.summary.trim()) {
    issues.push({
      code: 'summary_missing',
      severity: 'high',
      message: 'O resumo profissional precisa existir para posicionar o currículo com clareza.',
      section: 'summary',
    })
  } else if (cvState.summary.trim().length < 80) {
    issues.push({
      code: 'summary_too_short',
      severity: 'medium',
      message: 'O resumo profissional está curto demais para comunicar senioridade, especialidade e foco.',
      section: 'summary',
    })
  }

  if (cvState.experience.length === 0) {
    issues.push({
      code: 'experience_missing',
      severity: 'high',
      message: 'A seção de experiência profissional precisa ter pelo menos uma entrada estruturada.',
      section: 'experience',
    })
  }

  const thinBullets = cvState.experience.flatMap((entry) =>
    entry.bullets
      .filter((bullet) => bullet.trim().length > 0 && bullet.trim().length < 45)
      .map(() => entry),
  )
  if (thinBullets.length > 0) {
    issues.push({
      code: 'experience_bullets_weak',
      severity: 'medium',
      message: 'Alguns bullets de experiência estão curtos demais e perdem impacto ou contexto.',
      section: 'experience',
    })
  }

  if (countNonEmptySkills(cvState) < 4) {
    issues.push({
      code: 'skills_sparse',
      severity: 'medium',
      message: 'A seção de skills está enxuta e pode reduzir cobertura semântica para ATS.',
      section: 'skills',
    })
  }

  if (cvState.education.length === 0) {
    issues.push({
      code: 'education_missing',
      severity: 'medium',
      message: 'A seção de educação está ausente ou vazia.',
      section: 'education',
    })
  }

  const inconsistentDates = cvState.experience.some((entry) => !isDateRangeConsistent(entry.startDate, entry.endDate))
  if (inconsistentDates) {
    issues.push({
      code: 'experience_dates_inconsistent',
      severity: 'medium',
      message: 'Existem datas de experiência pouco padronizadas ou incompletas.',
      section: 'experience',
    })
  }

  return issues
}

function dedupeIssues(issues: AtsAnalysisIssue[]): AtsAnalysisIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.section ?? ''}:${issue.message}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function buildRecommendations(issues: AtsAnalysisIssue[]): string[] {
  return issues
    .slice(0, 5)
    .map((issue) => issue.message)
}

export async function analyzeAtsGeneral(
  cvState: CVState,
  _userId: string,
  _sessionId: string,
): Promise<{
  success: boolean
  result?: AtsAnalysisResult
  error?: string
}> {
  try {
    const resumeText = buildResumeTextFromCvState(cvState)
    const baseScore = scoreATS(resumeText)
    const derivedIssues = buildDerivedIssues(cvState)
    const issues = dedupeIssues([
      ...baseScore.issues.map((issue) => ({
        code: `${issue.section}_${issue.severity}`.replace(/\s+/g, '_').toLowerCase(),
        severity: normalizeIssueSeverity(issue.severity),
        message: issue.message,
        section: ['summary', 'experience', 'skills', 'education', 'certifications'].includes(issue.section)
          ? issue.section as AtsAnalysisIssue['section']
          : undefined,
      })),
      ...derivedIssues,
    ])

    const structureScore = clampScore(baseScore.breakdown.structure * 5)
    const clarityScore = clampScore(
      100
      - issues.filter((issue) => issue.section === 'summary' || issue.section === 'experience').length * 12,
    )
    const impactScore = clampScore(baseScore.breakdown.impact * 5)
    const keywordCoverageScore = clampScore(baseScore.breakdown.keywords * 100 / 30)
    const atsReadabilityScore = clampScore((baseScore.breakdown.format + baseScore.breakdown.contact) * 100 / 30)
    const overallScore = clampScore(
      (structureScore * 0.2)
      + (clarityScore * 0.2)
      + (impactScore * 0.2)
      + (keywordCoverageScore * 0.2)
      + (atsReadabilityScore * 0.2),
    )

    return {
      success: true,
      result: {
        overallScore,
        structureScore,
        clarityScore,
        impactScore,
        keywordCoverageScore,
        atsReadabilityScore,
        issues,
        recommendations: buildRecommendations(issues),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze ATS quality.',
    }
  }
}
