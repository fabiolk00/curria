"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
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

type ImportResumeModalProps = {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (data: ResumeData) => void
}

type ProfileResponse = {
  profile: {
    cvState: ResumeData
  } | null
}

type ImportStatusResponse = {
  status: JobStatus
  error?: string
  errorMessage?: string
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

export function ImportResumeModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportResumeModalProps) {
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)

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

          onImportSuccess(profileData.profile.cvState)
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
    setIsSubmitting(true)

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
      setIsSubmitting(false)
    }
  }

  const isBusy = isSubmitting || jobId !== null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-500" />
        <DialogHeader className="space-y-4 pt-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Importacao guiada
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-2xl">Importar perfil profissional</DialogTitle>
            <DialogDescription>
              Use o LinkedIn para preencher sua base profissional e revisar tudo antes de salvar.
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
                  Cole o link do seu perfil público e acompanhe a importação em tempo real.
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
                    Assim que terminar, os dados importados aparecem automaticamente no formulário.
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
                <h3 className="font-semibold text-foreground">PDF ou DOCX</h3>
                <p className="text-sm text-muted-foreground">
                  Esta opção ainda está em preparação. Por enquanto, use o LinkedIn ou preencha manualmente.
                </p>
              </div>
            </div>

            <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <Upload className="mx-auto h-5 w-5" />
                <p>Arraste seu arquivo aqui ou clique para selecionar.</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                  Upload ainda indisponível
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Upload por PDF ainda não está habilitado nesta entrega. O fluxo ativo continua sendo o LinkedIn.
              </p>
            </div>
          </section>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Fechar
          </Button>
          <Button disabled className="rounded-full">
            PDF em breve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
