"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, GitCompare, History, Loader2, PencilLine, Plus, Sparkles } from "lucide-react"

import ATSScoreBadge from "@/components/ats-score-badge"
import PhaseBadge from "@/components/phase-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
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
import type { PlanSlug } from "@/lib/plans"

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

  return "Não foi possível concluir a operação."
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString("pt-BR")
}

function shortenText(value: string, maxLength = 140): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
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

const panelClassName =
  "rounded-[2rem] border border-border/60 bg-card/85 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]"

export function ResumeWorkspace({
  initialSessionId,
  userName,
  activeRecurringPlan = null,
  currentCredits = 0,
}: ResumeWorkspaceProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [availableCredits, setAvailableCredits] = useState(currentCredits)

  useEffect(() => {
    setAvailableCredits(currentCredits)
  }, [currentCredits])

  useEffect(() => {
    if (!sessionId) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("session") === sessionId) return
    url.searchParams.set("session", sessionId)
    window.history.replaceState(window.history.state, "", url.toString())
  }, [sessionId])

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

  const isBusy = activeMutation !== null || isStreaming
  const gapAnalysis = workspace?.session.agentState.gapAnalysis?.result
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
          ? "Edição manual aplicada na base canônica."
          : "Nenhuma alteração detectada nesta seção.",
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

  const timelinePreview = useMemo(() => versions.slice(0, 8), [versions])

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

        <div className="space-y-6">
          <Card className={panelClassName}>
            <CardHeader className="pt-8">
              <CardTitle>Base canônica</CardTitle>
              <CardDescription>
                Esta área reflete o estado canônico atual da sessão e sempre volta do backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              {workspace ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <PhaseBadge phase={workspace.session.phase} />
                    {workspace.session.atsScore ? (
                      <ATSScoreBadge score={workspace.session.atsScore.total} />
                    ) : null}
                    <Badge variant="outline" className="rounded-full">
                      Versão {workspace.session.stateVersion}
                    </Badge>
                    {isStreaming ? (
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <Spinner className="size-3" />
                        SSE ativo
                      </Badge>
                    ) : null}
                    {activeMutation === "generate" ? (
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <Loader2 className="size-3 animate-spin" />
                        Gerando
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{workspace.session.cvState.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {workspace.session.cvState.email}
                          {workspace.session.cvState.phone ? ` • ${workspace.session.cvState.phone}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => openManualEdit("contact")}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {workspace.session.cvState.linkedin || "LinkedIn ausente"}
                      {workspace.session.cvState.location ? ` • ${workspace.session.cvState.location}` : ""}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Resumo</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => openManualEdit("summary")}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {workspace.session.cvState.summary || "Resumo ainda não preenchido."}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Skills</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => openManualEdit("skills")}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {workspace.session.cvState.skills.length > 0 ? (
                        workspace.session.cvState.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="rounded-full">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma skill estruturada.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4 text-left transition-colors hover:bg-accent"
                      disabled={isBusy}
                      onClick={() => openManualEdit("experience")}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Experiência
                      </p>
                      <p className="mt-2 text-2xl font-bold">{workspace.session.cvState.experience.length}</p>
                    </button>
                    <button
                      type="button"
                      className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4 text-left transition-colors hover:bg-accent"
                      disabled={isBusy}
                      onClick={() => openManualEdit("education")}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Educação
                      </p>
                      <p className="mt-2 text-2xl font-bold">{workspace.session.cvState.education.length}</p>
                    </button>
                    <button
                      type="button"
                      className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4 text-left transition-colors hover:bg-accent"
                      disabled={isBusy}
                      onClick={() => openManualEdit("certifications")}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Certificações
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {workspace.session.cvState.certifications?.length ?? 0}
                      </p>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button className="rounded-full" disabled={isBusy} onClick={() => void handleGenerateBase()}>
                      {activeMutation === "generate" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Gerar base
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={!baseOutputReady || isBusy}
                      onClick={() => void handleDownload()}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Baixar base
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  Envie sua primeira mensagem no chat para criar a sessão e carregar o workspace.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={panelClassName}>
            <CardHeader className="pt-8">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Timeline de versões
              </CardTitle>
              <CardDescription>
                Histórico imutável da base canônica e das derivações target.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!sessionId || isBusy}
                onClick={() => {
                  setCompareDefaults({})
                  setCompareResult(null)
                  setCompareOpen(true)
                }}
              >
                <GitCompare className="mr-2 h-4 w-4" />
                Abrir comparador
              </Button>

              {timelinePreview.length > 0 ? (
                <div className="space-y-3">
                  {timelinePreview.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{version.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(version.createdAt)}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {version.scope}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  As versões aparecerão aqui depois da ingestão ou de atualizações canônicas.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={panelClassName}>
            <CardHeader className="pt-8">
              <CardTitle>Targets e acoes</CardTitle>
              <CardDescription>
                Variantes derivadas ficam separadas da base. Toda ação recarrega o workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              {gapAnalysis ? (
                <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                  <div>
                    <p className="text-sm font-semibold">Gap analysis</p>
                    <p className="text-xs text-muted-foreground">
                      Match score: {gapAnalysis.matchScore}
                    </p>
                  </div>

                  {gapAnalysis.missingSkills.slice(0, 3).map((item) => (
                    <div key={`skill-${item}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{item}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => void handleGapAction("missing_skill", item)}
                      >
                        Aplicar
                      </Button>
                    </div>
                  ))}

                  {gapAnalysis.weakAreas.slice(0, 2).map((item) => (
                    <div key={`weak-${item}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{item}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => void handleGapAction("weak_area", item)}
                      >
                        Melhorar
                      </Button>
                    </div>
                  ))}

                  {gapAnalysis.improvementSuggestions.slice(0, 2).map((item) => (
                    <div key={`suggestion-${item}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{item}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => void handleGapAction("suggestion", item)}
                      >
                        Aplicar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-semibold">Criar novo target</p>
                <Textarea
                  value={targetJobDescription}
                  disabled={isBusy || !sessionId}
                  rows={6}
                  placeholder="Cole a descrição da vaga para criar uma variante derivada."
                  onChange={(event) => setTargetJobDescription(event.target.value)}
                />
                <Button
                  className="rounded-full"
                  disabled={!sessionId || !targetJobDescription.trim() || isBusy}
                  onClick={() => void handleCreateTarget()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar target
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                {workspace?.targets.length ? (
                  workspace.targets.map((target) => {
                    const targetReady = isGeneratedOutputReady(target.generatedOutput)

                    return (
                      <div
                        key={target.id}
                        className="space-y-3 rounded-[1.5rem] border border-border/60 bg-background/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">Target {target.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">
                              Atualizado em {formatDateTime(target.updatedAt)}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {target.gapAnalysis ? `Match ${target.gapAnalysis.matchScore}` : "Sem gap"}
                          </Badge>
                        </div>

                        <p className="text-sm leading-6 text-muted-foreground">
                          {shortenText(target.targetJobDescription)}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={isBusy}
                            onClick={() => void handleGenerateTarget(target.id)}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Gerar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={!targetReady || isBusy}
                            onClick={() => void handleDownload(target.id)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Baixar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={isBusy}
                            onClick={() => handleOpenCompareWithTarget(target.id)}
                          >
                            <GitCompare className="mr-2 h-4 w-4" />
                            Comparar
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    Nenhum target criado ainda para esta sessão.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {errorMessage || statusMessage ? (
            <Card className={panelClassName}>
              <CardContent className="pt-6">
                {errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{statusMessage}</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

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
