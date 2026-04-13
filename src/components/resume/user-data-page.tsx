"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  Layers3,
  Linkedin,
  Loader2,
  Upload,
  MapPin,
  Sparkles,
  Target,
  TextSelect,
  ListChecks,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { assessAtsEnhancementReadiness } from "@/lib/profile/ats-enhancement"
import { cvStateToTemplateData } from "@/lib/templates/cv-state-to-template-data"
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
    profilePhotoUrl: string | null
    extractedAt: string
    createdAt: string
    updatedAt: string
  } | null
}

type UserDataPageProps = {
  currentCredits?: number
  userImageUrl?: string | null
}

type AtsFeature = {
  id: string
  label: string
  icon: typeof FileSearch
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

const atsFeatures: AtsFeature[] = [
  { id: "analysis", label: "analise ATS geral", icon: FileSearch },
  { id: "keywords", label: "melhoria de palavras-chave", icon: Target },
  { id: "structure", label: "melhoria de estrutura", icon: ListChecks },
  { id: "rewrite", label: "rewrite otimizado para ATS", icon: TextSelect },
]

function formatUpdatedLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) {
    return "Nenhuma atualizacao salva ainda."
  }

  return `Atualizado em ${new Date(lastUpdatedAt).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })} as ${new Date(lastUpdatedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })}`
}

function buildInitials(fullName: string): string {
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")

  return initials || "CV"
}

