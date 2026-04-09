"use client"

import { useCallback, useEffect, useState } from "react"
import { useDefaultLayout } from "react-resizable-panels"

import { usePreviewPanel } from "@/context/preview-panel-context"
import { usePreviewPanelOverlay } from "@/hooks/use-preview-panel-overlay"
import {
  generateResume,
  getSessionWorkspace,
  isGeneratedOutputReady,
  manualEditBaseSection,
} from "@/lib/dashboard/workspace-client"
import type { PlanSlug } from "@/lib/plans"
import type { ManualEditInput, ManualEditSection, ManualEditSectionData } from "@/types/agent"
import type { SessionWorkspace } from "@/types/dashboard"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { ChatInterface } from "./chat-interface"
import { ManualEditDialog } from "./manual-edit-dialog"
import { PlanUpdateDialog } from "./plan-update-dialog"
import { PreviewPanel } from "./preview-panel"
import { WorkspaceSidePanel } from "./workspace-side-panel"

export const NEW_CONVERSATION_EVENT = "curria:new-conversation"
const NOOP_LAYOUT_STORAGE = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
}

type MutationKind =
  | "workspace-refresh"
  | "manual-edit"
  | "generate"
  | null

type ResumeWorkspaceProps = {
  initialSessionId?: string
  userName?: string
  activeRecurringPlan?: PlanSlug | null
  currentCredits?: number
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return "NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o."
}

function getManualEditSectionValue(
  workspace: SessionWorkspace | null,
  section: ManualEditSection | null,
): ManualEditSectionData | null {
  if (!workspace || section === null) {
    return null
  }

  const { cvState } = workspace.session

  switch (section) {
    case "contact":
      return {
        fullName: cvState.fullName,
        email: cvState.email,
        phone: cvState.phone,
        linkedin: cvState.linkedin,
        location: cvState.location,
      }
    case "summary":
      return cvState.summary
    case "skills":
      return cvState.skills
    case "experience":
      return cvState.experience
    case "education":
      return cvState.education
    case "certifications":
      return cvState.certifications ?? []
    default:
      return null
  }
}

