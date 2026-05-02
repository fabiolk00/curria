import { Check, Info, X } from "lucide-react"

import {
  PLAN_COMPARISON,
  PLAN_DISPLAY_ORDER,
  type PlanComparisonAtsTier,
} from "@/lib/pricing/plan-comparison"
import { PLANS, formatPrice, type PlanSlug } from "@/lib/plans"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ComparisonValue =
  | { type: "text"; value: string }
  | { type: "boolean"; value: boolean; label: string }

type ComparisonRow = {
  key: string
  label: string
  info: string
  valueForPlan: (slug: PlanSlug) => ComparisonValue
}

const comparisonRows: ComparisonRow[] = [
  {
    key: "price",
    label: "Preço",
    info: "Valor atual vindo da configuração canônica de planos.",
    valueForPlan: (slug) => {
      const plan = PLANS[slug]
      const period = plan.billing === "monthly" ? "/mês" : ""
      return { type: "text", value: `${formatPrice(plan.price)}${period}` }
    },
  },
  {
    key: "billing",
    label: "Cobrança",
    info: "Indica se o plano é pagamento único ou assinatura mensal.",
    valueForPlan: (slug) => ({
      type: "text",
      value: PLANS[slug].billing === "monthly" ? "Mensal" : "Única",
    }),
  },
  {
    key: "credits",
    label: "Currículos",
    info: "Quantidade de currículos/análises incluídos no plano.",
    valueForPlan: (slug) => ({ type: "text", value: String(PLANS[slug].credits) }),
  },
  {
    key: "ats",
    label: "ATS Expert",
    info: "Nível da análise ATS disponível no plano.",
    valueForPlan: (slug) => ({ type: "text", value: PLAN_COMPARISON[slug].ats }),
  },
  {
    key: "pdf",
    label: "PDF",
    info: "Download do currículo otimizado em PDF.",
    valueForPlan: (slug) => ({
      type: "boolean",
      value: PLAN_COMPARISON[slug].pdf,
      label: "PDF",
    }),
  },
  {
    key: "history",
    label: "Histórico",
    info: "Acesso ao histórico de currículos gerados.",
    valueForPlan: (slug) => ({
      type: "boolean",
      value: PLAN_COMPARISON[slug].historico,
      label: "Histórico",
    }),
  },
]

function BoolCell({ value, label }: { value: boolean; label: string }) {
  if (value) {
    return (
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A]">
        <Check aria-label={`${label}: incluído`} size={14} strokeWidth={3} className="text-white" />
      </div>
    )
  }

  return (
    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F7F7F7] text-[#8A8A93]">
      <X aria-label={`${label}: não incluído`} size={14} strokeWidth={3} />
    </div>
  )
}

function TextCell({ value }: { value: string }) {
  const isAtsTier = value === ("Completo" satisfies PlanComparisonAtsTier)
    || value === ("Básico" satisfies PlanComparisonAtsTier)

  return (
    <span
      className={cn(
        "text-sm font-medium text-[#1B1B1D]",
        isAtsTier && value === "Completo" ? "text-[#2563EB]" : undefined,
        isAtsTier && value === "Básico" ? "text-[#5E5E66]" : undefined,
      )}
    >
      {value}
    </span>
  )
}

function RowLabel({ row }: { row: ComparisonRow }) {
  return (
    <div className="flex items-center gap-2 text-left">
      <span className="text-sm font-medium text-[#1B1B1D]">{row.label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#8A8A93] transition-colors hover:bg-[#F7F7F7] hover:text-[#5E5E66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
            aria-label={`Mais informações sobre ${row.label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6} className="max-w-56">
          {row.info}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export default function PricingComparisonTable() {
  return (
    <section className="rounded-xl bg-[#FAFAFA] px-4 py-12 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h3 className="text-3xl font-bold leading-tight text-[#1B1B1D] md:text-4xl">
              Compare os planos
            </h3>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5E5E66]">
              Veja lado a lado os créditos, recursos e ciclos de cobrança disponíveis hoje.
            </p>
          </div>

          <div
            aria-label="Ciclo de cobrança"
            className="inline-flex w-fit rounded-full border border-[#E6E6E6] bg-[#FFFFFF] p-1 text-sm font-medium"
          >
            <span className="rounded-full bg-[#232327] px-4 py-2 text-[#FFFFFF]">
              Planos atuais
            </span>
            <span className="px-4 py-2 text-[#5E5E66]">Único e mensal</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px] overflow-hidden rounded-xl border border-[#E6E6E6] bg-[#FFFFFF] shadow-sm">
            <div className="grid grid-cols-[minmax(180px,1.15fr)_repeat(4,minmax(132px,1fr))] border-b border-[#E6E6E6] bg-[#F7F7F7]">
              <div className="px-5 py-4 text-left text-xs font-semibold text-[#5E5E66]">
                Recursos
              </div>
              {PLAN_DISPLAY_ORDER.map((slug) => {
                const plan = PLANS[slug]
                const isFeatured = plan.highlighted

                return (
                  <div
                    key={slug}
                    className={cn(
                      "px-5 py-4 text-center",
                      isFeatured ? "bg-[#EFF6FF]" : undefined,
                    )}
                  >
                    <div className="text-sm font-bold text-[#1B1B1D]">{plan.name}</div>
                    <div className="mt-1 text-xs font-medium text-[#5E5E66]">
                      {formatPrice(plan.price)}
                      {plan.billing === "monthly" ? "/mês" : ""}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="divide-y divide-[#E6E6E6]">
              {comparisonRows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[minmax(180px,1.15fr)_repeat(4,minmax(132px,1fr))] transition-colors hover:bg-[#FAFAFA]"
                >
                  <div className="px-5 py-4">
                    <RowLabel row={row} />
                  </div>
                  {PLAN_DISPLAY_ORDER.map((slug) => {
                    const plan = PLANS[slug]
                    const isFeatured = plan.highlighted
                    const cell = row.valueForPlan(slug)

                    return (
                      <div
                        key={`${row.key}-${slug}`}
                        className={cn(
                          "flex items-center justify-center px-5 py-4 text-center",
                          isFeatured ? "bg-[#EFF6FF]/55" : undefined,
                        )}
                      >
                        {cell.type === "boolean" ? (
                          <BoolCell value={cell.value} label={cell.label} />
                        ) : (
                          <TextCell value={cell.value} />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
