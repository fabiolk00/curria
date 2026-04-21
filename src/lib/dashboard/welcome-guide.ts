export const DASHBOARD_WELCOME_GUIDE_TARGET_ATTR = "data-dashboard-guide-target"
export const DASHBOARD_WELCOME_GUIDE_PROFILE_PATH = "/dashboard/resumes/new"
export const DASHBOARD_WELCOME_GUIDE_CHAT_PATH = "/dashboard"
export const DASHBOARD_WELCOME_GUIDE_SESSIONS_PATH = "/dashboard/sessions"

export const dashboardWelcomeGuideTargets = {
  profileNav: "profile-nav",
  profileAtsCta: "profile-ats-cta",
  sessionsNav: "sessions-nav",
  newConversation: "new-conversation",
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
    id: "sessions",
    title: "Suas sessões",
    description:
      "Aqui ficam suas conversas anteriores para retomar versões, revisar o histórico e continuar de onde parou.",
    targetId: dashboardWelcomeGuideTargets.sessionsNav,
    path: DASHBOARD_WELCOME_GUIDE_SESSIONS_PATH,
    preferredSide: "right",
    requiresSidebar: true,
  },
  {
    id: "new-conversation",
    title: "Nova conversa",
    description:
      "Comece uma nova conversa para analisar, otimizar ou adaptar seu currículo com ajuda da IA.",
    targetId: dashboardWelcomeGuideTargets.newConversation,
    path: DASHBOARD_WELCOME_GUIDE_CHAT_PATH,
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
