import { Check, Sparkles, X } from "lucide-react"

import { PLAN_COMPARISON, PLAN_DISPLAY_ORDER } from "@/lib/pricing/plan-comparison"
import { PLANS, formatPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"

function BoolCell({ value, highlight }: { value: boolean; highlight?: boolean }) {
  if (value) {
    return (
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full",
          highlight ? "bg-green-500" : "bg-green-500",
        )}
      >
        <Check size={12} strokeWidth={3} className="text-white" />
      </div>
    )
  }

  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
      <X size={12} strokeWidth={3} className="text-white" />
    </div>
  )
}

const columns = [
  { label: "Plano", key: "name" },
  { label: "Preço", key: "price" },
  { label: "Currículos", key: "curriculos" },
  { label: "ATS Expert", key: "ats" },
  { label: "PDF", key: "pdf" },
  { label: "Histórico", key: "historico" },
] as const

export default function PricingComparisonTable() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 py-20">
      <div className="mb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">
          <Sparkles size={12} />
          Planos e Preços
        </div>
        <h1 className="mb-4 text-balance text-4xl font-bold leading-tight text-neutral-900 md:text-5xl">
          Escolha o plano ideal
        </h1>
        <p className="mx-auto max-w-md text-lg text-neutral-500">
          Comece gratuitamente e evolua conforme sua necessidade
        </p>
      </div>

      <div className="w-full max-w-4xl overflow-x-auto">
        <div className="min-w-[620px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid grid-cols-6 border-b border-neutral-200 bg-neutral-50/80 px-6 py-4">
            {columns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider text-neutral-500",
                  col.key === "name" ? "col-span-1" : "col-span-1 text-center",
                )}
              >
                {col.label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-neutral-100">
            {PLAN_DISPLAY_ORDER.map((slug) => {
              const config = PLANS[slug]
              const comparison = PLAN_COMPARISON[slug]
              const isBlack = comparison.highlight === "black"
              const isGold = comparison.highlight === "gold"
              const period = config.billing === "monthly" ? "/mês" : null
              const curriculos = String(config.credits)

              return (
                <div
                  key={config.name}
                  className={cn(
                    "group grid grid-cols-6 items-center px-6 py-5 transition-all duration-200",
                    "hover:bg-neutral-50/50",
                    isBlack && "bg-neutral-900 hover:bg-neutral-800",
                    isGold
                      && "bg-gradient-to-r from-amber-50/80 via-yellow-50/50 to-amber-50/80 hover:from-amber-50 hover:via-yellow-50 hover:to-amber-50",
                  )}
                >
                  <div className="col-span-1 flex items-center gap-2.5">
                    {isBlack ? (
                      <strong className="text-sm font-semibold text-white">{config.name}</strong>
                    ) : isGold ? (
                      <span className="text-sm font-semibold" style={{ color: "#92700C" }}>
                        {config.name}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-neutral-700">{config.name}</span>
                    )}

                    {isBlack ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-neutral-900">
                        Popular
                      </span>
                    ) : null}

                    {isGold ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide"
                        style={{ backgroundColor: "#B8860B", color: "white" }}
                      >
                        Premium
                      </span>
                    ) : null}
                  </div>

                  <div className="col-span-1 text-center">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isBlack ? "text-white" : isGold ? "text-amber-900" : "text-neutral-900",
                      )}
                    >
                      {formatPrice(config.price)}
                    </span>
                    {period ? (
                      <span className="text-xs font-normal text-neutral-400">{period}</span>
                    ) : null}
                  </div>

                  <div className="col-span-1 text-center">
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold",
                        isBlack
                          ? "bg-white/10 text-white"
                          : isGold
                            ? "bg-amber-100 text-amber-800"
                            : "bg-neutral-100 text-neutral-700",
                      )}
                    >
                      {curriculos}
                    </span>
                  </div>

                  <div className="col-span-1 text-center">
                    <span
                      className={cn(
                        "text-sm",
                        isBlack ? "text-neutral-300" : isGold ? "text-amber-800" : "text-neutral-600",
                        comparison.ats === "Completo" && "font-medium",
                      )}
                    >
                      {comparison.ats}
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <BoolCell value={comparison.pdf} />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <BoolCell value={comparison.historico} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
