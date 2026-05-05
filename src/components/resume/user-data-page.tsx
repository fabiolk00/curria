"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  getBillingSummary,
  getDownloadUrls,
  isInsufficientCreditsError,
  overrideJobTargetingValidation,
} from "@/lib/dashboard/workspace-client"
import { startNavigationFeedback } from "@/lib/navigation/feedback"
import { resolveValidationOverrideCta } from "@/lib/dashboard/validation-override-cta"
import { assessTargetJobDescriptionPreflight } from "@/lib/job-targeting/target-job-description-preflight"
import { assessAtsEnhancementReadiness, getAtsEnhancementBlockingItems } from "@/lib/profile/ats-enhancement"
import type { PlanSlug } from "@/lib/plans"
import { GENERATE_RESUME_PATH, PROFILE_SETUP_PATH, buildResumeComparisonPath } from "@/lib/routes/app"
import { getDisplayableTargetRole, isSuspiciousTargetRole } from "@/lib/target-role"
import { repairUtf8Mojibake } from "@/lib/text/repair-utf8-mojibake"
import { cvStateToTemplateData } from "@/lib/templates/cv-state-to-template-data"
import { cn } from "@/lib/utils"
import { trackAnalyticsEvent } from "@/components/analytics/track-event"
import type { UserFriendlyRequirementCard } from "@/lib/agent/job-targeting/user-friendly-review"
import { JobTargetingReviewPanel } from "@/components/resume/job-targeting-review-panel"
import type { RecoverableValidationBlock, ValidationIssue } from "@/types/agent"
import type { CVState } from "@/types/cv"

import { GenerationLoading } from "./generation-loading"
import { PlanUpdateDialog } from "@/components/dashboard/plan-update-dialog"
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

type UserDataInitialView = "profile" | "enhancement"
type ProfileGenerationCtaAction = "inline" | "redirect"

type UserDataPageProps = {
  activeRecurringPlan?: PlanSlug | null
  currentCredits?: number
  userImageUrl?: string | null
  currentAppUserId?: string | null
  initialView?: UserDataInitialView
  showProfileGenerationCta?: boolean
  profileGenerationCtaAction?: ProfileGenerationCtaAction
}

type AtsFeature = {
  id: string
  label: string
  icon: typeof FileSearch
}

type SetupGenerationMode = "ats_enhancement" | "job_targeting"
type EnhancementIntent = "ats" | "target_job"
type ProfileView = UserDataInitialView | "editor"
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

type ValidationMessage = {
  severity: "high" | "medium"
  message: string
  section?: string
  issueType?: ValidationIssue["issueType"]
  offendingSignal?: string
  suggestedReplacement?: string
  userFacingTitle?: string
  userFacingExplanation?: string
}

type SmartGenerationResponse = {
  success?: boolean
  status?: "already_running" | "already_completed"
  message?: string
  sessionId?: string
  workflowMode?: SetupGenerationMode
  rewriteValidation?: {
    blocked?: boolean
    valid: boolean
    hardIssues?: ValidationMessage[]
    softWarnings?: ValidationMessage[]
    issues: ValidationMessage[]
  }
  targetRole?: string
  targetRoleConfidence?: "high" | "medium" | "low"
  error?: string
  code?: string
  reasons?: string[]
  missingItems?: string[]
  warnings?: string[]
  generationType?: "JOB_TARGETING" | "ATS_ENHANCEMENT"
  creditsUsed?: number
  resumeGenerationId?: string
  recoverableValidationBlock?: RecoverableValidationBlock
}

type RewriteValidationFailure = {
  sessionId?: string
  workflowMode: SetupGenerationMode
  hardIssues: ValidationMessage[]
  softWarnings: ValidationMessage[]
  targetRole?: string
  targetRoleConfidence?: "high" | "medium" | "low"
  recoverableValidationBlock?: RecoverableValidationBlock
}

type ProfileDownloadState = {
  status: "checking" | "ready" | "unavailable" | "error"
  pdfUrl: string | null
  pdfFileName: string | null
  message: string | null
}

const LEGACY_LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY = "curria:last-profile-generation-session-id"

const EMPTY_DOWNLOAD_STATE: ProfileDownloadState = {
  status: "unavailable",
  pdfUrl: null,
  pdfFileName: null,
  message: "Disponível depois que você gerar uma versão otimizada.",
}

function getLastGeneratedProfileSessionStorageKey(appUserId?: string | null): string | null {
  const normalizedUserId = appUserId?.trim()
  if (!normalizedUserId) {
    return LEGACY_LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY
  }

  return `${LEGACY_LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY}:${normalizedUserId}`
}

