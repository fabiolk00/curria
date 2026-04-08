'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Download, ExternalLink, Loader2, X } from 'lucide-react'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { getDownloadUrls } from '@/lib/dashboard/workspace-client'
import { usePreviewPanel } from '@/context/preview-panel-context'
import { usePreviewPanelOverlay } from '@/hooks/use-preview-panel-overlay'

type PreviewPanelProps = {
  inline?: boolean
}

export function PreviewPanel({ inline = false }: PreviewPanelProps) {
  const { file, close } = usePreviewPanel()
  const isOverlay = usePreviewPanelOverlay()

  if (!file || file.type !== 'pdf') {
    return null
  }

  if (!inline && !isOverlay) {
    return null
  }

  const content = <PreviewPanelContent file={file} onClose={close} />

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
}: {
  file: NonNullable<ReturnType<typeof usePreviewPanel>['file']>
  onClose: () => void
}) {
  const { getCachedUrl, setCachedUrl } = usePreviewPanel()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheKey = `${file.sessionId}:${file.targetId ?? 'base'}`

  const fetchUrls = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setPreviewUrl(null)

    const cachedUrl = getCachedUrl(cacheKey)
    if (cachedUrl) {
      setPreviewUrl(cachedUrl)
      setIsLoading(false)
      return
    }

    try {
      const urls = await getDownloadUrls(file.sessionId, file.targetId ?? undefined)

      if (!urls.pdfUrl) {
        setError('Não foi possível carregar a pré-visualização do PDF.')
        return
      }

      setPreviewUrl(urls.pdfUrl)
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

  const handleDownload = () => {
    if (!previewUrl) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = previewUrl
    anchor.download = `${file.label}.pdf`
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.label}</p>
          <p className="text-xs text-muted-foreground">PDF</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {previewUrl && !error ? (
            <>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Baixar PDF"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Fechar pré-visualização"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

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
            src={previewUrl}
            className="h-full w-full border-0"
            title={`Pré-visualização: ${file.label}`}
          />
        ) : null}
      </div>
    </div>
  )
}
