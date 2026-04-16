"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react"

import { ResumeEditorModal } from "@/components/dashboard/resume-editor-modal"
import Logo from "@/components/logo"
import { Button } from "@/components/ui/button"
import { getDownloadUrls } from "@/lib/dashboard/workspace-client"
import { cn } from "@/lib/utils"
import type { ResumeGenerationType } from "@/types/agent"
import type { CVState } from "@/types/cv"

type ResumeComparisonViewProps = {
  originalCvState: CVState
  optimizedCvState: CVState
  generationType: ResumeGenerationType
  sessionId: string
  targetJobDescription?: string
  originalScore?: number
  optimizedScore?: number
  scoreLabel?: string
  optimizationNotes?: string[]
  backHref?: string
  onContinue: () => void
  onCvStateUpdate?: (cvState: CVState) => void
  className?: string
}

function hasTextChanged(original: string, optimized: string): boolean {
  return original?.trim() !== optimized?.trim()
}

function hasArrayChanged<T>(original: T[], optimized: T[]): boolean {
  return JSON.stringify(original) !== JSON.stringify(optimized)
}

function ChangeIndicator({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <span className="ml-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 sm:ml-2 sm:h-2 sm:w-2" />
  )
}

function ResumeDocument({
  cvState,
  variant,
  originalCvState,
  onEdit,
  onDownload,
  isDownloading,
}: {
  cvState: CVState
  variant: "original" | "optimized"
  originalCvState?: CVState
  onEdit?: () => void
  onDownload?: () => void
  isDownloading?: boolean
}) {
  const isOptimized = variant === "optimized"
  const compare = originalCvState || cvState

  return (
    <div
      className={cn(
        "relative h-full rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-950 sm:p-6 md:p-8",
        isOptimized
          ? "border-emerald-200 dark:border-emerald-900/50"
          : "border-red-200 dark:border-red-900/50",
      )}
    >
      {isOptimized && (onEdit || onDownload) ? (
        <div className="absolute right-2 top-2 flex gap-1 sm:right-4 sm:top-4">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:h-8 sm:w-8"
              title="Editar currículo"
            >
              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          ) : null}
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:h-8 sm:w-8"
              title="Baixar PDF"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
              ) : (
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:mb-6 sm:pb-6">
        <h2 className="flex items-center pr-16 text-base font-bold text-zinc-900 dark:text-zinc-100 sm:pr-0 sm:text-xl">
          {cvState.fullName || "Seu nome"}
          {isOptimized ? (
            <ChangeIndicator show={hasTextChanged(compare.fullName, cvState.fullName)} />
          ) : null}
        </h2>
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400 sm:mt-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1 sm:text-sm">
          {cvState.email ? <span className="truncate">{cvState.email}</span> : null}
          {cvState.phone ? <span>{cvState.phone}</span> : null}
          {cvState.location ? <span className="truncate">{cvState.location}</span> : null}
        </div>
      </div>

      {cvState.summary ? (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Resumo
            {isOptimized ? (
              <ChangeIndicator show={hasTextChanged(compare.summary, cvState.summary)} />
            ) : null}
          </h3>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-sm">
            {cvState.summary}
          </p>
        </div>
      ) : null}

      {cvState.experience.length > 0 ? (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-2 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-3 sm:text-xs">
            Experiência
            {isOptimized ? (
              <ChangeIndicator show={hasArrayChanged(compare.experience, cvState.experience)} />
            ) : null}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {cvState.experience.map((experience, index) => {
              const originalExperience = compare.experience[index]
              const experienceChanged = isOptimized
                && originalExperience
                && JSON.stringify(originalExperience) !== JSON.stringify(experience)

              return (
                <div key={`${experience.title}-${index}`}>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 sm:text-sm">
                        <span className="truncate">{experience.title}</span>
                        {experienceChanged ? <ChangeIndicator show /> : null}
                      </p>
                      <p className="truncate text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                        {experience.company}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-500 sm:text-xs">
                      {experience.startDate} - {experience.endDate}
                    </span>
                  </div>
                  {experience.bullets.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5 sm:mt-2 sm:space-y-1">
                      {experience.bullets.map((bullet, bulletIndex) => {
                        const originalBullet = originalExperience?.bullets?.[bulletIndex]
                        const bulletChanged = isOptimized && originalBullet !== bullet

                        return (
                          <li
                            key={bulletIndex}
                            className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 sm:gap-2 sm:text-sm"
                          >
                            <span
                              className={cn(
                                "mt-1.5 h-1 w-1 shrink-0 rounded-full sm:mt-2",
                                bulletChanged
                                  ? "bg-emerald-500"
                                  : "bg-zinc-400 dark:bg-zinc-600",
                              )}
                            />
                            <span>{bullet}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {cvState.skills.length > 0 ? (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Skills
            {isOptimized ? (
              <ChangeIndicator show={hasArrayChanged(compare.skills, cvState.skills)} />
            ) : null}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {cvState.skills.map((skill, index) => {
              const isNew = isOptimized && !compare.skills.includes(skill)

              return (
                <span
                  key={`${skill}-${index}`}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-xs",
                    isNew
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                  )}
                >
                  {skill}
                  {isNew ? <span className="ml-0.5 text-emerald-500 sm:ml-1">+</span> : null}
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      {cvState.education.length > 0 ? (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Educação
            {isOptimized ? (
              <ChangeIndicator show={hasArrayChanged(compare.education, cvState.education)} />
            ) : null}
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            {cvState.education.map((education, index) => (
              <div key={`${education.degree}-${index}`}>
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 sm:text-sm">
                  {education.degree}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  {education.institution} {education.year ? `- ${education.year}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {cvState.certifications && cvState.certifications.length > 0 ? (
        <div>
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Certificações
            {isOptimized ? (
              <ChangeIndicator
                show={hasArrayChanged(compare.certifications || [], cvState.certifications)}
              />
            ) : null}
          </h3>
          <div className="space-y-0.5 sm:space-y-1">
            {cvState.certifications.map((certification, index) => (
              <p key={index} className="text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                {certification.name} {certification.issuer ? `- ${certification.issuer}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ResumeComparisonView({
  originalCvState,
  optimizedCvState,
  generationType,
  sessionId,
  targetJobDescription,
  originalScore,
  optimizedScore,
  scoreLabel = "Score ATS",
  optimizationNotes = [],
  backHref = "/dashboard/resume/new",
  onContinue,
  onCvStateUpdate,
  className,
}: ResumeComparisonViewProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [currentOptimizedCvState, setCurrentOptimizedCvState] = useState(optimizedCvState)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), 50)
    return () => window.clearTimeout(timer)
  }, [])

  const title = useMemo(
    () => generationType === "JOB_TARGETING" ? "Currículo adaptado para a vaga" : "Currículo otimizado para ATS",
    [generationType],
  )

  const handleDownload = async () => {
    try {
      setIsDownloading(true)

      const urls = await getDownloadUrls(sessionId)
      if (!urls.pdfUrl) {
        throw new Error("O PDF ainda não está disponível para download.")
      }

      const response = await fetch(urls.pdfUrl)
      if (!response.ok) {
        throw new Error(`Falha ao baixar o PDF (${response.status}).`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = generationType === "JOB_TARGETING" ? "currículo-vaga.pdf" : "currículo-ats.pdf"
      anchor.rel = "noopener noreferrer"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error("Falha ao baixar o PDF:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleEditorSaved = () => {
    setCurrentOptimizedCvState((current) => ({ ...current }))
    onCvStateUpdate?.(currentOptimizedCvState)
  }

  return (
    <div
      data-testid="resume-comparison-view"
      className={cn("flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900", className)}
    >
      <header
        className={cn(
          "shrink-0 border-b border-zinc-200 bg-white px-4 py-3 transition-all duration-500 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 sm:py-4",
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="shrink-0">
              <Logo linkTo={backHref} size="default" />
            </div>
            <div className="hidden h-6 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100 lg:text-lg">
                {title}
              </h1>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 lg:text-sm">
                Compare as alterações lado a lado
              </p>
            </div>
          </div>

          <Button
            onClick={onContinue}
            size="sm"
            className="hidden gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:flex sm:h-9 sm:px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline">Voltar ao Perfil</span>
            <span className="md:hidden">Voltar</span>
          </Button>
        </div>

        <div className="mt-2 sm:hidden">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Compare as alterações lado a lado
          </p>
        </div>
      </header>

      {optimizationNotes.length > 0 ? (
        <div className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 sm:text-sm">
              {optimizationNotes[0]}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
        <div
          className={cn(
            "mx-auto grid max-w-7xl gap-8 transition-all duration-700 sm:gap-6 lg:grid-cols-2",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <div>
            <div className="mb-2 flex items-center justify-between sm:mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400 sm:text-sm">
                  Original
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 sm:text-xs">{scoreLabel}:</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400 sm:text-xs">
                  {(originalScore ?? 0)}%
                </span>
              </div>
            </div>
            <ResumeDocument cvState={originalCvState} variant="original" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between sm:mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:text-sm">
                  Otimizado
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 sm:text-xs">{scoreLabel}:</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 sm:text-xs">
                  {(optimizedScore ?? 0)}%
                </span>
              </div>
            </div>
            <ResumeDocument
              cvState={currentOptimizedCvState}
              variant="optimized"
              originalCvState={originalCvState}
              onEdit={() => setIsEditorOpen(true)}
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:hidden">
        <Button
          onClick={onContinue}
          className="w-full gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Perfil
        </Button>
      </div>

      <ResumeEditorModal
        sessionId={sessionId}
        targetId={null}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSaved={handleEditorSaved}
      />
    </div>
  )
}
