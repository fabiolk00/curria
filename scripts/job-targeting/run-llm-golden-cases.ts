import { existsSync, readFileSync } from 'node:fs'

import OpenAI from 'openai'

import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import type { LlmRequirementResolver } from '@/lib/agent/job-targeting/compatibility/llm-matcher'
import type { CVState } from '@/types/cv'

type GoldenCase = {
  id: string
  requirement: string
  evidence: string[]
  expected?: {
    evidenceLevel: 'supported' | 'adjacent' | 'unsupported'
    rewritePermission: 'can_claim_directly' | 'can_bridge_to_target_role' | 'must_not_claim'
  }
  allowed?: Array<{
    evidenceLevel: 'supported' | 'adjacent' | 'unsupported'
    rewritePermission: 'can_claim_directly' | 'can_bridge_to_target_role' | 'must_not_claim'
  }>
}

const goldenCases: GoldenCase[] = [
  {
    id: 'qlik-product-variation',
    requirement: 'Conhecimento na ferramenta Qlik',
    evidence: ['Liderou migracao de 30 aplicacoes Qlik Sense para Qlik Cloud'],
    expected: { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
  },
  {
    id: 'competitor-tool',
    requirement: 'Conhecimento em Tableau',
    evidence: ['Desenvolveu dashboards em Power BI para Supply Chain'],
    expected: { evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' },
  },
  {
    id: 'generic-bi',
    requirement: 'Experiencia com Business Intelligence',
    evidence: ['Desenvolveu dashboards estrategicos em Power BI e Qlik Sense'],
    expected: { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
  },
  {
    id: 'pyspark-adjacent',
    requirement: 'Conhecimento em PySpark',
    evidence: ['Implementou pipelines ETL distribuidos no Azure Databricks usando processamento Spark'],
    expected: { evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' },
  },
  {
    id: 'requirements-facilitation-flexible',
    requirement: 'Conduzir levantamento de requisitos e facilitar reunioes com negocio',
    evidence: ['Desenvolveu aplicacoes desde a coleta de requisitos ate a visualizacao junto a areas de negocio'],
    allowed: [
      { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
      { evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' },
    ],
  },
  {
    id: 'formal-qlik-certification-missing',
    requirement: 'Certificacao Qlik formal',
    evidence: ['Conhecimento em Qlik Sense, Qlik Cloud e QlikView'],
    expected: { evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' },
  },
  {
    id: 'databricks-market-name',
    requirement: 'Experiencia com Databricks',
    evidence: ['Implementou pipelines ETL no Azure Databricks com PySpark'],
    expected: { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
  },
  {
    id: 'privacy-adjacent-no-lgpd',
    requirement: 'Conhecimento em LGPD e protecao de dados',
    evidence: ['Implementou controles de acesso, mascaramento de dados e praticas de privacidade em pipelines analiticos'],
    expected: { evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' },
  },
  {
    id: 'dbt-missing',
    requirement: 'Conhecimento em dbt',
    evidence: ['Criou pipelines SQL e modelagem dimensional'],
    expected: { evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' },
  },
  {
    id: 'bi-end-to-end',
    requirement: 'Conduzir desenvolvimentos de BI desde a concepcao ate a implementacao',
    evidence: ['Desenvolveu mais de 20 aplicacoes personalizadas, desde a coleta de requisitos ate a visualizacao'],
    expected: { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
  },
]

function loadDotenvIfPresent() {
  if (!existsSync('.env')) {
    return
  }

  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }

    const [rawName, ...valueParts] = trimmed.split('=')
    const name = rawName.trim()
    if (!name || process.env[name]) {
      continue
    }

    let value = valueParts.join('=').trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[name] = value
  }
}

function buildCliOpenAIResolver(): LlmRequirementResolver {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
  })

  return async ({ systemPrompt, userPrompt, model, signal }) => {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }, {
      signal,
    })

    return {
      content: response.choices[0]?.message?.content ?? '',
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    }
  }
}

function toCvState(goldenCase: GoldenCase): CVState {
  return {
    fullName: 'Golden Case',
    email: 'golden@example.com',
    phone: '+55 11 99999-9999',
    summary: 'Profissional avaliado por golden case.',
    skills: [],
    experience: [{
      title: 'Analista',
      company: 'Fixture',
      startDate: '2020',
      endDate: '2026',
      bullets: goldenCase.evidence,
    }],
    education: [],
    certifications: [],
  }
}

function expectedFor(goldenCase: GoldenCase) {
  return goldenCase.allowed ?? (goldenCase.expected ? [goldenCase.expected] : [])
}

async function runCase(goldenCase: GoldenCase, runIndex: number) {
  const resolver = buildCliOpenAIResolver()
  const assessment = await evaluateJobCompatibility({
    cvState: toCvState(goldenCase),
    targetJobDescription: `Required qualifications:\n- ${goldenCase.requirement}`,
    matcherEngine: 'llm',
    llmResolver: resolver,
    userId: `golden-${goldenCase.id}`,
    sessionId: `golden-${goldenCase.id}-${runIndex}`,
  })
  const result = assessment.requirements[0]
  const evidenceLevel = result.productGroup
  const rewritePermission = result.rewritePermission === 'can_claim_directly'
    ? 'can_claim_directly'
    : result.rewritePermission === 'must_not_claim'
      ? 'must_not_claim'
      : 'can_bridge_to_target_role'

  return {
    evidenceLevel,
    rewritePermission,
    confidence: result.confidence,
    rationale: result.rationale,
  }
}

async function main() {
  loadDotenvIfPresent()

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for real LLM golden cases.')
  }

  const failures: Array<{ id: string; runs: unknown[]; allowed: unknown[] }> = []

  for (const goldenCase of goldenCases) {
    const runs = []
    for (let index = 1; index <= 3; index += 1) {
      runs.push(await runCase(goldenCase, index))
    }
    const allowed = expectedFor(goldenCase)
    const passed = runs.every((run) => allowed.some((item) => (
      item.evidenceLevel === run.evidenceLevel
      && item.rewritePermission === run.rewritePermission
    )))

    console.log(JSON.stringify({
      id: goldenCase.id,
      passed,
      allowed,
      runs,
    }, null, 2))

    if (!passed) {
      failures.push({ id: goldenCase.id, runs, allowed })
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
