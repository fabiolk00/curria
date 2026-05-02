import Link from "next/link"
import { Check, Gift, ShieldCheck } from "lucide-react"

import PricingComparisonTable from "@/components/landing/pricing-comparison-table"
import { Badge } from "@/components/ui/badge"
import { PLAN_DISPLAY_ORDER } from "@/lib/pricing/plan-comparison"
import { PLANS, formatPrice, type PlanSlug } from "@/lib/plans"
import { buildCheckoutPathWithPlan, PUBLIC_ROUTES } from "@/lib/routes/public"
import { cn } from "@/lib/utils"

const planActions: Record<PlanSlug, { cta: string; href: string }> = {
  free: {
    cta: "Começar com este plano",
    href: PUBLIC_ROUTES.signup,
  },
  unit: {
    cta: "Começar com este plano",
    href: buildCheckoutPathWithPlan("unit"),
  },
  monthly: {
    cta: "Começar com este plano",
    href: buildCheckoutPathWithPlan("monthly"),
  },
  pro: {
    cta: "Começar com este plano",
    href: buildCheckoutPathWithPlan("pro"),
  },
}

function getBillingMeta(slug: PlanSlug): string {
  const plan = PLANS[slug]

  if (slug === "free") {
    return "Sem cartão, uso inicial gratuito"
  }

  if (plan.billing === "monthly") {
    return "Cobrança mensal, créditos renovados a cada mês"
  }

  return "Pagamento único, créditos para usar quando precisar"
}

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-[#FFFFFF] py-24">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-balance text-3xl font-bold leading-tight text-[#1B1B1D] md:text-5xl">
            Preços simples para melhorar seu currículo
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#5E5E66]">
            Escolha o plano ideal para ver seu score ATS, ajustar o currículo e avançar mais nas vagas.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_DISPLAY_ORDER.map((slug) => {
            const config = PLANS[slug]
            const planAction = planActions[slug]
            const billingPeriod = config.billing === "monthly" ? "/mês" : ""

            return (
              <article
                key={slug}
                data-testid={`pricing-card-${slug}`}
                data-featured={config.highlighted ? "true" : "false"}
                className={cn(
                  "relative flex h-full flex-col rounded-xl border bg-[#FFFFFF] p-6 shadow-sm transition-all duration-200",
                  "hover:-translate-y-0.5 hover:border-[#D6D6D6] hover:shadow-md",
                  config.highlighted
                    ? "border-[#3B82F6] shadow-md ring-1 ring-[#3B82F6]/20"
                    : "border-[#E6E6E6]",
                )}
              >
                {config.highlighted ? (
                  <div className="absolute left-6 top-6">
                    <Badge
                      variant="outline"
                      className="rounded-full border-[#3B82F6]/20 bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]"
                    >
                      Recomendado
                    </Badge>
                  </div>
                ) : null}

                <div className={cn("space-y-5", config.highlighted ? "pt-9" : undefined)}>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold leading-tight text-[#1B1B1D]">
                      {config.name}
                    </h3>
                    <p className="min-h-[44px] text-sm leading-relaxed text-[#5E5E66]">
                      {config.description}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold leading-none tracking-tight text-[#1B1B1D]">
                        {formatPrice(config.price)}
                      </span>
                      {billingPeriod ? (
                        <span className="pb-1 text-sm font-medium text-[#5E5E66]">
                          {billingPeriod}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#8A8A93]">
                      {getBillingMeta(slug)}
                    </p>
                  </div>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {config.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-relaxed text-[#1B1B1D]">
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={planAction.href}
                  className={cn(
                    "mt-8 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors",
                    config.highlighted
                      ? "bg-[#232327] text-[#FFFFFF] hover:bg-[#111113]"
                      : "border border-[#D6D6D6] bg-[#FFFFFF] text-[#232327] hover:border-[#232327] hover:bg-[#FAFAFA]",
                  )}
                >
                  {planAction.cta}
                </Link>
              </article>
            )
          })}
        </div>

        <div data-testid="landing-pricing-comparison" className="mt-20">
          <PricingComparisonTable />
        </div>

        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-sm font-medium text-[#5E5E66] sm:flex-row">
          <div className="flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-2">
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
            <span>Pagamento 100% seguro via</span>
            <span className="ml-0.5 flex items-center text-base font-black tracking-normal text-[#0030B9] dark:text-[#4270f5]">
              Asaas
            </span>
          </div>
          <span className="hidden text-[#D6D6D6] sm:inline">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <Gift className="h-3.5 w-3.5" />
            </div>
            <span>
              1 análise <strong className="text-[#1B1B1D]">totalmente gratuita</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
