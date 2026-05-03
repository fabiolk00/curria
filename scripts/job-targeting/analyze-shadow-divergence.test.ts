import { describe, expect, it } from 'vitest'

import {
  buildShadowDivergenceReport,
  parseShadowComparisonInput,
  percentile,
  type ShadowComparisonRecord,
} from './analyze-shadow-divergence'

function result(index: number, delta: number) {
  return {
    caseId: `case-${index}`,
    domain: index % 2 === 0 ? 'data-bi' : 'finance',
    legacy: {
      score: 70,
      lowFitTriggered: false,
      unsupportedCount: 2,
      criticalGaps: ['gap'],
    },
    assessment: {
      score: 70 + delta,
      lowFitTriggered: false,
      unsupportedCount: delta > 0 ? 1 : 3,
      supportedCount: 1,
      adjacentCount: 0,
      forbiddenClaimCount: 0,
      criticalGaps: ['gap'],
    },
    comparison: {
      scoreDelta: delta,
      lowFitDelta: false,
      criticalGapDelta: 0,
      unsupportedDelta: delta > 0 ? -1 : 1,
    },
    runtime: {
      success: true,
    },
  }
}

function readyResult(index: number, overrides: Partial<ShadowComparisonRecord> = {}): ShadowComparisonRecord {
  return {
    ...result(index, 3),
    gapAnalysisSource: 'provided',
    runConfig: {
      allowLlm: true,
      useRealGapAnalysis: false,
      includeRewriteValidation: true,
      persist: true,
      concurrency: 3,
      limit: 500,
      totalInputCases: 500,
    },
    validation: {
      executed: true,
      mode: 'real_llm',
      blocked: false,
      factualViolation: false,
      issueTypes: [],
    },
    ...overrides,
  }
}

