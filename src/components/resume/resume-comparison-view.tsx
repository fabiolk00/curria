"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ResumeEditorModal } from "@/components/dashboard/resume-editor-modal"
import Logo from "@/components/logo"
import { cn } from "@/lib/utils"
import type { CVState } from "@/types/cv"

type ResumeComparisonViewProps = {
  originalCvState: CVState
  optimizedCvState: CVState
  generationType: "ATS_ENHANCEMENT" | "JOB_TARGETING"
  sessionId: string
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
        "relative h-full rounded-lg border bg-white shadow-sm dark:bg-zinc-950",
        "p-4 sm:p-6 md:p-8",
        isOptimized
          ? "border-emerald-200 dark:border-emerald-900/50"
          : "border-zinc-200 dark:border-zinc-800"
      )}
    >
      {/* Action buttons */}
      {isOptimized && (onEdit || onDownload) && (
        <div className="absolute right-2 top-2 flex gap-1 sm:right-4 sm:top-4">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:h-8 sm:w-8"
              title="Editar curriculo"
            >
              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:h-8 sm:w-8"
              title="Download PDF"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
              ) : (
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-4 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:mb-6 sm:pb-6">
        <h2 className="flex items-center pr-16 text-base font-bold text-zinc-900 dark:text-zinc-100 sm:pr-0 sm:text-xl">
          {cvState.fullName || "Seu Nome"}
          {isOptimized && (
            <ChangeIndicator show={hasTextChanged(compare.fullName, cvState.fullName)} />
          )}
        </h2>
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400 sm:mt-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1 sm:text-sm">
          {cvState.email && <span className="truncate">{cvState.email}</span>}
          {cvState.phone && <span>{cvState.phone}</span>}
          {cvState.location && <span className="truncate">{cvState.location}</span>}
        </div>
      </div>

      {/* Summary */}
      {cvState.summary && (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Resumo
            {isOptimized && (
              <ChangeIndicator show={hasTextChanged(compare.summary, cvState.summary)} />
            )}
          </h3>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-sm">
            {cvState.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {cvState.experience.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-2 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-3 sm:text-xs">
            Experiencia
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.experience, cvState.experience)} />
            )}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {cvState.experience.slice(0, 3).map((exp, index) => {
              const originalExp = compare.experience[index]
              const expChanged = isOptimized && originalExp && 
                JSON.stringify(originalExp) !== JSON.stringify(exp)

              return (
                <div key={`${exp.title}-${index}`}>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 sm:text-sm">
                        <span className="truncate">{exp.title}</span>
                        {expChanged && <ChangeIndicator show />}
                      </p>
                      <p className="truncate text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                        {exp.company}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-500 sm:text-xs">
                      {exp.startDate} - {exp.endDate}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 sm:mt-2 sm:space-y-1">
                      {exp.bullets.slice(0, 2).map((bullet, bulletIndex) => {
                        const originalBullet = originalExp?.bullets?.[bulletIndex]
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
                                  : "bg-zinc-400 dark:bg-zinc-600"
                              )}
                            />
                            <span className="line-clamp-2">{bullet}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Skills */}
      {cvState.skills.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Skills
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.skills, cvState.skills)} />
            )}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {cvState.skills.slice(0, 8).map((skill, index) => {
              const isNew = isOptimized && !compare.skills.includes(skill)

              return (
                <span
                  key={`${skill}-${index}`}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-xs",
                    isNew
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  {skill}
                  {isNew && <span className="ml-0.5 text-emerald-500 sm:ml-1">+</span>}
                </span>
              )
            })}
            {cvState.skills.length > 8 && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:px-2.5 sm:text-xs">
                +{cvState.skills.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Education */}
      {cvState.education.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Educacao
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.education, cvState.education)} />
            )}
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            {cvState.education.slice(0, 2).map((edu, index) => (
              <div key={`${edu.degree}-${index}`}>
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 sm:text-sm">
                  {edu.degree}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  {edu.institution} {edu.year && `- ${edu.year}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {cvState.certifications && cvState.certifications.length > 0 && (
        <div>
          <h3 className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-2 sm:text-xs">
            Certificacoes
            {isOptimized && (
              <ChangeIndicator
                show={hasArrayChanged(compare.certifications || [], cvState.certifications)}
              />
            )}
          </h3>
          <div className="space-y-0.5 sm:space-y-1">
            {cvState.certifications.slice(0, 2).map((cert, index) => (
              <p key={index} className="text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                {cert.name} {cert.issuer && `- ${cert.issuer}`}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ResumeComparisonView({
  originalCvState,
  optimizedCvState,
  generationType,
  sessionId,
  onContinue,
  onCvStateUpdate,
  className,
}: ResumeComparisonViewProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [currentOptimizedCvState, setCurrentOptimizedCvState] = useState(optimizedCvState)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const title =
    generationType === "JOB_TARGETING"
      ? "Curriculo adaptado para a vaga"
      : "Curriculo otimizado para ATS"

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      
      const { getDownloadUrls } = await import("@/lib/dashboard/workspace-client")
      const urls = await getDownloadUrls(sessionId)
      
      if (!urls.pdfUrl) {
        throw new Error("PDF not available")
      }

      const response = await fetch(urls.pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to download PDF (${response.status})`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = `curriculo-otimizado.pdf`
      anchor.rel = "noopener noreferrer"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error("Failed to download PDF:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleEditorSaved = () => {
    onCvStateUpdate?.(currentOptimizedCvState)
  }

  return (
    <div
      data-testid="resume-comparison-view"
      className={cn(
        "flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900",
        className
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "shrink-0 border-b border-zinc-200 bg-white px-4 py-3 transition-all duration-500 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 sm:py-4",
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Logo and title */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="shrink-0">
              <Logo linkTo="#" size="default" />
            </div>
            <div className="hidden h-6 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100 lg:text-lg">
                {title}
              </h1>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 lg:text-sm">
                Compare as alteracoes lado a lado
              </p>
            </div>
          </div>

          {/* Button - hidden on mobile, shown in footer instead */}
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

        {/* Mobile subtitle */}
        <div className="mt-2 sm:hidden">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Compare as alteracoes lado a lado
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
        <div
          className={cn(
            "mx-auto grid max-w-7xl gap-4 transition-all duration-700 sm:gap-6 lg:grid-cols-2",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          {/* Original */}
          <div>
            <div className="mb-2 flex items-center gap-2 sm:mb-3">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:text-sm">
                Original
              </span>
            </div>
            <ResumeDocument cvState={originalCvState} variant="original" />
          </div>

          {/* Optimized */}
          <div>
            <div className="mb-2 flex items-center gap-2 sm:mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:text-sm">
                Otimizado
              </span>
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

      {/* Mobile footer */}
      <div className="shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:hidden">
        <Button
          onClick={onContinue}
          className="w-full gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Perfil
        </Button>
      </div>

      {/* Editor Modal */}
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
