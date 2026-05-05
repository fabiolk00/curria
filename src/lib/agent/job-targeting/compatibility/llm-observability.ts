import { logInfo } from '@/lib/observability/structured-log'

export type JobMatcherMetricName =
  | 'job_targeting.matcher.llm.model'
  | 'job_targeting.matcher.llm.prompt_version'
  | 'job_targeting.matcher.llm.requirements_per_session'
  | 'job_targeting.matcher.llm.calls_per_session'
  | 'job_targeting.matcher.llm.concurrent_calls_per_session'
  | 'job_targeting.matcher.llm.session_max_concurrent_requirement_calls'
  | 'job_targeting.matcher.llm.global_inflight_provider_calls'
  | 'job_targeting.matcher.llm.input_tokens_per_requirement'
  | 'job_targeting.matcher.llm.output_tokens_per_requirement'
  | 'job_targeting.matcher.llm.input_tokens_per_session'
  | 'job_targeting.matcher.llm.output_tokens_per_session'
  | 'job_targeting.matcher.llm.cost_usd_per_requirement'
  | 'job_targeting.matcher.llm.cost_usd_per_session'
  | 'job_targeting.matcher.llm.session_wall_clock_latency_ms'
  | 'job_targeting.matcher.llm.session_wall_clock_latency_ms.p95'
  | 'job_targeting.matcher.llm.requirement_latency_ms.avg'
  | 'job_targeting.matcher.llm.requirement_latency_ms.p95'
  | 'job_targeting.matcher.llm.total_latency_ms'
  | 'job_targeting.matcher.llm.p95_latency_ms'
  | 'job_targeting.matcher.llm.invalid_json_count'
  | 'job_targeting.matcher.llm.fallback_count'
  | 'job_targeting.matcher.llm.requirement_fallback_count'
  | 'job_targeting.matcher.llm.session_with_partial_fallback_count'
  | 'job_targeting.matcher.llm.session_full_fallback_count'
  | 'job_targeting.matcher.llm.confidence.avg'
  | 'job_targeting.matcher.llm.confidence.p10'
  | 'job_targeting.matcher.llm.confidence.p50'
  | 'job_targeting.matcher.llm.confidence.p90'
  | 'job_targeting.matcher.llm.low_confidence_count'
  | 'job_targeting.matcher.llm.low_confidence_rate'
  | 'job_targeting.matcher.llm.rate_limit_count'
  | 'job_targeting.matcher.llm.retry_count'
  | 'job_targeting.matcher.llm.retry_exhausted_count'
  | 'job_targeting.matcher.llm.retry_success_count'
  | 'job_targeting.matcher.llm.provider_5xx_count'
  | 'job_targeting.matcher.llm.timeout_count'
  | 'job_targeting.matcher.llm.fallback_reason.classification_failed'
  | 'job_targeting.matcher.llm.fallback_reason.rate_limit_retries_exhausted'
  | 'job_targeting.matcher.llm.fallback_reason.llm_timeout_retries_exhausted'
  | 'job_targeting.matcher.llm.fallback_reason.llm_provider_error_retries_exhausted'

export function recordJobMatcherMetric(
  metric: JobMatcherMetricName,
  value: number | string,
  fields: Record<string, unknown> = {},
): void {
  logInfo('job_targeting.matcher.llm.metric', {
    metric,
    value,
    ...fields,
  })
}

export function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1),
  )

  return sorted[index]
}
