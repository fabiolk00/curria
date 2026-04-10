'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronRight, ExternalLink, FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { usePreviewPanel } from '@/context/preview-panel-context'
import { cn } from '@/lib/utils'

import { useSessionDocuments } from '@/hooks/use-session-documents'
import { NEW_CONVERSATION_EVENT, SESSION_SYNC_EVENT, type SessionSyncDetail } from './events'

type SectionKey = 'files'

async function triggerDownload(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function DocumentSection({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  icon: typeof FileText
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pl-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function DownloadItem({
  label,
  downloadUrl,
  onPreviewClick,
  isActive = false,
}: {
  label: string
  downloadUrl: string
  onPreviewClick?: () => void
  isActive?: boolean
}) {
  const [isBusy, setIsBusy] = useState(false)

  const handleClick = async () => {
    if (onPreviewClick) {
      onPreviewClick()
      return
    }

    setIsBusy(true)
    await triggerDownload(downloadUrl, label)
    setIsBusy(false)
  }

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => void handleClick()}
      data-testid="document-item-pdf"
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50',
        isActive
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Badge variant="secondary" className="rounded-sm px-1.5 py-0 font-mono text-[10px]">
        PDF
      </Badge>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate">{label}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

export function SessionDocumentsPanel({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const searchParams = useSearchParams()
  const [sessionId, setSessionId] = useState<string | null>(() => searchParams.get('session'))
  const { file: previewFile, open } = usePreviewPanel()
  const { files, isLoading, error, refresh } = useSessionDocuments(sessionId)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    files: true,
  })

  useEffect(() => {
    setSessionId(searchParams.get('session'))
  }, [searchParams])

  useEffect(() => {
    const handleSessionSync = (event: Event) => {
      const detail = (event as CustomEvent<SessionSyncDetail>).detail
      setSessionId(detail?.sessionId ?? null)
    }

    const handleNewConversation = () => {
      setSessionId(null)
    }

    window.addEventListener(SESSION_SYNC_EVENT, handleSessionSync as EventListener)
    window.addEventListener(NEW_CONVERSATION_EVENT, handleNewConversation)

    return () => {
      window.removeEventListener(SESSION_SYNC_EVENT, handleSessionSync as EventListener)
      window.removeEventListener(NEW_CONVERSATION_EVENT, handleNewConversation)
    }
  }, [])

  const hasFiles = Boolean(files.pdfUrl)
  const isBasePdfActive =
    previewFile?.sessionId === sessionId
    && previewFile?.targetId === null
    && previewFile?.type === 'pdf'

  const documentGroups = useMemo(() => ({ hasFiles }), [hasFiles])
  const panelState = isLoading ? 'loading' : error ? 'error' : documentGroups.hasFiles ? 'ready' : 'empty'

  if (!isSidebarOpen || !sessionId) {
    return null
  }

  if (!documentGroups.hasFiles && !isLoading && !error) {
    return null
  }

  const toggleSection = (section: SectionKey) => {
    setOpenSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }))
  }

  return (
    <div
      data-testid="session-documents-panel"
      data-pdf-available={String(Boolean(files.pdfUrl))}
      data-state={panelState}
      className="mt-3 border-t border-border/60 pt-3"
    >
      <div className="px-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Documents
        </p>
      </div>

      {isLoading ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Carregando documentos...</p>
      ) : null}

      {error ? (
        <div className="space-y-2 px-2 py-1">
          <p className="text-xs text-destructive">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {documentGroups.hasFiles ? (
        <DocumentSection
          label="Files"
          icon={FileText}
          isOpen={openSections.files}
          onToggle={() => toggleSection('files')}
        >
          {files.pdfUrl ? (
            <DownloadItem
              label="Resume.pdf"
              downloadUrl={files.pdfUrl}
              isActive={isBasePdfActive}
              onPreviewClick={() => {
                open({
                  sessionId,
                  targetId: null,
                  type: 'pdf',
                  label: 'Resume',
                })
              }}
            />
          ) : null}
        </DocumentSection>
      ) : null}
    </div>
  )
}
