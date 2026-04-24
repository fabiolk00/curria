import type {
  ResumeGenerationHistoryKind,
  ResumeGenerationStatus,
  ResumeGenerationType,
  WorkflowMode,
} from '@/types/agent'

export const MAX_RESUME_HISTORY_ITEMS = 6
export const RESUME_HISTORY_PAGE_SIZE = 4

export type ResumeGenerationHistoryStatus = 'completed' | 'processing' | 'failed'

export type ResumeGenerationHistoryContext = {
  idempotencyKey?: string | null
  resumeTargetId?: string | null
  generationType?: ResumeGenerationType | null
  workflowMode?: WorkflowMode | null
  lastRewriteMode?: Extract<WorkflowMode, 'ats_enhancement' | 'job_targeting'> | null
  targetJobDescription?: string | null
  targetRole?: string | null
}

export type ResumeGenerationHistoryMetadata = {
  historyKind: ResumeGenerationHistoryKind
  historyTitle: string
  historyDescription: string | null
  targetRole: string | null
  targetJobSnippet: string | null
}

export type ResumeGenerationHistoryItem = {
  id: string
  sessionId: string | null
  kind: ResumeGenerationHistoryKind
  status: ResumeGenerationHistoryStatus
  title: string
  description: string | null
  targetRole: string | null
  targetJobSnippet: string | null
  createdAt: string
  completedAt: string | null
  relativeCreatedAt: string
  pdfAvailable: boolean
  docxAvailable: boolean
  downloadPdfUrl: string | null
  downloadDocxUrl: string | null
  viewerUrl: string | null
}

export type ResumeGenerationHistoryResponse = {
  items: ResumeGenerationHistoryItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export type ListResumeGenerationHistoryInput = {
  userId: string
  page?: number
  limit?: number
}

export type ListResumeGenerationHistoryResult = ResumeGenerationHistoryResponse

export function mapResumeGenerationStatusToHistoryStatus(
  status: ResumeGenerationStatus,
): ResumeGenerationHistoryStatus {
  switch (status) {
    case 'pending':
      return 'processing'
    case 'failed':
      return 'failed'
    default:
      return 'completed'
  }
}
