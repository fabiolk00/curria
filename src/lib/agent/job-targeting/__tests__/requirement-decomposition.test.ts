import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { decomposeJobRequirements } from '@/lib/agent/job-targeting/compatibility/requirement-decomposition'

describe('requirement decomposition', () => {
  it('extracts generic requirements from sections and list items', () => {
    const requirements = decomposeJobRequirements(`
      Required qualifications:
      - Strong written communication
      - Experience leading recurring planning routines

      Preferred qualifications:
      - Formal education in a related field

      Responsibilities:
      - Coordinate cross-functional delivery
    `)

    expect(requirements).toHaveLength(4)
    expect(requirements).toEqual([
      expect.objectContaining({
        text: 'Strong written communication',
        normalizedText: 'strong written communication',
        kind: 'skill',
        importance: 'core',
        scoreDimension: 'skills',
        source: expect.objectContaining({
          section: 'required qualifications',
          heading: 'Required qualifications',
          sourceKind: 'list_item',
          listIndex: 0,
        }),
      }),
      expect.objectContaining({
        text: 'Experience leading recurring planning routines',
        kind: 'responsibility',
        importance: 'core',
        scoreDimension: 'experience',
        source: expect.objectContaining({
          section: 'required qualifications',
          sourceKind: 'list_item',
          listIndex: 1,
        }),
      }),
      expect.objectContaining({
        text: 'Formal education in a related field',
        kind: 'education',
        importance: 'differential',
        scoreDimension: 'education',
        source: expect.objectContaining({
          section: 'preferred qualifications',
          sourceKind: 'list_item',
        }),
      }),
      expect.objectContaining({
        text: 'Coordinate cross-functional delivery',
        kind: 'responsibility',
        importance: 'secondary',
        scoreDimension: 'experience',
        source: expect.objectContaining({
          section: 'responsibilities',
          sourceKind: 'list_item',
        }),
      }),
    ])
  })

  it('decomposes sentence requirements and composite lists without catalog assumptions', () => {
    const requirements = decomposeJobRequirements(
      'Must have clear communication, structured planning, and measurable delivery outcomes. Nice to have: group facilitation.',
    )

    expect(requirements.map((requirement) => requirement.text)).toEqual([
      'Clear communication',
      'Structured planning',
      'Measurable delivery outcomes',
      'Group facilitation',
    ])
    expect(requirements.slice(0, 3).every((requirement) => requirement.importance === 'core')).toBe(true)
    expect(requirements[3]).toEqual(expect.objectContaining({
      importance: 'differential',
      source: expect.objectContaining({ sourceKind: 'sentence' }),
    }))
  })

  it('strips generic vacancy title leads before extracting requirements', () => {
    const requirements = decomposeJobRequirements(
      'Vaga de SDR com prospeccao outbound, qualificacao de leads, CRM, cadencias comerciais, pipeline e metas de conversao.',
    )

    expect(requirements.map((requirement) => requirement.text)).toEqual([
      'Prospeccao outbound',
      'Qualificacao de leads',
      'CRM',
      'Cadencias comerciais',
      'Pipeline e metas de conversao',
    ])
  })

  it('ignores generic prose headings and company-intro noise without domain rules', () => {
    const requirements = decomposeJobRequirements(`
      About the job
      Junte-se ao nosso time global.
      Qual sera o seu papel
      Sera o principal ponto de contato
      Requisitos:
      - Structured planning
      - Measurable delivery outcomes
    `)

    expect(requirements.map((requirement) => requirement.text)).toEqual([
      'Structured planning',
      'Measurable delivery outcomes',
    ])
  })

  it('ignores seed metadata and title labels while keeping real job requirements', () => {
    const requirements = decomposeJobRequirements(`
      Cargo: Analista de BI Shadow
      Empresa: Empresa Ficticia Shadow
      Contexto: vaga ficticia criada apenas para seed de teste anonimo.
      Requisitos principais: Power BI, SQL, dashboards.
      Diferenciais: Power Query, Tableau.
      Observacao: nao usar dados reais; caso marcado como shadow_seed.
    `)

    expect(requirements.map((requirement) => requirement.text)).toEqual([
      'Power BI',
      'SQL',
      'Dashboards',
      'Power Query',
      'Tableau',
    ])
  })

  it('keeps dotted technology names together when splitting requirements', () => {
    const requirements = decomposeJobRequirements(`
      Requisitos principais: TypeScript, Node.js, APIs REST.
      Diferenciais: Docker, Kubernetes.
    `)

    expect(requirements.map((requirement) => requirement.text)).toEqual([
      'TypeScript',
      'Node.js',
      'APIs REST',
      'Docker',
      'Kubernetes',
    ])
  })

  it('keeps compatibility runtime free from fixture-specific domain hardcodes', () => {
    const runtimeSources = [
      'src/lib/agent/job-targeting/compatibility/requirement-decomposition.ts',
      'src/lib/agent/job-targeting/compatibility/evidence-extraction.ts',
    ].map((filePath) => readFileSync(filePath, 'utf8'))
    const forbiddenRuntimeExamples = [
      /Power\s*BI/i,
      /Power\s*Query/i,
      /Totvs/i,
      /Java/i,
      /Salesforce/i,
      /SAP/i,
      /Google\s*Ads/i,
      /Excel/i,
      /Tableau/i,
      /HubSpot/i,
      /AutoCAD/i,
      /\bCRM\b/i,
      /\bERP\b/i,
    ]

    runtimeSources.forEach((source) => {
      forbiddenRuntimeExamples.forEach((pattern) => {
        expect(source).not.toMatch(pattern)
      })
    })
  })
})
