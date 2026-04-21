import type { NextRequest } from 'next/server'

import type { GeneratedOutput, ResumeTarget, Session } from '@/types/agent'
import type { JobStatusSnapshot } from '@/types/jobs'
import type { PreviewLockSummary } from '@/types/dashboard'
import type { RouteHttpResponse } from '@/lib/routes/shared/types'

export type FileAccessContext = {
  request: NextRequest
  requestStartedAt: number
  requestPath: string
  params: { sessionId: string }
  targetId: string | null
  appUser: NonNullable<Awaited<ReturnType<typeof import('@/lib/auth/app-user').getCurrentAppUser>>>
  session: Session
  target: ResumeTarget | null
  artifactMetadata: GeneratedOutput
  latestArtifactJob: JobStatusSnapshot | null
}

export type FileAccessContextResult =
  | { kind: 'allow'; context: FileAccessContext }
  | { kind: 'blocked'; response: RouteHttpResponse }

export type FileAccessResponseBody = {
  docxUrl: null
  available: boolean
  pdfFileName?: string | null
  pdfUrl?: string | null
  generationStatus: GeneratedOutput['status']
  jobId?: string
  stage?: string
  progress?: JobStatusSnapshot['progress']
  errorMessage?: string
  previewLock?: PreviewLockSummary
  reconciliation?: {
    required: true
    status: 'pending'
    reason?: string
  }
}

export type FileAccessDecisionLog = {
  generationStatus: GeneratedOutput['status']
  lifecycleStatus: JobStatusSnapshot['status'] | null
  jobId?: string
  stage?: string
}

export type FileAccessDecision =
  | {
      kind: 'artifact_unavailable'
      body: FileAccessResponseBody
      log: FileAccessDecisionLog
    }
  | {
      kind: 'locked_preview'
      body: FileAccessResponseBody
      log: FileAccessDecisionLog
    }
  | {
      kind: 'artifact_available'
      pdfPath: string
      body: FileAccessResponseBody
      log: FileAccessDecisionLog
    }
