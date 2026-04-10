"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Layers3,
  Linkedin,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CVState } from "@/types/cv"

import { ImportResumeModal, type ResumeData } from "./resume-builder"
import { VisualResumeEditor, normalizeResumeData } from "./visual-resume-editor"

type ProfileResponse = {
  profile: {
    id: string
    source: string
    cvState: ResumeData
    linkedinUrl: string | null
    extractedAt: string
    createdAt: string
    updatedAt: string
  } | null
}

function trimOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function sanitizeResumeData(value: CVState): CVState {
  const experience = value.experience
    .map((entry) => ({
      title: entry.title.trim(),
      company: entry.company.trim(),
      location: trimOptional(entry.location),
      startDate: entry.startDate.trim(),
      endDate: entry.endDate.trim(),
      bullets: entry.bullets.map((bullet) => bullet.trim()).filter(Boolean),
    }))
    .filter(
      (entry) =>
        entry.title.length > 0 ||
        entry.company.length > 0 ||
        Boolean(entry.location) ||
        entry.startDate.length > 0 ||
        entry.endDate.length > 0 ||
        entry.bullets.length > 0,
    )

  const education = value.education
    .map((entry) => ({
      degree: entry.degree.trim(),
      institution: entry.institution.trim(),
      year: entry.year.trim(),
      gpa: trimOptional(entry.gpa),
    }))
    .filter(
      (entry) =>
        entry.degree.length > 0 ||
        entry.institution.length > 0 ||
        entry.year.length > 0 ||
        Boolean(entry.gpa),
    )

  const certifications = (value.certifications ?? [])
    .map((entry) => ({
      name: entry.name.trim(),
      issuer: entry.issuer.trim(),
      year: trimOptional(entry.year),
    }))
    .filter((entry) => entry.name.length > 0 || entry.issuer.length > 0 || Boolean(entry.year))

  return {
    fullName: value.fullName.trim(),
    email: value.email.trim(),
    phone: value.phone.trim(),
    linkedin: trimOptional(value.linkedin),
    location: trimOptional(value.location),
    summary: value.summary.trim(),
    experience,
    skills: value.skills.map((skill) => skill.trim()).filter(Boolean),
    education,
    certifications: certifications.length > 0 ? certifications : undefined,
  }
}

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-5 font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"

const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800"

