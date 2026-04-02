"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Filter,
  HeartPulse,
  MapPin,
  MessageSquare,
  PencilLine,
  Plus,
  Search,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  JobApplicationBenefit,
  JobApplicationFormInput,
  JobApplicationStatus,
  SerializedJobApplication,
} from "@/types/dashboard"

const LOCKED_TRACKER_MESSAGE =
  "O gerenciamento de vagas faz parte dos planos pagos. Faca upgrade para registrar candidaturas, curriculos enviados e acompanhar cada status em um so lugar."
const LOCKED_TRACKER_TITLE = "Gerenciamento de vagas bloqueado"
const LOCKED_TRACKER_EYEBROW = "Recurso Premium"

const STATUS_OPTIONS: { value: JobApplicationStatus; label: string }[] = [
  { value: "entrevista", label: "Em Entrevista" },
  { value: "aguardando", label: "Aguardando" },
  { value: "sem_retorno", label: "Sem Retorno" },
  { value: "negativa", label: "Negativa" },
]

const statusConfig: Record<
  JobApplicationStatus,
  { label: string; icon: typeof MessageSquare; colorClass: string }
> = {
  entrevista: {
    label: "Em Entrevista",
    icon: MessageSquare,
    colorClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  aguardando: {
    label: "Aguardando",
    icon: Timer,
    colorClass: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  sem_retorno: {
    label: "Sem Retorno",
    icon: Timer,
    colorClass: "border-border bg-muted text-muted-foreground",
  },
  negativa: {
    label: "Negativa",
    icon: XCircle,
    colorClass: "border-destructive/20 bg-destructive/10 text-destructive",
  },
}

type ActionResult =
  | { success: true }
  | { success: false; error: string }

type TrackerProps = {
  applications: SerializedJobApplication[]
  locked?: boolean
  lockedEyebrow?: string
  lockedTitle?: string
  lockedMessage?: string | null
  loadErrorMessage?: string | null
  createApplicationAction: (input: JobApplicationFormInput) => Promise<ActionResult>
  updateApplicationDetailsAction: (input: {
    applicationId: string
    values: JobApplicationFormInput
  }) => Promise<ActionResult>
  updateApplicationStatusAction: (input: {
    applicationId: string
    status: JobApplicationStatus
  }) => Promise<ActionResult>
  deleteApplicationAction: (input: { applicationId: string }) => Promise<ActionResult>
}

type JobApplicationFormState = {
  role: string
  company: string
  salary: string
  location: string
  resumeVersionLabel: string
  benefitsText: string
  jobDescription: string
  notes: string
  appliedAt: string
}

function getTodayDateInput(): string {
  return new Date().toISOString().slice(0, 10)
}

function createEmptyFormState(): JobApplicationFormState {
  return {
    role: "",
    company: "",
    salary: "",
    location: "",
    resumeVersionLabel: "",
    benefitsText: "",
    jobDescription: "",
    notes: "",
    appliedAt: getTodayDateInput(),
  }
}

function formatDateInput(value?: string): string {
  if (!value) {
    return getTodayDateInput()
  }

  return value.slice(0, 10)
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function formatBenefitsAsTextarea(benefits: JobApplicationBenefit[]): string {
  return benefits
    .map((benefit) => (benefit.value ? `${benefit.name} | ${benefit.value}` : benefit.name))
    .join("\n")
}

function parseBenefitsInput(value: string): JobApplicationBenefit[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ...valueParts] = line.split("|")
      const name = namePart.trim()
      const parsedValue = valueParts.join("|").trim()

      return {
        name,
        value: parsedValue || undefined,
      }
    })
    .filter((benefit) => benefit.name.length > 0)
}

function toFormState(application?: SerializedJobApplication): JobApplicationFormState {
  if (!application) {
    return createEmptyFormState()
  }

  return {
    role: application.role,
    company: application.company,
    salary: application.salary ?? "",
    location: application.location ?? "",
    resumeVersionLabel: application.resumeVersionLabel,
    benefitsText: formatBenefitsAsTextarea(application.benefits),
    jobDescription: application.jobDescription ?? "",
    notes: application.notes ?? "",
    appliedAt: formatDateInput(application.appliedAt),
  }
}

function toSubmissionPayload(form: JobApplicationFormState): JobApplicationFormInput {
  return {
    role: form.role.trim(),
    company: form.company.trim(),
    salary: normalizeOptionalString(form.salary),
    location: normalizeOptionalString(form.location),
    benefits: parseBenefitsInput(form.benefitsText),
    resumeVersionLabel: form.resumeVersionLabel.trim(),
    jobDescription: normalizeOptionalString(form.jobDescription),
    notes: normalizeOptionalString(form.notes),
    appliedAt: normalizeOptionalString(form.appliedAt),
  }
}

function formatDisplayDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR")
}

function shortenText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

function getDetailsPreview(application: SerializedJobApplication): string | null {
  const source = application.jobDescription ?? application.notes
  return source ? shortenText(source) : null
}

export function JobApplicationsTracker({
  applications,
  locked = false,
  lockedEyebrow = LOCKED_TRACKER_EYEBROW,
  lockedTitle = LOCKED_TRACKER_TITLE,
  lockedMessage = LOCKED_TRACKER_MESSAGE,
  loadErrorMessage = null,
  createApplicationAction,
  updateApplicationDetailsAction,
  updateApplicationStatusAction,
  deleteApplicationAction,
}: TrackerProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<JobApplicationStatus | "todas">("todas")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<SerializedJobApplication | null>(null)
  const [formState, setFormState] = useState<JobApplicationFormState>(createEmptyFormState())
  const [deleteTarget, setDeleteTarget] = useState<SerializedJobApplication | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const filteredApplications = applications.filter((application) => {
    const matchesFilter = filter === "todas" || application.status === filter
    const normalizedQuery = searchQuery.toLowerCase()
    const matchesSearch =
      application.company.toLowerCase().includes(normalizedQuery) ||
      application.role.toLowerCase().includes(normalizedQuery)

    return matchesFilter && matchesSearch
  })

  const totalApplications = applications.length
  const interviewing = applications.filter((application) => application.status === "entrevista").length
  const waiting = applications.filter((application) => application.status === "aguardando").length
  const rejected = applications.filter((application) => application.status === "negativa").length
  const isBusy = pendingAction !== null
  const interactionsDisabled = isBusy || locked || loadErrorMessage !== null

  const openCreateDialog = (): void => {
    if (interactionsDisabled) {
      return
    }

    setEditingApplication(null)
    setFormState(createEmptyFormState())
    setErrorMessage(null)
    setDialogOpen(true)
  }

  const openEditDialog = (application: SerializedJobApplication): void => {
    if (interactionsDisabled) {
      return
    }

    setEditingApplication(application)
    setFormState(toFormState(application))
    setErrorMessage(null)
    setDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean): void => {
    setDialogOpen(open)

    if (!open) {
      setEditingApplication(null)
      setFormState(createEmptyFormState())
    }
  }

  const handleSaveApplication = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (interactionsDisabled) {
      return
    }

    const payload = toSubmissionPayload(formState)
    setPendingAction(editingApplication ? `save:${editingApplication.id}` : "create")
    setErrorMessage(null)
    setStatusMessage(null)

    const result = editingApplication
      ? await updateApplicationDetailsAction({
          applicationId: editingApplication.id,
          values: payload,
        })
      : await createApplicationAction(payload)

    if (!result.success) {
      setErrorMessage(result.error)
      setPendingAction(null)
      return
    }

    setDialogOpen(false)
    setEditingApplication(null)
    setFormState(createEmptyFormState())
    setStatusMessage(
      editingApplication
        ? "Vaga atualizada com sucesso."
        : "Vaga criada com sucesso.",
    )
    router.refresh()
    setPendingAction(null)
  }

  const handleStatusChange = async (
    applicationId: string,
    status: JobApplicationStatus,
  ): Promise<void> => {
    if (interactionsDisabled) {
      return
    }

    setPendingAction(`status:${applicationId}`)
    setErrorMessage(null)
    setStatusMessage(null)

    const result = await updateApplicationStatusAction({
      applicationId,
      status,
    })

    if (!result.success) {
      setErrorMessage(result.error)
      setPendingAction(null)
      return
    }

    setStatusMessage("Status atualizado com sucesso.")
    router.refresh()
    setPendingAction(null)
  }

  const handleDeleteApplication = async (): Promise<void> => {
    if (interactionsDisabled || !deleteTarget) {
      return
    }

    setPendingAction(`delete:${deleteTarget.id}`)
    setErrorMessage(null)
    setStatusMessage(null)

    const result = await deleteApplicationAction({
      applicationId: deleteTarget.id,
    })

    if (!result.success) {
      setErrorMessage(result.error)
      setPendingAction(null)
      return
    }

    setDeleteTarget(null)
    setStatusMessage("Vaga excluida com sucesso.")
    router.refresh()
    setPendingAction(null)
  }

  return (
    <>
      <div className="relative">
        {locked ? (
          <div className="absolute inset-0 z-20 flex items-start justify-center px-4 pt-24">
            <div className="max-w-xl rounded-3xl border border-border/60 bg-background/95 px-6 py-5 text-center shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                {lockedEyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">{lockedTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{lockedMessage}</p>
            </div>
          </div>
        ) : null}

      <div
        aria-hidden={locked}
        className={locked ? "pointer-events-none select-none blur-[4px]" : undefined}
      >
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Minhas Vagas</h1>
            <p className="text-muted-foreground">
              Registre manualmente cada vaga, acompanhe o status e saiba qual curriculo foi enviado.
            </p>
          </div>
          <Button className="shrink-0 shadow-sm" onClick={openCreateDialog} disabled={interactionsDisabled}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Vaga
          </Button>
        </div>

        {errorMessage || statusMessage ? (
          <div className="mb-6 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm shadow-sm">
            {errorMessage ? (
              <p className="text-destructive">{errorMessage}</p>
            ) : (
              <p className="text-muted-foreground">{statusMessage}</p>
            )}
          </div>
        ) : null}

        {loadErrorMessage ? (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:text-amber-200">
            <p className="font-semibold">Nao foi possivel carregar suas candidaturas agora.</p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">{loadErrorMessage}</p>
          </div>
        ) : null}

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-primary/10 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col gap-1 p-4 sm:p-6">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BriefcaseBusiness className="h-4 w-4" /> Vagas Aplicadas
              </span>
              <span className="text-2xl font-bold text-foreground sm:text-3xl">{totalApplications}</span>
            </CardContent>
          </Card>
          <Card className="border-blue-500/10 bg-blue-500/5 shadow-sm">
            <CardContent className="flex flex-col gap-1 p-4 sm:p-6">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Em Entrevista
              </span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 sm:text-3xl">
                {interviewing}
              </span>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/10 bg-yellow-500/5 shadow-sm">
            <CardContent className="flex flex-col gap-1 p-4 sm:p-6">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Timer className="h-4 w-4 text-yellow-500" /> Aguardando
              </span>
              <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 sm:text-3xl">
                {waiting}
              </span>
            </CardContent>
          </Card>
          <Card className="border-destructive/10 bg-destructive/5 shadow-sm">
            <CardContent className="flex flex-col gap-1 p-4 sm:p-6">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <XCircle className="h-4 w-4 text-destructive" /> Negativas
              </span>
              <span className="text-2xl font-bold text-destructive sm:text-3xl">{rejected}</span>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-border/50 bg-card p-2 shadow-sm sm:flex-row">
          <div className="relative w-full flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por empresa ou cargo..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              disabled={interactionsDisabled}
              className="w-full border-none bg-transparent py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex w-full items-center gap-2 overflow-x-auto border-t border-border/50 pb-1 pl-2 pt-2 sm:w-auto sm:border-l sm:border-t-0 sm:pb-0 sm:pl-0 sm:pt-0">
            <Filter className="mx-2 hidden h-4 w-4 text-muted-foreground sm:block" />
            <Button
              variant={filter === "todas" ? "secondary" : "ghost"}
              size="sm"
                onClick={() => setFilter("todas")}
                disabled={interactionsDisabled}
                className="shrink-0 rounded-full"
              >
                Todas
            </Button>
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status.value}
                variant={filter === status.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilter(status.value)}
                disabled={interactionsDisabled}
                className="shrink-0 rounded-full"
              >
                {status.label}
              </Button>
            ))}
          </div>
        </div>

        {filteredApplications.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {filteredApplications.map((application) => {
              const StatusIcon = statusConfig[application.status].icon
              const detailsPreview = getDetailsPreview(application)

              return (
                <Card
                  key={application.id}
                  className="group flex flex-col shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 sm:h-12 sm:w-12">
                          <Building2 className="h-5 w-5 text-primary/70 sm:h-6 sm:w-6" />
                        </div>
                        <div>
                          <CardTitle className="line-clamp-2 text-base leading-tight sm:text-lg">
                            {application.role}
                          </CardTitle>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm">
                            <span className="font-medium text-foreground/80">{application.company}</span>
                            {application.location ? (
                              <>
                                <span className="hidden sm:inline-block">/</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {application.location}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1 ${statusConfig[application.status].colorClass}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline-block">{statusConfig[application.status].label}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pb-4">
                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold">{application.salary || "Nao informado"}</span>
                      </div>
                      <span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        Atualizado manualmente
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <HeartPulse className="h-4 w-4 text-rose-500" />
                        Beneficios Oferecidos
                      </div>
                      <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                        {application.benefits.length > 0 ? (
                          <ul className="grid gap-2 pl-4 text-sm sm:grid-cols-2">
                            {application.benefits.map((benefit) => (
                              <li
                                key={`${application.id}-${benefit.name}-${benefit.value ?? "base"}`}
                                className="list-disc text-xs text-muted-foreground marker:text-primary/50 sm:text-sm"
                              >
                                <span className="font-medium text-foreground/80">{benefit.name}</span>
                                {benefit.value ? (
                                  <span className="mt-0.5 block text-xs text-muted-foreground opacity-80">
                                    {benefit.value}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum beneficio cadastrado.</p>
                        )}
                      </div>
                    </div>

                    {detailsPreview ? (
                      <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Descricao ou observacoes
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">{detailsPreview}</p>
                      </div>
                    ) : null}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 rounded-b-xl border-t bg-muted/5 pt-4">
                    <div className="w-full space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Curriculo Utilizado
                      </p>
                      <div className="flex items-center gap-2.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                        <div className="shrink-0 rounded bg-background p-1.5 shadow-sm">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="truncate text-sm font-medium text-primary/90">
                          {application.resumeVersionLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 border-t border-border/50 pt-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Aplicado: {formatDisplayDate(application.appliedAt)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={application.status}
                          disabled={interactionsDisabled}
                          onValueChange={(value) =>
                            void handleStatusChange(application.id, value as JobApplicationStatus)
                          }
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Atualizar status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          disabled={interactionsDisabled}
                          onClick={() => openEditDialog(application)}
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 text-muted-foreground hover:text-destructive"
                          disabled={interactionsDisabled}
                          onClick={() => setDeleteTarget(application)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-medium">Nenhuma vaga encontrada</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              {loadErrorMessage
                ? "O gerenciamento de vagas ainda nao esta disponivel neste ambiente. Tente novamente em instantes."
                : applications.length === 0
                ? "Comece adicionando sua primeira vaga para acompanhar a busca."
                : "Nao encontramos nenhuma candidatura com esse status ou termo de busca."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {applications.length === 0 && !loadErrorMessage ? (
                <Button onClick={openCreateDialog} disabled={interactionsDisabled}>Adicionar primeira vaga</Button>
              ) : null}
              <Button
                variant="outline"
                disabled={interactionsDisabled}
                onClick={() => {
                  setFilter("todas")
                  setSearchQuery("")
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingApplication ? "Editar vaga" : "Adicionar vaga"}</DialogTitle>
            <DialogDescription>
              Preencha manualmente os dados da candidatura. O status fica controlado pela tela.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={(event) => void handleSaveApplication(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-role">Cargo</Label>
                <Input
                  id="job-role"
                  value={formState.role}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, role: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-company">Empresa</Label>
                <Input
                  id="job-company"
                  value={formState.company}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, company: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-salary">Salario</Label>
                <Input
                  id="job-salary"
                  value={formState.salary}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, salary: event.target.value }))
                  }
                  placeholder="Ex.: R$ 12.000,00 ou A combinar"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-location">Localizacao</Label>
                <Input
                  id="job-location"
                  value={formState.location}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="Ex.: Remoto ou Hibrido (SP)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-resume-version">Nome do curriculo enviado</Label>
                <Input
                  id="job-resume-version"
                  value={formState.resumeVersionLabel}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      resumeVersionLabel: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Curriculo_Fintech_v3.pdf"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-applied-at">Data da candidatura</Label>
                <Input
                  id="job-applied-at"
                  type="date"
                  value={formState.appliedAt}
                  disabled={interactionsDisabled}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, appliedAt: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-benefits">Beneficios</Label>
              <Textarea
                id="job-benefits"
                rows={4}
                value={formState.benefitsText}
                disabled={interactionsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, benefitsText: event.target.value }))
                }
                placeholder={"Um beneficio por linha\nUse 'Nome | Valor' se quiser incluir valor"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-description">Descricao da vaga</Label>
              <Textarea
                id="job-description"
                rows={6}
                value={formState.jobDescription}
                disabled={interactionsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, jobDescription: event.target.value }))
                }
                placeholder="Cole aqui a descricao manual da vaga."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-notes">Observacoes</Label>
              <Textarea
                id="job-notes"
                rows={4}
                value={formState.notes}
                disabled={interactionsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Anote follow-ups, contatos ou qualquer detalhe relevante."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={interactionsDisabled} onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={interactionsDisabled}>
                {editingApplication ? "Salvar alteracoes" : "Criar vaga"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vaga?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A vaga ${deleteTarget.role} em ${deleteTarget.company} sera removida permanentemente do tracker.`
                : "Esta acao nao pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={interactionsDisabled}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={interactionsDisabled} onClick={() => void handleDeleteApplication()}>
              Excluir vaga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
