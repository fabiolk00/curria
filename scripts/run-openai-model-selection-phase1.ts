import { randomInt } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import OpenAI from 'openai'

import { DEFAULT_OPENAI_MODEL, MODEL_COMBINATIONS, type ModelComboName } from '../src/lib/agent/config'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '../src/lib/openai/chat'

type ModelRole = 'agent' | 'structured'
type OutputLabel = 'X' | 'Y' | 'Z'

type SampleCase = {
  id: string
  title: string
  role: ModelRole
  original: string
  instruction: string[]
}

type ComboResult = {
  combo: ModelComboName
  model: string
  role: ModelRole
  output: string
  inputTokens: number
  outputTokens: number
  costCents: number
  latencyMs: number
}

type SampleRun = {
  sample: SampleCase
  blindMapping: Record<OutputLabel, ModelComboName>
  results: ComboResult[]
}

const MODEL_PRICING_CENTS_PER_MILLION = {
  [DEFAULT_OPENAI_MODEL]: { input: 5, output: 40 },
  'gpt-5': { input: 125, output: 1000 },
  'gpt-5.4': { input: 250, output: 1500 },
  'gpt-5.4-mini': { input: 75, output: 450 },
  'gpt-5-mini': { input: 25, output: 200 },
} as const

const SAMPLES: readonly SampleCase[] = [
  {
    id: 'sample_01',
    title: 'Junior Tech - Weak Summary',
    role: 'agent',
    original: [
      'Sou desenvolvedor de software com experiencia em Java.',
      'Trabalho bem em equipe e sigo as boas praticas.',
    ].join('\n'),
    instruction: [
      'showcase 2 technical achievements',
      'use strong action verbs',
      'make the text ATS-friendly',
      'keep it under 100 words',
    ],
  },
  {
    id: 'sample_02',
    title: 'Mid-Level QA - Weak Bullets',
    role: 'structured',
    original: [
      'Testei varios sistemas. Encontrei bugs. Reportei para o time.',
      'Participei de reunioes de planejamento.',
    ].join('\n'),
    instruction: [
      'quantify impact',
      'use metrics such as test coverage and automation gains',
      'show business value',
      'keep a professional tone',
    ],
  },
  {
    id: 'sample_03',
    title: 'Senior Backend - Weak Skills',
    role: 'structured',
    original: [
      'Programacao',
      'Java, Python, Go',
      'Arquitetura de sistemas',
      'Lideranca tecnica',
    ].join('\n'),
    instruction: [
      'add proficiency levels',
      'include frameworks and tools such as Spring, FastAPI, and gRPC',
      'organize by category',
      'make the result ATS-scannable',
    ],
  },
  {
    id: 'sample_04',
    title: 'Sales - Weak Bullets',
    role: 'agent',
    original: [
      'Vendeu produtos de software. Atingiu meta de vendas.',
      'Treinou o time de vendas.',
    ].join('\n'),
    instruction: [
      'quantify revenue',
      'show growth metrics such as YoY growth and deals closed',
      'highlight team impact',
      'keep Brazilian business context',
    ],
  },
  {
    id: 'sample_05',
    title: 'Marketing - Weak Summary',
    role: 'agent',
    original: [
      'Sou profissional de marketing com experiencia em digital.',
      'Gosto de trabalhar em equipe.',
    ].join('\n'),
    instruction: [
      'lead with measurable impact such as ROI',
      'mention specialties',
      'use marketing terminology',
      'keep B2B and SaaS context',
    ],
  },
  {
    id: 'sample_06',
    title: 'Finance - Weak Education',
    role: 'structured',
    original: [
      'Graduacao em Contabilidade',
      'Curso de Excel',
    ].join('\n'),
    instruction: [
      'expand with university name, year, and GPA',
      'include certifications such as CFC',
      'include relevant professional courses',
      'keep finance-industry context',
    ],
  },
  {
    id: 'sample_07',
    title: 'Operations - Weak Bullets',
    role: 'structured',
    original: 'Organizei processos. Melhorei eficiencia. Ajudei o time.',
    instruction: [
      'quantify improvements such as time saved',
      'specify tools',
      'show operational impact',
      'use supply-chain terminology',
    ],
  },
  {
    id: 'sample_08',
    title: 'Healthcare - Weak Summary',
    role: 'agent',
    original: [
      'Enfermeira experiente em cuidados de pacientes.',
      'Boa comunicacao com pacientes.',
    ].join('\n'),
    instruction: [
      'highlight specialties',
      'show leadership',
      'include certifications such as COREN',
      'mention patient-outcome context',
    ],
  },
  {
    id: 'sample_09',
    title: 'Legal - Weak Certifications',
    role: 'structured',
    original: [
      'Certificado em Compliance',
      'Curso de Direito Corporativo',
    ].join('\n'),
    instruction: [
      'expand with full certification names such as OAB and CCJE',
      'include specializations',
      'include validity and renewal information',
      'mention LGPD and CVM expertise',
    ],
  },
  {
    id: 'sample_10',
    title: 'Career Change - Weak Transition',
    role: 'agent',
    original: [
      'Tenho experiencia em varejo mas quero mudar para tecnologia.',
      'Aprendi programacao e sou dedicado.',
    ].join('\n'),
    instruction: [
      'bridge retail experience to tech value',
      'highlight tech skills',
      'show transition readiness',
      'create a strong tech-market entry narrative',
    ],
  },
] as const

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

