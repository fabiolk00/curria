"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileOutput,
  FileSearch,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Sparkles,
  Target,
  Upload,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { dashboardWelcomeGuideTargets, getDashboardGuideTargetProps } from "@/lib/dashboard/welcome-guide"
import { getDownloadUrls } from "@/lib/dashboard/workspace-client"
import { assessAtsEnhancementReadiness, getAtsEnhancementBlockingItems } from "@/lib/profile/ats-enhancement"
import { cvStateToTemplateData } from "@/lib/templates/cv-state-to-template-data"
import { cn } from "@/lib/utils"
import type { CVState } from "@/types/cv"

import { GenerationLoading } from "./generation-loading"
import { ImportResumeModal, type ImportSource, type ResumeData } from "./resume-builder"
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
type EnhancementIntent = "ats" | "target_job"
type ProfileView = "profile" | "editor" | "enhancement"
type EditableResumeSection =
  | "personal"
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"

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

type ProfileDownloadState = {
  status: "checking" | "ready" | "unavailable" | "error"
  pdfUrl: string | null
  pdfFileName: string | null
  message: string | null
}

const LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY = "curria:last-profile-generation-session-id"

const EMPTY_DOWNLOAD_STATE: ProfileDownloadState = {
  status: "unavailable",
  pdfUrl: null,
  pdfFileName: null,
  message: "Disponível depois que você gerar uma versão otimizada.",
}

const PROFILE_SECTION_META: Record<EditableResumeSection, {
  label: string
  heading: string
  focusSelector: string
}> = {
  personal: {
    label: "Editar dados pessoais",
    heading: "Dados pessoais",
    focusSelector: 'input[placeholder="Nome completo"]',
  },
  summary: {
    label: "Editar resumo profissional",
    heading: "Resumo profissional",
    focusSelector: 'textarea[placeholder*="Escreva um resumo curto"]',
  },
  experience: {
    label: "Editar experiência",
    heading: "Experiência",
    focusSelector: 'input[placeholder="Cargo"]',
  },
  skills: {
    label: "Editar skills",
    heading: "Skills",
    focusSelector: 'textarea[placeholder*="Uma skill por linha"]',
  },
  education: {
    label: "Editar educação",
    heading: "Educação",
    focusSelector: 'input[placeholder="Curso"]',
  },
  certifications: {
    label: "Editar certificações",
    heading: "Certificações",
    focusSelector: 'input[placeholder="Nome da certificação"]',
  },
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
  { id: "keywords", label: "ATS Readiness Score, clareza e legibilidade do currículo.", icon: Target },
  { id: "structure", label: "Reescrita estratégica de resumo e bullets.", icon: PenLine },
  { id: "rewrite", label: "Template ATS em PDF textual, simples e objetivo.", icon: FileOutput },
]

const targetJobFeatures: AtsFeature[] = [
  { id: "analysis", label: "Detecção da vaga e gap analysis antes da reescrita.", icon: FileSearch },
  { id: "keywords", label: "Priorização de keywords e requisitos da vaga alvo.", icon: Target },
  { id: "structure", label: "Reescrita completa por seção com foco no cargo.", icon: PenLine },
  { id: "rewrite", label: "Versão targetizada pronta para preview e export.", icon: FileOutput },
]

