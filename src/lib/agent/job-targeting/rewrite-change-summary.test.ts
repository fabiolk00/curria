import { describe, expect, it } from 'vitest'

import { buildRewriteChangeSummary } from '@/lib/agent/job-targeting/rewrite-change-summary'
import type { CoreRequirement } from '@/types/agent'
import type { CVState } from '@/types/cv'

const beforeCvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Engenheiro de Dados e Especialista em BI com experiência em relatórios.',
  experience: [{
    title: 'Analista de Dados',
    company: 'Acme',
    startDate: '2020',
    endDate: '2024',
    bullets: ['Desenvolvi dashboards estratégicos em Power BI para Supply Chain e Manufatura.'],
  }],
  skills: ['SQL', 'Power BI', 'ETL'],
  education: [],
  certifications: [],
}

const coreRequirements: CoreRequirement[] = [
  {
    signal: 'Power BI',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
  },
  {
    signal: 'SQL',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
  },
  {
    signal: 'dashboards',
    importance: 'core',
    requirementKind: 'responsibility',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
  },
  {
    signal: 'DAX',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'unsupported_gap',
    rewritePermission: 'must_not_claim',
  },
]

describe('buildRewriteChangeSummary', () => {
  it('summarizes summary before/after changes with requirement-based reasons', () => {
    const afterCvState: CVState = {
      ...beforeCvState,
      summary: 'Profissional com experiência em Engenharia de Dados e BI, Power BI, SQL e dashboards para apoiar indicadores e tomada de decisão.',
    }

    const changes = buildRewriteChangeSummary({
      beforeCvState,
      afterCvState,
      coreRequirements,
      preferredRequirements: [],
      targetRole: 'Analista de BI',
    })

    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section: 'summary',
        changed: true,
        changeReasons: expect.arrayContaining([
          expect.stringMatching(/Power BI|SQL|dashboards/i),
        ]),
      }),
    ]))
  })

  it('records safety notes for unsupported requirements that were not added', () => {
    const afterCvState: CVState = {
      ...beforeCvState,
      summary: 'Profissional com experiência em Engenharia de Dados e BI, Power BI, SQL e dashboards.',
    }

    const summaryChange = buildRewriteChangeSummary({
      beforeCvState,
      afterCvState,
      coreRequirements,
      preferredRequirements: [],
    }).find((change) => change.section === 'summary')

    expect(summaryChange?.safetyNotes).toEqual(expect.arrayContaining([
      expect.stringMatching(/DAX.*não.*evidência/i),
    ]))
  })

  it('detects skills reordering as a visible section change', () => {
    const afterCvState: CVState = {
      ...beforeCvState,
      skills: ['Power BI', 'SQL', 'ETL'],
    }

    const skillsChange = buildRewriteChangeSummary({
      beforeCvState,
      afterCvState,
      coreRequirements,
      preferredRequirements: [],
    }).find((change) => change.section === 'skills')

    expect(skillsChange).toMatchObject({
      section: 'skills',
      changed: true,
      changeReasons: expect.arrayContaining([
        expect.stringMatching(/competências|competencias/i),
      ]),
    })
  })
})