export function ResumeWorkspace({
  initialSessionId,
  userName,
  activeRecurringPlan = null,
  currentCredits = 0,
}: ResumeWorkspaceProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [availableCredits, setAvailableCredits] = useState(currentCredits)
  const [workspace, setWorkspace] = useState<SessionWorkspace | null>(null)
  const [activeMutation, setActiveMutation] = useState<MutationKind>("workspace-refresh")
  const [isStreaming, setIsStreaming] = useState(false)
  const [manualEditOpen, setManualEditOpen] = useState(false)
  const [manualEditSection, setManualEditSection] = useState<ManualEditSection | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [planUpdateOpen, setPlanUpdateOpen] = useState(false)
  const { isOpen: isPreviewOpen, file: previewFile, close: closePreview } = usePreviewPanel()
  const isPreviewOverlay = usePreviewPanelOverlay()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "resume-workspace-split-view",
    panelIds: ["workspace-chat-panel", "workspace-preview-panel"],
    storage: typeof window === "undefined" ? NOOP_LAYOUT_STORAGE : window.localStorage,
  })

  useEffect(() => {
    setAvailableCredits(currentCredits)
  }, [currentCredits])

  // Sync initialSessionId prop changes to internal state
  // This handles URL changes like when Nova Conversa clears the session param.
  // The parent component updates initialSessionId based on the current URL searchParams,
  // and this effect ensures the workspace state stays in sync with navigation changes.
  useEffect(() => {
    setSessionId(initialSessionId)
  }, [initialSessionId])

  useEffect(() => {
    const handleNewConversation = (): void => {
      setSessionId(undefined)
      setWorkspace(null)
      setActiveMutation(null)
      setErrorMessage(null)
      setStatusMessage(null)
      closePreview()
    }

    window.addEventListener(NEW_CONVERSATION_EVENT, handleNewConversation)

    return () => {
      window.removeEventListener(NEW_CONVERSATION_EVENT, handleNewConversation)
    }
  }, [closePreview])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    const url = new URL(window.location.href)
    if (url.searchParams.get("session") === sessionId) {
      return
    }

    url.searchParams.set("session", sessionId)
    window.history.replaceState(window.history.state, "", url.toString())
  }, [sessionId])

  const isBusy = activeMutation !== null || isStreaming
  const baseOutputReady = isGeneratedOutputReady(workspace?.session.generatedOutput)
  const manualEditValue = getManualEditSectionValue(workspace, manualEditSection)

  const refreshWorkspace = useCallback(async (targetSessionId: string): Promise<void> => {
    setActiveMutation("workspace-refresh")
    setErrorMessage(null)

    try {
      const nextWorkspace = await getSessionWorkspace(targetSessionId)
      setWorkspace(nextWorkspace)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveMutation(null)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setWorkspace(null)
      setActiveMutation(null)
      return
    }

    void refreshWorkspace(sessionId)
  }, [refreshWorkspace, sessionId])

  useEffect(() => {
    if (!isPreviewOpen) {
      return
    }

    if (!sessionId || previewFile?.sessionId !== sessionId) {
      closePreview()
    }
  }, [closePreview, isPreviewOpen, previewFile?.sessionId, sessionId])

  const openManualEdit = (section: ManualEditSection): void => {
    setManualEditSection(section)
    setManualEditOpen(true)
  }

  const handleManualEdit = async (input: ManualEditInput): Promise<void> => {
    if (!sessionId) {
      return
    }

    setActiveMutation("manual-edit")
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const result = await manualEditBaseSection(sessionId, input)
      await refreshWorkspace(sessionId)
      setManualEditOpen(false)
      setStatusMessage(
        result.changed
          ? "EdiÃ§Ã£o manual aplicada na base canÃ´nica."
          : "Nenhuma alteraÃ§Ã£o detectada nesta seÃ§Ã£o.",
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      throw error
    } finally {
      setActiveMutation(null)
    }
  }

  const handleGenerateBase = async (): Promise<void> => {
    if (!sessionId) {
      return
    }

    setActiveMutation("generate")
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await generateResume(sessionId, { scope: "base" })
      await refreshWorkspace(sessionId)
      setStatusMessage("Arquivos da base gerados com sucesso.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveMutation(null)
    }
  }

  const chatPane = (
    <div className="flex h-full min-h-[72svh] min-w-0 flex-col overflow-hidden bg-[#faf9f5] lg:min-h-0">
      <ChatInterface
        sessionId={sessionId}
        userName={userName}
        disabled={activeMutation !== null}
        currentCredits={availableCredits}
        onSessionChange={(nextSessionId) => setSessionId(nextSessionId)}
        onStreamingChange={setIsStreaming}
        onAgentTurnCompleted={(payload) => {
          if (payload.isNewSession) {
            setAvailableCredits((previous) => Math.max(previous - 1, 0))
          }

          setSessionId(payload.sessionId)
          void refreshWorkspace(payload.sessionId)
        }}
        onCreditsExhausted={() => setPlanUpdateOpen(true)}
      />
    </div>
  )

  const viewerPane = (
    <WorkspaceSidePanel
      sessionId={sessionId}
      showInlinePreview={!isPreviewOverlay}
      previewFile={!isPreviewOverlay ? previewFile : null}
      baseOutputReady={baseOutputReady}
    />
  )

  return (
    <>
      {isPreviewOverlay ? (
        <div className="space-y-0 p-0">
          {chatPane}
          {viewerPane}
        </div>
      ) : (
        <div className="h-[calc(107svh-4rem)] px-0 py-0">
          <ResizablePanelGroup
            id="resume-workspace-split-view"
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
            className="items-stretch bg-[#faf9f5]"
          >
            <ResizablePanel id="workspace-chat-panel" defaultSize="68%" minSize="44%">
              <div className="h-full min-w-0">
                {chatPane}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              id="workspace-preview-panel"
              defaultSize="32%"
              minSize="24%"
              maxSize="56%"
            >
              <div className="h-full min-w-0">
                {viewerPane}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      {isPreviewOpen && previewFile && isPreviewOverlay ? <PreviewPanel /> : null}

      <ManualEditDialog
        open={manualEditOpen}
        section={manualEditSection}
        value={manualEditValue}
        busy={activeMutation === "manual-edit"}
        onOpenChange={(open) => {
          setManualEditOpen(open)
          if (!open) {
            setManualEditSection(null)
          }
        }}
        onSubmit={handleManualEdit}
      />

      <PlanUpdateDialog
        isOpen={planUpdateOpen}
        onOpenChange={setPlanUpdateOpen}
        activeRecurringPlan={activeRecurringPlan}
        currentCredits={availableCredits}
      />
    </>
  )
}
