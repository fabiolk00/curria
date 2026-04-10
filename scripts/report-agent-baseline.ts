import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { getSupabaseAdminClient } from '../src/lib/db/supabase-admin'

type UsageRow = {
  endpoint: 'agent' | 'gap_analysis' | 'target_resume'
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_cents: number
  created_at: string
}

type GeneratedOutputRow = {
  created_at: string
  generated_output: {
    status?: 'idle' | 'generating' | 'ready' | 'failed'
  } | null
}

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
    // Ignore missing .env here. The admin client will fail loudly if env is absent.
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint]
}

function countGenerationStatuses(rows: GeneratedOutputRow[]): Record<'ready' | 'failed' | 'generating' | 'idle' | 'missing', number> {
  return rows.reduce((counts, row) => {
    const status = row.generated_output?.status ?? 'missing'
    counts[status] += 1
    return counts
  }, {
    ready: 0,
    failed: 0,
    generating: 0,
    idle: 0,
    missing: 0,
  })
}

async function main(): Promise<void> {
  await loadRootEnvFile()

  const supabase = getSupabaseAdminClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: usageRows, error: usageError }, { data: sessionRows, error: sessionError }, { data: targetRows, error: targetError }] = await Promise.all([
    supabase
      .from('api_usage')
      .select('endpoint, model, input_tokens, output_tokens, total_tokens, cost_cents, created_at')
      .gte('created_at', since)
      .in('endpoint', ['agent', 'gap_analysis', 'target_resume']),
    supabase
      .from('sessions')
      .select('created_at, generated_output')
      .gte('created_at', since),
    supabase
      .from('resume_targets')
      .select('created_at, generated_output')
      .gte('created_at', since),
  ])

  if (usageError) {
    throw new Error(`Failed to load api_usage baseline: ${usageError.message}`)
  }

  if (sessionError) {
    throw new Error(`Failed to load session generation baseline: ${sessionError.message}`)
  }

  if (targetError) {
    throw new Error(`Failed to load target generation baseline: ${targetError.message}`)
  }

  const endpoints: Array<UsageRow['endpoint']> = ['agent', 'gap_analysis', 'target_resume']

  const usageSummary = Object.fromEntries(endpoints.map((endpoint) => {
    const rows = ((usageRows ?? []) as UsageRow[]).filter((row) => row.endpoint === endpoint)

    return [
      endpoint,
      {
        calls: rows.length,
        distinctModels: Array.from(new Set(rows.map((row) => row.model))).sort(),
        medianInputTokens: median(rows.map((row) => row.input_tokens)),
        medianOutputTokens: median(rows.map((row) => row.output_tokens)),
        medianTotalTokens: median(rows.map((row) => row.total_tokens)),
        medianCostCents: median(rows.map((row) => row.cost_cents)),
        totalCostUsd: rows.reduce((sum, row) => sum + row.cost_cents, 0) / 100,
      },
    ]
  }))

  const baseline = {
    generatedAt: new Date().toISOString(),
    windowStart: since,
    windowDays: 7,
    usageSummary,
    generationSummary: {
      sessions: countGenerationStatuses((sessionRows ?? []) as GeneratedOutputRow[]),
      targetResumes: countGenerationStatuses((targetRows ?? []) as GeneratedOutputRow[]),
    },
    notes: [
      'Token, model, and cost baselines come from api_usage.',
      'Turn-level truncation and empty-fallback rates now depend on structured logs emitted by agent.turn.completed and agent.response.* events.',
      'Use this report as the cost baseline before testing any agentModel promotion beyond combo_a.',
    ],
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDirectory = path.join(process.cwd(), 'docs', 'openai-baselines', runId)
  const latestDirectory = path.join(process.cwd(), 'docs', 'openai-baselines', 'latest')

  await mkdir(outputDirectory, { recursive: true })
  await mkdir(latestDirectory, { recursive: true })

  const markdown = [
    '# OpenAI Agent Baseline',
    '',
    `- Window start: \`${since}\``,
    `- Generated at: \`${baseline.generatedAt}\``,
    '',
    '## Usage',
    '',
    '| Endpoint | Calls | Models | Median Input | Median Output | Median Total | Median Cost (cents) | Total Cost (USD) |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
    ...endpoints.map((endpoint) => {
      const summary = baseline.usageSummary[endpoint]
      return `| ${endpoint} | ${summary.calls} | ${summary.distinctModels.join(', ') || 'n/a'} | ${summary.medianInputTokens} | ${summary.medianOutputTokens} | ${summary.medianTotalTokens} | ${summary.medianCostCents} | ${summary.totalCostUsd.toFixed(2)} |`
    }),
    '',
    '## Generation Summary',
    '',
    `- Session outputs: ready=${baseline.generationSummary.sessions.ready}, failed=${baseline.generationSummary.sessions.failed}, generating=${baseline.generationSummary.sessions.generating}, idle=${baseline.generationSummary.sessions.idle}, missing=${baseline.generationSummary.sessions.missing}`,
    `- Target resume outputs: ready=${baseline.generationSummary.targetResumes.ready}, failed=${baseline.generationSummary.targetResumes.failed}, generating=${baseline.generationSummary.targetResumes.generating}, idle=${baseline.generationSummary.targetResumes.idle}, missing=${baseline.generationSummary.targetResumes.missing}`,
    '',
    '## Notes',
    ...baseline.notes.map((note) => `- ${note}`),
    '',
  ].join('\n')

  await writeFile(path.join(outputDirectory, 'baseline.json'), JSON.stringify(baseline, null, 2))
  await writeFile(path.join(outputDirectory, 'summary.md'), markdown)
  await writeFile(path.join(latestDirectory, 'baseline.json'), JSON.stringify(baseline, null, 2))
  await writeFile(path.join(latestDirectory, 'summary.md'), markdown)

  console.log(`Agent baseline report written to ${outputDirectory}`)
}

main().catch((error) => {
  console.error('[agent:baseline] Failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
