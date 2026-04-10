import { writeFile } from 'node:fs/promises'

import type { AgentStreamChunk } from '../src/types/agent'
import { normalizeAgentRouteUrl } from './check-agent-runtime-parity'

const DEFAULT_VACANCY_TEXT = [
  'O que procuramos?',
  'Buscamos um Analista de BI Senior com foco em Power BI, SQL e traducao de necessidades de negocio em indicadores estrategicos.',
  'Responsabilidades:',
  'Levantar requisitos com as areas de negocio, construir dashboards em Power BI, tratar dados, automatizar ETL e apoiar metricas estrategicas.',
  'Requisitos:',
  'Experiencia solida com Power BI, DAX, SQL, ETL e comunicacao com areas nao tecnicas.',
  'Diferenciais:',
  'Python, APIs, Microsoft Fabric, modelagem de dados e storytelling para alta gestao.',
].join('\n')

const HELP_TEXT = `Usage:
  npm run agent:replay-dialog -- --url <app-url> --cookie "<cookie-header>"

Required flags:
  --url                       Base app URL or full /api/agent URL
  --cookie                    Cookie header value for an authenticated app session

Optional flags:
  --vacancy-text              Override the built-in representative vacancy text
  --follow-up-text            Override the follow-up rewrite request (default: reescreva)
  --format                    Output format: json or markdown (default: json)
  --output                    Optional file path for the captured artifact
  --timeout-ms                Request timeout in milliseconds (default: 15000)
  --help                      Show this help output

Safety:
  This replay uses the Phase 5 provenance headers already emitted by /api/agent.
  It captures route headers, SSE events, and final assistant text, but never writes the auth cookie into the artifact.
`

type ReplayFormat = 'json' | 'markdown'

type ReplayCliOptions = {
  url: string
  cookie: string
  vacancyText: string
  followUpText: string
  format: ReplayFormat
  outputPath?: string
  timeoutMs: number
}

type ReleaseHeaderSnapshot = {
  release?: string
  releaseSource?: string
  agentModel?: string
  dialogModel?: string
  commitShortSha?: string
  sessionHeader?: string
}

type ReplayTurnResult = {
  step: 'vacancy' | 'follow_up'
  request: {
    sessionId?: string
    message: string
    messageLength: number
  }
  response: {
    status: number
    contentType?: string
    headers: ReleaseHeaderSnapshot
    sessionId?: string
    events: AgentStreamChunk[]
    finalAssistantText: string
    rawBodyPreview: string
  }
}

export type ReplayResult = {
  ok: boolean
  requestUrl: string
  capturedAt: string
  turns: ReplayTurnResult[]
  warnings: string[]
}

type FetchLike = typeof fetch

function isFlag(value: string): boolean {
  return value.startsWith('--')
}

function readFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]

  if (!value || isFlag(value)) {
    throw new Error(`Missing value for ${flag}.`)
  }

  return value
}

export function parseReplayArgs(argv: string[]): ReplayCliOptions | { help: true } {
  const values: Partial<ReplayCliOptions> = {
    vacancyText: DEFAULT_VACANCY_TEXT,
    followUpText: 'reescreva',
    format: 'json',
    timeoutMs: 15_000,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    switch (token) {
      case '--help':
        return { help: true }
      case '--url':
        values.url = normalizeAgentRouteUrl(readFlagValue(argv, index, token))
        index += 1
        break
      case '--cookie':
        values.cookie = readFlagValue(argv, index, token)
        index += 1
        break
      case '--vacancy-text':
        values.vacancyText = readFlagValue(argv, index, token)
        index += 1
        break
      case '--follow-up-text':
        values.followUpText = readFlagValue(argv, index, token)
        index += 1
        break
      case '--format': {
        const format = readFlagValue(argv, index, token)
        if (format !== 'json' && format !== 'markdown') {
          throw new Error('--format must be either json or markdown.')
        }
        values.format = format
        index += 1
        break
      }
      case '--output':
        values.outputPath = readFlagValue(argv, index, token)
        index += 1
        break
      case '--timeout-ms': {
        const timeoutMs = Number.parseInt(readFlagValue(argv, index, token), 10)
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
          throw new Error('--timeout-ms must be a positive integer.')
        }
        values.timeoutMs = timeoutMs
        index += 1
        break
      }
      default:
        throw new Error(`Unknown flag: ${token}`)
    }
  }

  if (!values.url || !values.cookie) {
    const missing = [
      !values.url ? '--url' : undefined,
      !values.cookie ? '--cookie' : undefined,
    ].filter(Boolean)

    throw new Error(`Missing required flags: ${missing.join(', ')}`)
  }

  return values as ReplayCliOptions
}

