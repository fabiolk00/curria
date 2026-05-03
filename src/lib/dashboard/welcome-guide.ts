import {
  DASHBOARD_RESUMES_HISTORY_PATH,
  GENERATE_RESUME_PATH,
  PROFILE_SETUP_PATH,
} from "@/lib/routes/app"

export const DASHBOARD_WELCOME_GUIDE_TARGET_ATTR = "data-dashboard-guide-target"
export const DASHBOARD_WELCOME_GUIDE_PROFILE_PATH = PROFILE_SETUP_PATH
export const DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH = GENERATE_RESUME_PATH
export const DASHBOARD_WELCOME_GUIDE_RESUMES_PATH = DASHBOARD_RESUMES_HISTORY_PATH

export const dashboardWelcomeGuideTargets = {
  profileNav: "profile-nav",
  generateResumeNav: "generate-resume-nav",
  resumesNav: "resumes-nav",
} as const

export type DashboardWelcomeGuideTargetId =
  typeof dashboardWelcomeGuideTargets[keyof typeof dashboardWelcomeGuideTargets]

export type DashboardWelcomeGuideStepDefinition = {
  id: string
  title: string
  description: string
  targetId: DashboardWelcomeGuideTargetId
  path: string
  preferredSide?: "left" | "right"
  requiresSidebar?: boolean
}

export const dashboardWelcomeGuideSteps: DashboardWelcomeGuideStepDefinition[] = [
  {
    id: "profile",
    title: "Seu perfil",
    description:
      "Aqui você revisa e ajusta suas informações principais antes de gerar e exportar currículos com mais qualidade.",
    targetId: dashboardWelcomeGuideTargets.profileNav,
    path: DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
    preferredSide: "right",
    requiresSidebar: true,
  },
  {
    id: "resumes",
    title: "Histórico de currículos",
    description:
      "Aqui ficam as versões geradas para revisar, comparar e baixar seus currículos quando precisar.",
    targetId: dashboardWelcomeGuideTargets.resumesNav,
    path: DASHBOARD_WELCOME_GUIDE_RESUMES_PATH,
    preferredSide: "right",
    requiresSidebar: true,
  },
  {
    id: "generate-resume",
    title: "Gerar currículo",
    description:
      "Este item abre a página dedicada para melhorar seu currículo para ATS ou adaptar uma versão para uma vaga específica.",
    targetId: dashboardWelcomeGuideTargets.generateResumeNav,
    path: DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH,
    preferredSide: "left",
  },
]

export function getDashboardGuideTargetProps(
  targetId: DashboardWelcomeGuideTargetId,
): Record<string, string> {
  return {
    [DASHBOARD_WELCOME_GUIDE_TARGET_ATTR]: targetId,
  }
}
