"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, Pencil } from "lucide-react"

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
    <span className="ml-2 inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
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
        "relative h-full rounded-lg border bg-white p-8 shadow-sm dark:bg-zinc-950",
        isOptimized
          ? "border-emerald-200 dark:border-emerald-900/50"
          : "border-zinc-200 dark:border-zinc-800"
      )}
    >
      {/* Action buttons */}
      {isOptimized && (onEdit || onDownload) && (
        <div className="absolute right-4 top-4 flex gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Editar curriculo"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Download PDF"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 border-b border-zinc-100 pb-6 dark:border-zinc-800">
        <h2 className="flex items-center text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {cvState.fullName || "Seu Nome"}
          {isOptimized && (
            <ChangeIndicator show={hasTextChanged(compare.fullName, cvState.fullName)} />
          )}
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {cvState.email && <span>{cvState.email}</span>}
          {cvState.phone && <span>{cvState.phone}</span>}
          {cvState.location && <span>{cvState.location}</span>}
        </div>
      </div>

      {/* Summary */}
      {cvState.summary && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Resumo
            {isOptimized && (
              <ChangeIndicator show={hasTextChanged(compare.summary, cvState.summary)} />
            )}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {cvState.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {cvState.experience.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Experiencia
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.experience, cvState.experience)} />
            )}
          </h3>
          <div className="space-y-4">
            {cvState.experience.slice(0, 3).map((exp, index) => {
              const originalExp = compare.experience[index]
              const expChanged = isOptimized && originalExp && 
                JSON.stringify(originalExp) !== JSON.stringify(exp)

              return (
                <div key={`${exp.title}-${index}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="flex items-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {exp.title}
                        {expChanged && <ChangeIndicator show />}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {exp.company}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-500">
                      {exp.startDate} - {exp.endDate}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.bullets.slice(0, 3).map((bullet, bulletIndex) => {
                        const originalBullet = originalExp?.bullets?.[bulletIndex]
                        const bulletChanged = isOptimized && originalBullet !== bullet

                        return (
                          <li
                            key={bulletIndex}
                            className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                          >
                            <span
                              className={cn(
                                "mt-2 h-1 w-1 shrink-0 rounded-full",
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
        <div className="mb-6">
          <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Skills
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.skills, cvState.skills)} />
            )}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {cvState.skills.map((skill, index) => {
              const isNew = isOptimized && !compare.skills.includes(skill)

              return (
                <span
                  key={`${skill}-${index}`}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    isNew
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  {skill}
                  {isNew && <span className="ml-1 text-emerald-500">+</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Education */}
      {cvState.education.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Educacao
            {isOptimized && (
              <ChangeIndicator show={hasArrayChanged(compare.education, cvState.education)} />
            )}
          </h3>
          <div className="space-y-2">
            {cvState.education.map((edu, index) => (
              <div key={`${edu.degree}-${index}`}>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {edu.degree}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
          <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Certificacoes
            {isOptimized && (
              <ChangeIndicator
                show={hasArrayChanged(compare.certifications || [], cvState.certifications)}
              />
            )}
          </h3>
          <div className="space-y-1">
            {cvState.certifications.map((cert, index) => (
              <p key={index} className="text-sm text-zinc-600 dark:text-zinc-400">
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
      
      // Import dynamically to avoid SSR issues
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
      console.error("[v0] Failed to download PDF:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleEditorSaved = () => {
    // Refresh the optimized CV state after editing
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
          "shrink-0 border-b border-zinc-200 bg-white px-6 py-4 transition-all duration-500 dark:border-zinc-800 dark:bg-zinc-950",
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <Logo linkTo="#" size="default" />
            <div className="hidden h-6 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Compare as alteracoes lado a lado
              </p>
            </div>
          </div>
          <Button
            onClick={onContinue}
            className="gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Voltar ao Perfil
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className={cn(
            "mx-auto grid max-w-7xl gap-6 transition-all duration-700 lg:grid-cols-2",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          {/* Original */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Original
              </span>
            </div>
            <ResumeDocument cvState={originalCvState} variant="original" />
          </div>

          {/* Optimized */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
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
      <div className="shrink-0 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
        <Button
          onClick={onContinue}
          className="w-full gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
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
