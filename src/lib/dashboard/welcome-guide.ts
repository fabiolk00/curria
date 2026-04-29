export const DASHBOARD_WELCOME_GUIDE_TARGET_ATTR = "data-dashboard-guide-target"
export const DASHBOARD_WELCOME_GUIDE_PROFILE_PATH = "/profile-setup"
export const DASHBOARD_WELCOME_GUIDE_RESUMES_PATH = "/dashboard/resumes-history"

export const dashboardWelcomeGuideTargets = {
  profileNav: "profile-nav",
  profileAtsCta: "profile-ats-cta",
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
    id: "profile-ats-cta",
    title: "Melhorar para ATS",
    description:
      "Quando seu perfil estiver revisado, use este botão para gerar sua primeira versão ATS com base nas informações salvas.",
    targetId: dashboardWelcomeGuideTargets.profileAtsCta,
    path: DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
    preferredSide: "left",
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
]

export function getDashboardGuideTargetProps(
  targetId: DashboardWelcomeGuideTargetId,
): Record<string, string> {
  return {
    [DASHBOARD_WELCOME_GUIDE_TARGET_ATTR]: targetId,
  }
}
