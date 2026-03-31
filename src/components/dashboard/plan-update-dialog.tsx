"use client"

import React, { useCallback, useState } from "react"

import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  CHECKOUT_ERROR_MESSAGE,
  getCheckoutErrorMessage,
} from "@/lib/asaas/checkout-errors"
import { navigateToUrl } from "@/lib/navigation/external"
import { PLANS, type PlanSlug, formatPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"

interface PlanUpdateDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeRecurringPlan: PlanSlug | null
  currentCredits: number
}

const plans: Array<{ slug: PlanSlug; popular: boolean }> = [
  { slug: "unit", popular: false },
  { slug: "monthly", popular: true },
  { slug: "pro", popular: false },
]

type CheckoutAttemptResult =
  | { kind: "success"; url: string }
  | { kind: "error"; message: string }

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
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })

      let payload: unknown = null
      try {
        payload = await res.json()
      } catch {
        payload = null
      }

      if (
        res.ok &&
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
      }
    } catch {
      return {
        kind: "error",
        message: CHECKOUT_ERROR_MESSAGE,
      }
    }
  }, [])

  const handleCheckout = useCallback(
    async (plan: PlanSlug) => {
      const purchaseState = getPlanPurchaseState(activeRecurringPlan, plan)

      if (purchaseState.isCurrentActiveRecurringPlan) {
        toast.info("Voce ja possui este plano mensal ativo")
        return
      }

      if (purchaseState.cannotPurchasePlan) {
        toast.error(ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE)
        return
      }

      setLoading(plan)
      try {
        const result = await requestCheckout(plan)

        if (result.kind === "success") {
          navigateToUrl(result.url)
          return
        }

        toast.error(result.message)
      } finally {
        setLoading(null)
      }
    },
    [activeRecurringPlan, requestCheckout],
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alterar Plano</DialogTitle>
          <DialogDescription>
            Escolha um novo plano para sua conta. Seu saldo de creditos sera preservado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6 md:grid-cols-3">
          {plans.map((plan) => {
            const config = PLANS[plan.slug]
            const purchaseState = getPlanPurchaseState(activeRecurringPlan, plan.slug)
            const isCurrent = purchaseState.isCurrentActiveRecurringPlan
            const estimatedCredits = currentCredits + config.credits
            const period = config.billing === "monthly" ? "/mes" : ""

            return (
              <Card
                key={config.name}
                className={cn(
                  "relative flex h-full flex-col rounded-[1.5rem] border border-border/60 bg-card/85 py-0 transition-all",
                  isCurrent
                    ? "border-primary/70 ring-2 ring-primary/20"
                    : "hover:-translate-y-1 hover:border-border",
                )}
              >
                {plan.popular ? (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.15em]">
                    Mais popular
                  </Badge>
                ) : null}

                {isCurrent ? (
                  <Badge
                    variant="secondary"
                    className="absolute -top-3 right-3 rounded-full text-[10px] uppercase tracking-[0.15em]"
                  >
                    Plano atual
                  </Badge>
                ) : null}

                <CardHeader className="pb-2 pt-6 text-center">
                  <CardTitle className="text-xl">{config.name}</CardTitle>
                  <CardDescription className="text-xs">{config.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-between text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-black tracking-tight">
                      {formatPrice(config.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">{period}</span>
                  </div>

                  <div className="mb-6 space-y-2 text-left text-sm">
                    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium">Creditos do plano:</span>
                      <span className="font-semibold">{config.credits}</span>
                    </div>
                    {isCurrent ? (
                      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                        <span className="text-xs font-medium">Creditos atuais:</span>
                        <span className="font-semibold">{currentCredits}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                        <span className="text-xs font-medium">Apos a compra:</span>
                        <span className="font-semibold text-primary">{estimatedCredits}</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {config.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />
                        <span className="text-xs font-medium leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pb-6">
                  <Button
                    className="h-10 w-full rounded-lg text-sm font-semibold"
                    variant={isCurrent ? "secondary" : plan.popular ? "default" : "outline"}
                    onClick={() => handleCheckout(plan.slug)}
                    disabled={loading !== null || isCurrent || purchaseState.cannotPurchasePlan}
                    title={purchaseState.cannotPurchasePlan ? ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE : undefined}
                  >
                    {loading === plan.slug ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrent ? (
                      "Plano atual"
                    ) : purchaseState.cannotPurchasePlan ? (
                      "Cancele o atual primeiro"
                    ) : (
                      "Selecionar"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