describe('analyze-shadow-divergence', () => {
  it('calculates p95 using nearest-rank percentile', () => {
    expect(percentile([1, 2, 3, 4, 100], 95)).toBe(100)
  })

  it('marks CUTOVER_READY=false with fewer than 500 successful cases', () => {
    const report = buildShadowDivergenceReport([result(1, 2), result(2, 3)])

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.cutoverReasons).toContain('successful_cases_below_500')
  })

  it('marks CUTOVER_READY=false when p95 is high', () => {
    const records = Array.from({ length: 500 }, (_, index) => result(index, index >= 474 ? 45 : 3))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.cutoverReasons).toContain('p95_score_delta_above_30')
  })

  it('marks CUTOVER_READY=false when factual violations exist', () => {
    const records = Array.from({ length: 500 }, (_, index) => ({
      ...readyResult(index),
      validation: index === 0
        ? { executed: true, blocked: true, factualViolation: true, issueTypes: ['forbidden_term'] }
        : { executed: true, blocked: false, factualViolation: false, issueTypes: [] },
    }))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.cutoverReasons).toContain('factual_validation_violations_present')
  })

  it('marks CUTOVER_READY=false when rewrite validation has operational issues', () => {
    const records = Array.from({ length: 500 }, (_, index) => (index === 0
      ? readyResult(index, {
        validation: {
          executed: true,
          blocked: false,
          factualViolation: false,
          issueTypes: ['rewrite_model_call_failed', 'shadow_trace_fallback_used'],
        },
      })
      : readyResult(index)))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.rewriteValidationOperationalIssueCases).toBe(1)
    expect(report.cutoverReasons).toContain('rewrite_validation_operational_issues_present')
  })

  it('includes aggregated run config and can mark ready when provided gap analysis covers all cases', () => {
    const report = buildShadowDivergenceReport(Array.from({ length: 500 }, (_, index) => readyResult(index)))

    expect(report.CUTOVER_READY).toBe(true)
    expect(report.runConfig).toEqual(expect.objectContaining({
      allowLlm: true,
      useRealGapAnalysis: false,
      includeRewriteValidation: true,
      dryRunRewriteValidation: false,
      persist: true,
      limit: 500,
      concurrency: 3,
      totalInputCases: 500,
      processedCases: 500,
      pipelineRepresentativeness: 'full',
      rewriteValidationCoverage: 'full',
      gapAnalysisSources: {
        provided: 500,
        synthetic: 0,
        realLlm: 0,
      },
    }))
    expect(report.cost).toEqual(expect.objectContaining({
      estimatedCostUsd: 0,
      llmCases: 0,
      gapAnalysisCalls: 0,
      rewriteCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }))
  })

  it('can mark ready when real gap analysis was used for all cases', () => {
    const records = Array.from({ length: 500 }, (_, index) => readyResult(index, {
      gapAnalysisSource: 'real_llm',
      runConfig: {
        allowLlm: true,
        useRealGapAnalysis: true,
        includeRewriteValidation: true,
        persist: true,
        concurrency: 2,
        limit: 500,
        totalInputCases: 500,
      },
    }))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(true)
    expect(report.runConfig.pipelineRepresentativeness).toBe('full')
    expect(report.runConfig.gapAnalysisSources.realLlm).toBe(500)
  })

  it('marks CUTOVER_READY=false when synthetic gap analysis is present', () => {
    const records = Array.from({ length: 500 }, (_, index) => readyResult(index, index === 0
      ? { gapAnalysisSource: 'synthetic' }
      : {}))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.runConfig.pipelineRepresentativeness).toBe('partial')
    expect(report.cutoverReasons).toContain('pipeline_representativeness_partial')
  })

  it('marks CUTOVER_READY=false when results were not persisted', () => {
    const records = Array.from({ length: 500 }, (_, index) => readyResult(index, {
      runConfig: {
        allowLlm: true,
        useRealGapAnalysis: false,
        includeRewriteValidation: true,
        persist: false,
        concurrency: 3,
        limit: 500,
        totalInputCases: 500,
      },
    }))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.cutoverReasons).toContain('shadow_results_not_persisted')
  })

  it('marks CUTOVER_READY=false when rewrite validation was not executed', () => {
    const records = Array.from({ length: 500 }, (_, index) => ({
      ...readyResult(index),
      validation: undefined,
      runConfig: {
        allowLlm: false,
        useRealGapAnalysis: false,
        includeRewriteValidation: false,
        persist: true,
        concurrency: 3,
        limit: 500,
        totalInputCases: 500,
      },
    }))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.runConfig.rewriteValidationCoverage).toBe('none')
    expect(report.cutoverReasons).toContain('rewrite_validation_not_executed')
  })

  it('marks CUTOVER_READY=false when rewrite validation is dry-run only', () => {
    const records = Array.from({ length: 500 }, (_, index) => readyResult(index, {
      runConfig: {
        allowLlm: false,
        useRealGapAnalysis: false,
        includeRewriteValidation: true,
        dryRunRewriteValidation: true,
        persist: true,
        concurrency: 3,
        limit: 500,
        totalInputCases: 500,
      },
      validation: {
        executed: true,
        mode: 'dry_run',
        blocked: false,
        factualViolation: false,
        issueTypes: [],
      },
    }))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.runConfig.dryRunRewriteValidation).toBe(true)
    expect(report.cutoverReasons).toContain('rewrite_validation_dry_run_only')
  })

  it('aggregates LLM cost and cache usage', () => {
    const records = [
      readyResult(1, {
        llmUsage: {
          gapAnalysisCalled: true,
          rewriteCalled: false,
          cacheHit: false,
          cacheHits: 0,
          cacheMisses: 1,
          estimatedCostUsd: 0.01,
        },
      }),
      readyResult(2, {
        llmUsage: {
          gapAnalysisCalled: false,
          rewriteCalled: true,
          cacheHit: true,
          cacheHits: 1,
          cacheMisses: 0,
          estimatedCostUsd: 0.05,
          actualCostUsd: 0.03,
        },
      }),
    ]

    const report = buildShadowDivergenceReport(records)

    expect(report.cost).toEqual(expect.objectContaining({
      estimatedCostUsd: 0.06,
      actualCostUsd: 0.03,
      llmCases: 2,
      gapAnalysisCalls: 1,
      rewriteCalls: 1,
      cacheHits: 1,
      cacheMisses: 1,
    }))
  })

  it('marks CUTOVER_READY=false when failed cases exist', () => {
    const records = Array.from({ length: 500 }, (_, index) => readyResult(index, index === 0
      ? { runtime: { success: false, error: 'case failed' } }
      : {}))

    const report = buildShadowDivergenceReport(records)

    expect(report.CUTOVER_READY).toBe(false)
    expect(report.failedCases).toBe(1)
    expect(report.cutoverReasons).toContain('failed_cases_present')
  })

  it('parses shadow comparison logs and batch JSONL results', () => {
    const source = [
      JSON.stringify({ event: 'unrelated', scoreDelta: 99 }),
      JSON.stringify({ event: 'job_targeting.compatibility.shadow_comparison', scoreDelta: 4 }),
      JSON.stringify(result(1, -6)),
    ].join('\n')

    const records = parseShadowComparisonInput(source)

    expect(records).toHaveLength(2)
    expect(buildShadowDivergenceReport(records).scoreDelta.p50).toBe(4)
  })
})
