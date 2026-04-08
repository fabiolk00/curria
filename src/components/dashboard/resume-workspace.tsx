"use client"

import { useCallback, useEffect, useState } from "react"

import { usePreviewPanel } from "@/context/preview-panel-context"
import { usePreviewPanelOverlay } from "@/hooks/use-preview-panel-overlay"
import {
  applyGapAction,
  compareSnapshots,
  createTarget,
  generateResume,
  getDownloadUrls,
  getSessionWorkspace,
  isGeneratedOutputReady,
  listVersions,
  manualEditBaseSection,
} from "@/lib/dashboard/workspace-client"
import type { PlanSlug } from "@/lib/plans"
import type { ManualEditInput, ManualEditSection, ManualEditSectionData } from "@/types/agent"
import type {
  CompareSnapshotRef,
  CompareSnapshotsResponse,
  SerializedTimelineEntry,
  SessionWorkspace,
} from "@/types/dashboard"

import { ChatInterface } from "./chat-interface"
import { CompareDrawer } from "./compare-drawer"
import { ManualEditDialog } from "./manual-edit-dialog"
import { PlanUpdateDialog } from "./plan-update-dialog"
import { PreviewPanel } from "./preview-panel"
import { WorkspaceSidePanel } from "./workspace-side-panel"

type MutationKind =
  | "workspace-refresh"
  | "create-target"
  | "manual-edit"
  | "gap-action"
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

function buildCompareDefaultsForTarget(targetId: string): {
  left: CompareSnapshotRef
  right: CompareSnapshotRef
} {
  return {
    left: { kind: "base" },
    right: { kind: "target", id: targetId },
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
  const [versions, setVersions] = useState<SerializedTimelineEntry[]>([])
  const [activeMutation, setActiveMutation] = useState<MutationKind>("workspace-refresh")
  const [isStreaming, setIsStreaming] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareSnapshotsResponse | null>(null)
  const [compareDefaults, setCompareDefaults] = useState<{
    left?: CompareSnapshotRef
    right?: CompareSnapshotRef
  }>({})
  const [manualEditOpen, setManualEditOpen] = useState(false)
  const [manualEditSection, setManualEditSection] = useState<ManualEditSection | null>(null)
  const [targetJobDescription, setTargetJobDescription] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [planUpdateOpen, setPlanUpdateOpen] = useState(false)
  const { isOpen: isPreviewOpen, file: previewFile, close: closePreview } = usePreviewPanel()
  const isPreviewOverlay = usePreviewPanelOverlay()

  useEffect(() => {
    setAvailableCredits(currentCredits)
  }, [currentCredits])

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
      const [nextWorkspace, nextVersions] = await Promise.all([
        getSessionWorkspace(targetSessionId),
        listVersions(targetSessionId),
      ])

      setWorkspace(nextWorkspace)
      setVersions(nextVersions)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveMutation(null)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setWorkspace(null)
      setVersions([])
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

  const handleCreateTarget = async (): Promise<void> => {
    if (!sessionId || !targetJobDescription.trim()) {
      return
    }

    setActiveMutation("create-target")
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createTarget(sessionId, targetJobDescription.trim())
      await refreshWorkspace(sessionId)
      setTargetJobDescription("")
      setStatusMessage("Nova variante target criada com sucesso.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveMutation(null)
    }
  }

  const handleGapAction = async (
    itemType: "missing_skill" | "weak_area" | "suggestion",
    itemValue: string,
  ): Promise<void> => {
    if (!sessionId) {
      return
    }

    setActiveMutation("gap-action")
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await applyGapAction(sessionId, { itemType, itemValue })
      await refreshWorkspace(sessionId)
      setStatusMessage(`Melhoria aplicada a partir de: ${itemValue}`)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
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

  const handleGenerateTarget = async (targetId: string): Promise<void> => {
    if (!sessionId) {
      return
    }

    setActiveMutation("generate")
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await generateResume(sessionId, { scope: "target", targetId })
      await refreshWorkspace(sessionId)
      setStatusMessage("Arquivos da variante target gerados com sucesso.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveMutation(null)
    }
  }

  const handleDownload = async (targetId?: string): Promise<void> => {
    if (!sessionId) {
      return
    }

    setErrorMessage(null)

    try {
      const urls = await getDownloadUrls(sessionId, targetId)
      window.open(urls.pdfUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  const handleCompare = async (
    left: CompareSnapshotRef,
    right: CompareSnapshotRef,
  ): Promise<void> => {
    if (!sessionId) {
      return
    }

    setCompareBusy(true)
    setErrorMessage(null)

    try {
      const result = await compareSnapshots(sessionId, left, right)
      setCompareResult(result)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setCompareBusy(false)
    }
  }

  const handleOpenCompareWithTarget = (targetId: string): void => {
    const defaults = buildCompareDefaultsForTarget(targetId)
    setCompareDefaults(defaults)
    setCompareResult(null)
    setCompareOpen(true)
  }

  const handleOpenCompare = (): void => {
    setCompareDefaults({})
    setCompareResult(null)
    setCompareOpen(true)
  }

  return (
    <>
      <div className="grid min-h-screen gap-6 p-4 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:p-8">
        <div className="flex min-h-[72svh] flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-background/90 shadow-[0_32px_110px_-75px_oklch(var(--foreground)/0.9)] backdrop-blur lg:h-[calc(100svh-4rem)]">
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

        {isPreviewOpen && previewFile && !isPreviewOverlay ? (
          <PreviewPanel inline />
        ) : (
          <WorkspaceSidePanel
            sessionId={sessionId}
            workspace={workspace}
            versions={versions}
            isStreaming={isStreaming}
            activeMutation={activeMutation}
            isBusy={isBusy}
            baseOutputReady={baseOutputReady}
            targetJobDescription={targetJobDescription}
            errorMessage={errorMessage}
            statusMessage={statusMessage}
            onTargetJobDescriptionChange={setTargetJobDescription}
            onManualEdit={openManualEdit}
            onGenerateBase={handleGenerateBase}
            onDownload={handleDownload}
            onOpenCompare={handleOpenCompare}
            onCreateTarget={handleCreateTarget}
            onGenerateTarget={handleGenerateTarget}
            onGapAction={handleGapAction}
            onOpenCompareWithTarget={handleOpenCompareWithTarget}
          />
        )}
      </div>

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

      <CompareDrawer
        open={compareOpen}
        busy={compareBusy}
        versions={versions}
        targets={workspace?.targets ?? []}
        initialLeft={compareDefaults.left}
        initialRight={compareDefaults.right}
        result={compareResult}
        onOpenChange={setCompareOpen}
        onCompare={handleCompare}
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