function storeLastGeneratedProfileSessionId(sessionId: string, appUserId?: string | null): void {
  if (typeof window === "undefined") {
    return
  }

  const scopedStorageKey = getLastGeneratedProfileSessionStorageKey(appUserId)
  if (scopedStorageKey) {
    window.localStorage.setItem(scopedStorageKey, sessionId)
  }

  if (appUserId?.trim()) {
    window.localStorage.removeItem(LEGACY_LAST_GENERATED_PROFILE_SESSION_STORAGE_KEY)
  }
}

function readLastGeneratedProfileSessionId(appUserId?: string | null): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const scopedStorageKey = getLastGeneratedProfileSessionStorageKey(appUserId)
  const storedSessionId = scopedStorageKey
    ? window.localStorage.getItem(scopedStorageKey)?.trim()
    : null

  return storedSessionId || null
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

function buildGenerationSuccessMessage(successMessage: string, warnings?: string[]): string {
  const visibleWarnings = warnings?.map((warning) => repairUtf8Mojibake(warning).trim()).filter(Boolean) ?? []

  if (visibleWarnings.length === 0) {
    return repairUtf8Mojibake(successMessage).trim()
  }

  const reviewLead = visibleWarnings.length === 1
    ? "Revise este ponto antes de usar a versão final:"
    : "Revise estes pontos antes de usar a versão final:"

  return `${repairUtf8Mojibake(successMessage).trim()} ${reviewLead} ${visibleWarnings.join(" ")}`
}

function splitRewriteValidationIssues(
  rewriteValidation?: SmartGenerationResponse["rewriteValidation"],
): {
  hardIssues: ValidationMessage[]
  softWarnings: ValidationMessage[]
} {
  const issues = rewriteValidation?.issues ?? []

  return {
    hardIssues: (rewriteValidation?.hardIssues ?? issues.filter((issue) => issue.severity === "high")).map((issue) => ({
      ...issue,
      message: repairUtf8Mojibake(issue.message).trim(),
    })),
    softWarnings: (rewriteValidation?.softWarnings ?? issues.filter((issue) => issue.severity !== "high")).map((issue) => ({
      ...issue,
      message: repairUtf8Mojibake(issue.message).trim(),
    })),
  }
}

function buildValidationEventPayload(
  failure: RewriteValidationFailure,
  currentAppUserId?: string | null,
): Record<string, unknown> {
  const issues = [...failure.hardIssues, ...failure.softWarnings]
  const issueTypes = Array.from(new Set(
    issues
      .map((issue) => issue.issueType)
      .filter((issueType): issueType is NonNullable<ValidationIssue["issueType"]> => Boolean(issueType)),
  ))

  return {
    sessionId: failure.sessionId,
    userId: currentAppUserId ?? undefined,
    targetRole: failure.targetRole,
    issueCount: issues.length,
    hardIssueCount: failure.hardIssues.length,
    softWarningCount: failure.softWarnings.length,
    issueTypes: issueTypes.join(", ") || undefined,
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

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function ProfileBackButton({
  onClick,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: {
  onClick: () => void
  className?: string
  "data-testid"?: string
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      aria-label={ariaLabel ?? "Voltar ao perfil"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
        className,
      )}
      onClick={onClick}
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar ao perfil
    </button>
  )
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
        "flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-neutral-200 bg-white p-0 shadow-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          contentClassName,
        )}
      >
        {children}
      </div>
    </Card>
  )
}

