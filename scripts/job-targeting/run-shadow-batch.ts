import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

type CliOptions = {
  input?: string
  output?: string
  limit?: number
  concurrency?: number
  persist?: boolean
  disableLlm?: boolean
  useRealGapAnalysis?: boolean
  includeRewriteValidation?: boolean
  confirmLlmCost?: boolean
  maxLlmCases?: number
  maxEstimatedCostUsd?: number
  dryRunRewriteValidation?: boolean
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
  report?: boolean
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    disableLlm: true,
    useRealGapAnalysis: false,
    includeRewriteValidation: false,
    report: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--input') {
      options.input = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--output') {
      options.output = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--limit') {
      options.limit = readNumber(args[index + 1], 500)
      index += 1
      continue
    }

    if (arg === '--concurrency') {
      options.concurrency = readNumber(args[index + 1], 3)
      index += 1
      continue
    }

    if (arg === '--persist') {
      options.persist = true
      continue
    }

    if (arg === '--allow-llm') {
      options.disableLlm = false
      continue
    }

    if (arg === '--use-real-gap-analysis') {
      options.useRealGapAnalysis = true
      continue
    }

    if (arg === '--include-rewrite-validation') {
      options.includeRewriteValidation = true
      options.disableLlm = false
      continue
    }

    if (arg === '--confirm-llm-cost') {
      options.confirmLlmCost = true
      continue
    }

    if (arg === '--max-llm-cases') {
      options.maxLlmCases = readNumber(args[index + 1], 0)
      index += 1
      continue
    }

    if (arg === '--max-estimated-cost-usd') {
      const parsed = Number(args[index + 1])
      options.maxEstimatedCostUsd = Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
      index += 1
      continue
    }

    if (arg === '--dry-run-rewrite-validation') {
      options.dryRunRewriteValidation = true
      options.includeRewriteValidation = false
      options.disableLlm = true
      continue
    }

    if (arg === '--reuse-cached-llm-results') {
      options.reuseCachedLlmResults = true
      continue
    }

    if (arg === '--llm-cache-dir') {
      options.llmCacheDir = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--no-report') {
      options.report = false
    }
  }

  return options
}

function installServerOnlyShimForCli(): void {
  const moduleWithLoad = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown
    __curriaServerOnlyShimInstalled?: boolean
  }

  if (moduleWithLoad.__curriaServerOnlyShimInstalled) {
    return
  }

  const originalLoad = moduleWithLoad._load
  moduleWithLoad._load = function loadWithServerOnlyShim(
    request: string,
    parent: unknown,
    isMain: boolean,
  ): unknown {
    if (request === 'server-only') {
      return {}
    }

    return originalLoad.call(this, request, parent, isMain)
  }
  moduleWithLoad.__curriaServerOnlyShimInstalled = true
}

function loadNextEnvironmentForCli(): void {
  const requireFromProject = Module.createRequire(path.join(process.cwd(), 'package.json'))
  const nextEnv = requireFromProject('@next/env') as {
    loadEnvConfig(projectDir: string): void
  }

  nextEnv.loadEnvConfig(process.cwd())
}

async function main() {
  loadNextEnvironmentForCli()
  installServerOnlyShimForCli()
  const options = parseArgs(process.argv.slice(2))
  if (!options.input || !options.output) {
    console.error([
      'Usage:',
      'tsx scripts/job-targeting/run-shadow-batch.ts \\',
      '  --input .local/job-targeting-shadow-cases/cases.jsonl \\',
      '  --output .local/job-targeting-shadow-results/results.jsonl \\',
      '  --limit 500 \\',
      '  --concurrency 3 \\',
      '  --persist',
    ].join('\n'))
    process.exitCode = 1
    return
  }

  const concurrency = options.concurrency ?? (
    options.includeRewriteValidation
      ? 1
      : options.useRealGapAnalysis
        ? 2
        : 3
  )

  if (options.useRealGapAnalysis || options.includeRewriteValidation) {
    console.warn(JSON.stringify({
      event: 'job_targeting.shadow_batch.llm_mode_enabled',
      useRealGapAnalysis: options.useRealGapAnalysis ?? false,
      includeRewriteValidation: options.includeRewriteValidation ?? false,
      allowLlm: Boolean(options.useRealGapAnalysis || options.includeRewriteValidation),
      concurrency,
      message: 'This run may incur OpenAI latency/cost. It does not generate artifacts or consume user credits.',
    }))
  } else if (options.dryRunRewriteValidation) {
    console.warn(JSON.stringify({
      event: 'job_targeting.shadow_batch.rewrite_validation_dry_run',
      dryRunRewriteValidation: true,
      allowLlm: false,
      concurrency,
      message: 'Dry-run rewrite validation does not call OpenAI, generate artifacts, or consume user credits.',
    }))
  }

  const { runShadowBatch } = await import('../../src/lib/agent/job-targeting/shadow-batch-runner')
  const summary = await runShadowBatch({
    inputPath: options.input,
    outputPath: options.output,
    limit: options.limit ?? 500,
    concurrency,
    persist: options.persist ?? false,
    disableLlm: options.disableLlm ?? true,
    useRealGapAnalysis: options.useRealGapAnalysis ?? false,
    includeRewriteValidation: options.includeRewriteValidation ?? false,
    confirmLlmCost: options.confirmLlmCost ?? false,
    maxLlmCases: options.maxLlmCases,
    maxEstimatedCostUsd: options.maxEstimatedCostUsd,
    dryRunRewriteValidation: options.dryRunRewriteValidation ?? false,
    reuseCachedLlmResults: options.reuseCachedLlmResults ?? false,
    llmCacheDir: options.llmCacheDir,
    enforceCostGuards: true,
  })

  let cutoverReady: boolean | undefined
  if (options.report !== false) {
    const {
      parseShadowComparisonInput,
      writeShadowDivergenceReport,
    } = await import('./analyze-shadow-divergence')
    const records = parseShadowComparisonInput(readFileSync(options.output, 'utf8'))
    const report = writeShadowDivergenceReport({
      records,
      outputDir: path.dirname(options.output),
    })
    cutoverReady = report.CUTOVER_READY
  }

  console.log(JSON.stringify({
    ...summary,
    ...(cutoverReady === undefined ? {} : { CUTOVER_READY: cutoverReady }),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