const enhancementValueItems = [
  "Currículo mais claro e compatível com ATS",
  "Resumo profissional mais direto",
  "Experiências reescritas em bullets fortes",
  "Keywords alinhadas ao modo escolhido",
  "Versão pronta para comparar e exportar",
  "Seu currículo base continua preservado",
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
  })} às ${new Date(lastUpdatedAt).toLocaleTimeString("pt-BR", {
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

function formatPeriod(startDate?: string, endDate?: string): string | null {
  const start = startDate?.trim()
  const end = endDate?.trim()

  if (start && end) {
    return `${start} - ${end}`
  }

  return start ?? end ?? null
}

async function triggerPdfDownload(
  pdfUrl: string,
  filename: string,
): Promise<void> {
  const response = await fetch(pdfUrl)
  if (!response.ok) {
    throw new Error(`Failed to download profile PDF (${response.status})`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = "noopener noreferrer"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function resolveProfileDownloadState(urls: Awaited<ReturnType<typeof getDownloadUrls>>): ProfileDownloadState {
  if (urls.pdfUrl) {
    return {
      status: "ready",
      pdfUrl: urls.pdfUrl,
      pdfFileName: urls.pdfFileName ?? "Curriculo.pdf",
      message: urls.artifactStale?.message
        ?? (urls.previewLock?.locked ? urls.previewLock.message : null),
    }
  }

  if (urls.generationStatus === "generating") {
    return {
      status: "unavailable",
      pdfUrl: null,
      pdfFileName: null,
      message: "O PDF da última versão ainda está sendo atualizado.",
    }
  }

  return {
    status: "unavailable",
    pdfUrl: null,
    pdfFileName: null,
    message: urls.errorMessage ?? "Disponível depois que você gerar uma versão otimizada.",
  }
}

function ProfileSectionCard({
  title,
  editLabel,
  onEdit,
  children,
  className,
  contentClassName,
  testId,
}: {
  title: string
  editLabel: string
  onEdit: () => void
  children: React.ReactNode
  className?: string
  contentClassName?: string
  testId?: string
}) {
  return (
    <Card
      data-testid={testId}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {title}
        </h2>
        <Button
          type="button"
          size="icon"
          className="h-7 w-7 rounded-full bg-black text-white hover:bg-black/90"
          aria-label={editLabel}
          onClick={onEdit}
        >
          <PenLine className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", contentClassName)}>
        {children}
      </div>
    </Card>
  )
}

export default function UserDataPage({
  currentCredits = 0,
  userImageUrl = null,
}: UserDataPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const targetJobDescriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const [activeView, setActiveView] = useState<ProfileView>("profile")
  const [requestedEditorSection, setRequestedEditorSection] = useState<EditableResumeSection | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAtsEnhancement, setIsRunningAtsEnhancement] = useState(false)
  const [targetJobDescription, setTargetJobDescription] = useState("")
  const [enhancementIntent, setEnhancementIntent] = useState<EnhancementIntent>("ats")
  const [targetJobValidationMessage, setTargetJobValidationMessage] = useState<string | null>(null)
  const [isAtsRequirementsOpen, setIsAtsRequirementsOpen] = useState(false)
  const [atsMissingItems, setAtsMissingItems] = useState<string[]>([])
  const [rewriteValidationFailure, setRewriteValidationFailure] = useState<RewriteValidationFailure | null>(null)
  const [activeImportSource, setActiveImportSource] = useState<ImportSource | null>(null)
  const [lastGeneratedSessionId, setLastGeneratedSessionId] = useState<string | null>(null)
  const [profileDownloadState, setProfileDownloadState] = useState<ProfileDownloadState>(EMPTY_DOWNLOAD_STATE)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const storedSessionId = window.localStorage.getItem(LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY)?.trim()
    if (!storedSessionId) {
      setLastGeneratedSessionId(null)
      setProfileDownloadState(EMPTY_DOWNLOAD_STATE)
      return
    }

    let cancelled = false

    const loadDownloadState = async (): Promise<void> => {
      setLastGeneratedSessionId(storedSessionId)
      setProfileDownloadState({
        status: "checking",
        pdfUrl: null,
        pdfFileName: null,
        message: "Verificando a disponibilidade do último PDF gerado.",
      })

      try {
        const urls = await getDownloadUrls(storedSessionId)
        if (!cancelled) {
          setProfileDownloadState(resolveProfileDownloadState(urls))
        }
      } catch {
        if (!cancelled) {
          setProfileDownloadState({
            status: "error",
            pdfUrl: null,
            pdfFileName: null,
            message: "Não foi possível verificar o download da última versão.",
          })
        }
      }
    }

    void loadDownloadState()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeView !== "editor" || !requestedEditorSection) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const container = editorContainerRef.current
      if (!container) {
        return
      }

      const sectionMeta = PROFILE_SECTION_META[requestedEditorSection]
      const sectionToggle = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"))
        .find((button) => button.textContent?.includes(sectionMeta.heading))

      if (sectionToggle?.getAttribute("aria-expanded") === "false") {
        sectionToggle.click()
      }

      sectionToggle?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })

      const focusTarget = container.querySelector<HTMLElement>(sectionMeta.focusSelector)
      focusTarget?.focus()
      focusTarget?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      setRequestedEditorSection(null)
    }, 80)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeView, requestedEditorSection])

  useEffect(() => {
    if (targetJobDescription.trim()) {
      setEnhancementIntent("target_job")
    }
  }, [targetJobDescription])

  useEffect(() => {
    if (enhancementIntent === "target_job" && targetJobValidationMessage) {
      targetJobDescriptionRef.current?.focus()
    }
  }, [enhancementIntent, targetJobValidationMessage])

  const handleImportSuccess = (
    data: ResumeData,
    nextProfilePhotoUrl?: string | null,
    nextProfileSource?: string | null,
  ) => {
    setIsImportOpen(false)
    setActiveImportSource(null)
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
  const displayMode: SetupGenerationMode = enhancementIntent === "target_job" ? "job_targeting" : "ats_enhancement"
  const displayGenerationCopy = getGenerationCopy(displayMode)
  const generationFeatures = displayMode === "job_targeting" ? targetJobFeatures : atsFeatures
  const selectedModeLabel = displayMode === "job_targeting" ? "Adaptação para vaga" : "Melhoria ATS geral"

  const handleSelectAtsIntent = (): void => {
    setEnhancementIntent("ats")
    setTargetJobDescription("")
    setTargetJobValidationMessage(null)
  }

  const handleSelectTargetJobIntent = (): void => {
    setEnhancementIntent("target_job")
    setTargetJobValidationMessage(null)
  }

  const handleTargetJobDescriptionChange = (value: string): void => {
    setTargetJobDescription(value)
    setTargetJobValidationMessage(null)

    if (value.trim()) {
      setEnhancementIntent("target_job")
    }
  }

  const handleEnhancementSubmit = (): void => {
    if (enhancementIntent === "target_job" && !targetJobDescription.trim()) {
      setTargetJobValidationMessage("Cole a descrição da vaga para adaptar seu currículo.")
      return
    }

    setTargetJobValidationMessage(null)
    void handleSetupGeneration()
  }

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

      const generationEndpoint = generationMode === "job_targeting"
        ? "/api/profile/smart-generation"
        : "/api/profile/ats-enhancement"

      const response = await fetch(generationEndpoint, {
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

      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY, data.sessionId)
      }
      setLastGeneratedSessionId(data.sessionId)
      setProfileDownloadState({
        status: "unavailable",
        pdfUrl: null,
        pdfFileName: null,
        message: "O PDF da nova versão estará disponível assim que a geração terminar.",
      })

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

  const handleEditSection = (section: EditableResumeSection): void => {
    setRequestedEditorSection(section)
    setActiveView("editor")
  }

  const handleOpenEditor = (): void => {
    setRequestedEditorSection("personal")
    setActiveView("editor")
  }

  const handleDownloadPdf = async (): Promise<void> => {
    if (!lastGeneratedSessionId) {
      return
    }

    setIsDownloadingPdf(true)

    try {
      const urls = await getDownloadUrls(lastGeneratedSessionId)
      const nextState = resolveProfileDownloadState(urls)
      setProfileDownloadState(nextState)

      if (!nextState.pdfUrl) {
        throw new Error(nextState.message ?? "O PDF ainda não está disponível para download.")
      }

      await triggerPdfDownload(
        nextState.pdfUrl,
        nextState.pdfFileName ?? "Curriculo.pdf",
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o PDF.")
    } finally {
      setIsDownloadingPdf(false)
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

  const sanitizedResumeData = useMemo(() => sanitizeResumeData(resumeData), [resumeData])
  const template = useMemo(() => cvStateToTemplateData(sanitizedResumeData), [sanitizedResumeData])
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

  const contactItems = [
    sanitizedResumeData.email
      ? {
          key: "email",
          label: sanitizedResumeData.email,
          href: `mailto:${sanitizedResumeData.email}`,
          icon: Mail,
        }
      : null,
    sanitizedResumeData.phone
      ? {
          key: "phone",
          label: sanitizedResumeData.phone,
          href: `tel:${sanitizedResumeData.phone}`,
          icon: Phone,
        }
      : null,
    sanitizedResumeData.linkedin
      ? {
          key: "linkedin",
          label: sanitizedResumeData.linkedin.replace(/^https?:\/\//, ""),
          href: sanitizedResumeData.linkedin.startsWith("http")
            ? sanitizedResumeData.linkedin
            : `https://${sanitizedResumeData.linkedin}`,
          icon: Linkedin,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    label: string
    href: string
    icon: typeof Mail
  }>

  const renderProfileView = () => (
    <main className="min-h-screen bg-white text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border border-slate-200">
                  <AvatarImage src={avatarSrc} alt={template.fullName || "Sua foto de perfil"} />
                  <AvatarFallback className="bg-slate-100 text-base font-semibold text-slate-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
                        {template.fullName || "Seu nome"}
                      </h1>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {template.jobTitle || "Cargo principal"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-xs text-slate-600">
                        {profileBadgeText}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    {sanitizedResumeData.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {sanitizedResumeData.location}
                      </span>
                    ) : null}
                    {contactItems.map((item) => {
                      const Icon = item.icon

                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target={item.href.startsWith("mailto") || item.href.startsWith("tel") ? undefined : "_blank"}
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 transition-colors hover:text-slate-700"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </a>
                      )
                    })}
                    {!sanitizedResumeData.location && contactItems.length === 0 ? (
                      <span>Adicione seus dados de contato para completar o cabeçalho.</span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs text-slate-400">{updatedLabel}</p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 xl:items-end">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setIsImportOpen(true)}
                  className="gap-2 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Importar do LinkedIn ou PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={profileDownloadState.status !== "ready" || isDownloadingPdf}
                  onClick={() => void handleDownloadPdf()}
                  className="gap-2 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={handleOpenEditor}
                  className="gap-2 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <PenLine className="h-4 w-4" />
                  Editar perfil
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveView("enhancement")}
                  className="gap-2 rounded-lg bg-black text-white hover:bg-black/90"
                >
                  <Sparkles className="h-4 w-4" />
                  Melhorar currículo com IA
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => router.push("/dashboard")}
                  className="h-8 px-2 text-slate-500 hover:bg-transparent hover:text-slate-800"
                >
                  Cancelar
                </Button>
              </div>

              {profileDownloadState.message ? (
                <p className="max-w-md text-xs text-slate-500 xl:text-right">
                  {profileDownloadState.message}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {isLoadingProfile ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando perfil salvo...
            </div>
          </div>
        ) : (
          <div className="mt-5 flex-1 overflow-y-auto lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-col gap-5 lg:h-full lg:min-h-0">
              <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
                <section className="flex min-h-0 flex-col gap-5">
                  <ProfileSectionCard
                    title="Resumo profissional"
                    editLabel={PROFILE_SECTION_META.summary.label}
                    onEdit={() => handleEditSection("summary")}
                    testId="summary-section-card"
                  >
                    {sanitizedResumeData.summary ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {sanitizedResumeData.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Adicione um resumo profissional para apresentar sua proposta de valor.
                      </p>
                    )}
                  </ProfileSectionCard>

                  <ProfileSectionCard
                    title="Experiência"
                    editLabel={PROFILE_SECTION_META.experience.label}
                    onEdit={() => handleEditSection("experience")}
                    className="lg:flex-1"
                    testId="experience-section-card"
                  >
                    {sanitizedResumeData.experience.length > 0 ? (
                      <div className="space-y-5">
                        {sanitizedResumeData.experience.map((experience, index) => (
                          <article
                            key={`${experience.title}-${experience.company}-${index}`}
                            className={cn(
                              "space-y-2 pb-5",
                              index < sanitizedResumeData.experience.length - 1 && "border-b border-slate-100",
                            )}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-slate-900">
                                  {experience.title || "Cargo não informado"}
                                </h3>
                                <p className="text-sm text-slate-500">
                                  {experience.company || "Empresa não informada"}
                                </p>
                                {experience.location ? (
                                  <p className="mt-1 text-xs text-slate-400">{experience.location}</p>
                                ) : null}
                              </div>
                              {formatPeriod(experience.startDate, experience.endDate) ? (
                                <span className="text-xs font-medium text-slate-400">
                                  {formatPeriod(experience.startDate, experience.endDate)}
                                </span>
                              ) : null}
                            </div>

                            {experience.bullets.length > 0 ? (
                              <ul className="space-y-2">
                                {experience.bullets.map((bullet, bulletIndex) => (
                                  <li
                                    key={`${experience.title}-${bulletIndex}`}
                                    className="flex gap-2 text-sm leading-6 text-slate-600"
                                  >
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-400">Adicione bullets para detalhar essa experiência.</p>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Adicione pelo menos uma experiência profissional para estruturar seu currículo base.
                      </p>
                    )}
                  </ProfileSectionCard>
                </section>

                <aside className="flex min-h-0 flex-col gap-5">
                  <ProfileSectionCard
                    title="Skills"
                    editLabel={PROFILE_SECTION_META.skills.label}
                    onEdit={() => handleEditSection("skills")}
                    className="lg:flex-1"
                    testId="skills-section-card"
                  >
                    {sanitizedResumeData.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {sanitizedResumeData.skills.map((skill, index) => (
                          <Badge
                            key={`${skill}-${index}`}
                            variant="outline"
                            className="rounded-full border-slate-200 px-3 py-1 text-xs text-slate-700"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Liste ferramentas, tecnologias e competências relevantes.
                      </p>
                    )}
                  </ProfileSectionCard>

                  <ProfileSectionCard
                    title="Educação"
                    editLabel={PROFILE_SECTION_META.education.label}
                    onEdit={() => handleEditSection("education")}
                    className="lg:flex-1"
                    testId="education-section-card"
                  >
                    {sanitizedResumeData.education.length > 0 ? (
                      <div className="space-y-4">
                        {sanitizedResumeData.education.map((education, index) => (
                          <article
                            key={`${education.degree}-${education.institution}-${index}`}
                            className={cn(
                              "space-y-1 pb-4",
                              index < sanitizedResumeData.education.length - 1 && "border-b border-slate-100",
                            )}
                          >
                            <h3 className="text-sm font-semibold text-slate-900">
                              {education.degree || "Formação não informada"}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {education.institution || "Instituição não informada"}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                              {education.year ? <span>{education.year}</span> : null}
                              {education.gpa ? <span>{education.gpa}</span> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Adicione suas formações acadêmicas e cursos relevantes.
                      </p>
                    )}
                  </ProfileSectionCard>

                  <ProfileSectionCard
                    title="Certificações"
                    editLabel={PROFILE_SECTION_META.certifications.label}
                    onEdit={() => handleEditSection("certifications")}
                    className="lg:flex-1"
                    testId="certifications-section-card"
                  >
                    {sanitizedResumeData.certifications?.length ? (
                      <div className="space-y-4">
                        {sanitizedResumeData.certifications.map((certification, index) => (
                          <article
                            key={`${certification.name}-${certification.issuer}-${index}`}
                            className={cn(
                              "space-y-1 pb-4",
                              index < (sanitizedResumeData.certifications?.length ?? 0) - 1 && "border-b border-slate-100",
                            )}
                          >
                            <h3 className="text-sm font-semibold text-slate-900">
                              {certification.name || "Certificação não informada"}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {certification.issuer || "Emissor não informado"}
                            </p>
                            {certification.year ? (
                              <p className="text-xs text-slate-400">{certification.year}</p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Nenhuma certificação adicionada ainda.
                      </p>
                    )}
                  </ProfileSectionCard>
                </aside>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )

  const renderEditorView = () => (
    <main className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                className="-ml-3 mb-2 h-8 px-3 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setActiveView("profile")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao perfil
              </Button>
              <h1 className="text-xl font-semibold text-foreground">
                Edite seu currículo base
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Use o editor existente para revisar seus dados antes de salvar ou gerar uma nova versão.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {profileBadgeText}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {updatedLabel}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setIsImportOpen(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Importar do LinkedIn ou PDF
              </Button>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </header>

        {isLoadingProfile ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando perfil salvo...
            </div>
          </div>
        ) : (
          <div
            ref={editorContainerRef}
            className="mt-5 flex-1 overflow-y-auto lg:min-h-0"
          >
            <VisualResumeEditor
              value={resumeData}
              onChange={setResumeData}
              disabled={isSaving || isRunningAtsEnhancement}
              importProgressSource={activeImportSource}
            />
          </div>
        )}
      </div>
    </main>
  )

  const renderLegacyEnhancementView = () => (
    <main className="min-h-screen bg-white text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                className="-ml-3 mb-2 h-8 px-3 text-slate-500 hover:bg-transparent hover:text-slate-900"
                onClick={() => setActiveView("profile")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao perfil
              </Button>
              <Badge
                data-testid="ats-panel-badge"
                className="bg-black px-3 py-1 text-xs font-medium text-white hover:bg-black/90"
              >
                {generationCopy.badge}
              </Badge>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {generationCopy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {generationCopy.description}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span>Créditos disponíveis</span>
                <span className="font-semibold text-slate-900">{currentCredits}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex-1 overflow-y-auto lg:min-h-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.8fr)]">
            <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
              <div className="space-y-6 p-6">
                <div className="space-y-2">
                  <label
                    htmlFor="target-job-description"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                  >
                    Vaga alvo opcional
                  </label>
                  <Textarea
                    id="target-job-description"
                    data-testid="target-job-description-input"
                    value={targetJobDescription}
                    onChange={(event) => setTargetJobDescription(event.target.value)}
                    disabled={isBusy}
                    rows={10}
                    placeholder="Cole aqui a descrição da vaga para adaptar o currículo a um cargo específico."
                    className="min-h-[220px] rounded-2xl border-slate-200 bg-slate-50 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus-visible:ring-black"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    {generationCopy.helper}
                  </p>
                </div>

                <div className="space-y-3">
                  {generationFeatures.map((feature) => {
                    const Icon = feature.icon

                    return (
                      <div
                        key={feature.id}
                        data-testid={`ats-feature-${feature.id}`}
                        className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 text-sm leading-6 text-slate-700">
                          {feature.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-2 text-sm">
                  {!atsReadiness.isReady ? (
                    <p className="text-slate-500">
                      {generationCopy.incomplete}
                    </p>
                  ) : null}
                  {atsReadiness.reasons.length > 0 ? (
                    <div className="space-y-1 text-xs text-slate-500">
                      {atsReadiness.reasons.map((reason) => (
                        <p key={reason}>• {reason}</p>
                      ))}
                    </div>
                  ) : null}
                  {currentCredits < 1 ? (
                    <p className="text-xs text-slate-500">
                      Você precisa de pelo menos 1 crédito para gerar essa versão.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={setupGenerationButtonDisabled}
                    onClick={() => void handleSetupGeneration()}
                    {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileAtsCta)}
                    className="h-11 gap-2 rounded-xl bg-black px-5 text-sm font-medium text-white hover:bg-black/90"
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
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => setActiveView("profile")}
                    className="h-11 rounded-xl border-slate-200 bg-white px-5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Voltar ao perfil
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
              <div className="space-y-5 p-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">O que você recebe</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Uma nova versão otimizada sem sobrescrever seu currículo base.
                  </p>
                </div>

                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">Seu currículo base continua preservado</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Você revisa a nova versão antes de exportar e continua podendo editar o perfil original.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">Fluxo real da plataforma</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      O mesmo fluxo atual de validação, toasts, créditos e roteamento para comparação é preservado.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )

  const renderEnhancementView = () => (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(241,245,249,0.8),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:py-6">
        <header className="shrink-0 border-b border-slate-200/80 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Button
              type="button"
              variant="ghost"
              aria-label="Voltar ao perfil"
              className="-ml-3 h-9 px-3 text-slate-500 hover:bg-transparent hover:text-slate-900"
              onClick={() => setActiveView("profile")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao perfil
            </Button>

            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm lg:text-right">
              <span className="font-medium text-slate-900">Modo: {selectedModeLabel}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span>{currentCredits} créditos disponíveis</span>
            </div>
          </div>
        </header>

        <div className="mt-6 flex-1 overflow-y-auto lg:min-h-0">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.78fr)]">
            <Card className="rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.28)]">
              <div className="space-y-7 p-6 sm:p-7">
                <div className="space-y-3">
                  <p
                    data-testid="ats-panel-badge"
                    className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400"
                  >
                    Escolha o tipo de otimização
                  </p>
                  <h1 className="max-w-3xl text-[2rem] font-semibold tracking-tight text-slate-950">
                    Escolha como quer otimizar seu currículo
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    Há duas ações diferentes aqui: uma melhoria ATS geral, sem vaga específica,
                    ou uma adaptação orientada pela descrição real de uma vaga.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="enhancement-intent-ats"
                    aria-pressed={enhancementIntent === "ats"}
                    onClick={handleSelectAtsIntent}
                    disabled={isBusy}
                    className={cn(
                      "rounded-2xl border p-5 text-left transition",
                      enhancementIntent === "ats"
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Melhorar para ATS</p>
                        <p className="text-xs text-slate-500">Sem vaga específica</p>
                      </div>
                      {enhancementIntent === "ats" ? (
                        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
                          Selecionado
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Reestrutura seu currículo para ficar mais claro, objetivo e compatível com sistemas ATS.
                    </p>
                  </button>

                  <button
                    type="button"
                    data-testid="enhancement-intent-target-job"
                    aria-pressed={enhancementIntent === "target_job"}
                    onClick={handleSelectTargetJobIntent}
                    disabled={isBusy}
                    className={cn(
                      "rounded-2xl border p-5 text-left transition",
                      enhancementIntent === "target_job"
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Adaptar para vaga</p>
                        <p className="text-xs text-slate-500">Com descrição da vaga</p>
                      </div>
                      {enhancementIntent === "target_job" ? (
                        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
                          Selecionado
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Usa a descrição da vaga para priorizar keywords, requisitos e experiências mais relevantes.
                    </p>
                  </button>
                </div>

                {enhancementIntent === "ats" ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">Melhoria ATS geral</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Ideal quando você ainda não tem uma vaga específica.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        A IA melhora estrutura, clareza, resumo, bullets e compatibilidade com sistemas ATS.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-medium text-emerald-900">Seu currículo base continua preservado</p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        A IA cria uma nova versão para você comparar antes de exportar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <label
                      htmlFor="target-job-description"
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                    >
                      DESCRIÇÃO DA VAGA
                    </label>
                    <Textarea
                      ref={targetJobDescriptionRef}
                      id="target-job-description"
                      data-testid="target-job-description-input"
                      value={targetJobDescription}
                      onChange={(event) => handleTargetJobDescriptionChange(event.target.value)}
                      disabled={isBusy}
                      rows={10}
                      aria-invalid={targetJobValidationMessage ? "true" : undefined}
                      aria-describedby={targetJobValidationMessage
                        ? "target-job-description-helper target-job-description-error"
                        : "target-job-description-helper"}
                      placeholder="Cole aqui responsabilidades, requisitos, qualificações, stack, senioridade e qualquer detalhe importante da vaga..."
                      className="min-h-[260px] resize-none rounded-2xl border-slate-200 bg-white text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus-visible:ring-black"
                    />
                    <p id="target-job-description-helper" className="text-xs leading-5 text-slate-500">
                      Cole a descrição completa da vaga para a IA adaptar seu currículo com base nos requisitos reais.
                    </p>
                    {targetJobValidationMessage ? (
                      <p
                        id="target-job-description-error"
                        role="alert"
                        className="text-xs font-medium text-rose-600"
                      >
                        {targetJobValidationMessage}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  {!atsReadiness.isReady ? (
                    <p className="text-slate-500">
                      {displayGenerationCopy.incomplete}
                    </p>
                  ) : null}
                  {atsReadiness.reasons.length > 0 ? (
                    <div className="space-y-1 text-xs text-slate-500">
                      {atsReadiness.reasons.map((reason) => (
                        <p key={reason}>• {reason}</p>
                      ))}
                    </div>
                  ) : null}
                  {currentCredits < 1 ? (
                    <p className="text-xs text-slate-500">
                      Você precisa de pelo menos 1 crédito para gerar uma versão otimizada.
                    </p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  disabled={setupGenerationButtonDisabled}
                  onClick={handleEnhancementSubmit}
                  {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileAtsCta)}
                  className="h-11 w-full gap-2 rounded-xl bg-black px-5 text-sm font-medium text-white hover:bg-black/90 sm:w-auto sm:min-w-[250px]"
                  data-testid="ats-panel-cta"
                >
                  {isRunningAtsEnhancement ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {generationCopy.buttonRunning}
                    </>
                  ) : (
                    <>
                      {enhancementIntent === "target_job"
                        ? "Adaptar para esta vaga (1 crédito)"
                        : "Melhorar para ATS (1 crédito)"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="h-fit rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.2)] xl:sticky xl:top-0">
              <div className="space-y-5 p-6 sm:p-7">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">O que você recebe</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Uma nova versão otimizada sem sobrescrever seu currículo base.
                  </p>
                </div>

                <ul className="space-y-3">
                  {enhancementValueItems.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900">Seguro para testar</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    A IA cria uma nova versão. Você compara antes de exportar.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )

  return (
    <div
      data-testid="user-data-page"
      data-loading={String(isLoadingProfile)}
    >
      {activeView === "editor"
        ? renderEditorView()
        : activeView === "enhancement"
          ? renderEnhancementView()
          : renderProfileView()}

      <ImportResumeModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportStarted={(source) => {
          setActiveImportSource(source)
          setActiveView("editor")
          setIsImportOpen(false)
        }}
        onImportFinished={() => setActiveImportSource(null)}
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
