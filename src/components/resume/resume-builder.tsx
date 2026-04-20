"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  CircleAlert,
  CheckCircle2,
  FileText,
  Linkedin,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CVState } from "@/types/cv"

export type ResumeData = Partial<CVState>
type JobStatus = "active" | "completed" | "failed" | "delayed" | "waiting"
type FileImportStage = "idle" | "uploading" | "queued" | "extracting" | "completed" | "failed"
type PdfImportJobStatus = "pending" | "processing" | "completed" | "failed"
export type ImportSource = "linkedin" | "pdf"

const importToastMessages = {
  linkedin: {
    loading: "Importando dados do LinkedIn...",
    success: "Perfil importado do LinkedIn com sucesso.",
    error: "Não foi possível importar seu perfil do LinkedIn.",
  },
  pdf: {
    loading: "Importando currículo em PDF...",
    success: "Currículo importado com sucesso.",
    error: "Não foi possível importar seu currículo.",
  },
} as const

type ImportResumeModalProps = {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (data: ResumeData, profilePhotoUrl?: string | null, source?: string | null) => void
  onImportStarted?: (source: ImportSource) => void
  onImportFinished?: () => void
  currentProfileSource?: string | null
  linkedinPollMs?: number
  pdfImportPollMs?: number
}

type ProfileResponse = {
  profile: {
    cvState: ResumeData
    profilePhotoUrl: string | null
    source?: string | null
  } | null
}

type ImportStatusResponse = {
  status: JobStatus
  error?: string
  errorMessage?: string
}

type PdfImportStatusResponse = {
  jobId: string
  status: PdfImportJobStatus
  errorMessage?: string
  warningMessage?: string
}

type FileUploadResponse = {
  profile?: {
    cvState: ResumeData
    profilePhotoUrl: string | null
    source: string
  } | null
  error?: string
  warning?: string
  requiresConfirmation?: boolean
  jobId?: string
  status?: PdfImportJobStatus
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case "waiting":
      return "Aguardando"
    case "active":
      return "Processando"
    case "completed":
      return "Conclu\u00edda"
    case "failed":
      return "Falhou"
    case "delayed":
      return "Atrasada"
  }
}

function fileImportLabel(stage: FileImportStage): string {
  switch (stage) {
    case "idle":
      return "Pronto para importar"
    case "uploading":
      return "Enviando arquivo"
    case "queued":
      return "Aguardando processamento"
    case "extracting":
      return "Extraindo e organizando dados"
    case "completed":
      return "Importa\u00e7\u00e3o conclu\u00edda"
    case "failed":
      return "Importa\u00e7\u00e3o falhou"
  }
}