async function loadRootEnvFile(): Promise<void> {
  if (process.env.OPENAI_API_KEY) {
    return
  }

  const envPath = path.join(process.cwd(), '.env')

  try {
    const fileContents = await readFile(envPath, 'utf8')

    for (const rawLine of fileContents.split(/\r?\n/)) {
      const line = rawLine.trim()

      if (!line || line.startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')

      if (separatorIndex === -1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = normalizeEnvValue(line.slice(separatorIndex + 1))

      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore missing .env here; the explicit API key check below handles the real failure case.
  }
}

function getPricingForModel(model: string): { input: number; output: number } {
  return MODEL_PRICING_CENTS_PER_MILLION[model as keyof typeof MODEL_PRICING_CENTS_PER_MILLION]
    ?? MODEL_PRICING_CENTS_PER_MILLION[DEFAULT_OPENAI_MODEL]
}

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricingForModel(model)

  return Math.ceil(
    (inputTokens / 1_000_000) * pricing.input
    + (outputTokens / 1_000_000) * pricing.output,
  )
}

function getSystemPrompt(role: ModelRole): string {
  if (role === 'structured') {
    return [
      'You are CurrIA, a Brazilian Portuguese resume rewriting assistant.',
      'Rewrite the provided resume content in natural, professional Brazilian Portuguese.',
      'Follow the user instruction exactly.',
      'Return only the rewritten resume content with no explanation, no preamble, and no markdown fences.',
    ].join(' ')
  }

  return [
    'You are CurrIA, an expert AI resume coach for Brazilian job seekers.',
    'Rewrite the provided resume content in strong, credible, ATS-friendly Brazilian Portuguese.',
    'Follow the user instruction exactly.',
    'Return only the final rewritten resume text with no explanation, no preamble, and no markdown fences.',
  ].join(' ')
}

function buildUserPrompt(sample: SampleCase): string {
  return [
    `Sample: ${sample.title}`,
    `Model role under evaluation: ${sample.role}`,
    '',
    'Original text:',
    sample.original,
    '',
    'Rewrite requirements:',
    ...sample.instruction.map((item, index) => `${index + 1}. ${item}`),
    '',
    'Language requirement: Brazilian Portuguese.',
    'Output requirement: return only the rewritten resume content.',
  ].join('\n')
}

function shuffleLabels(combos: readonly ModelComboName[]): Record<OutputLabel, ModelComboName> {
  const pool = [...combos]

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const current = pool[index]

    pool[index] = pool[swapIndex]
    pool[swapIndex] = current
  }

  return {
    X: pool[0],
    Y: pool[1],
    Z: pool[2],
  }
}

async function runSampleForCombo(
  client: OpenAI,
  sample: SampleCase,
  combo: ModelComboName,
): Promise<ComboResult> {
  const model = MODEL_COMBINATIONS[combo][sample.role]
  const startedAt = Date.now()
  const response = await callOpenAIWithRetry(() => client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: getSystemPrompt(sample.role) },
      { role: 'user', content: buildUserPrompt(sample) },
    ],
    max_tokens: 500,
  }))
  const latencyMs = Date.now() - startedAt
  const output = getChatCompletionText(response).trim()
  const usage = getChatCompletionUsage(response)

  return {
    combo,
    model,
    role: sample.role,
    output,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costCents: calculateCostCents(model, usage.inputTokens, usage.outputTokens),
    latencyMs,
  }
}

