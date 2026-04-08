'use client'

import { Download, GitCompare, History, Loader2, PencilLine, Plus, Sparkles } from 'lucide-react'

import ATSScoreBadge from '@/components/ats-score-badge'
import PhaseBadge from '@/components/phase-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { isGeneratedOutputReady } from '@/lib/dashboard/workspace-client'
import type { ManualEditSection } from '@/types/agent'
import type { SessionWorkspace, SerializedTimelineEntry } from '@/types/dashboard'

type MutationKind =
  | 'workspace-refresh'
  | 'create-target'
  | 'manual-edit'
  | 'gap-action'
  | 'generate'
  | null

type WorkspaceSidePanelProps = {
  sessionId?: string
  workspace: SessionWorkspace | null
  versions: SerializedTimelineEntry[]
  isStreaming: boolean
  activeMutation: MutationKind
  isBusy: boolean
  baseOutputReady: boolean
  targetJobDescription: string
  errorMessage: string | null
  statusMessage: string | null
  onTargetJobDescriptionChange: (value: string) => void
  onManualEdit: (section: ManualEditSection) => void
  onGenerateBase: () => Promise<void>
  onDownload: (targetId?: string) => Promise<void>
  onOpenCompare: () => void
  onCreateTarget: () => Promise<void>
  onGenerateTarget: (targetId: string) => Promise<void>
  onGapAction: (itemType: 'missing_skill' | 'weak_area' | 'suggestion', itemValue: string) => Promise<void>
  onOpenCompareWithTarget: (targetId: string) => void
}

const panelClassName =
  'rounded-[2rem] border border-border/60 bg-card/85 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]'

function formatDateTime(value?: string): string {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('pt-BR')
}

function shortenText(value: string, maxLength = 140): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

export function WorkspaceSidePanel({
  sessionId,
  workspace,
  versions,
  isStreaming,
  activeMutation,
  isBusy,
  baseOutputReady,
  targetJobDescription,
  errorMessage,
  statusMessage,
  onTargetJobDescriptionChange,
  onManualEdit,
  onGenerateBase,
  onDownload,
  onOpenCompare,
  onCreateTarget,
  onGenerateTarget,
  onGapAction,
  onOpenCompareWithTarget,
}: WorkspaceSidePanelProps) {
  const gapAnalysis = workspace?.session.agentState.gapAnalysis?.result
  const timelinePreview = versions.slice(0, 8)

  return (
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
                {activeMutation === 'generate' ? (
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
                      {workspace.session.cvState.phone ? ` • ${workspace.session.cvState.phone}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={isBusy}
                    onClick={() => onManualEdit('contact')}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {workspace.session.cvState.linkedin || 'LinkedIn ausente'}
                  {workspace.session.cvState.location ? ` • ${workspace.session.cvState.location}` : ''}
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
                    onClick={() => onManualEdit('summary')}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {workspace.session.cvState.summary || 'Resumo ainda não preenchido.'}
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
                    onClick={() => onManualEdit('skills')}
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
                  onClick={() => onManualEdit('experience')}
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
                  onClick={() => onManualEdit('education')}
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
                  onClick={() => onManualEdit('certifications')}
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
                <Button className="rounded-full" disabled={isBusy} onClick={() => void onGenerateBase()}>
                  {activeMutation === 'generate' ? (
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
                  onClick={() => void onDownload()}
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
            onClick={onOpenCompare}
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
                    onClick={() => void onGapAction('missing_skill', item)}
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
                    onClick={() => void onGapAction('weak_area', item)}
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
                    onClick={() => void onGapAction('suggestion', item)}
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
              onChange={(event) => onTargetJobDescriptionChange(event.target.value)}
            />
            <Button
              className="rounded-full"
              disabled={!sessionId || !targetJobDescription.trim() || isBusy}
              onClick={() => void onCreateTarget()}
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
                        {target.gapAnalysis ? `Match ${target.gapAnalysis.matchScore}` : 'Sem gap'}
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
                        onClick={() => void onGenerateTarget(target.id)}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={!targetReady || isBusy}
                        onClick={() => void onDownload(target.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Baixar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => onOpenCompareWithTarget(target.id)}
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
  )
}
