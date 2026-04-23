import {
  buildExperienceBulletHighlightItemIds,
  createSummaryHighlightItemId,
  getHighlightRangesForItem,
  segmentTextByHighlightRanges,
  type CvHighlightState,
  type CvResolvedHighlight,
} from '@/lib/resume/cv-highlight-artifact'
import type { CVState } from '@/types/cv'

export type HighlightStateOmittedReason =
  | 'preview_locked'
  | 'artifact_missing'
  | 'not_applicable'

export type HighlightStateResponseKind =
  | 'omitted_preview_locked'
  | 'omitted_artifact_missing'
  | 'present_empty'
  | 'present_non_empty'
  | 'present_non_renderable'

export function countResolvedHighlights(
  resolvedHighlights?: CvResolvedHighlight[] | null,
): {
  resolvedItemCount: number
  resolvedRangeCount: number
} {
  const highlights = resolvedHighlights ?? []

  return {
    resolvedItemCount: highlights.length,
    resolvedRangeCount: highlights.reduce((total, highlight) => total + highlight.ranges.length, 0),
  }
}

export function summarizeHighlightState(
  highlightState?: CvHighlightState | null,
): {
  highlightStatePresent: boolean
  highlightStateResolvedItemCount: number
  highlightStateResolvedRangeCount: number
} {
  const counts = countResolvedHighlights(highlightState?.resolvedHighlights)

  return {
    highlightStatePresent: Boolean(highlightState),
    highlightStateResolvedItemCount: counts.resolvedItemCount,
    highlightStateResolvedRangeCount: counts.resolvedRangeCount,
  }
}

function countRenderableHighlights(
  optimizedCvState?: CVState | null,
  highlightState?: CvHighlightState | null,
): {
  highlightStateVisibleItemCount: number
  highlightStateVisibleRangeCount: number
} {
  if (!optimizedCvState || !highlightState) {
    return {
      highlightStateVisibleItemCount: 0,
      highlightStateVisibleRangeCount: 0,
    }
  }

  let highlightStateVisibleItemCount = 0
  let highlightStateVisibleRangeCount = 0

  const summaryVisibleRangeCount = segmentTextByHighlightRanges(
    optimizedCvState.summary ?? '',
    getHighlightRangesForItem(highlightState.resolvedHighlights, createSummaryHighlightItemId()),
  ).filter((segment) => segment.highlighted).length

  if (summaryVisibleRangeCount > 0) {
    highlightStateVisibleItemCount += 1
    highlightStateVisibleRangeCount += summaryVisibleRangeCount
  }

  optimizedCvState.experience.forEach((entry) => {
    const bulletItemIds = buildExperienceBulletHighlightItemIds(entry)

    entry.bullets.forEach((bullet, bulletIndex) => {
      const visibleRangeCount = segmentTextByHighlightRanges(
        bullet,
        getHighlightRangesForItem(highlightState.resolvedHighlights, bulletItemIds[bulletIndex] ?? ''),
      ).filter((segment) => segment.highlighted).length

      if (visibleRangeCount > 0) {
        highlightStateVisibleItemCount += 1
        highlightStateVisibleRangeCount += visibleRangeCount
      }
    })
  })

  return {
    highlightStateVisibleItemCount,
    highlightStateVisibleRangeCount,
  }
}

export function buildHighlightStateResponseOutcome(params: {
  previewLocked: boolean
  highlightState?: CvHighlightState | null
  optimizedCvState?: CVState | null
}): {
  highlightStateResponseKind: HighlightStateResponseKind
  highlightStateAvailable: boolean
  highlightStateReturned: boolean
  highlightStateOmittedReason: HighlightStateOmittedReason
  highlightStateResolvedItemCount: number
  highlightStateResolvedRangeCount: number
  highlightStateVisibleItemCount: number
  highlightStateVisibleRangeCount: number
  highlightStateRendererMismatch: boolean
} {
  const summary = summarizeHighlightState(params.highlightState)
  const renderable = countRenderableHighlights(params.optimizedCvState, params.highlightState)

  if (params.previewLocked) {
    return {
      highlightStateResponseKind: 'omitted_preview_locked',
      highlightStateAvailable: summary.highlightStatePresent,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'preview_locked',
      highlightStateResolvedItemCount: summary.highlightStateResolvedItemCount,
      highlightStateResolvedRangeCount: summary.highlightStateResolvedRangeCount,
      highlightStateVisibleItemCount: 0,
      highlightStateVisibleRangeCount: 0,
      highlightStateRendererMismatch: false,
    }
  }

  if (!summary.highlightStatePresent) {
    return {
      highlightStateResponseKind: 'omitted_artifact_missing',
      highlightStateAvailable: false,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'artifact_missing',
      highlightStateResolvedItemCount: 0,
      highlightStateResolvedRangeCount: 0,
      highlightStateVisibleItemCount: 0,
      highlightStateVisibleRangeCount: 0,
      highlightStateRendererMismatch: false,
    }
  }

  const highlightStateRendererMismatch = summary.highlightStateResolvedRangeCount > 0
    && renderable.highlightStateVisibleRangeCount === 0
  const highlightStateResponseKind: HighlightStateResponseKind = summary.highlightStateResolvedRangeCount === 0
    ? 'present_empty'
    : highlightStateRendererMismatch
      ? 'present_non_renderable'
      : 'present_non_empty'

  return {
    highlightStateResponseKind,
    highlightStateAvailable: true,
    highlightStateReturned: true,
    highlightStateOmittedReason: 'not_applicable',
    highlightStateResolvedItemCount: summary.highlightStateResolvedItemCount,
    highlightStateResolvedRangeCount: summary.highlightStateResolvedRangeCount,
    highlightStateVisibleItemCount: renderable.highlightStateVisibleItemCount,
    highlightStateVisibleRangeCount: renderable.highlightStateVisibleRangeCount,
    highlightStateRendererMismatch,
  }
}
