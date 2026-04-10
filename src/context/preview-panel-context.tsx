'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type PreviewFile = {
  sessionId: string
  targetId: string | null
  type: 'pdf' | 'docx'
  label: string
}

type CacheEntry = {
  pdfUrl: string
  fetchedAt: number
}

type PreviewPanelContextValue = {
  isOpen: boolean
  file: PreviewFile | null
  open: (file: PreviewFile) => void
  close: () => void
  getCachedUrl: (key: string) => string | null
  setCachedUrl: (key: string, url: string) => void
  invalidateCache: (key: string) => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

const CACHE_TTL_MS = 50 * 60 * 1000

function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<PreviewFile | null>(null)
  const urlCache = useRef<Map<string, CacheEntry>>(new Map())

  const open = useCallback((nextFile: PreviewFile) => {
    setFile(nextFile)
  }, [])

  const close = useCallback(() => {
    setFile(null)
  }, [])

  const getCachedUrl = useCallback((key: string): string | null => {
    const entry = urlCache.current.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      revokeObjectUrl(entry.pdfUrl)
      urlCache.current.delete(key)
      return null
    }

    return entry.pdfUrl
  }, [])

  const setCachedUrl = useCallback((key: string, url: string) => {
    const previousEntry = urlCache.current.get(key)
    if (previousEntry && previousEntry.pdfUrl !== url) {
      revokeObjectUrl(previousEntry.pdfUrl)
    }

    urlCache.current.set(key, {
      pdfUrl: url,
      fetchedAt: Date.now(),
    })
  }, [])

  const invalidateCache = useCallback((key: string) => {
    const entry = urlCache.current.get(key)
    if (entry) {
      revokeObjectUrl(entry.pdfUrl)
    }
    urlCache.current.delete(key)
  }, [])

  return (
    <PreviewPanelContext.Provider
      value={{
        isOpen: file !== null,
        file,
        open,
        close,
        getCachedUrl,
        setCachedUrl,
        invalidateCache,
      }}
    >
      {children}
    </PreviewPanelContext.Provider>
  )
}

export function usePreviewPanel(): PreviewPanelContextValue {
  const context = useContext(PreviewPanelContext)

  if (!context) {
    throw new Error('usePreviewPanel must be used within PreviewPanelProvider')
  }

  return context
}
