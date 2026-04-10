'use client'

import { useCallback, useEffect, useState } from 'react'

import { getDownloadUrls } from '@/lib/dashboard/workspace-client'

type SessionFiles = {
  docxUrl: string | null
  pdfUrl: string | null
}

type SessionDocuments = {
  files: SessionFiles
  isLoading: boolean
  error: string | null
  refresh: () => void
}

function getDocumentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Generated resume artifacts could not be retrieved.') {
      return 'Nao foi possivel carregar seus arquivos agora. Tente novamente em instantes.'
    }

    return error.message
  }

  return 'Nao foi possivel carregar os documentos da sessao.'
}

export function useSessionDocuments(sessionId: string | null): SessionDocuments {
  const [files, setFiles] = useState<SessionFiles>({ docxUrl: null, pdfUrl: null })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setRefreshTick((previous) => previous + 1)
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setFiles({ docxUrl: null, pdfUrl: null })
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

  return { files, isLoading, error, refresh }
}
