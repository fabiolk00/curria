"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import type {
  GeneratedResumeHistoryItem,
  GeneratedResumeHistoryResponse,
} from "@/lib/generated-resume-types"
import { getResumeGenerationHistory } from "@/lib/dashboard/workspace-client"
import {
  LEGACY_PROFILE_SETUP_ALIAS_PATH,
  PROFILE_SETUP_PATH,
  buildResumeComparisonPath,
} from "@/lib/routes/app"

import { GeneratedResumeHistory } from "./generated-resume-history"

const defaultHistoryResponse: GeneratedResumeHistoryResponse = {
  items: [],
  pagination: {
    page: 1,
    limit: 4,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Tente novamente em instantes."
}

export function GeneratedResumeHistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<GeneratedResumeHistoryResponse>(defaultHistoryResponse)
  const [currentPage, setCurrentPage] = useState(1)
  const [requestVersion, setRequestVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const nextHistory = await getResumeGenerationHistory(currentPage, 4)

        if (isCancelled) {
          return
        }

        setHistory(nextHistory)

        if (nextHistory.pagination.page !== currentPage) {
          setCurrentPage(nextHistory.pagination.page)
        }
      } catch (nextError) {
        if (isCancelled) {
          return
        }

        setError(getErrorMessage(nextError))
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isCancelled = true
    }
  }, [currentPage, requestVersion])

  function handleRetry() {
    setRequestVersion((version) => version + 1)
  }

  function handleDownloadPdf(item: GeneratedResumeHistoryItem) {
    if (!item.downloadPdfUrl) {
      return
    }

    window.open(item.downloadPdfUrl, "_blank", "noopener,noreferrer")
  }

  function handleOpen(item: GeneratedResumeHistoryItem) {
    const destination = item.viewerUrl
      ?? (item.sessionId ? buildResumeComparisonPath(item.sessionId) : null)

    if (!destination) {
      return
    }

    router.push(destination)
  }

  function handlePageChange(page: number) {
    if (page < 1 || page === currentPage) {
      return
    }

    setCurrentPage(page)
  }

  return (
    <GeneratedResumeHistory
      items={history.items}
      pagination={history.pagination}
      isLoading={isLoading}
      error={error}
      onBack={() => router.push(PROFILE_SETUP_PATH)}
      onRetry={handleRetry}
      onPageChange={handlePageChange}
      onStartResume={() => router.push(LEGACY_PROFILE_SETUP_ALIAS_PATH)}
      onDownloadPdf={handleDownloadPdf}
      onOpen={handleOpen}
    />
  )
}
