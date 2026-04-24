"use client"

import { ArrowLeft, FileText, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  GeneratedResumeHistoryItem,
  GeneratedResumeHistoryResponse,
} from "@/lib/generated-resume-types"

import { GeneratedResumeCard } from "./generated-resume-card"

type GeneratedResumeHistoryProps = {
  items: GeneratedResumeHistoryItem[]
  pagination: GeneratedResumeHistoryResponse["pagination"]
  isLoading?: boolean
  error?: string | null
  onBack?: () => void
  onRetry?: () => void
  onPageChange?: (page: number) => void
  onStartResume?: () => void
  onDownloadPdf?: (resume: GeneratedResumeHistoryItem) => void
  onOpen?: (resume: GeneratedResumeHistoryItem) => void
}

function BackButton({ onBack }: { onBack?: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar ao perfil
    </button>
  )
}

function SectionHeader({ totalItems }: { totalItems: number }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
        Histórico
      </p>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
          Currículos recentes
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-600">
          Acesse os últimos currículos gerados pela IA e retome a versão certa para
          download ou visualização.
          {totalItems > 0 ? ` Mostrando ${totalItems} arquivo${totalItems === 1 ? "" : "s"} mais recente${totalItems === 1 ? "" : "s"}.` : ""}
        </p>
      </div>
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-[228px] animate-pulse rounded-[24px] border border-neutral-200 bg-white"
        />
      ))}
    </div>
  )
}

function EmptyState({
  onStartResume,
}: {
  onStartResume?: () => void
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-neutral-300 bg-white px-6 py-14 text-center shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-neutral-950">
        Nenhum currículo gerado ainda
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        Gere sua primeira versão ATS ou adapte seu currículo para uma vaga
        específica.
      </p>
      <Button className="mt-6 rounded-full px-5" onClick={onStartResume}>
        Melhorar currículo com IA
      </Button>
    </div>
  )
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-[28px] border border-rose-200 bg-white px-6 py-14 text-center shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
        <RefreshCcw className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-neutral-950">
        Não foi possível carregar seu histórico de currículos.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        {error}
      </p>
      <Button className="mt-6 rounded-full px-5" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: GeneratedResumeHistoryResponse["pagination"]
  onPageChange?: (page: number) => void
}) {
  if (pagination.totalPages <= 1) {
    return null
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => onPageChange?.(pagination.page - 1)}
        disabled={!pagination.hasPreviousPage}
      >
        Anterior
      </Button>

      <p className="text-sm text-neutral-600">
        Página {pagination.page} de {pagination.totalPages}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => onPageChange?.(pagination.page + 1)}
        disabled={!pagination.hasNextPage}
      >
        Próxima
      </Button>
    </div>
  )
}

export function GeneratedResumeHistory({
  items,
  pagination,
  isLoading = false,
  error = null,
  onBack,
  onRetry,
  onPageChange,
  onStartResume,
  onDownloadPdf,
  onOpen,
}: GeneratedResumeHistoryProps) {
  const totalItems = pagination.totalItems

  return (
    <div className="min-h-screen bg-neutral-100/70 px-6 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <BackButton onBack={onBack} />

        <section className="rounded-[32px] border border-white/70 bg-[#f5f6f8] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:px-8 md:py-8">
          <SectionHeader totalItems={totalItems} />

          <div className="mt-8">
            {error ? (
              <ErrorState error={error} onRetry={onRetry} />
            ) : isLoading ? (
              <HistorySkeleton />
            ) : items.length === 0 ? (
              <EmptyState onStartResume={onStartResume} />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((resume) => (
                    <GeneratedResumeCard
                      key={resume.id}
                      resume={resume}
                      onDownloadPdf={onDownloadPdf}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
                <PaginationControls
                  pagination={pagination}
                  onPageChange={onPageChange}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
