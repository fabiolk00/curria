"use client"

import { useCallback, useState } from "react"

import { Check, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import {
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  CHECKOUT_ERROR_MESSAGE,
  getCheckoutErrorMessage,
} from "@/lib/asaas/checkout-errors"
import { navigateToUrl } from "@/lib/navigation/external"
import { PLANS, type PlanSlug, formatPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PlanUpdateDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeRecurringPlan: PlanSlug | null
  currentCredits: number
}

const planCards: Array<{ slug: PlanSlug; popular: boolean }> = [
  { slug: "unit", popular: false },
  { slug: "monthly", popular: true },
  { slug: "pro", popular: false },
]

type CheckoutAttemptResult =
  | { kind: "success"; url: string }
  | { kind: "error"; message: string; retryable: boolean }

function getPlanPurchaseState(activeRecurringPlan: PlanSlug | null, candidatePlan: PlanSlug): {
  isCurrentActiveRecurringPlan: boolean
  cannotPurchasePlan: boolean
} {
  const hasActiveRecurringPlan =
    activeRecurringPlan !== null && PLANS[activeRecurringPlan].billing === "monthly"

  const isCurrentActiveRecurringPlan =
    hasActiveRecurringPlan && activeRecurringPlan === candidatePlan

  const cannotPurchasePlan =
    hasActiveRecurringPlan &&
    PLANS[candidatePlan].billing === "monthly" &&
    activeRecurringPlan !== candidatePlan

  return {
    isCurrentActiveRecurringPlan,
    cannotPurchasePlan,
  }
}

export function PlanUpdateDialog({
  isOpen,
  onOpenChange,
  activeRecurringPlan,
  currentCredits,
}: PlanUpdateDialogProps) {
  const [loading, setLoading] = useState<PlanSlug | null>(null)

  const requestCheckout = useCallback(async (plan: PlanSlug): Promise<CheckoutAttemptResult> => {
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (
        response.ok &&
        typeof payload === "object" &&
        payload !== null &&
        "url" in payload &&
        typeof payload.url === "string" &&
        payload.url.length > 0
      ) {
        return { kind: "success", url: payload.url }
      }

      return {
        kind: "error",
        message: getCheckoutErrorMessage(payload),
        retryable: response.status >= 500,
      }
    } catch {
      return {
        kind: "error",
        message: CHECKOUT_ERROR_MESSAGE,
        retryable: true,
      }
    }
  }, [])

  const handleCheckout = useCallback(
    async (plan: PlanSlug) => {
      const purchaseState = getPlanPurchaseState(activeRecurringPlan, plan)

      if (purchaseState.isCurrentActiveRecurringPlan) {
        toast.info("Você já possui este plano mensal ativo")
        return
      }

      if (purchaseState.cannotPurchasePlan) {
        toast.error(ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE)
        return
      }

      setLoading(plan)
      try {
        let result = await requestCheckout(plan)

        if (result.kind !== "success" && result.retryable) {
          result = await requestCheckout(plan)
        }

        if (result.kind === "success") {
          onOpenChange(false)
          navigateToUrl(result.url)
          return
        }

        toast.error(result.message)
      } finally {
        setLoading(null)
      }
    },
    [activeRecurringPlan, onOpenChange, requestCheckout],
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(98vw,1200px)] max-w-none overflow-hidden p-0 sm:rounded-[2rem]">
        <div className="max-h-[92vh] overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-7xl">
            <DialogHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
                  Atualização de plano
                </Badge>
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Créditos preservados
                </div>
              </div>

              <div className="space-y-3">
                <DialogTitle className="text-3xl font-black tracking-tight sm:text-4xl">
                  Escolha seu novo plano
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-base leading-7">
                  Recriamos o modal com a mesma estrutura visual dos cards da página de preços. Seu saldo atual continua
                  na conta enquanto o checkout é iniciado.
                </DialogDescription>
              </div>

              <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Créditos atuais: {currentCredits}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se você já possui um plano mensal ativo, outro plano mensal ficará indisponível até o cancelamento do
                  plano atual.
                </p>
              </div>
            </DialogHeader>

            <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {planCards.map((planCard) => {
                const config = PLANS[planCard.slug]
                const purchaseState = getPlanPurchaseState(activeRecurringPlan, planCard.slug)
                const isCurrent = purchaseState.isCurrentActiveRecurringPlan
                const estimatedCredits = currentCredits + config.credits
                const period = config.billing === "monthly" ? "/mês" : ""

                return (
                  <Card
                    key={config.name}
                    className={cn(
                      "relative flex h-full flex-col rounded-[2rem] border border-border/60 bg-card/85 py-0 shadow-[0_28px_90px_-65px_oklch(var(--foreground)/0.8)] transition-all",
                      planCard.popular
                        ? "border-primary/70 lg:scale-[1.02]"
                        : "hover:-translate-y-1 hover:border-border hover:shadow-xl",
                      isCurrent ? "ring-2 ring-primary/20" : undefined,
                    )}
                  >
                    {planCard.popular ? (
                      <Badge className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.2em]">
                        Mais popular
                      </Badge>
                    ) : null}

                    {isCurrent ? (
                      <Badge
                        variant="secondary"
                        className="absolute right-3 top-3 rounded-full text-[10px] uppercase tracking-[0.15em]"
                      >
                        Plano atual
                      </Badge>
                    ) : null}

                    <CardHeader className="pb-2 pt-8 text-center">
                      <CardTitle className="text-2xl">{config.name}</CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-1 flex-col justify-between text-center">
                      <div className="mb-8">
                        <span className="text-5xl font-black tracking-tight">{formatPrice(config.price)}</span>
                        <span className="text-muted-foreground">{period}</span>
                      </div>

                      <ul className="space-y-4 text-left">
                        <li className="flex items-start gap-3">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span className="text-sm font-medium">Créditos do plano: {config.credits}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span className="text-sm font-medium">
                            {isCurrent ? `Créditos atuais: ${currentCredits}` : `Após a compra: ${estimatedCredits}`}
                          </span>
                        </li>
                        {config.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <span className="text-sm font-medium">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter className="pb-8">
                      <Button
                        className="h-12 w-full rounded-full font-semibold"
                        variant={isCurrent ? "secondary" : planCard.popular ? "default" : "outline"}
                        onClick={() => void handleCheckout(planCard.slug)}
                        disabled={loading !== null || isCurrent}
                        title={purchaseState.cannotPurchasePlan ? ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE : undefined}
                      >
                        {loading === planCard.slug ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processando...
                          </>
                        ) : isCurrent ? (
                          "Plano atual"
                        ) : purchaseState.cannotPurchasePlan ? (
                          "Ver restrição"
                        ) : (
                          "Selecionar"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
