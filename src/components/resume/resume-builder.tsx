"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Linkedin,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

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
type FileImportStage = "idle" | "uploading" | "extracting" | "completed" | "failed"

type ImportResumeModalProps = {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (data: ResumeData, profilePhotoUrl?: string | null, source?: string | null) => void
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

type FileUploadResponse = {
  profile?: {
    cvState: ResumeData
    profilePhotoUrl: string | null
    source: string
  } | null
  error?: string
  warning?: string
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case "waiting":
      return "Aguardando"
    case "active":
      return "Processando"
    case "completed":
      return "Concluida"
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
    case "extracting":
      return "Extraindo e organizando dados"
    case "completed":
      return "Importacao concluida"
    case "failed":
      return "Importacao falhou"
  }
}

export function ImportResumeModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportResumeModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeFileImportIdRef = useRef(0)
  const isFileImportInFlightRef = useRef(false)
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLinkedinSubmitting, setIsLinkedinSubmitting] = useState(false)
  const [activeFileImportId, setActiveFileImportId] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [fileImportStage, setFileImportStage] = useState<FileImportStage>("idle")
  const [fileImportMessage, setFileImportMessage] = useState<string | null>(null)

  const invalidateActiveFileImport = (): void => {
    activeFileImportIdRef.current += 1
    isFileImportInFlightRef.current = false
    setActiveFileImportId(null)
  }

  const resetFileImportState = (): void => {
    setSelectedFile(null)
    setFileImportStage("idle")
    setFileImportMessage(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = (): void => {
    invalidateActiveFileImport()
    resetFileImportState()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) {
      invalidateActiveFileImport()
      resetFileImportState()
    }
  }, [isOpen])

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
          throw new Error(failure?.error ?? "Nao foi possivel acompanhar a importacao.")
        }

        const data = (await response.json()) as ImportStatusResponse
        setJobStatus(data.status)

        if (data.status === "completed") {
          window.clearInterval(interval)

          const profileResponse = await fetch("/api/profile", {
            credentials: "include",
          })
          if (!profileResponse.ok) {
            throw new Error("A importacao terminou, mas o perfil nao pode ser carregado.")
          }

          const profileData = (await profileResponse.json()) as ProfileResponse
          if (!profileData.profile) {
            throw new Error("A importacao terminou sem retornar dados de perfil.")
          }

          onImportSuccess(
            profileData.profile.cvState,
            profileData.profile.profilePhotoUrl ?? null,
            profileData.profile.source ?? "linkedin",
          )
          setLinkedinUrl("")
          setJobId(null)
          setJobStatus(null)
          toast.success("Perfil importado do LinkedIn com sucesso.")
        }

        if (data.status === "failed") {
          window.clearInterval(interval)
          setJobId(null)
          setJobStatus("failed")
          toast.error(data.errorMessage ?? "Nao foi possivel importar seu perfil do LinkedIn.")
        }
      } catch (error) {
        window.clearInterval(interval)
        setJobId(null)
        setJobStatus(null)
        toast.error(error instanceof Error ? error.message : "Erro ao acompanhar a importacao do LinkedIn.")
      }
    }, 2000)

    return () => window.clearInterval(interval)
  }, [jobId, onImportSuccess])

  const handleLinkedInImport = async (): Promise<void> => {
    setIsLinkedinSubmitting(true)

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
        throw new Error(data.error ?? "Nao foi possivel iniciar a importacao.")
      }

      setJobId(data.jobId)
      setJobStatus("waiting")
      toast.info("Importacao iniciada. Estamos buscando seus dados no LinkedIn.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar a importacao do LinkedIn.")
    } finally {
      setIsLinkedinSubmitting(false)
    }
  }

  const handleFileImport = async (): Promise<void> => {
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
    setFileImportMessage("Estamos enviando seu curriculo para leitura segura.")

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      setFileImportStage("extracting")
      setFileImportMessage("Extraindo o texto e preenchendo as secoes automaticamente.")

      const response = await fetch("/api/profile/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = (await response.json()) as FileUploadResponse
      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? "Nao foi possivel importar seu curriculo.")
      }

      if (activeFileImportIdRef.current !== importId || !isOpen) {
        return
      }

      onImportSuccess(
        data.profile.cvState,
        data.profile.profilePhotoUrl ?? null,
        data.profile.source,
      )
      resetFileImportState()
      setFileImportStage("completed")
      setFileImportMessage("Os dados importados ja foram aplicados ao formulario.")
      if (data.warning) {
        toast.warning(data.warning)
      }
      toast.success("Curriculo importado com sucesso.")
    } catch (error) {
      if (activeFileImportIdRef.current !== importId || !isOpen) {
        return
      }

      setFileImportStage("failed")
      setFileImportMessage(null)
      toast.error(error instanceof Error ? error.message : "Erro ao importar seu curriculo.")
    } finally {
      if (activeFileImportIdRef.current === importId) {
        isFileImportInFlightRef.current = false
        setActiveFileImportId(null)
      }
    }
  }

  const isBusy = isLinkedinSubmitting || activeFileImportId !== null || jobId !== null
  const showFileStatus = fileImportStage !== "idle"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="overflow-hidden sm:max-w-3xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-500" />
        <DialogHeader className="space-y-4 pt-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Importacao guiada
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-2xl">Importar perfil profissional</DialogTitle>
            <DialogDescription>
              Use o LinkedIn ou um curriculo em PDF para preencher sua base profissional e revisar tudo antes de salvar.
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
                  Cole o link do seu perfil publico e acompanhe a importacao em tempo real.
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
                    Status da importacao: {statusLabel(jobStatus)}
                  </div>
                  <p className="mt-2 text-blue-800 dark:text-blue-200">
                    Assim que terminar, os dados importados aparecem automaticamente no formulario.
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
                  Envie seu curriculo para preencher a base profissional usando a mesma estrutura do editor.
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
                    Ate 5 MB
                  </p>
                </div>
              </label>

              <Input
                ref={fileInputRef}
                id="resume-file-upload"
                type="file"
                className="sr-only"
                accept=".pdf,application/pdf"
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
                    Importando curriculo
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
                    Status da importacao: {fileImportLabel(fileImportStage)}
                  </div>
                  {fileImportMessage ? (
                    <p className="mt-2 text-slate-700 dark:text-slate-300">{fileImportMessage}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  PDFs escaneados podem nao ter texto suficiente para leitura automatica. Se isso acontecer, use um PDF com texto selecionavel ou preencha manualmente.
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
  )
}
