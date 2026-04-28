import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { vendedorJrVacancy } from '@/lib/agent/job-targeting/__fixtures__/vendedor-jr-vacancy'
import { buildCoreRequirementCoverage } from '@/lib/agent/job-targeting/core-requirement-coverage'
import type { TargetEvidence } from '@/types/agent'

function buildTargetEvidence(): TargetEvidence[] {
  return [
    {
      jobSignal: 'Git',
      canonicalSignal: 'Git',
      evidenceLevel: 'explicit',
      rewritePermission: 'can_claim_directly',
      matchedResumeTerms: ['Git'],
      supportingResumeSpans: ['Git'],
      rationale: 'Evidencia explicita.',
      confidence: 1,
      allowedRewriteForms: ['Git'],
      forbiddenRewriteForms: [],
      validationSeverityIfViolated: 'none',
    },
    {
      jobSignal: 'APIs REST',
      canonicalSignal: 'APIs REST',
      evidenceLevel: 'explicit',
      rewritePermission: 'can_claim_directly',
      matchedResumeTerms: ['APIs REST'],
      supportingResumeSpans: ['APIs REST'],
      rationale: 'Evidencia explicita.',
      confidence: 1,
      allowedRewriteForms: ['APIs REST'],
      forbiddenRewriteForms: [],
      validationSeverityIfViolated: 'none',
    },
    {
      jobSignal: 'Java',
      canonicalSignal: 'Java',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
      matchedResumeTerms: [],
      supportingResumeSpans: [],
      rationale: 'Sem evidencia real.',
      confidence: 0.99,
      allowedRewriteForms: [],
      forbiddenRewriteForms: ['Java'],
      validationSeverityIfViolated: 'critical',
    },
  ]
}

