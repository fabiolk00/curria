import { mkdir, writeFile } from 'node:fs/promises'
import Module from 'node:module'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { JobTargetingShadowCase } from '../../src/lib/agent/job-targeting/shadow-case-types'
import type { CVState } from '../../src/types/cv'

type CliOptions = {
  seedRunId?: string
  output?: string
}

type SeededSessionRow = {
  id: string
  user_id: string
  cv_state: CVState
  agent_state: {
    targetJobDescription?: string
    source?: string
    seedRunId?: string
    caseId?: string
    domain?: string
    fitLevel?: string
    testOnly?: boolean
    anonymized?: boolean
    metadata?: Record<string, unknown>
  }
  created_at: string
}

function loadNextEnvironmentForCli(): void {
  const requireFromProject = Module.createRequire(path.join(process.cwd(), 'package.json'))
  const nextEnv = requireFromProject('@next/env') as {
    loadEnvConfig(projectDir: string): void
  }

  nextEnv.loadEnvConfig(process.cwd())
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--seed-run-id') {
      options.seedRunId = args[index + 1]?.trim()
      index += 1
      continue
    }

    if (arg === '--output') {
      options.output = args[index + 1]?.trim()
      index += 1
    }
  }

  return options
}

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`)
  }

  return value
}

function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

function assertString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }

  return value
}

function mapRowToShadowCase(row: SeededSessionRow): JobTargetingShadowCase {
  const agentState = row.agent_state ?? {}
  const caseId = assertString(agentState.caseId, `Seeded session ${row.id} is missing agent_state.caseId.`)
  const rawTargetJobDescription = assertString(
    agentState.targetJobDescription,
    `Seeded session ${row.id} is missing agent_state.targetJobDescription.`,
  )
  const targetJobDescription = sanitizeSeedTargetJobDescription(rawTargetJobDescription)
  const anonymized = agentState.anonymized === true

  if (agentState.source !== 'shadow_seed') {
    throw new Error(`Seeded session ${row.id} has unexpected source ${String(agentState.source)}.`)
  }

  if (!anonymized) {
    throw new Error(`Seeded session ${row.id} is not marked anonymized.`)
  }

  return {
    id: caseId,
    source: 'synthetic',
    domain: agentState.domain,
    cvState: row.cv_state,
    targetJobDescription,
    metadata: {
      originalSessionId: row.id,
      createdAt: row.created_at,
      anonymized,
      seedRunId: agentState.seedRunId,
      source: agentState.source,
      testOnly: agentState.testOnly === true,
      fitLevel: agentState.fitLevel,
    },
  } as JobTargetingShadowCase
}

function sanitizeSeedTargetJobDescription(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !isSeedMetadataTargetLine(line))
    .map((line) => line.replace(/\s+Shadow\b/gu, ''))
    .join('\n')
}

function isSeedMetadataTargetLine(line: string): boolean {
  const normalizedLine = normalizeForSeedFilter(line)

  return normalizedLine.startsWith('empresa:')
    || normalizedLine.startsWith('contexto:')
    || normalizedLine.startsWith('observacao:')
    || normalizedLine.startsWith('observacao ')
    || normalizedLine.includes('seed de teste anonimo')
    || normalizedLine.includes('nao usar dados reais')
    || normalizedLine.includes('caso marcado como shadow_seed')
    || normalizedLine.includes('source: shadow_seed')
    || normalizedLine.includes('testonly')
    || normalizedLine.includes('anonymized')
}

function normalizeForSeedFilter(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
}

function countDomains(cases: JobTargetingShadowCase[]): Record<string, number> {
  return cases.reduce((acc, testCase) => {
    const domain = testCase.domain ?? 'unknown'
    acc[domain] = (acc[domain] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

async function loadSeededSessions(
  supabase: SupabaseClient,
  seedRunId: string,
): Promise<SeededSessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id,user_id,cv_state,agent_state,created_at')
    .filter('agent_state->>source', 'eq', 'shadow_seed')
    .filter('agent_state->>seedRunId', 'eq', seedRunId)
    .order('id', { ascending: true })

  if (error) {
    throw new Error(`Failed to load seeded sessions: ${error.message}`)
  }

  return (data ?? []) as SeededSessionRow[]
}

async function main(): Promise<void> {
  loadNextEnvironmentForCli()

  const options = parseArgs(process.argv.slice(2))
  const seedRunId = assertString(options.seedRunId, 'Usage: tsx scripts/job-targeting/export-seeded-shadow-cases.ts --seed-run-id <id> --output <path>')
  const output = assertString(options.output, 'Usage: tsx scripts/job-targeting/export-seeded-shadow-cases.ts --seed-run-id <id> --output <path>')
  const supabase = createSupabaseAdminClient()
  const sessions = await loadSeededSessions(supabase, seedRunId)
  const cases = sessions.map(mapRowToShadowCase)

  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${cases.map((testCase) => JSON.stringify(testCase)).join('\n')}\n`, 'utf8')

  console.log(JSON.stringify({
    seedRunId,
    exportedCases: cases.length,
    domains: countDomains(cases),
    output,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
