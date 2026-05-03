import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runShadowBatch } from '@/lib/agent/job-targeting/shadow-batch-runner'
import type { JobTargetingShadowCase } from '@/lib/agent/job-targeting/shadow-case-types'
import type { CVState } from '@/types/cv'

const {
  mockAnalyzeGap,
  mockBuildTargetedRewritePlan,
  mockEvaluateJobCompatibility,
  mockRewriteResumeFull,
  mockCreateJobCompatibilityShadowComparison,
} = vi.hoisted(() => ({
  mockAnalyzeGap: vi.fn(),
  mockBuildTargetedRewritePlan: vi.fn(),
  mockEvaluateJobCompatibility: vi.fn(),
  mockRewriteResumeFull: vi.fn(),
  mockCreateJobCompatibilityShadowComparison: vi.fn(),
}))

vi.mock('@/lib/agent/tools/gap-analysis', () => ({
  analyzeGap: mockAnalyzeGap,
}))

vi.mock('@/lib/agent/tools/build-targeting-plan', () => ({
  buildTargetedRewritePlan: mockBuildTargetedRewritePlan,
}))

vi.mock('@/lib/agent/tools/rewrite-resume-full', () => ({
  rewriteResumeFull: mockRewriteResumeFull,
}))

vi.mock('@/lib/agent/job-targeting/compatibility/assessment', () => ({
  evaluateJobCompatibility: mockEvaluateJobCompatibility,
}))

vi.mock('@/lib/db/job-compatibility-shadow-comparison', () => ({
  createJobCompatibilityShadowComparison: mockCreateJobCompatibilityShadowComparison,
}))

const cvState: CVState = {
  fullName: 'Pessoa Teste',
  email: 'teste@example.com',
  phone: '+55 11 99999-0000',
  summary: 'Analista com experiencia em dados.',
  experience: [],
  skills: ['SQL'],
  education: [],
  certifications: [],
}

function buildGapAnalysis(matchScore = 88) {
  return {
    matchScore,
    missingSkills: ['Ferramenta faltante'],
    weakAreas: ['Resumo'],
    improvementSuggestions: ['Priorizar evidencias reais.'],
  }
}

function buildCase(id: string): JobTargetingShadowCase {
  return {
    id,
    source: 'synthetic',
    domain: 'data-bi',
    cvState,
    targetJobDescription: 'Cargo: Analista de Dados\nRequisitos: SQL',
    metadata: {
      anonymized: true,
    },
  }
}

function buildPlan() {
  return {
    targetRole: 'Analista de Dados',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    focusKeywords: [],
    mustEmphasize: [],
    shouldDeemphasize: [],
    missingButCannotInvent: [],
    sectionStrategy: {
      summary: [],
      experience: [],
      skills: [],
      education: [],
      certifications: [],
    },
    targetEvidence: [{
      jobSignal: 'SQL',
      canonicalSignal: 'SQL',
      evidenceLevel: 'explicit',
      rewritePermission: 'can_claim_directly',
      matchedResumeTerms: ['SQL'],
      supportingResumeSpans: ['SQL'],
      rationale: 'explicit',
      confidence: 1,
      allowedRewriteForms: ['SQL'],
      forbiddenRewriteForms: [],
      validationSeverityIfViolated: 'none',
    }],
    lowFitWarningGate: {
      triggered: false,
      blocking: false,
      riskLevel: 'low',
      matchScore: 80,
      unsupportedGapCount: 0,
      unsupportedGapRatio: 0,
      explicitEvidenceCount: 1,
      explicitEvidenceRatio: 1,
      coreRequirementCoverage: {
        total: 1,
        supported: 1,
        unsupported: 0,
        unsupportedSignals: [],
        topUnsupportedSignalsForDisplay: [],
        preferredSignalsForDisplay: [],
        requirements: [],
      },
    },
  }
}

