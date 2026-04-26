import { describe, expect, it } from 'vitest'

import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
import type { TargetingPlan } from '@/types/agent'
import type { CVState } from '@/types/cv'

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Profissional de dados com foco em BI e SQL.',
    experience: [
      {
        title: 'Analista de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Construi dashboards e rotinas em SQL.'],
      },
    ],
    skills: ['SQL', 'Power BI'],
    education: [],
    certifications: [],
  }
}

function buildTargetingPlan(overrides: Partial<TargetingPlan> = {}): TargetingPlan {
  return {
    targetRole: 'Analytics Engineer',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    focusKeywords: ['analytics engineer'],
    mustEmphasize: [],
    shouldDeemphasize: [],
    missingButCannotInvent: [],
    sectionStrategy: {
      summary: [],
      experience: [],
      skills: [],
      education: [],
      certifications: [],
    },
    ...overrides,
  }
}

describe('validateRewrite', () => {
  it('returns the expanded compatibility contract', () => {
    const result = validateRewrite(buildCvState(), buildCvState())

    expect(result).toEqual({
      blocked: false,
      valid: true,
      hardIssues: [],
      softWarnings: [],
      issues: [],
    })
  })

  it('ignores heading-like target roles in job targeting validation', () => {
    const result = validateRewrite(
      buildCvState(),
      {
        ...buildCvState(),
        summary: 'Profissional de dados com foco em BI e SQL. Requisitos obrigatorios atendidos com base na experiencia.',
      },
      {
        mode: 'job_targeting',
        targetingPlan: buildTargetingPlan({
          targetRole: 'Requisitos Obrigatorios',
          targetRoleConfidence: 'low',
          targetRoleSource: 'fallback',
        }),
      },
    )

    expect(result.issues.some((issue) => issue.message.includes('cargo alvo'))).toBe(false)
  })

  it('still flags unsupported real target-role claims as soft warnings', () => {
    const result = validateRewrite(
      buildCvState(),
      {
        ...buildCvState(),
        summary: 'Analytics engineer com foco em BI e SQL.',
      },
      {
        mode: 'job_targeting',
        targetingPlan: buildTargetingPlan(),
      },
    )

    expect(result.blocked).toBe(false)
    expect(result.softWarnings).toContainEqual(expect.objectContaining({
      severity: 'medium',
      section: 'summary',
    }))
  })

  it('does not fail job targeting when only weak-area labels appear in the optimized text', () => {
    const result = validateRewrite(
      buildCvState(),
      {
        ...buildCvState(),
        summary: 'Profissional de dados com foco em BI e SQL.',
      },
      {
        mode: 'job_targeting',
        targetingPlan: buildTargetingPlan({
          missingButCannotInvent: ['summary'],
        }),
      },
    )

    expect(result.issues.some((issue) => issue.message.includes('apagar gaps reais'))).toBe(false)
  })

  it('passes when a supported quantified bullet is rewritten without inventing evidence', () => {
    const original = {
      ...buildCvState(),
      summary: 'Profissional de dados com foco em resultados analiticos.',
      experience: [{
        title: 'Analista de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Aumentei em 15% os indicadores de qualidade de producao na LATAM com dashboards em Power BI.'],
      }],
    }

    const optimized = {
      ...original,
      experience: [{
        ...original.experience[0],
        bullets: ['Liderei dashboards em Power BI e SQL, contribuindo para aumento de 15% nos indicadores de qualidade de producao na LATAM.'],
      }],
    }

    const result = validateRewrite(original, optimized)

    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('does not warn when the optimized summary keeps a skill already claimed in the original summary', () => {
    const original = {
      ...buildCvState(),
      summary: 'Profissional de dados com foco em BI e SQL.',
      experience: [{
        title: 'Analista de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Construi dashboards executivos para a operacao comercial.'],
      }],
    }

    const optimized = {
      ...original,
      summary: 'Profissional de dados com foco em BI e SQL para suportar decisoes de negocio.',
      experience: [{
        ...original.experience[0],
        bullets: ['Estruturei dashboards executivos para apoiar a operacao comercial.'],
      }],
    }

    const result = validateRewrite(original, optimized)

    expect(result.issues.some((issue) => issue.message.includes('skill sem evidência no currículo original'))).toBe(false)
  })

  it('does not warn when the skill exists only in original certifications', () => {
    const original = {
      ...buildCvState(),
      summary: 'Profissional de dados com foco em BI.',
      skills: ['SQL'],
      certifications: [{
        name: 'Power BI Data Analyst Associate',
        issuer: 'Microsoft',
        year: '2024',
      }],
    }

    const optimized = {
      ...original,
      summary: 'Profissional de dados com foco em BI, SQL e Power BI.',
      skills: ['SQL', 'Power BI'],
    }

    const result = validateRewrite(original, optimized)

    expect(result.issues.some((issue) => issue.message.includes('skill sem evidência no currículo original'))).toBe(false)
    expect(result.blocked).toBe(false)
  })

  it('returns a soft warning when the optimized summary introduces a skill with no original evidence', () => {
    const original = {
      ...buildCvState(),
      summary: 'Profissional de dados com foco em BI.',
      skills: ['SQL', 'Power BI'],
    }

    const optimized = {
      ...original,
      summary: 'Profissional de dados com foco em BI, SQL e Airflow.',
      skills: ['SQL', 'Power BI', 'Airflow'],
    }

    const result = validateRewrite(original, optimized)

    expect(result.blocked).toBe(false)
    expect(result.valid).toBe(false)
    expect(result.hardIssues).toEqual([])
    expect(result.softWarnings).toContainEqual(expect.objectContaining({
      severity: 'medium',
      section: 'summary',
      message: 'O resumo otimizado menciona skill sem evidência no currículo original.',
    }))
  })

  it('returns a hard issue when a company is invented', () => {
    const optimized = {
      ...buildCvState(),
      experience: [{
        title: 'Analista de Dados',
        company: 'Outra Empresa',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Construi dashboards e rotinas em SQL.'],
      }],
    }

    const result = validateRewrite(buildCvState(), optimized)

    expect(result.blocked).toBe(true)
    expect(result.hardIssues).toContainEqual(expect.objectContaining({
      severity: 'high',
      section: 'experience',
    }))
  })

  it('returns a hard issue when a certification is invented', () => {
    const optimized = {
      ...buildCvState(),
      certifications: [{
        name: 'AWS Certified Data Engineer',
        issuer: 'AWS',
        year: '2025',
      }],
    }

    const result = validateRewrite(buildCvState(), optimized)

    expect(result.blocked).toBe(true)
    expect(result.hardIssues).toContainEqual(expect.objectContaining({
      severity: 'high',
      section: 'certifications',
    }))
  })

  it('returns a hard issue when dates are altered', () => {
    const optimized = {
      ...buildCvState(),
      experience: [{
        ...buildCvState().experience[0],
        endDate: '2025',
      }],
    }

    const result = validateRewrite(buildCvState(), optimized)

    expect(result.blocked).toBe(true)
    expect(result.hardIssues).toContainEqual(expect.objectContaining({
      severity: 'high',
      section: 'experience',
    }))
  })

  it('returns a hard issue when job targeting invents alignment for a missing skill gap', () => {
    const original = buildCvState()
    const optimized = {
      ...original,
      summary: 'Profissional de dados com foco em BI, SQL e Airflow.',
      skills: ['SQL', 'Power BI', 'Airflow'],
    }

    const result = validateRewrite(original, optimized, {
      mode: 'job_targeting',
      targetingPlan: buildTargetingPlan({
        missingButCannotInvent: ['airflow'],
      }),
    })

    expect(result.blocked).toBe(true)
    expect(result.hardIssues).toContainEqual(expect.objectContaining({
      severity: 'high',
      message: expect.stringContaining('apagar gaps reais'),
    }))
  })

  it('does not run job-targeting-only rules during ats enhancement mode', () => {
    const original = buildCvState()
    const optimized = {
      ...original,
      summary: 'Profissional de dados com foco em BI e SQL.',
    }

    const result = validateRewrite(original, optimized)

    expect(result.issues.some((issue) => issue.message.includes('cargo alvo'))).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes('apagar gaps reais'))).toBe(false)
  })
})
