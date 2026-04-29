import { PLANS, type PlanSlug } from "@/lib/plans"

export type PlanComparisonHighlight = "black" | "gold" | null
export type PlanComparisonAtsTier = "Básico" | "Completo"

type PlanComparisonDefinition = {
  ats: PlanComparisonAtsTier
  pdf: boolean
  historico: boolean
  highlight: PlanComparisonHighlight
}

export type PlanComparisonRow =
  | { type: "value"; label: "Currículos" | "ATS Expert"; value: string }
  | { type: "boolean"; label: "PDF" | "Histórico"; included: boolean }

export const PLAN_DISPLAY_ORDER: PlanSlug[] = ["free", "unit", "monthly", "pro"]

export const PLAN_COMPARISON: Record<PlanSlug, PlanComparisonDefinition> = {
  free: {
    ats: "Básico",
    pdf: false,
    historico: false,
    highlight: null,
  },
  unit: {
    ats: "Completo",
    pdf: true,
    historico: true,
    highlight: null,
  },
  monthly: {
    ats: "Completo",
    pdf: true,
    historico: true,
    highlight: "black",
  },
  pro: {
    ats: "Completo",
    pdf: true,
    historico: true,
    highlight: "gold",
  },
}

export function getPlanComparison(slug: PlanSlug): PlanComparisonDefinition {
  return PLAN_COMPARISON[slug]
}

export function getPlanComparisonRows(slug: PlanSlug): PlanComparisonRow[] {
  const comparison = getPlanComparison(slug)

  return [
    {
      type: "value",
      label: "Currículos",
      value: String(PLANS[slug].credits),
    },
    {
      type: "value",
      label: "ATS Expert",
      value: comparison.ats,
    },
    {
      type: "boolean",
      label: "PDF",
      included: comparison.pdf,
    },
    {
      type: "boolean",
      label: "Histórico",
      included: comparison.historico,
    },
  ]
}