export function ImportResumeModal({
  isOpen,
  onClose,
  onImportSuccess,
  onImportStarted,
  onImportFinished,
  currentProfileSource = null,
  linkedinPollMs = 2000,
  pdfImportPollMs = 1500,
}: ImportResumeModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeFileImportIdRef = useRef(0)
  const isFileImportInFlightRef = useRef(false)
  const keepImportStateOnCloseRef = useRef(false)
  const backgroundCloseResetTimeoutRef = useRef<number | null>(null)
  const activeImportToastIdRef = useRef<string | number | null>(null)
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLinkedinSubmitting, setIsLinkedinSubmitting] = useState(false)
  const [activeFileImportId, setActiveFileImportId] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [pdfImportJobId, setPdfImportJobId] = useState<string | null>(null)
  const [fileImportStage, setFileImportStage] = useState<FileImportStage>("idle")
  const [fileImportMessage, setFileImportMessage] = useState<string | null>(null)
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false)

  const invalidateActiveFileImport = (): void => {
    activeFileImportIdRef.current += 1
    isFileImportInFlightRef.current = false
    setActiveFileImportId(null)
  }

  const resetFileImportState = (): void => {
    setSelectedFile(null)
    setPdfImportJobId(null)
    setFileImportStage("idle")
    setFileImportMessage(null)
    setIsReplaceConfirmOpen(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = (): void => {
    invalidateActiveFileImport()
    resetFileImportState()
    onClose()
  }

  const showImportToast = (
    source: ImportSource,
    state: "loading" | "success" | "error",
    message?: string,
  ): void => {
    const toastId = `resume-import-${source}`
    activeImportToastIdRef.current = toastId

    const icon = state === "loading"
      ? <Loader2 className="h-4 w-4 animate-spin text-white" />
      : state === "success"
        ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        )
        : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
            <CircleAlert className="h-3.5 w-3.5" />
          </span>
        )

    const toastMethod = state === "loading"
      ? toast.loading
      : state === "success"
        ? toast.success
        : toast.error

    toastMethod(message ?? importToastMessages[source][state], {
      id: toastId,
      icon,
      duration: state === "loading" ? Infinity : 5000,
    })
  }

  const closeForBackgroundImport = (source: ImportSource): void => {
    if (backgroundCloseResetTimeoutRef.current) {
      window.clearTimeout(backgroundCloseResetTimeoutRef.current)
    }

    keepImportStateOnCloseRef.current = true
    onImportStarted?.(source)
    onClose()

    backgroundCloseResetTimeoutRef.current = window.setTimeout(() => {
      keepImportStateOnCloseRef.current = false
      backgroundCloseResetTimeoutRef.current = null
    }, 0)
  }

  useEffect(() => {
    if (!isOpen) {
      if (
        keepImportStateOnCloseRef.current
        && (isLinkedinSubmitting || activeFileImportId !== null || jobId !== null || pdfImportJobId !== null)
      ) {
        keepImportStateOnCloseRef.current = false
        return
      }

      invalidateActiveFileImport()
      resetFileImportState()
    }
  }, [activeFileImportId, isLinkedinSubmitting, isOpen, jobId, pdfImportJobId])

  useEffect(() => {
    return () => {
      if (activeImportToastIdRef.current) {
        toast.dismiss(activeImportToastIdRef.current)
      }
      if (backgroundCloseResetTimeoutRef.current) {
        window.clearTimeout(backgroundCloseResetTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!jobId) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/profile/status/${jobId}`, {
          credentials: "include",
        })
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(failure?.error ?? "N\u00e3o foi poss\u00edvel acompanhar a importa\u00e7\u00e3o.")
        }

        const data = (await response.json()) as ImportStatusResponse
        setJobStatus(data.status)

        if (data.status === "completed") {
          window.clearInterval(interval)

          const profileResponse = await fetch("/api/profile", {
            credentials: "include",
          })
          if (!profileResponse.ok) {
            throw new Error("A importa\u00e7\u00e3o terminou, mas o perfil n\u00e3o pode ser carregado.")
          }

          const profileData = (await profileResponse.json()) as ProfileResponse
          if (!profileData.profile) {
            throw new Error("A importa\u00e7\u00e3o terminou sem retornar dados de perfil.")
          }

          onImportSuccess(
            profileData.profile.cvState,
            profileData.profile.profilePhotoUrl ?? null,
            profileData.profile.source ?? "linkedin",
          )
          onImportFinished?.()
          setLinkedinUrl("")
          setJobId(null)
          setJobStatus(null)
          showImportToast("linkedin", "success")
        }

        if (data.status === "failed") {
          window.clearInterval(interval)
          onImportFinished?.()
          setJobId(null)
          setJobStatus("failed")
          showImportToast("linkedin", "error", data.errorMessage)
        }
      } catch (error) {
        window.clearInterval(interval)
        onImportFinished?.()
        setJobId(null)
        setJobStatus(null)
        showImportToast(
          "linkedin",
          "error",
          error instanceof Error ? error.message : "Erro ao acompanhar a importação do LinkedIn.",
        )
      }
    }, linkedinPollMs)

    return () => window.clearInterval(interval)
  }, [jobId, linkedinPollMs, onImportFinished, onImportSuccess])

  useEffect(() => {
    if (!pdfImportJobId) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/profile/upload/status/${pdfImportJobId}`, {
          credentials: "include",
        })
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(failure?.error ?? "N\u00e3o foi poss\u00edvel acompanhar a importa\u00e7\u00e3o do curr\u00edculo.")
        }

        const data = (await response.json()) as PdfImportStatusResponse

        if (data.status === "pending") {
          setFileImportStage("queued")
          setFileImportMessage("Seu PDF entrou na fila segura de processamento.")
          return
        }

        if (data.status === "processing") {
          setFileImportStage("extracting")
          setFileImportMessage("Extraindo o texto e preenchendo as se\u00e7\u00f5es automaticamente.")
          return
        }

        if (data.status === "completed") {
          window.clearInterval(interval)

          const profileResponse = await fetch("/api/profile", {
            credentials: "include",
          })
          if (!profileResponse.ok) {
            throw new Error("A importa\u00e7\u00e3o terminou, mas o perfil n\u00e3o pode ser carregado.")
          }

          const profileData = (await profileResponse.json()) as ProfileResponse
          if (!profileData.profile) {
            throw new Error("A importa\u00e7\u00e3o terminou sem retornar dados de perfil.")
          }

          onImportSuccess(
            profileData.profile.cvState,
            profileData.profile.profilePhotoUrl ?? null,
            profileData.profile.source ?? "pdf",
          )
          onImportFinished?.()
          resetFileImportState()
          setFileImportStage("completed")
          setFileImportMessage("Os dados importados j\u00e1 foram aplicados ao formul\u00e1rio.")
          showImportToast(
            "pdf",
            "success",
            data.warningMessage
              ? `Currículo importado com sucesso. ${data.warningMessage}`
              : undefined,
          )
          return
        }

        if (data.status === "failed") {
          window.clearInterval(interval)
          onImportFinished?.()
          setPdfImportJobId(null)
          setFileImportStage("failed")
          setFileImportMessage(null)
          showImportToast("pdf", "error", data.errorMessage)
        }
      } catch (error) {
        window.clearInterval(interval)
        onImportFinished?.()
        setPdfImportJobId(null)
        setFileImportStage("failed")
        setFileImportMessage(null)
        showImportToast(
          "pdf",
          "error",
          error instanceof Error ? error.message : "Erro ao acompanhar a importação do currículo.",
        )
      }
    }, pdfImportPollMs)

    return () => window.clearInterval(interval)
  }, [onImportFinished, onImportSuccess, pdfImportJobId, pdfImportPollMs])

  const handleLinkedInImport = async (): Promise<void> => {
    setIsLinkedinSubmitting(true)
    closeForBackgroundImport("linkedin")
    showImportToast("linkedin", "loading")

    try {
      const response = await fetch("/api/profile/extract", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ linkedinUrl }),
      })

      const data = (await response.json()) as { error?: string; jobId?: string }
      if (!response.ok || !data.jobId) {
        throw new Error(data.error ?? "N\u00e3o foi poss\u00edvel iniciar a importa\u00e7\u00e3o.")
      }

      setJobId(data.jobId)
      setJobStatus("waiting")
    } catch (error) {
      onImportFinished?.()
      showImportToast(
        "linkedin",
        "error",
        error instanceof Error ? error.message : "Erro ao iniciar a importação do LinkedIn.",
      )
    } finally {
      setIsLinkedinSubmitting(false)
    }
  }

  const runFileImport = async (replaceLinkedinImport: boolean): Promise<void> => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo PDF para importar.")
      return
    }

    if (isFileImportInFlightRef.current) {
      return
    }

    isFileImportInFlightRef.current = true
    const importId = activeFileImportIdRef.current + 1
    activeFileImportIdRef.current = importId
    setActiveFileImportId(importId)
    setFileImportStage("uploading")
    setFileImportMessage("Estamos enviando seu curr\u00edculo para leitura segura.")
    closeForBackgroundImport("pdf")
    showImportToast("pdf", "loading")

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("replaceLinkedinImport", String(replaceLinkedinImport))

      setFileImportStage("extracting")
      setFileImportMessage("Extraindo o texto e preenchendo as se\u00e7\u00f5es automaticamente.")

      const response = await fetch("/api/profile/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = (await response.json()) as FileUploadResponse
      if (response.status === 409 && data.requiresConfirmation) {
        onImportFinished?.()
        if (activeImportToastIdRef.current) {
          toast.dismiss(activeImportToastIdRef.current)
          activeImportToastIdRef.current = null
        }
        setIsReplaceConfirmOpen(true)
        return
      }

      if (response.status === 202 && data.jobId) {
        if (activeFileImportIdRef.current !== importId) {
          return
        }

        setPdfImportJobId(data.jobId)
        setFileImportStage(data.status === "processing" ? "extracting" : "queued")
        setFileImportMessage(
          data.status === "processing"
            ? "Extraindo o texto e preenchendo as se\u00e7\u00f5es automaticamente."
            : "Seu PDF entrou na fila segura de processamento.",
        )
        return
      }

      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? "N\u00e3o foi poss\u00edvel importar seu curr\u00edculo.")
      }

      if (activeFileImportIdRef.current !== importId) {
        return
      }

      onImportSuccess(
        data.profile.cvState,
        data.profile.profilePhotoUrl ?? null,
        data.profile.source,
      )
      onImportFinished?.()
      resetFileImportState()
      setFileImportStage("completed")
      setFileImportMessage("Os dados importados j\u00e1 foram aplicados ao formul\u00e1rio.")
      showImportToast(
        "pdf",
        "success",
        data.warning ? `Currículo importado com sucesso. ${data.warning}` : undefined,
      )
    } catch (error) {
      if (activeFileImportIdRef.current !== importId) {
        return
      }

      setFileImportStage("failed")
      setFileImportMessage(null)
      onImportFinished?.()
      showImportToast(
        "pdf",
        "error",
        error instanceof Error ? error.message : "Erro ao importar seu currículo.",
      )
    } finally {
      if (activeFileImportIdRef.current === importId) {
        isFileImportInFlightRef.current = false
        setActiveFileImportId(null)
      }
    }
  }

  const handleFileImport = async (): Promise<void> => {
    if (currentProfileSource === "linkedin") {
      setIsReplaceConfirmOpen(true)
      return
    }

    await runFileImport(false)
  }

  const isBusy = isLinkedinSubmitting || activeFileImportId !== null || jobId !== null || pdfImportJobId !== null
  const showFileStatus = fileImportStage !== "idle"

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="overflow-hidden sm:max-w-3xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-500" />
          <DialogHeader className="space-y-4 pt-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              {"Importa\u00e7\u00e3o guiada"}
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl">Importar perfil profissional</DialogTitle>
              <DialogDescription>
                {"Use o LinkedIn ou um curr\u00edculo em PDF para preencher sua base profissional e revisar tudo antes de salvar."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Linkedin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">LinkedIn</h3>
                  <p className="text-sm text-muted-foreground">
                    {"Cole o link do seu perfil p\u00fablico e acompanhe a importa\u00e7\u00e3o em tempo real."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="https://www.linkedin.com/in/seu-perfil"
                  value={linkedinUrl}
                  disabled={isBusy}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                />

                <Button
                  type="button"
                  className="w-full rounded-full"
                  disabled={isBusy || linkedinUrl.trim().length === 0}
                  onClick={() => void handleLinkedInImport()}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando perfil
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Importar do LinkedIn
                    </>
                  )}
                </Button>

                {jobStatus && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                    <div className="flex items-center gap-2 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Status da importa\u00e7\u00e3o: {statusLabel(jobStatus)}
                    </div>
                    <p className="mt-2 text-blue-800 dark:text-blue-200">
                      {"Assim que terminar, os dados importados aparecem automaticamente no formul\u00e1rio."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">PDF</h3>
                  <p className="text-sm text-muted-foreground">
                    {"Envie seu curr\u00edculo para preencher a base profissional usando a mesma estrutura do editor."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="resume-file-upload"
                  className="flex min-h-36 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <div className="space-y-2">
                    <Upload className="mx-auto h-5 w-5" />
                    <p>{selectedFile ? selectedFile.name : "Clique para selecionar um PDF."}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                      {"At\u00e9 5 MB"}
                    </p>
                  </div>
                </label>

                <Input
                  ref={fileInputRef}
                  id="resume-file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,application/pdf"
                  aria-label="Clique para selecionar um PDF."
                  disabled={isBusy}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />

                <Button
                  type="button"
                  className="w-full rounded-full"
                  disabled={isBusy || !selectedFile}
                  onClick={() => void handleFileImport()}
                >
                  {activeFileImportId !== null ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {"Importando curr\u00edculo"}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Importar arquivo
                    </>
                  )}
                </Button>

                {showFileStatus ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100">
                    <div className="flex items-center gap-2 font-medium">
                      {fileImportStage === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Loader2 className={`h-4 w-4 ${fileImportStage === "failed" ? "" : "animate-spin"}`} />
                      )}
                      Status da importa\u00e7\u00e3o: {fileImportLabel(fileImportStage)}
                    </div>
                    {fileImportMessage ? (
                      <p className="mt-2 text-slate-700 dark:text-slate-300">{fileImportMessage}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {"PDFs escaneados podem n\u00e3o ter texto suficiente para leitura autom\u00e1tica. Se isso acontecer, use um PDF com texto selecion\u00e1vel ou preencha manualmente."}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={handleClose} className="rounded-full">
              Fechar
            </Button>
            <Button
              type="button"
              disabled={isBusy || !selectedFile}
              className="rounded-full"
              onClick={() => void handleFileImport()}
            >
              Importar arquivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isReplaceConfirmOpen} onOpenChange={setIsReplaceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir perfil importado do LinkedIn?</AlertDialogTitle>
            <AlertDialogDescription>
              {"Voc\u00ea j\u00e1 importou seu perfil pelo LinkedIn. Se continuar, vamos substituir essas informa\u00e7\u00f5es pelos dados extra\u00eddos do PDF."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                setIsReplaceConfirmOpen(false)
                void runFileImport(true)
              }}
            >
              Substituir pelo PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
