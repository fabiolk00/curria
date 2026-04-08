'use client'

import type { PreviewFile } from '@/context/preview-panel-context'

import { PreviewPanel } from './preview-panel'

type WorkspaceSidePanelProps = {
  sessionId?: string
  showInlinePreview: boolean
  previewFile: PreviewFile | null
  baseOutputReady: boolean
}

export function WorkspaceSidePanel({
  sessionId,
  showInlinePreview,
  previewFile,
  baseOutputReady,
}: WorkspaceSidePanelProps) {
  const defaultPreviewFile = sessionId && baseOutputReady
    ? {
        sessionId,
        targetId: null,
        type: 'pdf' as const,
        label: 'Resume',
      }
    : null

  const inlinePreviewFile = previewFile ?? defaultPreviewFile

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 px-4 pb-3 pt-3">
        <p className="text-sm font-semibold text-foreground">Template viewer</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aqui aparece a pre-visualizacao do PDF gerado.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        {showInlinePreview && inlinePreviewFile ? (
          <div className="min-h-[32rem] flex-1 overflow-hidden rounded-[1.25rem] border border-border/50 bg-background">
            <PreviewPanel
              inline
              fileOverride={inlinePreviewFile}
              showCloseButton={previewFile !== null}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[1.25rem] border border-dashed border-border/50 bg-muted/20 p-6 text-sm text-muted-foreground">
            Gere um arquivo.
          </div>
        )}
      </div>
    </aside>
  )
}
