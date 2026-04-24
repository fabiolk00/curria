import { ArrowUpRight, Download, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GeneratedResumeHistoryItem } from "@/lib/generated-resume-types"
import { cn } from "@/lib/utils"

type GeneratedResumeCardProps = {
  resume: GeneratedResumeHistoryItem
  onDownloadPdf?: (resume: GeneratedResumeHistoryItem) => void
  onOpen?: (resume: GeneratedResumeHistoryItem) => void
}

const statusLabelMap = {
  completed: "Concluído",
  failed: "Falhou",
  processing: "Processando",
} as const

const statusClassNameMap = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  processing: "border-amber-200 bg-amber-50 text-amber-700",
} as const

const sourceLabelMap = {
  ats_enhancement: "ATS geral",
  chat: "Chat",
  target_job: "Vaga alvo",
} as const

const sourceClassNameMap = {
  ats_enhancement: "border-slate-200 bg-slate-100 text-slate-700",
  chat: "border-blue-200 bg-blue-50 text-blue-700",
  target_job: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const

export function GeneratedResumeCard({
  resume,
  onDownloadPdf,
  onOpen,
}: GeneratedResumeCardProps) {
  const canDownloadPdf = resume.pdfAvailable && Boolean(resume.downloadPdfUrl)
  const canOpen = Boolean(resume.viewerUrl || resume.sessionId)

  return (
    <article className="group flex h-full flex-col rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.32)]">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-500">
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", sourceClassNameMap[resume.kind])}
              >
                {sourceLabelMap[resume.kind]}
              </Badge>
              <Badge
                variant="outline"
                className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusClassNameMap[resume.status])}
              >
                {statusLabelMap[resume.status]}
              </Badge>
            </div>

            <div className="space-y-1">
              <h3 className="line-clamp-2 text-base font-semibold text-neutral-950">
                {resume.title}
              </h3>
              {resume.description ? (
                <p className="line-clamp-3 text-sm leading-6 text-neutral-600">
                  {resume.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <p className="text-xs font-medium text-neutral-500">
          {resume.relativeCreatedAt}
        </p>

        <div className="flex items-center gap-2">
          {canDownloadPdf ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full border-neutral-200 text-neutral-700 hover:border-neutral-300"
              aria-label={`Baixar PDF de ${resume.title}`}
              onClick={() => onDownloadPdf?.(resume)}
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full border-neutral-200 text-neutral-700 hover:border-neutral-300"
            aria-label={`Visualizar ${resume.title}`}
            onClick={() => onOpen?.(resume)}
            disabled={!canOpen}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  )
}
