import { describe, expect, it } from 'vitest'

import { assessTargetJobDescriptionPreflight } from './target-job-description-preflight'

const technicalAnswerText = `
Sim, tem hardcode semantico, mas em lugares diferentes:

1. No LLM matcher runtime
- Nao tem lista hardcoded de ferramentas tipo Qlik, Tableau, Power BI, dbt.
- Tem politica semantica no prompt em llm-matcher.ts.

2. Na UI/review
- user-friendly-review.ts filtra Atividades, Identificar, BI.

3. Nos golden cases
- O script run-llm-golden-cases.ts tem Qlik/Tableau/PySpark/etc.
`

const biQlikVacancy = `
Cargo: Analista de Business Intelligence

Responsabilidades:
- Desenvolver dashboards e indicadores em Qlik Sense e Power BI.
- Conduzir levantamento de requisitos junto as areas de negocio.
- Criar pipelines ETL e consultas SQL para integracao de dados.

Requisitos:
- Conhecimento em Qlik, ETL, SQL e modelagem dimensional.
- Experiencia com homologacao de dados e visualizacao executiva.
`

describe('target job description preflight', () => {
  it('blocks conversational/code analysis text before it reaches job targeting', () => {
    const result = assessTargetJobDescriptionPreflight(technicalAnswerText)

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'conversation_or_code_not_vacancy',
    }))
    expect(result.diagnostics.conversationScore).toBeGreaterThanOrEqual(2)
    expect(result.diagnostics.codeArtifactScore).toBeGreaterThanOrEqual(2)
  })

  it('allows a real BI/Qlik vacancy with responsibilities and requirements', () => {
    const result = assessTargetJobDescriptionPreflight(biQlikVacancy)

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      reason: 'vacancy_shape',
    }))
    expect(result.diagnostics.vacancyScore).toBeGreaterThanOrEqual(3)
  })

  it('does not reject short explicit role snippets used by existing flows', () => {
    const result = assessTargetJobDescriptionPreflight('Cargo: BI com Qlik')

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      reason: 'short_explicit',
    }))
  })
})
