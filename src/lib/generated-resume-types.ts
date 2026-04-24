import type {
  ResumeGenerationHistoryItem,
  ResumeGenerationHistoryResponse,
} from '@/lib/resume-history/resume-generation-history.types'

export type GeneratedResumeMode = ResumeGenerationHistoryItem['kind']
export type GeneratedResumeStatus = ResumeGenerationHistoryItem['status']
export type GeneratedResumeHistoryItem = ResumeGenerationHistoryItem
export type GeneratedResumeHistoryResponse = ResumeGenerationHistoryResponse
