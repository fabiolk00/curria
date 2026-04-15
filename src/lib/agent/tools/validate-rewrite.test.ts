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
        summary: 'Profissional de dados com foco em BI e SQL. Requisitos obrigatórios atendidos com base na experiência.',
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
})
