import { describe, expect, it } from 'vitest'

import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
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

describe('validateRewrite', () => {
  it('ignores heading-like target roles in job targeting validation', () => {
    const result = validateRewrite(
      buildCvState(),
      {
        ...buildCvState(),
        summary: 'Profissional de dados com foco em BI e SQL. Requisitos obrigatorios atendidos com base na experiencia.',
      },
      {
        mode: 'job_targeting',
        targetingPlan: {
          targetRole: 'Requisitos Obrigatorios',
          targetRoleConfidence: 'low',
          focusKeywords: ['sql'],
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
        },
      },
    )

    expect(result.issues.some((issue) => issue.message.includes('cargo alvo'))).toBe(false)
  })

  it('still flags unsupported real target-role claims', () => {
    const result = validateRewrite(
      buildCvState(),
      {
        ...buildCvState(),
        summary: 'Analytics engineer com foco em BI e SQL.',
      },
      {
        mode: 'job_targeting',
        targetingPlan: {
          targetRole: 'Analytics Engineer',
          targetRoleConfidence: 'high',
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
        },
      },
    )

    expect(result.issues).toContainEqual(expect.objectContaining({
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
        targetingPlan: {
          targetRole: 'Analytics Engineer',
          targetRoleConfidence: 'high',
          focusKeywords: ['analytics engineer'],
          mustEmphasize: [],
          shouldDeemphasize: [],
          missingButCannotInvent: ['summary'],
          sectionStrategy: {
            summary: [],
            experience: [],
            skills: [],
            education: [],
            certifications: [],
          },
        },
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
    expect(result.issues).toEqual([])
  })

  it('does not fail solely because a metric disappeared when no unsupported claim was introduced', () => {
    const original = {
      ...buildCvState(),
      experience: [{
        title: 'Analista de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Reduzi em 40% o tempo de processamento de relatorios criticos para a operacao regional.'],
      }],
    }

    const optimized = {
      ...original,
      experience: [{
        ...original.experience[0],
        bullets: ['Atuei em relatorios e rotinas analiticas para apoiar a operacao regional.'],
      }],
    }

    const result = validateRewrite(original, optimized)

    expect(result.issues.some((issue) => issue.message.includes('metrica real de impacto'))).toBe(false)
  })
})