function buildBlindReviewMarkdown(runId: string, runs: readonly SampleRun[]): string {
  const sections = runs.map((run) => {
    const resultsByCombo = Object.fromEntries(run.results.map((result) => [result.combo, result])) as Record<ModelComboName, ComboResult>

    return [
      `## ${run.sample.id.toUpperCase()} - ${run.sample.title}`,
      '',
      `- Model role exercised: \`${run.sample.role}\``,
      '',
      '### Original text',
      '',
      '```text',
      run.sample.original,
      '```',
      '',
      '### Rewrite requirements',
      ...run.sample.instruction.map((item, index) => `${index + 1}. ${item}`),
      '',
      '### Output X',
      '',
      resultsByCombo[run.blindMapping.X].output,
      '',
      '### Output Y',
      '',
      resultsByCombo[run.blindMapping.Y].output,
      '',
      '### Output Z',
      '',
      resultsByCombo[run.blindMapping.Z].output,
      '',
      '### Evaluator notes',
      '',
      '- Preferred output:',
      '- Key quality strengths:',
      '- Key quality concerns:',
      '',
      '### Scoring',
      '',
      '| Output | Grammar | Vocabulary | Tone | Terminology | Readability | Average |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| X |  |  |  |  |  |  |',
      '| Y |  |  |  |  |  |  |',
      '| Z |  |  |  |  |  |  |',
      '',
    ].join('\n')
  })

  return [
    '# Phase 1 Blind Review Packet',
    '',
    `- Run ID: \`${runId}\``,
    '- Important: do not show the combo mapping to the evaluator.',
    '- Evaluate X, Y, and Z blindly for each sample.',
    '',
    ...sections,
  ].join('\n')
}

function buildSummaryMarkdown(runId: string, runs: readonly SampleRun[]): string {
  const lines = runs.flatMap((run) => run.results.map((result) => [
    `- ${run.sample.id} | role=${result.role} | combo=${result.combo} | model=${result.model} | input=${result.inputTokens} | output=${result.outputTokens} | cost=$${(result.costCents / 100).toFixed(4)} | latency=${result.latencyMs}ms`,
  ].join('')))

  return [
    '# Phase 1 Generation Summary',
    '',
    `- Run ID: \`${runId}\``,
    '- This file is machine-generated before human scoring.',
    '',
    ...lines,
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  await loadRootEnvFile()

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to .env or the shell environment, then rerun Phase 1.')
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDirectory = path.join(process.cwd(), 'docs', 'openai-model-selection-runs', runId)

  await mkdir(outputDirectory, { recursive: true })

  const runs: SampleRun[] = []
  const combos = Object.keys(MODEL_COMBINATIONS) as ModelComboName[]

  for (const sample of SAMPLES) {
    console.log(`Running ${sample.id} (${sample.role})...`)

    const results: ComboResult[] = []

    for (const combo of combos) {
      console.log(`  -> ${combo} using ${MODEL_COMBINATIONS[combo][sample.role]}`)
      results.push(await runSampleForCombo(client, sample, combo))
    }

    runs.push({
      sample,
      blindMapping: shuffleLabels(combos),
      results,
    })
  }

  const rawResultsPath = path.join(outputDirectory, 'raw-results.json')
  const blindReviewPath = path.join(outputDirectory, 'blind-review.md')
  const summaryPath = path.join(outputDirectory, 'summary.md')
  const latestDirectory = path.join(process.cwd(), 'docs', 'openai-model-selection-runs', 'latest')

  await mkdir(latestDirectory, { recursive: true })

  await writeFile(rawResultsPath, JSON.stringify({ runId, generatedAt: new Date().toISOString(), runs }, null, 2))
  await writeFile(blindReviewPath, buildBlindReviewMarkdown(runId, runs))
  await writeFile(summaryPath, buildSummaryMarkdown(runId, runs))

  await writeFile(path.join(latestDirectory, 'raw-results.json'), JSON.stringify({ runId, generatedAt: new Date().toISOString(), runs }, null, 2))
  await writeFile(path.join(latestDirectory, 'blind-review.md'), buildBlindReviewMarkdown(runId, runs))
  await writeFile(path.join(latestDirectory, 'summary.md'), buildSummaryMarkdown(runId, runs))

  console.log(`Phase 1 generation complete.`)
  console.log(`Blind review packet: ${blindReviewPath}`)
  console.log(`Private mapping and outputs: ${rawResultsPath}`)
  console.log(`Summary: ${summaryPath}`)
}

main().catch((error) => {
  console.error('[phase1:model-selection] Failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
