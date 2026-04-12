'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Download, ExternalLink, Loader2, Pencil, X } from 'lucide-react'

import type { PreviewFile } from '@/context/preview-panel-context'
import { usePreviewPanel } from '@/context/preview-panel-context'
import { usePreviewPanelOverlay } from '@/hooks/use-preview-panel-overlay'
import { getDownloadUrls } from '@/lib/dashboard/workspace-client'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import { ResumeEditorModal } from './resume-editor-modal'

type PreviewPanelProps = {
  inline?: boolean
  fileOverride?: PreviewFile | null
  showCloseButton?: boolean
}

export function PreviewPanel({
  inline = false,
  fileOverride = null,
  showCloseButton = true,
}: PreviewPanelProps) {
  const { file, close } = usePreviewPanel()
  const isOverlay = usePreviewPanelOverlay()
  const activeFile = fileOverride ?? file

  if (!activeFile || activeFile.type !== 'pdf') {
    return null
  }

  if (!inline && !isOverlay) {
    return null
  }

  const content = (
    <PreviewPanelContent
      file={activeFile}
      onClose={close}
      showCloseButton={showCloseButton}
    />
  )

  if (inline) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="h-full"
      >
        {content}
      </motion.div>
    )
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-full">
        {content}
      </SheetContent>
    </Sheet>
  )
}

function PreviewPanelContent({
  file,
  onClose,
  showCloseButton,
}: {
  file: PreviewFile
  onClose: () => void
  showCloseButton: boolean
}) {
  const { getCachedUrl, invalidateCache, setCachedUrl } = usePreviewPanel()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [externalUrl, setExternalUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const cacheKey = `${file.sessionId}:${file.targetId ?? 'base'}`

  const fetchUrls = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setPreviewUrl(null)
    setExternalUrl(null)

    const cachedUrl = getCachedUrl(cacheKey)
    if (cachedUrl) {
      setPreviewUrl(cachedUrl)
      setExternalUrl(cachedUrl)
      setIsLoading(false)
      return
    }

    try {
      const urls = await getDownloadUrls(file.sessionId, file.targetId ?? undefined)

      if (!urls.pdfUrl) {
        setError('Nao foi possivel carregar a pre-visualizacao do PDF.')
        return
      }

      setPreviewUrl(urls.pdfUrl)
      setExternalUrl(urls.pdfUrl)
      setCachedUrl(cacheKey, urls.pdfUrl)
    } catch (fetchError) {
      console.error('[preview-panel] failed to load signed urls', fetchError)
      setError('Falha ao carregar o arquivo. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey, file.sessionId, file.targetId, getCachedUrl, setCachedUrl])

  useEffect(() => {
    void fetchUrls()
  }, [fetchUrls])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleDownload = async () => {
    if (!previewUrl) {
      return
    }

    try {
      setIsDownloading(true)
      setDownloadError(null)

      const response = await fetch(previewUrl)
      if (!response.ok) {
        throw new Error(`Failed to download preview PDF (${response.status})`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${file.label}.pdf`
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (downloadFailure) {
      console.error('[preview-panel] failed to download pdf', downloadFailure)
      setDownloadError('Falha ao baixar o PDF. Tente novamente.')
    } finally {
      setIsDownloading(false)
    }
  }

  const previewState = isLoading ? 'loading' : error ? 'error' : previewUrl ? 'ready' : 'idle'

  return (
    <div
      data-testid="preview-panel"
      data-preview-url={previewUrl ?? ''}
      data-session-id={file.sessionId}
      data-state={previewState}
      className="flex h-full flex-col bg-background"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.label}</p>
          <p className="text-xs text-muted-foreground">PDF</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {previewUrl && !error ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                data-testid="preview-edit-button"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Edit resume"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => void handleDownload()}
                data-testid="preview-download-pdf"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                title="Baixar PDF"
              >
                {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Download</span>
              </button>
              <a
                href={externalUrl ?? previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="preview-open-external"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : null}

          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Fechar pre-visualizacao"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {downloadError ? (
        <div className="border-b border-border bg-destructive/5 px-4 py-2">
          <p className="text-xs text-destructive">{downloadError}</p>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden bg-muted/30">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {error && !isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void fetchUrls()}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {previewUrl && !isLoading ? (
          <iframe
            data-testid="preview-panel-frame"
            src={previewUrl}
            className="h-full w-full border-0"
            title={`Pre-visualizacao: ${file.label}`}
          />
        ) : null}
      </div>

      <ResumeEditorModal
        sessionId={file.sessionId}
        targetId={file.targetId}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSaved={() => {
          invalidateCache(cacheKey)
          void fetchUrls()
        }}
      />
    </div>
  )
}
