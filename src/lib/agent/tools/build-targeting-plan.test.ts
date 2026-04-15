import { describe, expect, it } from 'vitest'

import { buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import type { CVState, GapAnalysisResult } from '@/types/cv'

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Engenheira de dados com foco em SQL e automacao.',
    experience: [
      {
        title: 'Engenheira de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Automatizei pipelines em SQL e Python.'],
      },
    ],
    skills: ['SQL', 'Python', 'ETL'],
    education: [],
    certifications: [],
  }
}

const gapAnalysis: GapAnalysisResult = {
  matchScore: 72,
  missingSkills: ['Airflow'],
  weakAreas: ['summary'],
  improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
}

describe('buildTargetingPlan', () => {
  it('extracts a role from prose instead of promoting section headings', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Requisitos Obrigatórios',
        'SQL avançado e modelagem de dados.',
        'Estamos contratando uma pessoa Engenheira de Dados para atuar com pipelines e analytics.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Engenheira De Dados')
    expect(plan.targetRoleConfidence).toBe('high')
  })

  it('preserves explicit role labels when present', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Requisitos Obrigatórios',
        'SQL e BigQuery.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analytics Engineer')
    expect(plan.targetRoleConfidence).toBe('high')
  })

  it('falls back to richer prose when the explicit role label is too weak', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: BI.',
        'Responsabilidades',
        'Estamos contratando Analista de BI para atuar com dashboards, SQL e indicadores.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analista De BI')
    expect(plan.targetRoleConfidence).toBe('high')
  })

  it('ignores english heading text and keeps semantic focus when the role is absent', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Responsibilities',
        'Build Power BI dashboards and SQL models for analytics reporting.',
        'Requirements',
        'Strong SQL and Power BI experience.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Vaga Alvo')
    expect(plan.targetRoleConfidence).toBe('low')
    expect(plan.focusKeywords).toEqual(expect.arrayContaining(['power bi', 'sql']))
    expect(plan.mustEmphasize).toEqual(expect.arrayContaining(['SQL']))
  })

  it('does not promote recruiter prose to target role', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Buscamos profissionais com forte experiência em Power BI e análise de dados.',
        'Atuação com SQL, dashboards e indicadores executivos.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Vaga Alvo')
    expect(plan.targetRoleConfidence).toBe('low')
    expect(plan.focusKeywords).toEqual(expect.arrayContaining(['power bi', 'sql']))
  })

  it('does not treat weak areas as invented missing requirements', () => {
    const plan = buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer',
      gapAnalysis: {
        ...gapAnalysis,
        missingSkills: ['Airflow'],
        weakAreas: ['summary', 'experience'],
      },
    })

    expect(plan.missingButCannotInvent).toEqual(['Airflow'])
  })
})