function readReleaseHeaders(headers: Headers): ReleaseHeaderSnapshot {
  return {
    release: headers.get('X-Agent-Release') ?? undefined,
    releaseSource: headers.get('X-Agent-Release-Source') ?? undefined,
    agentModel: headers.get('X-Agent-Resolved-Agent-Model') ?? undefined,
    dialogModel: headers.get('X-Agent-Resolved-Dialog-Model') ?? undefined,
    commitShortSha: headers.get('X-Agent-Commit-Short-Sha') ?? undefined,
    sessionHeader: headers.get('X-Session-Id') ?? undefined,
  }
}

function parseSseEvents(payload: string): AgentStreamChunk[] {
  return payload
    .split('\n\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.slice(6)) as AgentStreamChunk)
}

function buildRawBodyPreview(payload: string): string {
  const collapsed = payload.replace(/\s+/g, ' ').trim()
  return collapsed.length > 280 ? `${collapsed.slice(0, 277)}...` : collapsed
}

async function replayTurn(
  options: {
    url: string
    cookie: string
    message: string
    timeoutMs: number
    sessionId?: string
    step: 'vacancy' | 'follow_up'
  },
  dependencies: { fetchImpl?: FetchLike } = {},
): Promise<ReplayTurnResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await fetchImpl(options.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: options.cookie,
      },
      body: JSON.stringify({
        sessionId: options.sessionId,
        message: options.message,
      }),
      signal: controller.signal,
    })

    const rawBody = await response.text()
    const contentType = response.headers.get('content-type') ?? undefined
    const events = contentType?.includes('text/event-stream') ? parseSseEvents(rawBody) : []
    const finalAssistantText = events
      .filter((event): event is Extract<AgentStreamChunk, { type: 'text' }> => event.type === 'text')
      .map((event) => event.content)
      .join('')
    const sessionIdFromEvents = events.find(
      (event): event is Extract<AgentStreamChunk, { type: 'sessionCreated' | 'done' }> =>
        event.type === 'sessionCreated' || event.type === 'done',
    )?.sessionId

    return {
      step: options.step,
      request: {
        sessionId: options.sessionId,
        message: options.message,
        messageLength: options.message.length,
      },
      response: {
        status: response.status,
        contentType,
        headers: readReleaseHeaders(response.headers),
        sessionId: response.headers.get('X-Session-Id') ?? sessionIdFromEvents,
        events,
        finalAssistantText,
        rawBodyPreview: buildRawBodyPreview(rawBody),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function replayAgentDialog(
  options: ReplayCliOptions,
  dependencies: { fetchImpl?: FetchLike } = {},
): Promise<ReplayResult> {
  const firstTurn = await replayTurn({
    url: options.url,
    cookie: options.cookie,
    message: options.vacancyText,
    timeoutMs: options.timeoutMs,
    step: 'vacancy',
  }, dependencies)

  const warnings: string[] = []
  const sessionId = firstTurn.response.sessionId

  if (!sessionId) {
    warnings.push('The vacancy turn did not expose a session ID; the follow-up replay could not reuse the created session.')
    return {
      ok: false,
      requestUrl: options.url,
      capturedAt: new Date().toISOString(),
      turns: [firstTurn],
      warnings,
    }
  }

  const secondTurn = await replayTurn({
    url: options.url,
    cookie: options.cookie,
    message: options.followUpText,
    sessionId,
    timeoutMs: options.timeoutMs,
    step: 'follow_up',
  }, dependencies)

  if (!secondTurn.response.finalAssistantText.trim()) {
    warnings.push('The follow-up turn completed without assistant text in the SSE stream.')
  }

  const ok = firstTurn.response.status === 200
    && secondTurn.response.status === 200
    && Boolean(secondTurn.response.finalAssistantText.trim())

  return {
    ok,
    requestUrl: options.url,
    capturedAt: new Date().toISOString(),
    turns: [firstTurn, secondTurn],
    warnings,
  }
}

export function formatReplayResult(result: ReplayResult, format: ReplayFormat): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2)
  }

  const lines: string[] = [
    `# Agent Dialog Replay`,
    '',
    `- Status: ${result.ok ? 'PASS' : 'FAIL'}`,
    `- URL: ${result.requestUrl}`,
    `- Captured At: ${result.capturedAt}`,
  ]

  if (result.warnings.length > 0) {
    lines.push(`- Warnings: ${result.warnings.join(' | ')}`)
  }

  for (const turn of result.turns) {
    lines.push('')
    lines.push(`## ${turn.step === 'vacancy' ? 'Vacancy Turn' : 'Follow-up Turn'}`)
    lines.push(`- Request Session ID: ${turn.request.sessionId ?? '<none>'}`)
    lines.push(`- Response Session ID: ${turn.response.sessionId ?? '<none>'}`)
    lines.push(`- Status: ${turn.response.status}`)
    lines.push(`- X-Agent-Release: ${turn.response.headers.release ?? '<missing>'}`)
    lines.push(`- X-Agent-Release-Source: ${turn.response.headers.releaseSource ?? '<missing>'}`)
    lines.push(`- X-Agent-Resolved-Agent-Model: ${turn.response.headers.agentModel ?? '<missing>'}`)
    lines.push(`- X-Agent-Resolved-Dialog-Model: ${turn.response.headers.dialogModel ?? '<missing>'}`)
    lines.push(`- Final Assistant Text: ${turn.response.finalAssistantText || '<empty>'}`)
    lines.push(`- Raw Body Preview: ${turn.response.rawBodyPreview || '<empty>'}`)
  }

  return lines.join('\n')
}

