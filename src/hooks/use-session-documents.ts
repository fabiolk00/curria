'use client'

import { useCallback, useEffect, useState } from 'react'

import { getDownloadUrls } from '@/lib/dashboard/workspace-client'
import type { ArtifactStatusSummary } from '@/types/dashboard'

type SessionFiles = {
  docxUrl: string | null
  pdfUrl: string | null
  pdfFileName?: string | null
}

type SessionDocuments = {
  files: SessionFiles
  artifactStatus: ArtifactStatusSummary
  isLoading: boolean
  error: string | null
  refresh: () => void
}

const EMPTY_ARTIFACT_STATUS: ArtifactStatusSummary = {
  generationStatus: 'idle',
}

function getDocumentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Generated resume artifacts could not be retrieved.') {
      return 'Não foi possível carregar seus arquivos agora. Tente novamente em instantes.'
    }

    return error.message
  }

  return 'Não foi possível carregar os documentos da sessão.'
}

export function useSessionDocuments(sessionId: string | null): SessionDocuments {
  const [files, setFiles] = useState<SessionFiles>({
    docxUrl: null,
    pdfUrl: null,
    pdfFileName: null,
  })
  const [artifactStatus, setArtifactStatus] = useState<ArtifactStatusSummary>(EMPTY_ARTIFACT_STATUS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setRefreshTick((previous) => previous + 1)
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setFiles({ docxUrl: null, pdfUrl: null, pdfFileName: null })
      setArtifactStatus(EMPTY_ARTIFACT_STATUS)
      setError(null)
      setIsLoading(false)
      return
    }

    let isCancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nextFiles = await getDownloadUrls(sessionId)

        if (isCancelled) {
          return
        }

        setFiles({
          docxUrl: null,
          pdfUrl: nextFiles.pdfUrl ?? null,
          pdfFileName: nextFiles.pdfFileName ?? null,
        })
        setArtifactStatus({
          generationStatus: nextFiles.generationStatus,
          jobId: nextFiles.jobId,
          stage: nextFiles.stage,
          progress: nextFiles.progress,
          errorMessage: nextFiles.errorMessage,
          previewLock: nextFiles.previewLock,
          reconciliation: nextFiles.reconciliation,
        })
      } catch (fetchError) {
        if (!isCancelled) {
          setError(getDocumentErrorMessage(fetchError))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [refreshTick, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    const interval = window.setInterval(refresh, 10_000)
    return () => window.clearInterval(interval)
  }, [refresh, sessionId])

  return { files, artifactStatus, isLoading, error, refresh }
}
