export const DASHBOARD_WELCOME_GUIDE_STORAGE_KEY = "curria:dashboard:welcome-guide:v1"
export const DASHBOARD_WELCOME_GUIDE_TARGET_ATTR = "data-dashboard-guide-target"
export const DASHBOARD_WELCOME_GUIDE_PROFILE_PATH = "/dashboard/resumes/new"

export const dashboardWelcomeGuideTargets = {
  profileNav: "profile-nav",
  newConversation: "new-conversation",
  profileAtsCta: "profile-ats-cta",
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
    id: "new-conversation",
    title: "Nova conversa",
    description:
      "Comece uma nova conversa para analisar, otimizar ou adaptar seu currículo com ajuda da IA.",
    targetId: dashboardWelcomeGuideTargets.newConversation,
    path: DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
    preferredSide: "right",
    requiresSidebar: true,
  },
  {
    id: "profile-ats-cta",
    title: "Próximo passo recomendado",
    description:
      "Com o perfil revisado, você já pode gerar sua primeira versão ATS ou adaptar o currículo para uma vaga específica.",
    targetId: dashboardWelcomeGuideTargets.profileAtsCta,
    path: DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
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