export default function UserDataPage({
  activeRecurringPlan = null,
  currentCredits = 0,
  currentAppUserId = null,
  initialView = "profile",
  showProfileGenerationCta = true,
  profileGenerationCtaAction = "inline",
}: UserDataPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const pushWithFeedback = useCallback((href: string): void => {
    startNavigationFeedback()
    router.push(href)
  }, [router])
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const targetJobDescriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const [activeView, setActiveView] = useState<ProfileView>(initialView)
  const [requestedEditorSection, setRequestedEditorSection] = useState<EditableResumeSection | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [resumeData, setResumeData] = useState<CVState>(() => normalizeResumeData())
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAtsEnhancement, setIsRunningAtsEnhancement] = useState(false)
  const isRunningAtsEnhancementRef = useRef(false)
  const [targetJobDescription, setTargetJobDescription] = useState("")
  const [enhancementIntent, setEnhancementIntent] = useState<EnhancementIntent>("ats")
  const [targetJobValidationMessage, setTargetJobValidationMessage] = useState<string | null>(null)
  const [isAtsRequirementsOpen, setIsAtsRequirementsOpen] = useState(false)
  const [atsMissingItems, setAtsMissingItems] = useState<string[]>([])
  const [rewriteValidationFailure, setRewriteValidationFailure] = useState<RewriteValidationFailure | null>(null)
  const [isOverrideGenerating, setIsOverrideGenerating] = useState(false)
  const [isPlanUpdateOpen, setIsPlanUpdateOpen] = useState(false)
  const [availableCredits, setAvailableCredits] = useState(currentCredits)
  const [currentActiveRecurringPlan, setCurrentActiveRecurringPlan] = useState<PlanSlug | null>(activeRecurringPlan)
  const [activeImportSource, setActiveImportSource] = useState<ImportSource | null>(null)
  const [lastGeneratedSessionId, setLastGeneratedSessionId] = useState<string | null>(null)
  const [profileDownloadState, setProfileDownloadState] = useState<ProfileDownloadState>(EMPTY_DOWNLOAD_STATE)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const previousValidationOverrideActionRef = useRef<"override_generate" | "open_pricing_modal" | null>(null)
  const lastPricingShownTokenRef = useRef<string | null>(null)

  useEffect(() => {
    setAvailableCredits(currentCredits)
  }, [currentCredits])

  useEffect(() => {
    setCurrentActiveRecurringPlan(activeRecurringPlan)
  }, [activeRecurringPlan])

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const storedSessionId = readLastGeneratedProfileSessionId(currentAppUserId)
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
        const urls = await getDownloadUrls(storedSessionId, undefined, {
          trigger: "profile_last_generated",
          onSessionIdRecovered: (recoveredSessionId) => {
            storeLastGeneratedProfileSessionId(recoveredSessionId, currentAppUserId)
            if (!cancelled) {
              setLastGeneratedSessionId(recoveredSessionId)
            }
          },
        })
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
  }, [currentAppUserId])

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
    void nextProfilePhotoUrl
    setIsImportOpen(false)
    setActiveImportSource(null)
    setResumeData(normalizeResumeData(data))
    setProfileSource(nextProfileSource ?? "linkedin")
    setLastUpdatedAt(new Date().toISOString())
    setActiveView("profile")
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
    setLastUpdatedAt(data.profile.updatedAt)
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)

    try {
      await persistProfile()
      toast.success("Perfil salvo com sucesso.")

      if (pathname !== PROFILE_SETUP_PATH) {
        pushWithFeedback(PROFILE_SETUP_PATH)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReturnToProfile = (): void => {
    if (pathname !== PROFILE_SETUP_PATH) {
      pushWithFeedback(PROFILE_SETUP_PATH)
      return
    }

    setActiveView("profile")
  }

  const handleProfileGenerationCta = (): void => {
    if (profileGenerationCtaAction === "redirect") {
      pushWithFeedback(GENERATE_RESUME_PATH)
      return
    }

    setActiveView("enhancement")
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

    if (enhancementIntent === "target_job") {
      const preflight = assessTargetJobDescriptionPreflight(targetJobDescription)

      if (!preflight.ok) {
        setTargetJobValidationMessage(preflight.message)
        targetJobDescriptionRef.current?.focus()
        return
      }
    }

    setTargetJobValidationMessage(null)
    void handleSetupGeneration()
  }

  const handleSetupGeneration = async (): Promise<void> => {
    if (isRunningAtsEnhancementRef.current) {
      return
    }

    isRunningAtsEnhancementRef.current = true
    setIsRunningAtsEnhancement(true)

    const missingItems = getAtsEnhancementBlockingItems(sanitizeResumeData(resumeData))
    if (missingItems.length > 0) {
      setAtsMissingItems(missingItems)
      setIsAtsRequirementsOpen(true)
      isRunningAtsEnhancementRef.current = false
      setIsRunningAtsEnhancement(false)
      return
    }

    try {
      await persistProfile()

      const generationPayload = {
        ...sanitizeResumeData(resumeData),
        ...(generationMode === "job_targeting"
          ? { targetJobDescription: targetJobDescription.trim() }
          : {}),
      }

      const response = await fetch("/api/profile/smart-generation", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generationPayload),
      })

      const data = (await response.json()) as SmartGenerationResponse

      if (response.status === 400 && (data.missingItems?.length || data.reasons?.length)) {
        setAtsMissingItems(data.missingItems ?? data.reasons ?? [])
        setIsAtsRequirementsOpen(true)
        return
      }

      if (response.status === 422 && data.code === "INVALID_TARGET_JOB_DESCRIPTION") {
        setTargetJobValidationMessage(extractErrorMessage(data.error, "Cole a descricao real da vaga."))
        targetJobDescriptionRef.current?.focus()
        return
      }

      if (response.status === 422 && data.rewriteValidation?.issues?.length) {
        const { hardIssues, softWarnings } = splitRewriteValidationIssues(data.rewriteValidation)

        setRewriteValidationFailure({
          sessionId: data.sessionId,
          workflowMode: data.workflowMode ?? generationMode,
          hardIssues,
          softWarnings,
          targetRole: data.targetRole,
          targetRoleConfidence: data.targetRoleConfidence,
          recoverableValidationBlock: data.recoverableValidationBlock,
        })
        if (data.recoverableValidationBlock) {
          trackAnalyticsEvent(
            "agent.job_targeting.validation_modal_shown",
            buildValidationEventPayload({
              sessionId: data.sessionId,
              workflowMode: data.workflowMode ?? generationMode,
              hardIssues,
              softWarnings,
              targetRole: data.targetRole,
              targetRoleConfidence: data.targetRoleConfidence,
              recoverableValidationBlock: data.recoverableValidationBlock,
            }, currentAppUserId),
          )
        }
        return
      }

      if (response.ok && data.status === "already_running") {
        toast.info(data.message ?? "Essa adaptação já está em andamento.")
        if (data.sessionId) {
          storeLastGeneratedProfileSessionId(data.sessionId, currentAppUserId)
          setLastGeneratedSessionId(data.sessionId)
        }
        return
      }

      if (response.ok && data.status === "already_completed" && data.sessionId) {
        applyGenerationSuccess(
          data,
          "Esta adaptação já estava pronta. Abrindo a sessão existente.",
        )
        return
      }

      if (!response.ok || !data.success || !data.sessionId) {
        throw new Error(extractErrorMessage(data.error, generationCopy.failure))
      }

      applyGenerationSuccess(
        data,
        generationMode === "job_targeting"
          ? "Versão adaptada para a vaga criada com sucesso."
          : "Versão ATS criada com sucesso.",
      )
    } catch (error) {
      toast.error(extractErrorMessage(error, generationCopy.failure))
    } finally {
      isRunningAtsEnhancementRef.current = false
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
      const urls = await getDownloadUrls(lastGeneratedSessionId, undefined, {
        trigger: "profile_last_generated",
        onSessionIdRecovered: (recoveredSessionId) => {
          storeLastGeneratedProfileSessionId(recoveredSessionId, currentAppUserId)
          setLastGeneratedSessionId(recoveredSessionId)
        },
      })
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
  const setupGenerationButtonDisabled = isBusy || availableCredits < 1
  const suspiciousValidationTargetRole = rewriteValidationFailure?.workflowMode === "job_targeting"
    && (
      rewriteValidationFailure.targetRoleConfidence === "low"
      || isSuspiciousTargetRole(rewriteValidationFailure.targetRole)
    )
  const displayValidationTargetRole = getDisplayableTargetRole(rewriteValidationFailure?.targetRole)
  const validationModalPayload = rewriteValidationFailure?.recoverableValidationBlock?.modal
  const validationUserFriendlyReview = rewriteValidationFailure?.workflowMode === "job_targeting"
    ? rewriteValidationFailure.recoverableValidationBlock?.userFriendlyReview
    : undefined
  const shouldUseFriendlyJobReview = Boolean(validationUserFriendlyReview)
  const validationOverrideCreditCost = validationModalPayload?.actions.primary?.creditCost ?? 1
  const validationOverrideCta = validationModalPayload?.actions.primary && !shouldUseFriendlyJobReview
    ? resolveValidationOverrideCta({
        creditCost: validationOverrideCreditCost,
        availableCredits,
        isOverrideLoading: isOverrideGenerating,
      })
    : null

  const refreshBillingSummary = useCallback(async (): Promise<void> => {
    try {
      const billingSummary = await getBillingSummary()
      setAvailableCredits(billingSummary.currentCredits)
      setCurrentActiveRecurringPlan(billingSummary.activeRecurringPlan ?? null)
    } catch {
      // Keep the last known credit state; CTA will remain conservative.
    }
  }, [])

  useEffect(() => {
    if (!rewriteValidationFailure?.recoverableValidationBlock) {
      return
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void refreshBillingSummary()
      }
    }

    const handleFocus = (): void => {
      void refreshBillingSummary()
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refreshBillingSummary, rewriteValidationFailure])

  useEffect(() => {
    const overrideToken = rewriteValidationFailure?.recoverableValidationBlock?.overrideToken
    if (!overrideToken || !validationOverrideCta) {
      previousValidationOverrideActionRef.current = null
      lastPricingShownTokenRef.current = null
      return
    }

    if (
      validationOverrideCta.action === "open_pricing_modal"
      && lastPricingShownTokenRef.current !== overrideToken
    ) {
      trackAnalyticsEvent("agent.job_targeting.validation_override_pricing_shown", {
        ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
        source: "profile_setup",
        creditCost: validationOverrideCreditCost,
        availableCredits,
      })
      lastPricingShownTokenRef.current = overrideToken
    }

    if (
      previousValidationOverrideActionRef.current === "open_pricing_modal"
      && validationOverrideCta.action === "override_generate"
    ) {
      trackAnalyticsEvent("agent.job_targeting.validation_override_credit_added", {
        ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
        source: "profile_setup",
        creditCost: validationOverrideCreditCost,
        availableCredits,
      })
    }

    previousValidationOverrideActionRef.current = validationOverrideCta.action
  }, [
    currentAppUserId,
    availableCredits,
    rewriteValidationFailure,
    validationOverrideCreditCost,
    validationOverrideCta,
  ])

  const applyGenerationSuccess = (
    data: Pick<SmartGenerationResponse, "sessionId" | "warnings">,
    successMessage: string,
  ): void => {
    if (!data.sessionId) {
      return
    }

    storeLastGeneratedProfileSessionId(data.sessionId, currentAppUserId)
    setLastGeneratedSessionId(data.sessionId)
    setProfileDownloadState({
      status: "unavailable",
      pdfUrl: null,
      pdfFileName: null,
      message: "O PDF da nova versão estará disponível assim que a geração terminar.",
    })

    toast.success(buildGenerationSuccessMessage(successMessage, data.warnings))
    pushWithFeedback(buildResumeComparisonPath(data.sessionId))
  }

  const closeRewriteValidationFailure = (): void => {
    if (rewriteValidationFailure?.recoverableValidationBlock) {
      trackAnalyticsEvent(
        "agent.job_targeting.validation_override_closed",
        buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
      )
    }

    setRewriteValidationFailure(null)
  }

  const handleAddEvidenceFromReview = (requirement: UserFriendlyRequirementCard): void => {
    closeRewriteValidationFailure()
    setRequestedEditorSection("experience")
    setActiveView("editor")
    toast.info(`Adicione uma evidência real de ${requirement.label} na sua experiência antes de gerar novamente.`)
  }

  const handleValidationOverride = async (): Promise<void> => {
    if (!rewriteValidationFailure?.sessionId || !rewriteValidationFailure.recoverableValidationBlock) {
      return
    }

    setIsOverrideGenerating(true)
    trackAnalyticsEvent(
      "agent.job_targeting.validation_override_clicked",
      {
        ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
        source: "profile_setup",
        creditCost: validationOverrideCreditCost,
        availableCredits,
      },
    )

    try {
      const result = await overrideJobTargetingValidation(
        rewriteValidationFailure.sessionId,
        {
          overrideToken: rewriteValidationFailure.recoverableValidationBlock.overrideToken,
          consumeCredit: true,
        },
      )
      trackAnalyticsEvent(
        "agent.job_targeting.validation_override_succeeded",
        {
          ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
          source: "profile_setup",
          creditCost: validationOverrideCreditCost,
          availableCredits,
          creditCharged: (result.creditsUsed ?? 0) > 0,
          cvVersionId: result.resumeGenerationId,
          validationOverride: true,
        },
      )
      setRewriteValidationFailure(null)
      applyGenerationSuccess(result, "Geramos a versão com sua confirmação.")
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        trackAnalyticsEvent(
          "agent.job_targeting.validation_override_insufficient_credits",
          {
            ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
            source: "profile_setup",
            creditCost: validationOverrideCreditCost,
            availableCredits,
          },
        )
        setIsPlanUpdateOpen(true)
        return
      }

      trackAnalyticsEvent(
        "agent.job_targeting.validation_override_failed",
        {
          ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
          source: "profile_setup",
          creditCost: validationOverrideCreditCost,
          availableCredits,
        },
      )
      toast.error(extractErrorMessage(error, "Não conseguimos concluir a geração por um erro técnico. Tente novamente."))
    } finally {
      setIsOverrideGenerating(false)
    }
  }

  const handleValidationOverridePrimaryAction = (): void => {
    if (!rewriteValidationFailure || !validationOverrideCta) {
      return
    }

    if (validationOverrideCta.action === "open_pricing_modal") {
      trackAnalyticsEvent("agent.job_targeting.validation_override_pricing_clicked", {
        ...buildValidationEventPayload(rewriteValidationFailure, currentAppUserId),
        source: "profile_setup",
        creditCost: validationOverrideCreditCost,
        availableCredits,
      })
      setIsPlanUpdateOpen(true)
      return
    }

    void handleValidationOverride()
  }

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
    <main className="flex h-full min-h-0 flex-col bg-white text-neutral-900">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                {template.fullName || "Seu nome"}
              </h1>
              <span className="text-sm font-medium text-neutral-500">
                {template.jobTitle || "Cargo principal"}
              </span>
                <Button
                type="button"
                size="icon"
                aria-label="Editar perfil"
                disabled={isBusy}
                onClick={handleOpenEditor}
                className="h-7 w-7 rounded-full bg-black text-white hover:bg-black/90 hover:text-white disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                <PenLine className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {sanitizedResumeData.location ? (
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <MapPin className="h-3 w-3" />
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
                    className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </a>
                )
              })}
              {!sanitizedResumeData.location && contactItems.length === 0 ? (
                <span className="text-xs text-neutral-400">Adicione seus dados de contato para completar o cabeçalho.</span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label="Importar do LinkedIn ou PDF"
                disabled={isBusy}
                onClick={() => setIsImportOpen(true)}
                className="h-auto gap-1.5 rounded-md border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Importar /</span>
                <LinkedInMark className="h-3.5 w-3.5 text-[#0A66C2]" />
                <span>/ PDF</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={profileDownloadState.status !== "ready" || isDownloadingPdf}
                onClick={() => void handleDownloadPdf()}
                className="h-auto gap-1.5 rounded-md border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
              >
                {isDownloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </Button>
              {showProfileGenerationCta ? (
              <Button
                type="button"
                onClick={handleProfileGenerationCta}
                className="h-auto gap-1.5 rounded-md bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Melhorar currículo com IA
              </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mb-5 mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
            <span>{profileBadgeText}</span>
            <span aria-hidden="true">•</span>
            <span>{updatedLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            {profileDownloadState.message ? (
              <p className="max-w-md text-xs text-neutral-400 lg:text-right">
                {profileDownloadState.message}
              </p>
            ) : null}
          </div>
        </div>

        {isLoadingProfile ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando perfil salvo...
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <section className="flex min-h-0 flex-col gap-5">
              <ProfileSectionCard
                title="Resumo profissional"
                editLabel={PROFILE_SECTION_META.summary.label}
                onEdit={() => handleEditSection("summary")}
                testId="summary-section-card"
              >
                {sanitizedResumeData.summary ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                    {sanitizedResumeData.summary}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Adicione um resumo profissional para apresentar sua proposta de valor.
                  </p>
                )}
              </ProfileSectionCard>

              <ProfileSectionCard
                title="Experiência"
                editLabel={PROFILE_SECTION_META.experience.label}
                onEdit={() => handleEditSection("experience")}
                className="flex-1"
                testId="experience-section-card"
              >
                {sanitizedResumeData.experience.length > 0 ? (
                  <div className="-mx-4 -mb-4">
                    {sanitizedResumeData.experience.map((experience, index) => (
                      <div
                        key={`${experience.title}-${experience.company}-${index}`}
                        className="px-4"
                      >
                        <article
                          className={cn(
                            "group transition-colors hover:bg-neutral-50/50",
                            index === 0 ? "pb-4" : "py-4",
                            index < sanitizedResumeData.experience.length - 1 && "border-b border-neutral-100",
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-semibold text-neutral-900">
                                  {experience.title || "Cargo não informado"}
                                </span>
                                <span className="text-sm text-neutral-500">
                                  {experience.company || "Empresa não informada"}
                                </span>
                              </div>
                              {experience.location ? (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {experience.location}
                                </div>
                              ) : null}
                            </div>
                            {formatPeriod(experience.startDate, experience.endDate) ? (
                              <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-400">
                                {formatPeriod(experience.startDate, experience.endDate)}
                              </span>
                            ) : null}
                          </div>

                          {experience.bullets.length > 0 ? (
                            <ul className="mt-2.5 space-y-1.5">
                              {experience.bullets.map((bullet, bulletIndex) => (
                                <li
                                  key={`${experience.title}-${bulletIndex}`}
                                  className="flex gap-2 text-sm leading-relaxed text-neutral-600"
                                >
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2.5 text-sm text-neutral-400">
                              Adicione bullets para detalhar essa experiência.
                            </p>
                          )}
                        </article>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Adicione pelo menos uma experiência profissional para estruturar seu currículo base.
                  </p>
                )}
              </ProfileSectionCard>
            </section>

            <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ProfileSectionCard
                title="Skills"
                editLabel={PROFILE_SECTION_META.skills.label}
                onEdit={() => handleEditSection("skills")}
                testId="skills-section-card"
              >
                {sanitizedResumeData.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sanitizedResumeData.skills.map((skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Liste ferramentas, tecnologias e competências relevantes.
                  </p>
                )}
              </ProfileSectionCard>

              <ProfileSectionCard
                title="Educação"
                editLabel={PROFILE_SECTION_META.education.label}
                onEdit={() => handleEditSection("education")}
                testId="education-section-card"
              >
                {sanitizedResumeData.education.length > 0 ? (
                  <div className="space-y-3">
                    {sanitizedResumeData.education.map((education, index) => (
                      <article key={`${education.degree}-${education.institution}-${index}`}>
                        <p className="text-sm font-medium text-neutral-800">
                          {education.degree || "Formação não informada"}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {education.institution || "Instituição não informada"}
                          {education.year ? ` · ${education.year}` : ""}
                          {education.gpa ? ` · ${education.gpa}` : ""}
                        </p>
                        {index < sanitizedResumeData.education.length - 1 ? (
                          <div className="mt-3 border-t border-neutral-100" />
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Adicione suas formações acadêmicas e cursos relevantes.
                  </p>
                )}
              </ProfileSectionCard>

              <ProfileSectionCard
                title="Certificações"
                editLabel={PROFILE_SECTION_META.certifications.label}
                onEdit={() => handleEditSection("certifications")}
                testId="certifications-section-card"
              >
                {sanitizedResumeData.certifications?.length ? (
                  <div className="space-y-2">
                    {sanitizedResumeData.certifications.map((certification, index) => (
                      <article
                        key={`${certification.name}-${certification.issuer}-${index}`}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug text-neutral-800">
                            {certification.name || "Certificação não informada"}
                          </p>
                          {certification.issuer ? (
                            <p className="text-xs text-neutral-400">
                              {certification.issuer}
                            </p>
                          ) : null}
                        </div>
                        {certification.year ? (
                          <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                            {certification.year}
                          </span>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Nenhuma certificação adicionada ainda.
                  </p>
                )}
              </ProfileSectionCard>
            </aside>
          </div>
        )}
      </div>
    </main>
  )

  const renderEditorView = () => (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <ProfileBackButton onClick={handleReturnToProfile} className="-ml-3" />
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
                  onClick={() => pushWithFeedback(PROFILE_SETUP_PATH)}
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
            className="mt-5 flex-1 overflow-y-auto lg:min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
    <main className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:px-6 lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <ProfileBackButton onClick={() => setActiveView("profile")} className="-ml-3" />
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
                <span className="font-semibold text-slate-900">{availableCredits}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex-1 overflow-y-auto lg:min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    rows={8}
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
                  {availableCredits < 1 ? (
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
                    onClick={handleReturnToProfile}
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
    <main className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 lg:min-h-0 lg:py-5">
        <header className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ProfileBackButton
              onClick={handleReturnToProfile}
              className="-ml-1"
              data-testid="enhancement-back-button"
            />

            <div className="text-sm text-slate-500 lg:text-right">
              <span className="font-medium text-slate-900">Modo: {selectedModeLabel}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span>{availableCredits} créditos disponíveis</span>
            </div>
          </div>
        </header>

        <div className="mt-5 flex-1 overflow-y-auto lg:min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.82fr)]">
            <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
              <div className="space-y-6 p-6">
                <div className="space-y-3">
                  <Badge
                    data-testid="ats-panel-badge"
                    className="bg-black px-3 py-1 text-xs font-medium text-white hover:bg-black/90"
                  >
                    {displayGenerationCopy.badge}
                  </Badge>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {enhancementIntent === "target_job"
                      ? "Adapte seu currículo para a vaga certa."
                      : "Melhore seu currículo para ATS com mais clareza."}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    {enhancementIntent === "target_job"
                      ? "Escolha a adaptação por vaga quando você já tiver a descrição do cargo e quiser priorizar requisitos, keywords e experiências mais relevantes."
                      : "Escolha a melhoria ATS geral quando quiser fortalecer estrutura, clareza e legibilidade sem depender de uma vaga específica."}
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
                      "rounded-2xl border p-4 text-left transition",
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
                      "rounded-2xl border p-4 text-left transition",
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
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">Melhoria ATS geral</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Ideal quando você ainda não tem uma vaga específica. A IA melhora estrutura, clareza, resumo,
                        bullets e compatibilidade com sistemas ATS.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                      rows={8}
                      aria-invalid={targetJobValidationMessage ? "true" : undefined}
                      aria-describedby={targetJobValidationMessage
                        ? "target-job-description-helper target-job-description-error"
                        : "target-job-description-helper"}
                      placeholder="Cole aqui responsabilidades, requisitos, qualificações, stack, senioridade e qualquer detalhe importante da vaga..."
                      className="min-h-[260px] resize-none rounded-2xl border-slate-200 bg-slate-50 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus-visible:ring-black"
                    />
                    <p id="target-job-description-helper" className="text-xs leading-5 text-slate-500" />
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
                  {availableCredits < 1 ? (
                    <p className="text-xs text-slate-500">
                      Você precisa de pelo menos 1 crédito para gerar uma versão otimizada.
                    </p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  disabled={setupGenerationButtonDisabled}
                  onClick={handleEnhancementSubmit}
                  className="h-11 w-full gap-2 rounded-xl bg-black px-5 text-sm font-medium text-white hover:bg-black/90"
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

            <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
              <div className="space-y-5 p-6">
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

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Neste modo</p>
                  {generationFeatures.map((feature) => {
                    const Icon = feature.icon

                    return (
                      <div
                        key={feature.id}
                        data-testid={`ats-feature-${feature.id}`}
                        className="flex items-start gap-3 text-sm text-slate-700"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="leading-6">{feature.label}</span>
                      </div>
                    )
                  })}
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
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
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
            closeRewriteValidationFailure()
          }
        }}
      >
        <DialogContent className="!flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {validationUserFriendlyReview?.title ?? validationModalPayload?.title ?? (rewriteValidationFailure?.workflowMode === "job_targeting"
                ? "Não concluímos essa adaptação automaticamente"
                : "Não concluímos essa melhoria ATS automaticamente")}
            </DialogTitle>
            <DialogDescription>
              {validationUserFriendlyReview?.description ?? validationModalPayload?.description ?? (rewriteValidationFailure?.workflowMode === "job_targeting"
                ? "A validação final encontrou inconsistências e interrompemos a adaptação para a vaga para não gerar um currículo incoerente."
                : "A validação final encontrou inconsistências e interrompemos a melhoria ATS para não gerar um currículo incoerente.")}
            </DialogDescription>
          </DialogHeader>

          <div
            data-testid="rewrite-validation-dialog-scroll"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 text-sm text-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {validationUserFriendlyReview ? (
              <JobTargetingReviewPanel
                review={validationUserFriendlyReview}
                onAddEvidence={handleAddEvidenceFromReview}
                onChooseAnotherJob={closeRewriteValidationFailure}
              />
            ) : validationModalPayload ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-medium text-amber-900">{validationModalPayload.primaryProblem}</p>
                  <ul className="mt-3 space-y-2">
                    {validationModalPayload.problemBullets.map((bullet, index) => (
                      <li key={`problem-bullet-${index}`} className="list-none">
                        • {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p>{validationModalPayload.reassurance}</p>
                  {validationModalPayload.recommendation ? (
                    <p className="mt-2 font-medium text-slate-900">
                      {validationModalPayload.recommendation}
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-amber-900">O que bloqueou automaticamente</p>
                <ul className="mt-2 space-y-2">
                  {rewriteValidationFailure?.hardIssues.map((issue, index) => (
                    <li key={`${issue.section ?? "unknown"}-${index}`} className="list-none">
                      <span className="font-medium">{formatValidationSectionLabel(issue.section)}:</span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!validationModalPayload && rewriteValidationFailure?.softWarnings.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Outros pontos para revisar</p>
                <p className="mt-2 text-slate-700">
                  Essas observações não foram a causa do bloqueio, mas valem a sua atenção antes de tentar novamente.
                </p>
                <ul className="mt-3 space-y-2">
                  {rewriteValidationFailure.softWarnings.map((issue, index) => (
                    <li key={`${issue.section ?? "unknown"}-warning-${index}`} className="list-none">
                      <span className="font-medium">{formatValidationSectionLabel(issue.section)}:</span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!validationModalPayload && suspiciousValidationTargetRole ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="font-medium text-rose-900">Possível bug de leitura da vaga</p>
                <p className="mt-2">
                  {displayValidationTargetRole ? (
                    <>
                      Detectamos um cargo-alvo suspeito na vaga analisada:
                      {" "}
                      <span className="font-medium">{displayValidationTargetRole}</span>.
                      Isso parece mais um título de seção ou placeholder do que o cargo real. Se isso não fizer sentido para você, trate como erro do sistema e tente reenviar a vaga.
                    </>
                  ) : (
                    <>
                      Não conseguimos identificar com confiança o cargo-alvo da vaga analisada.
                      Isso sugere erro de leitura da vaga ou uso de um placeholder interno, não do cargo real. Se isso não fizer sentido para você, trate como erro do sistema e tente reenviar a vaga.
                    </>
                  )}
                </p>
              </div>
            ) : !validationModalPayload ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Como interpretar esse aviso</p>
                <p className="mt-2">
                  Esse bloqueio é de segurança. Ele indica que a reescrita final ficou inconsistente com o seu histórico real ou com a vaga, então o sistema preferiu parar em vez de mostrar um currículo pronto como se estivesse tudo certo.
                </p>
              </div>
            ) : null}
          </div>

          {validationOverrideCta?.helperText && !shouldUseFriendlyJobReview ? (
            <p className="shrink-0 text-xs text-slate-500">{validationOverrideCta.helperText}</p>
          ) : null}

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={closeRewriteValidationFailure}>
              {validationModalPayload?.actions.secondary.label ?? "Entendi"}
            </Button>
            {validationModalPayload?.actions.primary && !shouldUseFriendlyJobReview ? (
              <Button
                type="button"
                onClick={handleValidationOverridePrimaryAction}
                disabled={validationOverrideCta?.disabled}
              >
                {validationOverrideCta?.label ?? validationModalPayload.actions.primary.label}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanUpdateDialog
        isOpen={isPlanUpdateOpen}
        onOpenChange={setIsPlanUpdateOpen}
        activeRecurringPlan={currentActiveRecurringPlan}
        currentCredits={availableCredits}
      />

      <GenerationLoading
        isLoading={isRunningAtsEnhancement}
        generationType={generationMode === "job_targeting" ? "JOB_TARGETING" : "ATS_ENHANCEMENT"}
      />
    </div>
  )
}

