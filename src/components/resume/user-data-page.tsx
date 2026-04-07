"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Linkedin, Loader2, Moon, Sun } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import Logo from "@/components/logo"
import { Button } from "@/components/ui/button"
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
    .filter(
      (entry) => entry.name.length > 0 || entry.issuer.length > 0 || Boolean(entry.year),
    )

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

export default function UserDataPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("N\u00e3o foi poss\u00edvel carregar seu perfil.")
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

  const handleImportClose = () => {
    setIsImportOpen(false)
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
        throw new Error(data.error ?? "N\u00e3o foi poss\u00edvel salvar seu perfil.")
      }

      setResumeData(normalizeResumeData(data.profile.cvState))
      setProfileSource(data.profile.source)
      setLastUpdatedAt(data.profile.updatedAt)
      toast.success("Perfil salvo com sucesso.")
      router.push("/dashboard/resumes")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil.")
    } finally {
      setIsSaving(false)
    }
  }

  const profileBadgeText = useMemo(() => {
    if (!profileSource) {
      return "Perfil ainda n\u00e3o salvo"
    }

    if (profileSource === "linkedin") {
      return "Base salva a partir do LinkedIn"
    }

    if (profileSource === "manual") {
      return "Base salva manualmente"
    }

    return `Base salva via ${profileSource}`
  }, [profileSource])

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans dark:bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 dark:bg-card md:px-8">
        <Logo size="sm" linkTo="/dashboard" />
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Alternar tema"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/resumes")}
            className="hidden rounded-full font-medium text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 sm:flex"
          >
            Cancelar
          </Button>
          <Button
            disabled={isLoadingProfile || isSaving}
            onClick={() => void handleSave()}
            className="rounded-full bg-blue-600 px-4 font-semibold text-white shadow-sm hover:bg-blue-700 sm:px-6"
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
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:py-12">
        <div className="mb-10 flex flex-col items-center space-y-6 text-center">
          <Button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/50 px-6 py-6 font-semibold text-blue-700 shadow-sm hover:bg-blue-100 hover:text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
          >
            <Linkedin className="h-5 w-5" />
            <span>Importar do LinkedIn ou PDF</span>
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Configure seu perfil profissional
            </h1>
            <p className="mx-auto max-w-lg text-slate-500 dark:text-slate-400">
              Preencha os dados manualmente ou importe do LinkedIn. Esse perfil salva sua base
              profissional e abastece novas sess\u00f5es automaticamente.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-border dark:bg-card dark:text-slate-300">
            {profileBadgeText}
            {lastUpdatedAt ? ` • Atualizado em ${new Date(lastUpdatedAt).toLocaleDateString("pt-BR")}` : ""}
          </div>
        </div>

        {isLoadingProfile ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando perfil salvo...
            </div>
          </div>
        ) : (
          <>
            {profileSource && (
              <div className="flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  O perfil salvo funciona como base para novas sess\u00f5es. Editar e salvar aqui n\u00e3o altera
                  sess\u00f5es antigas nem cria vers\u00f5es em <code>cv_versions</code>.
                </p>
              </div>
            )}

            <VisualResumeEditor value={resumeData} onChange={setResumeData} disabled={isSaving} />
          </>
        )}
      </main>

      <ImportResumeModal
        isOpen={isImportOpen}
        onClose={handleImportClose}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  )
}
