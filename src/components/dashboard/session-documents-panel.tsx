'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Target,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePreviewPanel } from '@/context/preview-panel-context'
import { getDownloadUrls } from '@/lib/dashboard/workspace-client'
import { cn } from '@/lib/utils'
import type { SerializedResumeTarget, SerializedTimelineEntry } from '@/types/dashboard'

import { useSessionDocuments } from '@/hooks/use-session-documents'

import { VersionPreviewSheet } from './version-preview-sheet'

type SectionKey = 'files' | 'versions' | 'targets'

function formatRelativeDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}

function createTargetLabel(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length <= 44) {
    return trimmed
  }

  return `${trimmed.slice(0, 44).trimEnd()}...`
}

async function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
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
  badge,
  dateLabel,
  downloadUrl,
  onPreviewClick,
  isActive = false,
}: {
  label: string
  badge: 'PDF' | 'DOCX'
  dateLabel?: string
  downloadUrl: string
  onPreviewClick?: () => void
  isActive?: boolean
}) {
  const [isBusy, setIsBusy] = useState(false)

  const handleClick = async () => {
    if (badge === 'PDF' && onPreviewClick) {
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
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50',
        isActive
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Badge variant="secondary" className="rounded-sm px-1.5 py-0 font-mono text-[10px]">
        {badge}
      </Badge>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate">{label}</p>
        {dateLabel ? <p className="text-[10px] text-muted-foreground/70">{dateLabel}</p> : null}
      </div>
      {badge === 'DOCX' ? (
        <Download className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}

function VersionItem({ version }: { version: SerializedTimelineEntry }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPreviewOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        <span className="flex-1 truncate">{version.label}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground/70">
          {formatRelativeDate(version.createdAt)}
        </span>
      </button>
      <VersionPreviewSheet
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        version={version}
      />
    </>
  )
}

function TargetItem({
  sessionId,
  target,
}: {
  sessionId: string
  target: SerializedResumeTarget
}) {
  const [isBusy, setIsBusy] = useState(false)
  const { file: previewFile, open } = usePreviewPanel()

  const isActive =
    previewFile?.sessionId === sessionId
    && previewFile?.targetId === target.id
    && previewFile?.type === 'pdf'

  const handleDownload = async () => {
    if (target.generatedOutput?.status !== 'ready') {
      return
    }

    const urls = await getDownloadUrls(sessionId, target.id)
    await triggerDownload(urls.pdfUrl, `target-${target.id}.pdf`)
  }

  const handlePreviewClick = () => {
    if (target.generatedOutput?.status !== 'ready') {
      return
    }

    open({
      sessionId,
      targetId: target.id,
      type: 'pdf',
      label: `Target: ${createTargetLabel(target.targetJobDescription)}`,
    })
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <button
        type="button"
        onClick={handlePreviewClick}
        disabled={target.generatedOutput?.status !== 'ready'}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <p className="truncate" title={target.targetJobDescription}>
          {createTargetLabel(target.targetJobDescription)}
        </p>
        <p className="text-[10px] text-muted-foreground/70">{formatRelativeDate(target.createdAt)}</p>
      </button>
      {target.generatedOutput?.status === 'ready' ? (
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={handlePreviewClick}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-sidebar-accent"
            aria-label="Preview PDF"
            title="Preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            onClick={() => {
              setIsBusy(true)
              void handleDownload().finally(() => setIsBusy(false))
            }}
            aria-label="Baixar currículo target"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function SessionDocumentsPanel({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const { file: previewFile, open } = usePreviewPanel()
  const { versions, targets, files, isLoading, error } = useSessionDocuments(sessionId)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    files: true,
    versions: false,
    targets: false,
  })

  const hasFiles = Boolean(files.docxUrl || files.pdfUrl)
  const hasVersions = versions.length > 0
  const hasTargets = targets.length > 0
  const isBasePdfActive =
    previewFile?.sessionId === sessionId
    && previewFile?.targetId === null
    && previewFile?.type === 'pdf'

  const documentGroups = useMemo(
    () => ({ hasFiles, hasVersions, hasTargets }),
    [hasFiles, hasTargets, hasVersions],
  )

  if (!isSidebarOpen || !sessionId) {
    return null
  }

  if (!documentGroups.hasFiles && !documentGroups.hasVersions && !documentGroups.hasTargets && !isLoading) {
    return null
  }

  const toggleSection = (section: SectionKey) => {
    setOpenSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }))
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="px-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Documents
        </p>
      </div>

      {isLoading ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Carregando documentos...</p>
      ) : null}

      {error ? (
        <p className="px-2 py-1 text-xs text-destructive">{error}</p>
      ) : null}

      {documentGroups.hasFiles ? (
        <DocumentSection
          label="Files"
          icon={FileText}
          isOpen={openSections.files}
          onToggle={() => toggleSection('files')}
        >
          {files.docxUrl ? (
            <DownloadItem
              label="Resume.docx"
              badge="DOCX"
              downloadUrl={files.docxUrl}
            />
          ) : null}
          {files.pdfUrl ? (
            <DownloadItem
              label="Resume.pdf"
              badge="PDF"
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

      {documentGroups.hasVersions ? (
        <DocumentSection
          label="Versions"
          icon={Clock3}
          isOpen={openSections.versions}
          onToggle={() => toggleSection('versions')}
        >
          <ScrollArea className={cn('max-h-52 pr-1', versions.length < 5 && 'max-h-none')}>
            <div className="space-y-1">
              {versions.map((version) => (
                <VersionItem key={version.id} version={version} />
              ))}
            </div>
          </ScrollArea>
        </DocumentSection>
      ) : null}

      {documentGroups.hasTargets ? (
        <DocumentSection
          label="Target Resumes"
          icon={Target}
          isOpen={openSections.targets}
          onToggle={() => toggleSection('targets')}
        >
          <ScrollArea className={cn('max-h-52 pr-1', targets.length < 5 && 'max-h-none')}>
            <div className="space-y-1">
              {targets.map((target) => (
                <TargetItem key={target.id} target={target} sessionId={sessionId} />
              ))}
            </div>
          </ScrollArea>
        </DocumentSection>
      ) : null}
    </div>
  )
}
