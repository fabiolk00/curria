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
  | 'architecture.generate_resume.stage_failure.lookup_completed_generation'
  | 'architecture.generate_resume.stage_failure.lookup_idempotent_generation'
  | 'architecture.generate_resume.stage_failure.lookup_latest_version'
  | 'architecture.generate_resume.stage_failure.reuse_pending_generation'
  | 'architecture.generate_resume.stage_failure.create_pending_generation'
  | 'architecture.generate_resume.stage_failure.reserve_credit'
  | 'architecture.generate_resume.stage_failure.render_artifact'
  | 'architecture.generate_resume.stage_failure.finalize_credit'
  | 'architecture.generate_resume.stage_failure.release_credit'
  | 'architecture.generate_resume.stage_failure.persist_completed_generation'
  | 'architecture.generate_resume.stage_failure.persist_failed_generation'
  | 'architecture.generate_resume.stage_failure.reconciliation_marking'
  | 'architecture.ats_readiness.finalized'
  | 'architecture.ats_readiness.estimated_range'
  | 'architecture.ats_readiness.withheld'
  | 'architecture.ats_readiness.withheld_converted_to_range'
  | 'architecture.ats_readiness.v1_normalized_to_v2'
  | 'architecture.ats_readiness.floor_89_applied'
  | 'architecture.ats_readiness.low_confidence'
  | 'architecture.ats_readiness.raw_decreased_display_protected'
  | 'architecture.ats_readiness.comparison_rendered'
  | 'architecture.ats_readiness.legacy_fallback_used'
  | 'architecture.ats_readiness.compat_session_ats_score_emitted'
  | 'architecture.ats_readiness.compat_agent_done_chunk_ats_score_emitted'
  | 'architecture.ats_editorial.premium_bullets_detected'
  | 'architecture.ats_editorial.percent_premium_bullets_detected'
  | 'architecture.ats_editorial.metric_regression_detected'
  | 'architecture.ats_editorial.metric_regression_percent_lost'
  | 'architecture.ats_editorial.metric_regression_scope_lost'
  | 'architecture.ats_editorial.smart_repair_used'
  | 'architecture.ats_editorial.conservative_fallback_used'
  | 'architecture.ats_editorial.revert_used'
  | 'architecture.ats_editorial.metric_preservation_full'
  | 'architecture.ats_editorial.metric_preservation_partial'
  | 'architecture.ats_editorial.metric_preservation_regressed'
  | 'architecture.highlight_detection.invalid_payload'

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
