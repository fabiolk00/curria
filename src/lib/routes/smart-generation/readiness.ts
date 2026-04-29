import { checkUserQuota } from '@/lib/db/sessions'
import {
  assessAtsEnhancementReadiness,
  getAtsEnhancementBlockingItems,
} from '@/lib/profile/ats-enhancement'

import type { SmartGenerationContext, SmartGenerationDecision } from './types'
import { buildGenerationCopy, resolveWorkflowMode } from './workflow-mode'

export function evaluateSmartGenerationResumeReadiness(
  context: SmartGenerationContext,
): Extract<SmartGenerationDecision, { kind: 'validation_error' }> | null {
  const copy = buildGenerationCopy(resolveWorkflowMode(context.targetJobDescription))
  const readiness = assessAtsEnhancementReadiness(context.cvState)
  const missingItems = getAtsEnhancementBlockingItems(context.cvState)
  if (!readiness.isReady || missingItems.length > 0) {
    return {
      kind: 'validation_error',
      status: 400,
      body: {
        error: copy.incompleteError,
        reasons: missingItems.length > 0 ? missingItems : readiness.reasons,
        missingItems,
      },
    }
  }

  return null
}

export async function evaluateSmartGenerationQuotaReadiness(
  context: SmartGenerationContext,
): Promise<Extract<SmartGenerationDecision, { kind: 'validation_error' }> | null> {
  const copy = buildGenerationCopy(resolveWorkflowMode(context.targetJobDescription))
  const hasCredits = await checkUserQuota(context.appUser.id)
  if (!hasCredits) {
    return {
      kind: 'validation_error',
      status: 402,
      body: { error: copy.creditsError },
    }
  }

  return null
}

export async function evaluateSmartGenerationReadiness(
  context: SmartGenerationContext,
): Promise<Extract<SmartGenerationDecision, { kind: 'validation_error' }> | null> {
  return evaluateSmartGenerationResumeReadiness(context)
    ?? await evaluateSmartGenerationQuotaReadiness(context)
}