export async function runCli(
  argv: string[],
  dependencies: {
    fetchImpl?: FetchLike
    stdout?: NodeJS.WritableStream
    stderr?: NodeJS.WritableStream
    writeFileImpl?: typeof writeFile
  } = {},
): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  const writeFileImpl = dependencies.writeFileImpl ?? writeFile

  try {
    const parsed = parseReplayArgs(argv)

    if ('help' in parsed) {
      stdout.write(`${HELP_TEXT}\n`)
      return 0
    }

    const result = await replayAgentDialog(parsed, {
      fetchImpl: dependencies.fetchImpl,
    })
    const formatted = `${formatReplayResult(result, parsed.format)}\n`

    if (parsed.outputPath) {
      await writeFileImpl(parsed.outputPath, formatted, 'utf8')
      const summary = `${result.ok ? 'PASS' : 'FAIL'}: replay artifact written to ${parsed.outputPath}\n`
      if (result.ok) {
        stdout.write(summary)
        return 0
      }

      stderr.write(summary)
      return 1
    }

    if (result.ok) {
      stdout.write(formatted)
      return 0
    }

    stderr.write(formatted)
    return 1
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP_TEXT}\n`)
    return 1
  }
}

function isDirectExecution(): boolean {
  const entry = process.argv[1]

  if (!entry) {
    return false
  }

  const normalizePath = (value: string): string =>
    value
      .replace(/\\/g, '/')
      .replace(/^\/([A-Za-z]:)/, '$1')
      .toLowerCase()

  return normalizePath(new URL(import.meta.url).pathname).endsWith(normalizePath(entry))
}

void (async () => {
  if (!isDirectExecution()) {
    return
  }

  const exitCode = await runCli(process.argv.slice(2))
  process.exit(exitCode)
})()
