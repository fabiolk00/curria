import { listRecentResumeGenerationsForUser } from '@/lib/db/resume-generations'
import { buildResumeComparisonPath } from '@/lib/routes/app'
import type { ResumeGeneration, ResumeGenerationHistoryKind } from '@/types/agent'

import {
  MAX_RESUME_HISTORY_ITEMS,
  RESUME_HISTORY_PAGE_SIZE,
  mapResumeGenerationStatusToHistoryStatus,
  type ListResumeGenerationHistoryInput,
  type ListResumeGenerationHistoryResult,
  type ResumeGenerationHistoryContext,
  type ResumeGenerationHistoryMetadata,
  type ResumeGenerationHistoryResponse,
} from './resume-generation-history.types'

const MAX_TARGET_JOB_SNIPPET_LENGTH = 160

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? '').replace(/<[^>]*>/g, ' ')
}

function sanitizeTargetRole(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value)

  if (!normalized || /^(vaga alvo|target role)$/i.test(normalized)) {
    return null
  }

  return normalized
}

export function sanitizeTargetJobSnippet(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(stripHtml(value))

  if (!normalized) {
    return null
  }

  if (normalized.length <= MAX_TARGET_JOB_SNIPPET_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_TARGET_JOB_SNIPPET_LENGTH - 3).trimEnd()}...`
}

function resolveHistoryKind(
  context: ResumeGenerationHistoryContext,
): ResumeGenerationHistoryKind {
  const idempotencyKey = context.idempotencyKey?.trim().toLowerCase()

  if (idempotencyKey?.includes(':chat:')) {
    return 'chat'
  }

  if (idempotencyKey?.startsWith('profile-target:')) {
    return 'target_job'
  }

  if (
    context.resumeTargetId
    || context.generationType === 'JOB_TARGETING'
    || context.workflowMode === 'job_targeting'
    || context.lastRewriteMode === 'job_targeting'
  ) {
    return 'target_job'
  }

  return 'ats_enhancement'
}

export function buildResumeGenerationHistoryMetadata(
  context: ResumeGenerationHistoryContext,
): ResumeGenerationHistoryMetadata {
  const historyKind = resolveHistoryKind(context)
  const targetRole = sanitizeTargetRole(context.targetRole)
  const targetJobSnippet = sanitizeTargetJobSnippet(context.targetJobDescription)

  switch (historyKind) {
    case 'chat':
      return {
        historyKind,
        historyTitle: 'Currículo gerado no chat',
        historyDescription: 'Versão criada a partir da conversa com a IA.',
        targetRole,
        targetJobSnippet,
      }
    case 'target_job':
      return {
        historyKind,
        historyTitle: targetRole
          ? `Currículo para ${targetRole}`
          : 'Currículo adaptado para vaga',
        historyDescription: targetJobSnippet
          ? `Adaptado para vaga: "${targetJobSnippet}"`
          : 'Versão adaptada com base na descrição da vaga informada.',
        targetRole,
        targetJobSnippet,
      }
    default:
      return {
        historyKind,
        historyTitle: 'Currículo ATS otimizado',
        historyDescription: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
        targetRole: null,
        targetJobSnippet: null,
      }
  }
}

function resolvePersistedHistoryKind(
  generation: ResumeGeneration,
): ResumeGenerationHistoryKind | null {
  if (
    generation.historyKind === 'chat'
    || generation.historyKind === 'ats_enhancement'
    || generation.historyKind === 'target_job'
  ) {
    return generation.historyKind
  }

  return null
}

function resolveGenerationHistoryMetadata(
  generation: ResumeGeneration,
): ResumeGenerationHistoryMetadata {
  const fallback = buildResumeGenerationHistoryMetadata({
    idempotencyKey: generation.idempotencyKey,
    resumeTargetId: generation.resumeTargetId,
    generationType: generation.type,
    targetJobDescription: generation.targetJobSnippet,
    targetRole: generation.targetRole,
  })

  return {
    historyKind: resolvePersistedHistoryKind(generation) ?? fallback.historyKind,
    historyTitle: normalizeWhitespace(generation.historyTitle) || fallback.historyTitle,
    historyDescription: normalizeWhitespace(generation.historyDescription)
      || fallback.historyDescription,
    targetRole: sanitizeTargetRole(generation.targetRole) ?? fallback.targetRole,
    targetJobSnippet: sanitizeTargetJobSnippet(generation.targetJobSnippet) ?? fallback.targetJobSnippet,
  }
}

function formatRelativeCreatedAt(date: Date): string {
  const differenceInMs = Date.now() - date.getTime()
  const differenceInMinutes = Math.floor(differenceInMs / 60_000)
  const differenceInHours = Math.floor(differenceInMs / 3_600_000)
  const differenceInDays = Math.floor(differenceInMs / 86_400_000)
  const differenceInWeeks = Math.floor(differenceInDays / 7)
  const differenceInMonths = Math.floor(differenceInDays / 30)
  const differenceInYears = Math.floor(differenceInDays / 365)

  if (differenceInMinutes < 1) {
    return 'agora mesmo'
  }

  if (differenceInMinutes < 60) {
    return `há ${differenceInMinutes} min`
  }

  if (differenceInHours < 24) {
    return `há ${differenceInHours} h`
  }

  if (differenceInDays < 7) {
    return `há ${differenceInDays} dia${differenceInDays === 1 ? '' : 's'}`
  }

  if (differenceInWeeks < 5) {
    return `há ${differenceInWeeks} semana${differenceInWeeks === 1 ? '' : 's'}`
  }

  if (differenceInMonths < 12) {
    return differenceInMonths === 1 ? 'há 1 mês' : `há ${differenceInMonths} meses`
  }

  return `há ${differenceInYears} ano${differenceInYears === 1 ? '' : 's'}`
}

function buildPdfDownloadUrl(sessionId: string, resumeTargetId?: string): string {
  const searchParams = new URLSearchParams({
    download: 'pdf',
  })

  if (resumeTargetId) {
    searchParams.set('targetId', resumeTargetId)
  }

  return `/api/file/${encodeURIComponent(sessionId)}?${searchParams.toString()}`
}

function mapGenerationToHistoryItem(
  generation: ResumeGeneration,
): ResumeGenerationHistoryResponse['items'][number] {
  const metadata = resolveGenerationHistoryMetadata(generation)
  const sessionId = generation.sessionId ?? null
  const referenceDate = generation.completedAt ?? generation.createdAt
  const pdfAvailable = Boolean(sessionId && generation.outputPdfPath)
  const docxAvailable = Boolean(sessionId && generation.outputDocxPath)

  return {
    id: generation.id,
    sessionId,
    kind: metadata.historyKind,
    status: mapResumeGenerationStatusToHistoryStatus(generation.status),
    title: metadata.historyTitle,
    description: metadata.historyDescription,
    targetRole: metadata.targetRole,
    targetJobSnippet: metadata.targetJobSnippet,
    createdAt: generation.createdAt.toISOString(),
    completedAt: generation.completedAt?.toISOString() ?? null,
    relativeCreatedAt: formatRelativeCreatedAt(referenceDate),
    pdfAvailable,
    docxAvailable,
    downloadPdfUrl: pdfAvailable
      ? buildPdfDownloadUrl(sessionId!, generation.resumeTargetId)
      : null,
    downloadDocxUrl: null,
    viewerUrl: sessionId ? buildResumeComparisonPath(sessionId) : null,
  }
}

function clampPage(page: number | undefined, totalPages: number): number {
  const normalized = Number.isFinite(page) ? Math.max(1, Math.trunc(page ?? 1)) : 1

  if (totalPages === 0) {
    return 1
  }

  return Math.min(normalized, totalPages)
}

export async function listResumeGenerationHistory(
  input: ListResumeGenerationHistoryInput,
): Promise<ListResumeGenerationHistoryResult> {
  const limit = Math.min(
    Math.max(Math.trunc(input.limit ?? RESUME_HISTORY_PAGE_SIZE), 1),
    RESUME_HISTORY_PAGE_SIZE,
  )
  const recentGenerations = await listRecentResumeGenerationsForUser(
    input.userId,
    MAX_RESUME_HISTORY_ITEMS,
  )

  const sortedGenerations = [...recentGenerations].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
  const boundedGenerations = sortedGenerations.slice(0, MAX_RESUME_HISTORY_ITEMS)
  const totalItems = boundedGenerations.length
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit)
  const page = clampPage(input.page, totalPages)
  const startIndex = totalPages === 0 ? 0 : (page - 1) * limit
  const items = boundedGenerations
    .slice(startIndex, startIndex + limit)
    .map((generation) => mapGenerationToHistoryItem(generation))

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: totalPages > 0 && page < totalPages,
      hasPreviousPage: totalPages > 0 && page > 1,
    },
  }
}
