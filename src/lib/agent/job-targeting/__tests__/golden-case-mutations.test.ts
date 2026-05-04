import { describe, expect, it } from 'vitest'

import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'
import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import type { CVState } from '@/types/cv'

const cvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Analista com experiência em Power BI e SQL.',
  experience: [{
    title: 'Analista de BI',
    company: 'Acme',
    startDate: '2021',
    endDate: 'present',
    bullets: ['Construiu dashboards em Power BI e consultas SQL para operacoes recorrentes.'],
  }],
  skills: ['Power BI', 'SQL'],
  education: [],
  certifications: [],
}

const jobMutations = [
  'Requisitos:\n- Power BI\n- SQL',
    'SQL\nPower BI\nO que esperamos: experiência com indicadores',
  'Experiencia com Power BI e SQL para acompanhamento de indicadores.',
  'Requisitos: Power BI, SQL, comunicacao com areas de negocio.',
  'Requirements:\n- Power BI\n- SQL',
]

describe('job targeting golden-case mutations', () => {
  it('keeps explicit evidence supported across common job description layout mutations', async () => {
    const catalog = await loadJobTargetingCatalog()

    for (const targetJobDescription of jobMutations) {
      const assessment = await evaluateJobCompatibility({
        cvState,
        targetJobDescription,
        catalog,
      })
      const supportedSignals = assessment.supportedRequirements
        .flatMap((requirement) => requirement.extractedSignals)
        .join(' ')

      expect(supportedSignals, targetJobDescription).toMatch(/Power BI|SQL/i)
      expect(assessment.unsupportedRequirements.map((requirement) => requirement.originalRequirement).join(' '))
        .not.toMatch(/Power BI|SQL/i)
    }
  })
})
