"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileOutput,
  FileSearch,
  Layers3,
  Linkedin,
  Loader2,
  Upload,
  MapPin,
  PenLine,
  Sparkles,
  Target,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { assessAtsEnhancementReadiness, getAtsEnhancementBlockingItems } from "@/lib/profile/ats-enhancement"
import { cvStateToTemplateData } from "@/lib/templates/cv-state-to-template-data"
import { cn } from "@/lib/utils"
import type { CVState } from "@/types/cv"

import { GenerationLoading } from "./generation-loading"
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

type SetupGenerationMode = "ats_enhancement" | "job_targeting"

type SetupGenerationCopy = {
  badge: string
  title: string
  description: string
  helper: string
  incomplete: string
  buttonIdle: string
  buttonRunning: string
  success: string
  failure: string
  modalTitle: string
  modalDescription: string
}

type SmartGenerationResponse = {
  success?: boolean
  sessionId?: string
  workflowMode?: SetupGenerationMode
  rewriteValidation?: {
    valid: boolean
    issues: Array<{
      severity: "high" | "medium"
      message: string
      section?: string
    }>
  }
  targetRole?: string
  targetRoleConfidence?: "high" | "low"
  error?: string
  reasons?: string[]
  missingItems?: string[]
}

type RewriteValidationFailure = {
  workflowMode: SetupGenerationMode
  issues: Array<{
    severity: "high" | "medium"
    message: string
    section?: string
  }>
  targetRole?: string
  targetRoleConfidence?: "high" | "low"
}

function trimOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function extractErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === "string" && error.trim()) {
    return error
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (
    error
    && typeof error === "object"
    && "fieldErrors" in error
    && error.fieldErrors
    && typeof error.fieldErrors === "object"
  ) {
    const firstFieldError = Object.values(error.fieldErrors as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0)

    if (firstFieldError) {
      return firstFieldError
    }
  }

  return fallback
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
  { id: "analysis", label: "Construção e leitura estruturada do currículo", icon: FileSearch },
  { id: "keywords", label: "Score ATS geral, clareza e legibilidade do currículo.", icon: Target },
  { id: "structure", label: "Reescrita estratégica de resumo e bullets.", icon: PenLine },
  { id: "rewrite", label: "Template ATS em PDF textual, simples e objetivo.", icon: FileOutput },
]

const targetJobFeatures: AtsFeature[] = [
  { id: "analysis", label: "Detecção da vaga e gap analysis antes da reescrita.", icon: FileSearch },
  { id: "keywords", label: "Priorização de keywords e requisitos da vaga alvo.", icon: Target },
  { id: "structure", label: "Reescrita completa por seção com foco no cargo.", icon: PenLine },
  { id: "rewrite", label: "Versão targetizada pronta para preview e export.", icon: FileOutput },
]

function getGenerationCopy(mode: SetupGenerationMode): SetupGenerationCopy {
  if (mode === "job_targeting") {
    return {
      badge: "Target Job - Adaptar para Vaga",
      title: "Adaptar meu currículo para esta vaga",
      description:
        "Usa o seu currículo base e a descrição da vaga para fazer gap analysis, montar um plano de targeting e reescrever o currículo inteiro com foco no cargo alvo sem inventar fatos.",
      helper:
        "Cole a descrição da vaga abaixo. Se você remover a vaga, esta entrada volta automaticamente para melhoria ATS geral.",
      incomplete: "Complete seu currículo para adaptar sua versão para a vaga.",
      buttonIdle: "Adaptar para vaga (1 crédito)",
      buttonRunning: "Adaptando para vaga",
      success: "Versão adaptada para a vaga criada com sucesso.",
      failure: "Erro ao adaptar o currículo para a vaga.",
      modalTitle: "Complete seu perfil antes de adaptar para a vaga",
      modalDescription:
        "Faltam alguns pontos importantes para gerar uma versão targetizada com qualidade. Preencha estes itens no formulário e tente novamente.",
    }
  }

  return {
    badge: "ATS - Aprimorar Currículo",
    title: "Melhorar meu currículo para ATS",
    description:
      "Usa o seu perfil base para gerar uma versão ATS em pt-BR seguindo o modelo padrão da plataforma: estrutura linear, sem elementos que atrapalham parsing, linguagem objetiva e foco em verdade, matching e clareza.",
    helper:
      "Se você adicionar uma vaga alvo abaixo, esta entrada muda para adaptação estratégica por vaga sem precisar ir para o chat.",
    incomplete: "Complete seu currículo para gerar uma versão ATS.",
      buttonIdle: "Melhorar para ATS (1 crédito)",
    buttonRunning: "Gerando versão ATS",
    success: "Versão ATS criada com sucesso.",
    failure: "Erro ao gerar a versão ATS.",
    modalTitle: "Complete seu perfil antes de melhorar para ATS",
    modalDescription:
      "Faltam alguns pontos importantes para gerar uma versão ATS com qualidade. Preencha estes itens no formulário e tente novamente.",
  }
}

function formatUpdatedLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) {
    return "Nenhuma atualização salva ainda."
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

function normalizeRoleForReview(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isSuspiciousTargetRole(value?: string): boolean {
  const normalized = normalizeRoleForReview(value)

  if (!normalized) {
    return false
  }

  return /^(responsabilidades?(?:\s+e\s+atribuicoes)?|atribuicoes|requisitos(?:\s+e\s+qualificacoes)?|qualificacoes|descricao|atividades|about\s+the\s+job|about\s+the\s+role|job\s+description|responsibilities|requirements|qualifications|vaga\s+alvo)$/.test(normalized)
}

function formatValidationSectionLabel(section?: string): string {
  switch (section) {
    case "summary":
      return "Resumo"
    case "experience":
      return "Experiência"
    case "skills":
      return "Skills"
    case "education":
      return "Educação"
    case "certifications":
      return "Certificações"
    default:
      return "Validação"
  }
}

export default function UserDataPage({
  currentCredits = 0,
  userImageUrl = null,
}: UserDataPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAtsEnhancement, setIsRunningAtsEnhancement] = useState(false)
  const [targetJobDescription, setTargetJobDescription] = useState("")
  const [allSectionsClosed, setAllSectionsClosed] = useState(false)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false)
  const [isAtsRequirementsOpen, setIsAtsRequirementsOpen] = useState(false)
  const [atsMissingItems, setAtsMissingItems] = useState<string[]>([])
  const [rewriteValidationFailure, setRewriteValidationFailure] = useState<RewriteValidationFailure | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Não foi possível carregar seu perfil.")
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
      throw new Error(data.error ?? "Não foi possível salvar seu perfil.")
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

      if (pathname !== "/dashboard/resume/new") {
        router.push("/dashboard/resume/new")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil.")
    } finally {
      setIsSaving(false)
    }
  }

  const generationMode: SetupGenerationMode = targetJobDescription.trim() ? "job_targeting" : "ats_enhancement"
  const generationCopy = getGenerationCopy(generationMode)
  const generationFeatures = generationMode === "job_targeting" ? targetJobFeatures : atsFeatures

  const handleSetupGeneration = async (): Promise<void> => {
    const missingItems = getAtsEnhancementBlockingItems(sanitizeResumeData(resumeData))
    if (missingItems.length > 0) {
      setAtsMissingItems(missingItems)
      setIsAtsRequirementsOpen(true)
      return
    }

    setIsRunningAtsEnhancement(true)

    try {
      await persistProfile()

      const response = await fetch("/api/profile/smart-generation", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...sanitizeResumeData(resumeData),
          targetJobDescription: trimOptional(targetJobDescription),
        }),
      })

      const data = (await response.json()) as SmartGenerationResponse

      if (response.status === 400 && (data.missingItems?.length || data.reasons?.length)) {
        setAtsMissingItems(data.missingItems ?? data.reasons ?? [])
        setIsAtsRequirementsOpen(true)
        return
      }

      if (response.status === 422 && data.rewriteValidation?.issues?.length) {
        setRewriteValidationFailure({
          workflowMode: data.workflowMode ?? generationMode,
          issues: data.rewriteValidation.issues,
          targetRole: data.targetRole,
          targetRoleConfidence: data.targetRoleConfidence,
        })
        return
      }

      if (!response.ok || !data.success || !data.sessionId) {
        throw new Error(extractErrorMessage(data.error, generationCopy.failure))
      }

      toast.success(
        generationMode === "job_targeting"
          ? "Versão adaptada para a vaga criada com sucesso."
          : "Versão ATS criada com sucesso.",
      )

      router.push(`/dashboard/resume/compare/${encodeURIComponent(data.sessionId)}`)
    } catch (error) {
      toast.error(extractErrorMessage(error, generationCopy.failure))
    } finally {
      setIsRunningAtsEnhancement(false)
    }
  }

  const profileBadgeText = useMemo(() => {
    if (!profileSource) {
      return "Perfil ainda não salvo"
    }

    if (profileSource === "linkedin") {
      return "Base salva a partir do LinkedIn"
    }

    if (profileSource === "pdf") {
      return "Base salva a partir de currículo importado"
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
    { label: "Seções preenchidas", value: `${filledSections}/6`, icon: Layers3 },
    { label: "Experiências", value: `${resumeData.experience.length}`, icon: BadgeCheck },
    { label: "Skills", value: `${resumeData.skills.length}`, icon: Sparkles },
  ]

  const sanitizedResumeData = useMemo(() => sanitizeResumeData(resumeData), [resumeData])
  const template = useMemo(() => cvStateToTemplateData(sanitizedResumeData), [sanitizedResumeData])
  const previewExperiences = template.experiences.length > 0
    ? template.experiences
    : [{
        title: "Experiência principal",
        company: "",
        location: "",
        period: "Período",
        techStack: "",
        bullets: [{ text: "Os bullets reescritos para ATS aparecem aqui." }],
      }]
  const previewEducation = template.education.length > 0
    ? template.education
    : [{
        degree: "Sua formação aparece aqui",
        institution: "",
        period: "",
      }]
  const previewCertifications = template.certifications.length > 0
    ? template.certifications
    : [{ name: "Suas certificações aparecem aqui" }]

  const atsReadiness = useMemo(
    () => assessAtsEnhancementReadiness(sanitizedResumeData),
    [sanitizedResumeData],
  )
  const updatedLabel = formatUpdatedLabel(lastUpdatedAt)
  const isBusy = isLoadingProfile || isSaving || isRunningAtsEnhancement
  const setupGenerationButtonDisabled = isBusy || currentCredits < 1
  const initials = buildInitials(template.fullName)
  const avatarSrc = profilePhotoUrl ?? userImageUrl ?? undefined
  const suspiciousValidationTargetRole = rewriteValidationFailure?.workflowMode === "job_targeting"
    && (
      rewriteValidationFailure.targetRoleConfidence === "low"
      || isSuspiciousTargetRole(rewriteValidationFailure.targetRole)
    )

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
                  <h2 className="mb-4 text-base font-semibold text-foreground">Preview do currículo base</h2>

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
                        <p>Seus links e localização aparecem aqui.</p>
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
                      Educação
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
                          +{template.education.length - 3} formações
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Certificações
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
                          +{template.certifications.length - 4} certificações
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
                      Revise seu currículo com uma base limpa e consistente.
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Importe do LinkedIn, ajuste os campos manualmente e deixe seu perfil pronto para novas sessões.
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

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving || isRunningAtsEnhancement}
                        onClick={() => router.push("/dashboard")}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={isSaving || isRunningAtsEnhancement}
                        onClick={() => void handleSave()}
                        data-testid="profile-save-button"
                        className="bg-black text-white hover:bg-black/90"
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

            <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="p-5">
                <div className="mb-4">
                  <Badge
                    data-testid="ats-panel-badge"
                    className="bg-foreground px-3 py-1 font-medium text-background hover:bg-foreground/90"
                  >
                    {generationCopy.badge}
                  </Badge>
                </div>

                <div className="mb-5">
                  <h2 className="mb-2 text-lg font-semibold text-foreground">
                    {generationCopy.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {generationCopy.description}
                  </p>
                </div>

                <div className="mb-5 space-y-2">
                  <label
                    htmlFor="target-job-description"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Vaga alvo opcional
                  </label>
                  <Textarea
                    id="target-job-description"
                    data-testid="target-job-description-input"
                    value={targetJobDescription}
                    onChange={(event) => setTargetJobDescription(event.target.value)}
                    disabled={isBusy}
                    rows={8}
                    placeholder="Cole aqui a descrição da vaga para adaptar o currículo a um cargo específico."
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {generationCopy.helper}
                  </p>
                </div>

                <div className="mb-6 space-y-3">
                  {generationFeatures.map((feature) => {
                    const Icon = feature.icon

                    return (
                      <div
                        key={feature.id}
                        data-testid={`ats-feature-${feature.id}`}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                          "border-emerald-500/50 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked
                          readOnly
                          aria-label={feature.label}
                          className="mt-0.5 h-4 w-4 rounded border-emerald-600 accent-emerald-600"
                        />
                        <div className="mt-0.5 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 text-sm leading-snug text-foreground">
                          {feature.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="mb-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Créditos disponíveis</span>
                    <span className="font-semibold text-foreground">{currentCredits}</span>
                  </div>
                  {!atsReadiness.isReady ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {generationCopy.incomplete}
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
                      Você precisa de pelo menos 1 crédito para gerar essa versão.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3">
              <Button
                type="button"
                disabled={setupGenerationButtonDisabled}
                onClick={() => void handleSetupGeneration()}
                className="h-12 w-full gap-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-600/60"
                size="lg"
                data-testid="ats-panel-cta"
              >
                {isRunningAtsEnhancement ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {generationCopy.buttonRunning}
                  </>
                ) : (
                    <>
                    {generationCopy.buttonIdle}
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

      <Dialog open={isAtsRequirementsOpen} onOpenChange={setIsAtsRequirementsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{generationCopy.modalTitle}</DialogTitle>
            <DialogDescription>
              {generationCopy.modalDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-foreground">
            {atsMissingItems.map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setIsAtsRequirementsOpen(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rewriteValidationFailure)}
        onOpenChange={(open) => {
          if (!open) {
            setRewriteValidationFailure(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rewriteValidationFailure?.workflowMode === "job_targeting"
                ? "Não concluímos essa adaptação automaticamente"
                : "Não concluímos essa melhoria ATS automaticamente"}
            </DialogTitle>
            <DialogDescription>
              {rewriteValidationFailure?.workflowMode === "job_targeting"
                ? "A validação final encontrou inconsistências e interrompemos a adaptação para a vaga para não gerar um currículo incoerente."
                : "A validação final encontrou inconsistências e interrompemos a melhoria ATS para não gerar um currículo incoerente."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-900">O que bloqueou automaticamente</p>
              <ul className="mt-2 space-y-2">
                {rewriteValidationFailure?.issues.map((issue, index) => (
                  <li key={`${issue.section ?? "unknown"}-${index}`} className="list-none">
                    <span className="font-medium">{formatValidationSectionLabel(issue.section)}:</span>{" "}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>

            {suspiciousValidationTargetRole ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="font-medium text-rose-900">Possível bug de leitura da vaga</p>
                <p className="mt-2">
                  Detectamos um cargo-alvo suspeito na vaga analisada:
                  {" "}
                  <span className="font-medium">{rewriteValidationFailure?.targetRole}</span>.
                  Isso parece mais um título de seção ou placeholder do que o cargo real. Se isso não fizer sentido para você, trate como erro do sistema e tente reenviar a vaga.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Como interpretar esse aviso</p>
                <p className="mt-2">
                  Esse bloqueio é de segurança. Ele indica que a reescrita final ficou inconsistente com o seu histórico real ou com a vaga, então o sistema preferiu parar em vez de mostrar um currículo pronto como se estivesse tudo certo.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setRewriteValidationFailure(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerationLoading
        isLoading={isRunningAtsEnhancement}
        generationType={generationMode === "job_targeting" ? "JOB_TARGETING" : "ATS_ENHANCEMENT"}
      />
    </div>
  )
}
