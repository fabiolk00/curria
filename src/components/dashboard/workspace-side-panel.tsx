'use client'

import type { PreviewFile } from '@/context/preview-panel-context'
import { Button } from '@/components/ui/button'

import { PreviewPanel } from './preview-panel'

type WorkspaceSidePanelProps = {
  sessionId?: string
  showInlinePreview: boolean
  previewFile: PreviewFile | null
  baseOutputReady: boolean
  onGenerateBase?: () => void
  generationBusy?: boolean
  generationInProgress?: boolean
}

export function WorkspaceSidePanel({
  sessionId,
  showInlinePreview,
  previewFile,
  baseOutputReady,
  onGenerateBase,
  generationBusy = false,
  generationInProgress = false,
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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#faf9f5]">
      <div className="shrink-0 px-3 pb-1 pt-3">
        <p className="text-sm font-semibold text-foreground">Template viewer</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aqui aparece a pre-visualizacao do PDF gerado.
        </p>
        {!baseOutputReady ? (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-900">
            <p>1 crédito será reservado para esta exportação.</p>
            <p className="mt-1 text-amber-800/80">Se a geração falhar, o crédito será liberado.</p>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-0 pb-0">
        {showInlinePreview && inlinePreviewFile ? (
          <div className="min-h-[32rem] flex-1 overflow-hidden bg-background">
            <PreviewPanel
              inline
              fileOverride={inlinePreviewFile}
              showCloseButton={previewFile !== null}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-muted/20 p-6 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3 text-center">
              <p>Gere um arquivo.</p>
              {sessionId && onGenerateBase ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateBase}
                  disabled={generationBusy}
                >
                  {generationInProgress ? 'Gerando arquivo...' : 'Gerar arquivo base'}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