export default function UserDataPage() {
  const router = useRouter()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [allSectionsClosed, setAllSectionsClosed] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar seu perfil.")
        }

        const data = (await response.json()) as ProfileResponse
        if (!isMounted) {
          return
        }

        if (data.profile) {
          setResumeData(normalizeResumeData(data.profile.cvState))
          setProfileSource(data.profile.source)
          setLastUpdatedAt(data.profile.updatedAt)
          return
        }

        setResumeData(normalizeResumeData())
        setProfileSource(null)
        setLastUpdatedAt(null)
      } catch (error) {
        if (isMounted) {
          toast.error(error instanceof Error ? error.message : "Erro ao carregar o perfil salvo.")
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleImportSuccess = (data: ResumeData) => {
    setIsImportOpen(false)
    setResumeData(normalizeResumeData(data))
    setProfileSource("linkedin")
    setLastUpdatedAt(new Date().toISOString())
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizeResumeData(resumeData)),
      })

      const data = (await response.json()) as ProfileResponse & { error?: string }
      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? "Nao foi possivel salvar seu perfil.")
      }

      setResumeData(normalizeResumeData(data.profile.cvState))
      setProfileSource(data.profile.source)
      setLastUpdatedAt(data.profile.updatedAt)
      toast.success("Perfil salvo com sucesso.")
      router.push("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil.")
    } finally {
      setIsSaving(false)
    }
  }

  const profileBadgeText = useMemo(() => {
    if (!profileSource) {
      return "Perfil ainda nao salvo"
    }

    if (profileSource === "linkedin") {
      return "Base salva a partir do LinkedIn"
    }

    if (profileSource === "manual") {
      return "Base salva manualmente"
    }

    return `Base salva via ${profileSource}`
  }, [profileSource])

  const filledSections = useMemo(() => {
    const hasContact = Boolean(
      resumeData.fullName || resumeData.email || resumeData.phone || resumeData.linkedin || resumeData.location,
    )
    const hasSummary = Boolean(resumeData.summary.trim())
    const hasExperience = resumeData.experience.some((entry) =>
      Boolean(entry.title.trim() || entry.company.trim() || entry.bullets.length > 0),
    )
    const hasSkills = resumeData.skills.length > 0
    const hasEducation = resumeData.education.some((entry) =>
      Boolean(entry.degree.trim() || entry.institution.trim() || entry.year.trim()),
    )
    const hasCertifications = Boolean(resumeData.certifications?.length)

    return [hasContact, hasSummary, hasExperience, hasSkills, hasEducation, hasCertifications].filter(Boolean).length
  }, [resumeData])

  const stats = [
    { label: "Seccoes preenchidas", value: `${filledSections}/6`, icon: Layers3 },
    { label: "Experiencias", value: `${resumeData.experience.length}`, icon: BadgeCheck },
    { label: "Skills", value: `${resumeData.skills.length}`, icon: Sparkles },
  ]

  const updatedLabel = lastUpdatedAt
    ? `Atualizado em ${new Date(lastUpdatedAt).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })} as ${new Date(lastUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })}`
    : "Nenhuma atualizacao salva ainda."

  return (
    <div
      data-testid="user-data-page"
      data-loading={String(isLoadingProfile)}
      className={cn(
        "relative overflow-hidden bg-slate-50/70 font-sans dark:bg-background",
        allSectionsClosed ? "min-h-screen md:h-screen md:overflow-y-hidden" : "min-h-screen",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.3),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.35),_transparent_28%),linear-gradient(to_bottom,rgba(15,23,42,0.16),transparent_36%)]" />

      <main
        className={cn(
          "relative mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-12",
          allSectionsClosed && "space-y-4 py-5 md:grid md:h-[100dvh] md:grid-rows-[auto,minmax(0,1fr),auto] md:gap-3 md:space-y-0 md:overflow-hidden md:py-3",
        )}
      >
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-border dark:bg-card/90">
          {allSectionsClosed ? (
            <div className="px-4 py-4 md:px-5 md:py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Base profissional
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="max-w-2xl text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-2xl">
                      Revise seu currículo com uma base limpa e consistente.
                    </h1>
                    <p className="max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400 md:text-sm">
                      Importe do LinkedIn, ajuste os campos manualmente e deixe seu perfil pronto para novas sessões.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:min-w-[280px]">
                  <Button
                    onClick={() => setIsImportOpen(true)}
                    className={cn("flex h-10 items-center gap-2 px-4", primaryButtonClassName)}
                  >
                    <Linkedin className="h-4 w-4" />
                    Importar do LinkedIn ou PDF
                  </Button>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-600 dark:border-border dark:bg-background/60 dark:text-slate-300">
                    {profileBadgeText}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {stats.map((stat) => {
                  const Icon = stat.icon

                  return (
                    <div
                      key={stat.label}
                      className="flex min-h-[122px] flex-col rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-4 dark:border-border dark:bg-background/50 md:min-h-[136px] md:px-4 md:py-4.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm dark:bg-card dark:text-slate-100 md:h-11 md:w-11">
                          <Icon className="h-4.5 w-4.5 md:h-5 md:w-5" />
                        </div>
                        <p className="text-[10px] leading-4 font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 md:text-[11px]">
                          {stat.label}
                        </p>
                      </div>
                      <p className="flex flex-1 items-center justify-center text-center text-[32px] font-semibold leading-none text-slate-900 dark:text-slate-100 md:text-[38px]">
                        {stat.value}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-8 px-5 py-7 md:grid-cols-[1.3fr_0.7fr] md:px-8 md:py-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Base profissional
                  </div>
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                    {"Revise seu curr\u00edculo com uma base limpa e consistente."}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 md:text-base">
                    {"Importe do LinkedIn, ajuste os campos manualmente e deixe seu perfil pronto para novas sess\u00f5es."}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    onClick={() => setIsImportOpen(true)}
                    className={cn("flex h-11 items-center gap-2", primaryButtonClassName)}
                  >
                    <Linkedin className="h-4 w-4" />
                    Importar do LinkedIn ou PDF
                  </Button>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-border dark:bg-background/60 dark:text-slate-300">
                    {profileBadgeText}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {stats.map((stat) => {
                  const Icon = stat.icon

                  return (
                    <div
                      key={stat.label}
                      className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-border dark:bg-background/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stat.value}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm dark:bg-card dark:text-slate-100">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div
            className={cn(
              "border-t border-slate-100 text-slate-500 dark:border-border dark:text-slate-400",
              allSectionsClosed ? "px-4 py-2 text-[11px] md:px-5" : "px-5 py-4 text-sm md:px-8",
            )}
          >
            {updatedLabel}
          </div>
        </section>

        {isLoadingProfile ? (
          <div className="flex min-h-64 items-center justify-center rounded-[28px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-border dark:bg-card/90">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando perfil salvo...
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "rounded-[28px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-border dark:bg-card/90",
                allSectionsClosed ? "min-h-0 p-3 md:h-full md:overflow-hidden md:p-3.5" : "p-4 md:p-6",
              )}
            >
              <VisualResumeEditor
                value={resumeData}
                onChange={setResumeData}
                disabled={isSaving}
                onAllSectionsClosedChange={setAllSectionsClosed}
                compactMode={allSectionsClosed}
              />
            </div>

            <div
              className={cn(
                "flex flex-col-reverse gap-3 pb-6 sm:flex-row sm:justify-end",
                allSectionsClosed && "gap-2 pb-3 md:items-center md:justify-end md:pb-0",
              )}
            >
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => router.push("/dashboard")}
                className={cn(secondaryButtonClassName, allSectionsClosed && "h-10 px-4")}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                data-testid="profile-save-button"
                className={cn(primaryButtonClassName, allSectionsClosed && "h-10 px-4")}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </>
        )}
      </main>

      <ImportResumeModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  )
}

