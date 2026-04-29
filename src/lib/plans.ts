/**
 * SINGLE SOURCE OF TRUTH for all pricing and plan data.
 * Every component, API route, and config file MUST import from here.
 * Never hardcode plan values elsewhere.
 */

export const PLANS = {
  free: {
    name: "Grátis",
    slug: "free",
    price: 0,
    credits: 1,
    billing: "once" as const,
    description: "Experimente sem compromisso",
    features: [
      "1 análise de currículo grátis",
      "ATS Readiness Score básico",
      "Lista de palavras-chave",
      "Sugestões de melhoria",
    ],
    highlighted: false,
  },
  unit: {
    name: "Unitário",
    slug: "unit",
    price: 1990,
    credits: 3,
    billing: "once" as const,
    description: "Para análises pontuais",
    features: [
      "3 currículos otimizados",
      "PDF para download",
      "Otimização ATS com IA",
      "Adaptação para vaga",
    ],
    highlighted: false,
  },
  monthly: {
    name: "Mensal",
    slug: "monthly",
    price: 3990,
    credits: 12,
    billing: "monthly" as const,
    description: "Ideal para busca ativa de emprego",
    features: [
      "12 currículos por mês",
      "Otimização ATS dentro dos créditos",
      "Adaptação para vagas específicas",
      "Histórico de currículos gerados",
    ],
    highlighted: true,
  },
  pro: {
    name: "Pro",
    slug: "pro",
    price: 5990,
    credits: 30,
    billing: "monthly" as const,
    description: "Para profissionais e recrutadores",
    features: [
      "30 currículos por mês",
      "Tudo do plano Mensal",
      "Comparação e histórico avançado",
      "Suporte prioritário",
    ],
    highlighted: false,
  },
} as const

export type PlanSlug = keyof typeof PLANS
type Plan = (typeof PLANS)[PlanSlug]

/**
 * Helper to format price for display
 */
export function formatPrice(cents: number, period?: string): string {
  if (cents === 0) return "R$ 0"
  const reais = cents / 100
  const formattedNumber = reais.toFixed(2).replace('.', ',').replace(/,00$/, "")
  const formatted = `R$ ${formattedNumber}`
  return period ? `${formatted}${period}` : formatted
}

/**
 * Helper to get plan by slug with type safety
 */
export function getPlan(slug: string): Plan | null {
  return PLANS[slug as PlanSlug] ?? null
}
