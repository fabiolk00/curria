'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PreviewFile } from '@/context/preview-panel-context'

import { PreviewPanel } from './preview-panel'

type WorkspaceSidePanelProps = {
  sessionId?: string
  showInlinePreview: boolean
  previewFile: PreviewFile | null
  baseOutputReady: boolean
}

const panelClassName =
  'flex h-full flex-col rounded-[2rem] border border-border/60 bg-card/85 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]'

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
    <Card className={panelClassName}>
      <CardHeader className="shrink-0 pt-8">
        <CardTitle>Template viewer</CardTitle>
        <CardDescription>
          Aqui aparece a pre-visualizacao do PDF gerado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pb-8">
        {showInlinePreview && inlinePreviewFile ? (
          <div className="min-h-[32rem] flex-1 overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/70">
            <PreviewPanel
              inline
              fileOverride={inlinePreviewFile}
              showCloseButton={previewFile !== null}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Gere um arquivo.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
