import type { NextRequest } from 'next/server'

import type { Session } from '@/types/agent'
import type { CVState } from '@/types/cv'
import type { PreviewLockSummary } from '@/types/dashboard'
import type { RouteHttpResponse } from '@/lib/routes/shared/types'
import type { SmartGenerationCopy, SmartGenerationWorkflowMode } from './workflow-mode'

export type SmartGenerationRequestBody = CVState & {
  targetJobDescription?: string
}

export type SmartGenerationContext = {
  request: NextRequest
  appUser: NonNullable<Awaited<ReturnType<typeof import('@/lib/auth/app-user').getCurrentAppUser>>>
  cvState: CVState
  targetJobDescription?: string
}

export type SmartGenerationContextResult =
  | { kind: 'allow'; context: SmartGenerationContext }
  | { kind: 'blocked'; response: RouteHttpResponse }

export type SmartGenerationDecision =
  | {
      kind: 'validation_error'
      status: number
      body: {
        error?: string
        code?: string
        reasons?: string[]
        missingItems?: string[]
        sessionId?: string
        workflowMode?: SmartGenerationWorkflowMode
        rewriteValidation?: Record<string, unknown>
        targetRole?: string
        targetRoleConfidence?: string | number
      }
    }
  | {
      kind: 'success'
      body: {
        success: true
        sessionId: string
        creditsUsed?: number
        resumeGenerationId?: string
        generationType?: 'JOB_TARGETING' | 'ATS_ENHANCEMENT'
        originalCvState?: CVState
        optimizedCvState?: CVState
        previewLock?: PreviewLockSummary
        warnings?: string[]
      }
    }

export type PatchedSmartGenerationSession = Session

export type SmartGenerationWorkflowState = {
  workflowMode: SmartGenerationWorkflowMode
  copy: SmartGenerationCopy
  session: Awaited<ReturnType<typeof import('@/lib/db/sessions').createSession>>
  patchedSession: PatchedSmartGenerationSession
}

export type SmartGenerationPipelineResult = Awaited<
  ReturnType<typeof import('@/lib/agent/job-targeting-pipeline').runJobTargetingPipeline>
> | Awaited<ReturnType<typeof import('@/lib/agent/ats-enhancement-pipeline').runAtsEnhancementPipeline>>
