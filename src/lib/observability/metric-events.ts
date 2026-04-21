import { logInfo } from '@/lib/observability/structured-log'

export type MetricCounterEventName =
  | 'billing.reservations.created'
  | 'billing.reservations.finalized'
  | 'billing.reservations.released'
  | 'billing.reservations.needs_reconciliation'
  | 'billing.reconciliation.auto_finalized'
  | 'billing.reconciliation.auto_released'
  | 'billing.reconciliation.manual_review'
  | 'exports.started'
  | 'exports.completed'
  | 'exports.failed'
  | 'architecture.file.locked_preview_responses'
  | 'architecture.file.artifact_available_responses'
  | 'architecture.compare.locked_responses'
  | 'architecture.versions.locked_responses'
  | 'architecture.smart_generation.replay_locked_after_upgrade'
  | 'architecture.generate_file.source_mismatch'
  | 'architecture.generate_file.precondition_failed'
  | 'architecture.generate_file.latest_version_missing'

export function recordMetricCounter(
  metric: MetricCounterEventName,
  fields: Record<string, unknown> = {},
): void {
  logInfo('metric.counter', {
    metric,
    value: 1,
    ...fields,
  })
}