export default function UserDataPage({
  currentCredits = 0,
  userImageUrl = null,
}: UserDataPageProps) {
  const router = useRouter()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAtsEnhancement, setIsRunningAtsEnhancement] = useState(false)
  const [allSectionsClosed, setAllSectionsClosed] = useState(false)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false)

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
          setProfilePhotoUrl(data.profile.profilePhotoUrl)
          setLastUpdatedAt(data.profile.updatedAt)
          return
        }

        setResumeData(normalizeResumeData())
        setProfileSource(null)
        setProfilePhotoUrl(null)
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

  const handleImportSuccess = (
    data: ResumeData,
    nextProfilePhotoUrl?: string | null,
    nextProfileSource?: string | null,
  ) => {
    setIsImportOpen(false)
    setResumeData(normalizeResumeData(data))
    setProfileSource(nextProfileSource ?? "linkedin")
    setProfilePhotoUrl(nextProfilePhotoUrl ?? null)
    setLastUpdatedAt(new Date().toISOString())
  }

  const persistProfile = async (): Promise<void> => {
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
    setProfilePhotoUrl(data.profile.profilePhotoUrl)
    setLastUpdatedAt(data.profile.updatedAt)
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)

    try {
      await persistProfile()
      toast.success("Perfil salvo com sucesso.")
      router.push("/dashboard/resume/new")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAtsEnhancement = async (): Promise<void> => {
    setIsRunningAtsEnhancement(true)

    try {
      await persistProfile()

      const response = await fetch("/api/profile/ats-enhancement", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizeResumeData(resumeData)),
      })

      const data = (await response.json()) as {
        success?: boolean
        sessionId?: string
        error?: string
      }

      if (!response.ok || !data.success || !data.sessionId) {
        throw new Error(data.error ?? "Nao foi possivel gerar a versao ATS.")
      }

      toast.success("Versao ATS criada com sucesso.")
      router.push(`/dashboard?session=${encodeURIComponent(data.sessionId)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar a versao ATS.")
    } finally {
      setIsRunningAtsEnhancement(false)
    }
  }

  const profileBadgeText = useMemo(() => {
    if (!profileSource) {
      return "Perfil ainda nao salvo"
    }

    if (profileSource === "linkedin") {
      return "Base salva a partir do LinkedIn"
    }

    if (profileSource === "pdf") {
      return "Base salva a partir de curriculo importado"
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

  const sanitizedResumeData = useMemo(() => sanitizeResumeData(resumeData), [resumeData])
  const template = useMemo(() => cvStateToTemplateData(sanitizedResumeData), [sanitizedResumeData])
  const previewExperiences = template.experiences.length > 0
    ? template.experiences
    : [{
        title: "Experiencia principal",
        company: "",
        location: "",
        period: "Periodo",
        techStack: "",
        bullets: [{ text: "Os bullets reescritos para ATS aparecem aqui." }],
      }]
  const previewEducation = template.education.length > 0
    ? template.education
    : [{
        degree: "Sua formacao aparece aqui",
        institution: "",
        period: "",
      }]
  const previewCertifications = template.certifications.length > 0
    ? template.certifications
    : [{ name: "Suas certificacoes aparecem aqui" }]

  const atsReadiness = useMemo(
    () => assessAtsEnhancementReadiness(sanitizedResumeData),
    [sanitizedResumeData],
  )
  const updatedLabel = formatUpdatedLabel(lastUpdatedAt)
  const isBusy = isLoadingProfile || isSaving || isRunningAtsEnhancement
  const atsButtonDisabled = isBusy || !atsReadiness.isReady || currentCredits < 1
  const initials = buildInitials(template.fullName)
  const avatarSrc = profilePhotoUrl ?? userImageUrl ?? undefined

  return (
    <div
      data-testid="user-data-page"
      data-loading={String(isLoadingProfile)}
      className="min-h-screen bg-background text-foreground"
    >
      <div className="flex h-screen w-full overflow-hidden bg-background">
          <aside
            className={cn(
              "relative flex min-h-0 flex-col border-r border-border bg-card transition-all duration-300",
              isPreviewCollapsed ? "w-16" : "w-80",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsPreviewCollapsed((current) => !current)}
              className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
              aria-label={isPreviewCollapsed ? "Expandir preview" : "Recolher preview"}
            >
              {isPreviewCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            {isPreviewCollapsed ? (
              <div className="flex flex-col items-center gap-4 p-4">
                <Avatar className="h-10 w-10 border border-border/60">
                  <AvatarImage src={avatarSrc} alt={template.fullName || "Sua foto de perfil"} />
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-5">
                  <h2 className="mb-4 text-base font-semibold text-foreground">Preview do curriculo base</h2>

                  <div className="mb-3">
                    <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Dados pessoais
                    </h4>
                  </div>

                  <div className="mb-5 rounded-lg bg-muted/50 p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0 border border-border/60">
                        <AvatarImage src={avatarSrc} alt={template.fullName || "Sua foto de perfil"} />
                        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground">
                          {template.fullName || "Seu nome"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {template.jobTitle || "Cargo principal"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-muted-foreground">
                      {template.linkedin ? (
                        <div className="flex items-center gap-2">
                          <Linkedin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{template.linkedin}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </div>
                      ) : null}
                      {template.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>{template.location}</span>
                        </div>
                      ) : null}
                      {!template.linkedin && !template.location ? (
                        <p>Seus links e localizacao aparecem aqui.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-5">
                    <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Resumo
                    </h4>
                    <p className="text-xs leading-relaxed text-foreground">
                      {template.summary || "Seu resumo profissional aparece aqui no template final."}
                    </p>
                  </div>

                  <Separator className="my-4" />

                  <div className="mb-5">
                    <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(sanitizedResumeData.skills.length > 0
                        ? sanitizedResumeData.skills.slice(0, 12)
                        : ["Suas skills priorizadas aparecem aqui"])
                        .map((skill, index) => (
                          <Badge
                            key={`${skill}-${index}`}
                            variant="outline"
                            className="px-2 py-0.5 text-[10px] font-normal"
                          >
                            {skill}
                          </Badge>
                        ))}
                      {sanitizedResumeData.skills.length > 12 ? (
                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-normal">
                          +{sanitizedResumeData.skills.length - 12} mais
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Experiencia
                    </h4>
                    <div className="space-y-4">
                      {previewExperiences.slice(0, 4).map((experience, index) => (
                        <div key={`${experience.title}-${index}`} className="text-xs">
                          <p className="leading-tight font-medium text-foreground">
                            {experience.title || "Experiencia principal"}
                            {experience.company ? ` - ${experience.company}` : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {experience.period || "Periodo"}
                          </p>
                          <div className="mt-1 space-y-1">
                            {experience.bullets.slice(0, 2).map((bullet, bulletIndex) => (
                              <p
                                key={`${experience.title}-${bulletIndex}`}
                                className="line-clamp-2 leading-relaxed text-muted-foreground"
                              >
                                • {bullet.text}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Educacao
                    </h4>
                    <div className="space-y-3">
                      {previewEducation.slice(0, 3).map((entry, index) => (
                        <div key={`${entry.degree}-${index}`} className="text-xs">
                          <p className="leading-tight font-medium text-foreground">
                            {entry.degree}
                          </p>
                          {entry.institution ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {entry.institution}
                              {entry.period ? ` - ${entry.period}` : ""}
                            </p>
                          ) : entry.period ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {entry.period}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {template.education.length > 3 ? (
                        <p className="text-[10px] text-muted-foreground">
                          +{template.education.length - 3} formacoes
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Certificacoes
                    </h4>
                    <div className="space-y-2">
                      {previewCertifications.slice(0, 4).map((certification, index) => (
                        <p
                          key={`${certification.name}-${index}`}
                          className="text-xs leading-relaxed text-foreground"
                        >
                          • {certification.name}
                        </p>
                      ))}
                      {template.certifications.length > 4 ? (
                        <p className="text-[10px] text-muted-foreground">
                          +{template.certifications.length - 4} certificacoes
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="flex min-h-0 flex-1 overflow-hidden">
            <section className="flex min-h-0 flex-1 flex-col border-r border-border">
              <header className="shrink-0 border-b border-border bg-card px-6 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-foreground text-balance">
                      Revise seu curriculo com uma base limpa e consistente.
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Importe do LinkedIn, ajuste os campos manualmente e deixe seu perfil pronto para novas sessoes.
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    disabled={isBusy}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Importar do LinkedIn ou PDF
                  </Button>
                  <span className="text-xs text-muted-foreground">{profileBadgeText}</span>
                </div>
              </div>
              </header>

              <div className="shrink-0 border-b border-border bg-card px-6 py-4">
                <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => {
                  const Icon = stat.icon

                  return (
                    <Card key={stat.label} className="border-border py-0 shadow-none">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
                <p className="mt-3 text-xs text-muted-foreground">{updatedLabel}</p>
              </div>

            {isLoadingProfile ? (
                <div className="flex min-h-[380px] flex-1 items-center justify-center px-6 py-10">
                  <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando perfil salvo...
                </div>
              </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="space-y-4 p-6">
                    <VisualResumeEditor
                      value={resumeData}
                      onChange={setResumeData}
                      disabled={isSaving || isRunningAtsEnhancement}
                      onAllSectionsClosedChange={setAllSectionsClosed}
                      compactMode={allSectionsClosed}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving || isRunningAtsEnhancement}
                        onClick={() => router.push("/dashboard")}
                        className="h-10 flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={isSaving || isRunningAtsEnhancement}
                        onClick={() => void handleSave()}
                        data-testid="profile-save-button"
                        className="h-10 flex-1 bg-black text-white hover:bg-black/90"
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
                  </div>
                </div>
            )}
            </section>

            <aside className="flex w-80 shrink-0 flex-col bg-card">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    ATS - Aprimorar Curriculo
                  </Badge>
                </div>

                <Card className="mb-5 border-border py-0 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">
                      Melhorar meu curriculo para ATS
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Use seu perfil base atual para gerar uma nova versao ATS, sem vaga especifica, com analise geral, melhoria de estrutura, palavras-chave e rewrite otimizado.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                  {atsFeatures.map((feature) => {
                    const Icon = feature.icon

                    const checked = true
                    return (
                      <div
                        key={feature.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left",
                          checked ? "border-primary/50 bg-primary/5" : "border-border",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <div className="text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground">
                          {feature.label}
                        </span>
                      </div>
                    )
                  })}
                  </CardContent>
                </Card>

                <div className="mb-5 px-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Creditos disponiveis</span>
                    <span className="font-semibold text-foreground">{currentCredits}</span>
                  </div>
                  {!atsReadiness.isReady ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Complete seu curriculo para gerar uma versao ATS.
                    </p>
                  ) : null}
                  {atsReadiness.reasons.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {atsReadiness.reasons.map((reason) => (
                        <p key={reason}>• {reason}</p>
                      ))}
                    </div>
                  ) : null}
                  {currentCredits < 1 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Voce precisa de pelo menos 1 credito para gerar essa versao.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3">
              <Button
                type="button"
                disabled={atsButtonDisabled}
                onClick={() => void handleAtsEnhancement()}
                className="h-11 w-full gap-2"
                size="lg"
              >
                {isRunningAtsEnhancement ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando versao ATS
                  </>
                ) : (
                    <>
                    Melhorar para ATS (1 credito)
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </>
                  )}
                </Button>
            </div>
              </div>
              </div>
            </aside>
          </main>
      </div>

      <ImportResumeModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
        currentProfileSource={profileSource}
      />
    </div>
  )
}