function buildAssessment() {
  return {
    targetRole: 'Analista de Dados',
    scoreBreakdown: {
      total: 82,
      scoreVersion: 'job-compat-score-v1',
    },
    lowFit: { triggered: false },
    supportedRequirements: [{}],
    adjacentRequirements: [],
    unsupportedRequirements: [],
    criticalGaps: [],
    reviewNeededGaps: [],
    claimPolicy: {
      allowedClaims: [],
      cautiousClaims: [],
      forbiddenClaims: [],
    },
    audit: {
      assessmentVersion: 'job-compat-assessment-v1',
      scoreVersion: 'job-compat-score-v1',
    },
    catalog: {
      catalogVersions: { generic: '1.0.0' },
    },
  }
}

describe('runShadowBatch', () => {
  let tempDir: string
  let cacheDir: string | undefined

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'curria-shadow-batch-'))
    cacheDir = undefined
    vi.clearAllMocks()
    mockBuildTargetedRewritePlan.mockResolvedValue(buildPlan())
    mockEvaluateJobCompatibility.mockResolvedValue(buildAssessment())
    mockAnalyzeGap.mockResolvedValue({
      output: { success: true, result: buildGapAnalysis(91) },
      result: buildGapAnalysis(91),
      repairAttempted: false,
    })
    mockRewriteResumeFull.mockResolvedValue({
      success: true,
      optimizedCvState: cvState,
      generatedClaimTrace: [{
        section: 'summary',
        itemPath: 'summary',
        generatedText: cvState.summary,
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'test',
      }, {
        section: 'skills',
        itemPath: 'skills.0',
        generatedText: 'SQL',
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'test',
      }],
    })
    mockCreateJobCompatibilityShadowComparison.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
    if (cacheDir) {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })

  async function writeCases(cases: JobTargetingShadowCase[]): Promise<{ input: string; output: string }> {
    const input = path.join(tempDir, 'cases.jsonl')
    const output = path.join(tempDir, 'results.jsonl')
    await writeFile(input, cases.map((testCase) => JSON.stringify(testCase)).join('\n'), 'utf8')
    return { input, output }
  }

  it('processes multiple cases and writes JSONL results', async () => {
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    const summary = await runShadowBatch({ inputPath: input, outputPath: output, concurrency: 2 })
    const lines = (await readFile(output, 'utf8')).trim().split(/\r?\n/u)

    expect(summary).toEqual(expect.objectContaining({ total: 2, successful: 2, failed: 0 }))
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] ?? '{}')).toEqual(expect.objectContaining({
      caseId: 'case-1',
      gapAnalysisSource: 'synthetic',
      runConfig: expect.objectContaining({
        allowLlm: false,
        useRealGapAnalysis: false,
        includeRewriteValidation: false,
        persist: false,
        concurrency: 2,
      }),
      runtime: expect.objectContaining({ success: true }),
    }))
    expect(mockAnalyzeGap).not.toHaveBeenCalled()
    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
  })

  it('aborts real rewrite validation without explicit LLM cost confirmation', async () => {
    const { input, output } = await writeCases([buildCase('case-rewrite-cost')])

    await expect(runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      enforceCostGuards: true,
    })).rejects.toThrow('LLM cost confirmation required')

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
    expect(mockAnalyzeGap).not.toHaveBeenCalled()
  })

  it('aborts real gap analysis without explicit LLM cost confirmation', async () => {
    const { input, output } = await writeCases([buildCase('case-gap-cost')])

    await expect(runShadowBatch({
      inputPath: input,
      outputPath: output,
      useRealGapAnalysis: true,
      enforceCostGuards: true,
    })).rejects.toThrow('LLM cost confirmation required')

    expect(mockAnalyzeGap).not.toHaveBeenCalled()
  })

  it('aborts LLM runs when maxLlmCases is below the selected case count', async () => {
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    await expect(runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      confirmLlmCost: true,
      maxLlmCases: 1,
      maxEstimatedCostUsd: 1,
      enforceCostGuards: true,
    })).rejects.toThrow('Refusing to run 2 LLM cases with maxLlmCases=1')

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
  })

  it('aborts LLM runs without an explicit estimated cost budget', async () => {
    const { input, output } = await writeCases([buildCase('case-budget-required')])

    await expect(runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      confirmLlmCost: true,
      maxLlmCases: 1,
      enforceCostGuards: true,
    })).rejects.toThrow('LLM max estimated cost budget required')

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
  })

  it('aborts LLM runs when estimated cost exceeds the configured budget', async () => {
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    await expect(runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      confirmLlmCost: true,
      maxLlmCases: 2,
      maxEstimatedCostUsd: 0.05,
      enforceCostGuards: true,
    })).rejects.toThrow('Estimated cost $0.10 exceeds max budget $0.05')

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
  })

  it('respects limit', async () => {
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    const summary = await runShadowBatch({ inputPath: input, outputPath: output, limit: 1 })

    expect(summary.total).toBe(1)
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledTimes(1)
  })

  it('uses provided gap analysis when the case includes one', async () => {
    const providedGapAnalysis = buildGapAnalysis(94)
    const { input, output } = await writeCases([{
      ...buildCase('case-provided'),
      gapAnalysis: providedGapAnalysis,
    }])

    await runShadowBatch({ inputPath: input, outputPath: output })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.gapAnalysisSource).toBe('provided')
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledWith(expect.objectContaining({
      gapAnalysis: providedGapAnalysis,
    }))
    expect(mockAnalyzeGap).not.toHaveBeenCalled()
  })

  it('uses real LLM gap analysis when requested', async () => {
    const { input, output } = await writeCases([buildCase('case-real-gap')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      useRealGapAnalysis: true,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.gapAnalysisSource).toBe('real_llm')
    expect(result.runConfig).toEqual(expect.objectContaining({
      allowLlm: true,
      useRealGapAnalysis: true,
      concurrency: 2,
    }))
    expect(mockAnalyzeGap).toHaveBeenCalledWith(
      cvState,
      'Cargo: Analista de Dados\nRequisitos: SQL',
      'shadow_batch',
      'shadow_case_case-real-gap',
    )
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledWith(expect.objectContaining({
      gapAnalysis: buildGapAnalysis(91),
    }))
  })

  it('persists shadow comparison only when requested', async () => {
    const { input, output } = await writeCases([buildCase('case-persist')])

    await runShadowBatch({ inputPath: input, outputPath: output })
    expect(mockCreateJobCompatibilityShadowComparison).not.toHaveBeenCalled()

    await runShadowBatch({ inputPath: input, outputPath: output, persist: true })
    expect(mockCreateJobCompatibilityShadowComparison).toHaveBeenCalledWith(expect.objectContaining({
      caseId: 'case-persist',
      source: 'batch',
    }))
  })

  it('runs rewrite validation when requested', async () => {
    const { input, output } = await writeCases([buildCase('case-rewrite')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(mockRewriteResumeFull).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'job_targeting',
      userId: 'shadow_batch',
      sessionId: 'shadow_case_case-rewrite',
      jobCompatibilityAssessment: expect.objectContaining({
        claimPolicy: expect.any(Object),
      }),
    }))
    expect(result.runConfig).toEqual(expect.objectContaining({
      includeRewriteValidation: true,
      allowLlm: true,
      concurrency: 1,
    }))
    expect(result.validation).toEqual(expect.objectContaining({
      executed: true,
      blocked: false,
      factualViolation: false,
      generatedClaimTraceCount: 2,
    }))
  })

  it('runs dry-run rewrite validation without calling OpenAI rewrite', async () => {
    const { input, output } = await writeCases([buildCase('case-dry-run')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      dryRunRewriteValidation: true,
      concurrency: 1,
      enforceCostGuards: true,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
    expect(result.runConfig).toEqual(expect.objectContaining({
      includeRewriteValidation: true,
      dryRunRewriteValidation: true,
      allowLlm: false,
    }))
    expect(result.validation).toEqual(expect.objectContaining({
      executed: true,
      mode: 'dry_run',
    }))
    expect(result.llmUsage).toEqual(expect.objectContaining({
      gapAnalysisCalled: false,
      rewriteCalled: false,
      estimatedCostUsd: 0,
    }))
  })

  it('reuses cached rewrite validation results without a second OpenAI rewrite call', async () => {
    cacheDir = path.join('.local', `test-shadow-cache-${process.pid}-${Date.now()}`)
    const { input, output } = await writeCases([buildCase('case-cache')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      confirmLlmCost: true,
      maxLlmCases: 1,
      maxEstimatedCostUsd: 1,
      reuseCachedLlmResults: true,
      llmCacheDir: cacheDir,
      concurrency: 1,
      enforceCostGuards: true,
    })
    expect(mockRewriteResumeFull).toHaveBeenCalledTimes(1)

    mockRewriteResumeFull.mockClear()
    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      confirmLlmCost: true,
      maxLlmCases: 1,
      maxEstimatedCostUsd: 1,
      reuseCachedLlmResults: true,
      llmCacheDir: cacheDir,
      concurrency: 1,
      enforceCostGuards: true,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(mockRewriteResumeFull).not.toHaveBeenCalled()
    expect(result.validation).toEqual(expect.objectContaining({
      cacheHit: true,
    }))
    expect(result.llmUsage).toEqual(expect.objectContaining({
      rewriteCalled: false,
      cacheHit: true,
    }))
  })

  it('classifies model rewrite failures specifically and uses a transparent synthetic trace fallback', async () => {
    mockRewriteResumeFull.mockResolvedValueOnce({
      success: false,
      error: 'Failed to rewrite resume section.',
      errorCode: 'UNAUTHORIZED',
      failedSection: 'summary',
    })
    const { input, output } = await writeCases([buildCase('case-rewrite-failure')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.validation).toEqual(expect.objectContaining({
      executed: true,
      blocked: false,
      factualViolation: false,
      rewriteSucceeded: false,
      errorCode: 'UNAUTHORIZED',
      safeErrorCode: 'UNAUTHORIZED',
      rewriteErrorCode: 'UNAUTHORIZED',
      failedSection: 'summary',
      retryAttempted: false,
      fallbackUsed: true,
      traceFallbackUsed: true,
    }))
    expect(result.validation.issueTypes).toEqual(expect.arrayContaining([
      'rewrite_model_call_failed',
      'shadow_trace_fallback_used',
    ]))
    expect(result.validation.generatedClaimTraceCount).toBeGreaterThan(0)
  })

  it('classifies 429 rewrite failures as provider operational failures', async () => {
    mockRewriteResumeFull.mockResolvedValueOnce({
      success: false,
      error: 'Rate limit reached for requests.',
      errorCode: 'RATE_LIMITED',
      failedSection: 'summary',
    })
    const { input, output } = await writeCases([buildCase('case-provider-rate')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
      maxProviderRetries: 0,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.validation).toEqual(expect.objectContaining({
      executed: true,
      mode: 'real_llm',
      blocked: true,
      factualViolation: false,
      operationalFailure: true,
      providerIssueType: 'provider_rate_limited',
    }))
    expect(result.validation.issueTypes).toContain('provider_rate_limited')
    expect(result.validation.issueTypes).not.toContain('rewrite_failed')
  })

  it('classifies circuit breaker short-circuits as provider operational failures', async () => {
    mockRewriteResumeFull.mockResolvedValueOnce({
      success: false,
      error: 'OpenAI circuit breaker is open.',
      errorCode: 'INTERNAL_ERROR',
      failedSection: 'summary',
    })
    const { input, output } = await writeCases([buildCase('case-provider-circuit')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
      maxProviderRetries: 0,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.validation).toEqual(expect.objectContaining({
      operationalFailure: true,
      providerIssueType: 'provider_short_circuited',
      factualViolation: false,
    }))
    expect(result.validation.issueTypes).toContain('provider_short_circuited')
  })

  it('retries provider failures after cooldown and respects maxProviderRetries', async () => {
    mockRewriteResumeFull
      .mockResolvedValueOnce({
        success: false,
        error: 'Rate limit reached for requests.',
        errorCode: 'RATE_LIMITED',
        failedSection: 'summary',
      })
      .mockResolvedValueOnce({
        success: true,
        optimizedCvState: cvState,
        generatedClaimTrace: [{
          section: 'summary',
          itemPath: 'summary',
          generatedText: cvState.summary,
          expressedSignals: [],
          usedClaimPolicyIds: [],
          evidenceBasis: [],
          prohibitedTermsFound: [],
          validationStatus: 'valid',
          rationale: 'test',
        }],
      })
    const { input, output } = await writeCases([buildCase('case-provider-retry')])

    const summary = await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
      providerCooldownMs: 1,
      maxProviderRetries: 1,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(summary.stoppedEarly).toBeUndefined()
    expect(mockRewriteResumeFull).toHaveBeenCalledTimes(2)
    expect(result.validation).toEqual(expect.objectContaining({
      rewriteSucceeded: true,
      providerRetryCount: 1,
    }))
    expect(result.llmUsage).toEqual(expect.objectContaining({
      providerRetryCount: 1,
      providerCooldownMs: 1,
    }))
  })

  it('stops starting new cases when provider failure remains after retries', async () => {
    mockRewriteResumeFull.mockResolvedValue({
      success: false,
      error: 'OpenAI circuit breaker is open.',
      errorCode: 'INTERNAL_ERROR',
      failedSection: 'summary',
    })
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    const summary = await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
      providerCooldownMs: 1,
      maxProviderRetries: 0,
      stopOnProviderCircuitOpen: true,
    })
    const results = (await readFile(output, 'utf8')).trim().split(/\r?\n/u).map((line) => JSON.parse(line))

    expect(summary).toEqual(expect.objectContaining({
      total: 1,
      stoppedEarly: true,
      stopReason: 'provider_short_circuited',
    }))
    expect(results).toHaveLength(1)
    expect(results[0].caseId).toBe('case-1')
    expect(mockRewriteResumeFull).toHaveBeenCalledTimes(1)
  })

  it('resume-failed-from reruns only provider operational failures', async () => {
    const previous = path.join(tempDir, 'previous.jsonl')
    await writeFile(previous, [
      JSON.stringify({
        caseId: 'case-1',
        validation: {
          executed: true,
          blocked: false,
          factualViolation: false,
          issueTypes: [],
        },
        runtime: { success: true },
      }),
      JSON.stringify({
        caseId: 'case-2',
        validation: {
          executed: true,
          blocked: true,
          factualViolation: false,
          operationalFailure: true,
          issueTypes: ['provider_rate_limited'],
        },
        runtime: { success: true },
      }),
    ].join('\n'), 'utf8')
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    const summary = await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
      resumeFailedFrom: previous,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(summary).toEqual(expect.objectContaining({
      total: 1,
      rerunProviderFailures: 1,
    }))
    expect(result.caseId).toBe('case-2')
    expect(mockRewriteResumeFull).toHaveBeenCalledTimes(1)
  })

  it('reports missing generated traces as missing_claim_trace instead of generic rewrite_failed', async () => {
    mockRewriteResumeFull.mockResolvedValueOnce({
      success: true,
      optimizedCvState: cvState,
      generatedClaimTrace: [],
      sectionRewritePlans: [],
    })
    const { input, output } = await writeCases([buildCase('case-missing-trace')])

    await runShadowBatch({
      inputPath: input,
      outputPath: output,
      includeRewriteValidation: true,
      concurrency: 1,
    })
    const result = JSON.parse((await readFile(output, 'utf8')).trim())

    expect(result.validation).toEqual(expect.objectContaining({
      executed: true,
      blocked: true,
      rewriteSucceeded: true,
      generatedClaimTraceCount: 0,
    }))
    expect(result.validation.issueTypes).toContain('missing_claim_trace')
    expect(result.validation.issueTypes).not.toContain('rewrite_failed')
  })

  it('marks a per-case error without killing the whole batch', async () => {
    mockBuildTargetedRewritePlan.mockImplementation(async ({ sessionId }: { sessionId?: string }) => {
      if (sessionId?.includes('case-2')) {
        throw new Error('case failed')
      }
      return buildPlan()
    })
    const { input, output } = await writeCases([buildCase('case-1'), buildCase('case-2')])

    const summary = await runShadowBatch({ inputPath: input, outputPath: output, concurrency: 2 })
    const results = (await readFile(output, 'utf8')).trim().split(/\r?\n/u).map((line) => JSON.parse(line))

    expect(summary).toEqual(expect.objectContaining({ total: 2, successful: 1, failed: 1 }))
    expect(results.find((result) => result.caseId === 'case-2')).toEqual(expect.objectContaining({
      runtime: expect.objectContaining({
        success: false,
        error: 'case failed',
      }),
    }))
  })
})
