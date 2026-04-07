"use client"

import { useEffect, useState } from "react"
import { AlertCircle, FileText, Linkedin, Loader2, Upload } from "lucide-react"
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
          throw new Error("N\u00e3o foi poss\u00edvel acompanhar a importa\u00e7\u00e3o.")
        }

        const data = (await response.json()) as { status: JobStatus }
        setJobStatus(data.status)

        if (data.status === "completed") {
          window.clearInterval(interval)

          const profileResponse = await fetch("/api/profile", {
            credentials: "include",
          })
          if (!profileResponse.ok) {
            throw new Error("A importa\u00e7\u00e3o terminou, mas o perfil n\u00e3o p\u00f4de ser carregado.")
          }

          const profileData = (await profileResponse.json()) as ProfileResponse
          if (!profileData.profile) {
            throw new Error("A importa\u00e7\u00e3o terminou sem retornar dados de perfil.")
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
          toast.error("N\u00e3o foi poss\u00edvel importar seu perfil do LinkedIn.")
        }
      } catch (error) {
        window.clearInterval(interval)
        setJobId(null)
        setJobStatus(null)
        toast.error(
          error instanceof Error ? error.message : "Erro ao acompanhar a importa\u00e7\u00e3o do LinkedIn.",
        )
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
        throw new Error(data.error ?? "N\u00e3o foi poss\u00edvel iniciar a importa\u00e7\u00e3o.")
      }

      setJobId(data.jobId)
      setJobStatus("waiting")
      toast.info("Importa\u00e7\u00e3o iniciada. Estamos buscando seus dados no LinkedIn.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao iniciar a importa\u00e7\u00e3o do LinkedIn.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle>Importar perfil</DialogTitle>
          <DialogDescription>
            Use o LinkedIn para preencher sua base profissional e revise tudo antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                <Linkedin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">LinkedIn</h3>
                <p className="text-sm text-muted-foreground">
                  Cole o link do seu perfil p\u00fablico para importar seus dados agora.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="https://www.linkedin.com/in/seu-perfil"
                value={linkedinUrl}
                disabled={isSubmitting || jobId !== null}
                onChange={(event) => setLinkedinUrl(event.target.value)}
              />

              <Button
                type="button"
                className="w-full"
                disabled={isSubmitting || jobId !== null || linkedinUrl.trim().length === 0}
                onClick={() => void handleLinkedInImport()}
              >
                {isSubmitting || jobId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando perfil
                  </>
                ) : (
                  <>
                    <Linkedin className="h-4 w-4" />
                    Importar do LinkedIn
                  </>
                )}
              </Button>

              {jobStatus && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                  <div className="flex items-center gap-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Status da importa\u00e7\u00e3o: {jobStatus}
                  </div>
                  <p className="mt-2 text-blue-800 dark:text-blue-200">
                    Assim que terminar, os dados importados aparecem automaticamente no formul\u00e1rio.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">PDF ou DOCX</h3>
                <p className="text-sm text-muted-foreground">
                  Esta op\u00e7\u00e3o entra na pr\u00f3xima etapa. Por enquanto, use a importa\u00e7\u00e3o via LinkedIn
                  ou preencha manualmente.
                </p>
              </div>
            </div>

            <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <Upload className="mx-auto h-5 w-5" />
                <p>Arraste seu arquivo aqui ou clique para selecionar.</p>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Upload por PDF ainda n\u00e3o est\u00e1 habilitado nesta entrega.</p>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button disabled>PDF em breve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