describe('core requirement coverage', () => {
  it('does not hardcode domain-specific display rules in the requirement coverage source', () => {
    const source = readFileSync('src/lib/agent/job-targeting/core-requirement-coverage.ts', 'utf8')

    expect(source).not.toMatch(/\bif\s*\([^)]*(marketing|eventos|campanhas|java|juridico|financas|vendas|saude|operacoes|logistica)/iu)
    expect(source).not.toMatch(/Planejamento de acoes de marketing|Campanhas comerciais|Conteudo para canais externos/iu)
  })

  it('separates unsupported Java core requirements from peripheral supported evidence', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Cargo: Desenvolvedor Java',
        'Requisitos obrigatorios: Java com mais de 5 anos, Spring Boot, JPA/Hibernate, Kafka/RabbitMQ, microsservicos, Docker, CI/CD e testes automatizados.',
        'Desejavel: cloud e observabilidade.',
      ].join('\n'),
      targetRole: 'Desenvolvedor Java',
      targetEvidence: buildTargetEvidence(),
      missingButCannotInvent: ['Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
    })

    expect(coverage.total).toBeGreaterThanOrEqual(5)
    expect(coverage.supported).toBeLessThan(coverage.total)
    expect(coverage.unsupportedSignals).toEqual(expect.arrayContaining([
      'Java',
      '5+ anos de Java',
      'Spring Boot',
      'JPA/Hibernate',
      'Kafka/RabbitMQ',
      'microsservicos',
      'Docker',
      'CI/CD',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay.length).toBeLessThanOrEqual(8)
    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      '5+ anos de Java',
      'Spring Boot',
      'JPA/Hibernate',
      'Kafka/RabbitMQ',
    ]))
  })

  it('filters pure headings from the requirement list', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Requisitos e qualificacoes',
        'Responsabilidades',
        'Diferenciais',
        'Experiencia com SQL e Power BI.',
      ].join('\n'),
      targetRole: 'Analista de BI',
      targetEvidence: buildTargetEvidence(),
      missingButCannotInvent: [],
    })

    expect(coverage.requirements.map((requirement) => requirement.signal)).not.toEqual(expect.arrayContaining([
      'Requisitos',
      'qualificacoes',
      'Responsabilidades',
      'Diferenciais',
    ]))
  })

  it('extracts core requirements from non-technical vacancies without display labels', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Cargo: Analista de Marketing e Eventos',
        'Responsabilidades',
        '- Planejar campanhas de marketing e comunicacao.',
        '- Sera responsavel por producao de eventos, briefing e relacionamento com fornecedores.',
        '- Atuara com midias sociais, trade marketing e relacionamento com areas internas.',
        '- Criar conteudo para canais externos e campanhas institucionais.',
        'Requisitos',
        '- Vivencia em eventos corporativos e campanhas digitais.',
      ].join('\n'),
      targetRole: 'Analista de Marketing e Eventos',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.total).toBeGreaterThan(0)
    expect(coverage.unsupportedSignals).toEqual(expect.arrayContaining([
      'Planejar campanhas de marketing e comunicacao',
      'briefing e relacionamento com fornecedores',
      'midias sociais, trade marketing',
      'eventos corporativos',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Planejar campanhas de marketing e comunicacao',
      'Criar conteudo para canais externos',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'atribuicoes',
      'externos',
      'institucionais',
      'promocional',
    ]))
    expect(coverage.requirements.map((requirement) => requirement.signal)).not.toEqual(expect.arrayContaining([
      'Requisitos',
      'Responsabilidades',
    ]))
  })

  it('keeps modifier pairs intact and avoids loose display fragments', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Responsabilidades',
        '- Planejar acoes de comunicacao institucional e promocional.',
        '- Desenvolver estrategias para encontros internos e externos.',
        '- Apoiar producao de materiais comerciais e institucionais.',
        '- Gerenciar custos e forecast.',
      ].join('\n'),
      targetRole: 'Analista',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.unsupportedSignals).toEqual(expect.arrayContaining([
      'Planejar acoes de comunicacao institucional e promocional',
      'Desenvolver estrategias para encontros internos e externos',
      'Apoiar producao de materiais comerciais e institucionais',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Planejar acoes de comunicacao institucional e promocional',
      'Desenvolver estrategias para encontros internos e externos',
      'Apoiar producao de materiais comerciais e institucionais',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'promocional',
      'externos',
      'institucionais',
    ]))
  })

  it('splits independent conjunction requirements without domain rules', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Requisitos',
        '- Vivencia com Python e SQL.',
        '- Conhecimento em Git e Docker.',
        '- Experiencia com contratos e compliance.',
        '- Experiencia com recrutamento e selecao.',
      ].join('\n'),
      targetRole: 'Analista',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.unsupportedSignals).toEqual(expect.arrayContaining([
      'Python',
      'SQL',
      'Git',
      'Docker',
      'contratos e compliance',
      'recrutamento e selecao',
    ]))
  })

  it.each([
    ['Tecnologia backend', 'Requisitos: Experiencia com Spring Boot, APIs REST, bancos relacionais e mensageria.'],
    ['Juridico', 'Requisitos: Elaborar contratos, analisar riscos regulatorios e acompanhar compliance.'],
    ['Financas', 'Responsabilidades: Analisar DRE, gerenciar forecast e apoiar fechamento contabil.'],
    ['Operacoes', 'Responsabilidades: Otimizar processos, acompanhar indicadores e gerenciar fornecedores.'],
    ['RH', 'Responsabilidades: Executar recrutamento e selecao, acompanhar clima e apoiar liderancas.'],
    ['Vendas', 'Responsabilidades: Gerenciar funil comercial, analisar CRM e executar negociacoes.'],
  ])('builds clean display signals for %s vacancies', (_domain, targetJobDescription) => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription,
      targetRole: 'Analista',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.topUnsupportedSignalsForDisplay.length).toBeGreaterThan(0)
    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'Requisitos',
      'Responsabilidades',
      'externos',
      'institucionais',
      'promocional',
    ]))
    coverage.topUnsupportedSignalsForDisplay.forEach((signal) => {
      expect(signal.trim().length).toBeGreaterThan(1)
    })
  })

  it('breaks compound technical requirements into clean atomic signals', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: 'Experiencia com Spring Boot, construcao e manutencao de APIs REST, JPA/Hibernate, bancos relacionais e mensageria (Kafka/RabbitMQ)',
      targetRole: 'Desenvolvedor Java',
      targetEvidence: buildTargetEvidence(),
      missingButCannotInvent: [],
    })

    expect(coverage.requirements.map((requirement) => requirement.signal)).toEqual(expect.arrayContaining([
      'Spring Boot',
      'APIs REST',
      'JPA/Hibernate',
      'bancos relacionais e mensageria',
      'Kafka/RabbitMQ',
    ]))
  })

  it('extracts both the technology and the years-of-experience requirement', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: 'Profissional com mais de 5 anos de experiência em Java',
      targetRole: 'Desenvolvedor Java',
      targetEvidence: buildTargetEvidence(),
      missingButCannotInvent: [],
    })

    expect(coverage.requirements.map((requirement) => requirement.signal)).toEqual(expect.arrayContaining([
      'Java',
      '5+ anos de Java',
    ]))
  })

  it('does not promote structural headings to top unsupported display signals', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: 'Responsabilidades Da Posição',
      targetRole: 'Vendedora/Vendedor JR',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'Responsabilidades Da Posição',
    ]))
  })

  it('normalizes long business requirements for sales vacancies without broken fragments', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Responsabilidades',
        'Cumprir as metas de vendas estabelecidas (volume, rentabilidade, positivação etc.), visando a geração da demanda.',
        'Negociar a instalação de equipamentos, espaços para exposição de produtos e materiais de merchandising.',
        'Assegurar a correta utilização dos equipamentos e ativos de mercado (geladeiras, gôndolas, racks, etc.)',
      ].join('\n'),
      targetRole: 'Vendedora/Vendedor JR',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Cumprir metas de vendas estabelecidas',
      'Negociar instalação de equipamentos',
      'Espaços para exposição de produtos',
      'Materiais de merchandising',
      'Utilização de equipamentos e ativos de mercado',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'rentabilidade',
      'positivação etc.)',
      'visando a geração da',
      'materiais de',
      'ativos de mercado (geladeiras',
    ]))
  })

  it('builds human-friendly unsupported requirements for the real vendedor jr vacancy fixture', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: vendedorJrVacancy,
      targetRole: 'Vendedora/Vendedor JR',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Manter cadastros de clientes atualizados',
      'Monitorar estratégias de repasse de preço',
      'Cumprir metas de vendas estabelecidas',
      'Construir relacionamento com clientes',
      'Executar planos acordados com clientes',
      'Negociar instalação de equipamentos',
      'Acompanhar retornos, entregas e pendências de produtos',
    ]))
    expect(coverage.topUnsupportedSignalsForDisplay).not.toEqual(expect.arrayContaining([
      'Aplicar',
      'demanda',
      'gôndolas',
      'racks, etc.)',
      'precificando conforme padrão',
      'reciprocidades dos acordos comerciais',
      'pendências de produtos da sua área',
      'Responsabilidades Da Posição',
    ]))
  })

  it('keeps technical lists split into atomic display signals', () => {
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: 'Experiência com Java, Spring Boot, Kafka, Docker e CI/CD.',
      targetRole: 'Desenvolvedor Backend',
      targetEvidence: [],
      missingButCannotInvent: [],
    })

    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Java',
      'Spring Boot',
      'Kafka',
      'Docker',
      'CI/CD',
    ]))
  })
})
