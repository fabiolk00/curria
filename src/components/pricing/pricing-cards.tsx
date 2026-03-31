"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@clerk/nextjs"
import { Check, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CHECKOUT_ERROR_MESSAGE, getCheckoutErrorMessage } from "@/lib/asaas/checkout-errors"
import { navigateToUrl } from "@/lib/navigation/external"
import { PLANS, formatPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"

const plans = [
  {
    slug: "unit" as const,
    popular: false,
  },
  {
    slug: "monthly" as const,
    popular: true,
  },
  {
    slug: "pro" as const,
    popular: false,
  },
] as const

type CheckoutPlan = (typeof plans)[number]["slug"]

type CheckoutAttemptResult =
  | { kind: "success"; url: string }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string; retryable: boolean }

function getCheckoutRedirectPath(plan: CheckoutPlan): string {
  return `/pricing?checkoutPlan=${plan}`
}

function getLoginRedirectPath(plan: CheckoutPlan): string {
  return `/login?redirect_to=${encodeURIComponent(getCheckoutRedirectPath(plan))}`
}

function getSignupRedirectPath(plan: CheckoutPlan): string {
  return `/signup?redirect_to=${encodeURIComponent(getCheckoutRedirectPath(plan))}`
}

export default function PricingCards() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const autoCheckoutStartedRef = useRef(false)

  const redirectToAuth = useCallback(
    (plan: CheckoutPlan) => {
      router.push(getSignupRedirectPath(plan))
    },
    [router],
  )

  const requestCheckout = useCallback(async (plan: CheckoutPlan): Promise<CheckoutAttemptResult> => {
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

      if (res.status === 401) {
        return { kind: "unauthorized" }
      }

      return {
        kind: "error",
        message: getCheckoutErrorMessage(payload),
        retryable: res.status >= 500,
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
    async (plan: CheckoutPlan) => {
      if (!isLoaded) {
        return
      }

      if (!isSignedIn) {
        redirectToAuth(plan)
        return
      }

      setLoading(plan)
      try {
        let result = await requestCheckout(plan)

        if (result.kind !== "success" && (result.kind === "unauthorized" || result.retryable)) {
          result = await requestCheckout(plan)
        }

        if (result.kind === "success") {
          navigateToUrl(result.url)
          return
        }

        if (result.kind === "unauthorized") {
          router.push(getLoginRedirectPath(plan))
          return
        }

        toast.error(result.message)
      } finally {
        setLoading(null)
      }
    },
    [isLoaded, isSignedIn, redirectToAuth, requestCheckout, router],
  )

  useEffect(() => {
    const checkoutPlan = searchParams.get("checkoutPlan")
    if (!isLoaded || !isSignedIn || autoCheckoutStartedRef.current || !checkoutPlan) {
      return
    }

    if (checkoutPlan !== "unit" && checkoutPlan !== "monthly" && checkoutPlan !== "pro") {
      return
    }

    autoCheckoutStartedRef.current = true
    router.replace("/pricing")
    void handleCheckout(checkoutPlan)
  }, [handleCheckout, isLoaded, isSignedIn, router, searchParams])

  return (
    <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      {plans.map((plan) => {
        const config = PLANS[plan.slug]
        const period = config.billing === "monthly" ? "/mes" : ""

        return (
          <Card
            key={config.name}
            className={cn(
              "relative flex h-full flex-col rounded-[2rem] border border-border/60 bg-card/85 py-0 shadow-[0_28px_90px_-65px_oklch(var(--foreground)/0.8)] transition-all",
              plan.popular
                ? "border-primary/70 lg:scale-[1.03]"
                : "hover:-translate-y-1 hover:border-border hover:shadow-xl",
            )}
          >
            {plan.popular ? (
              <Badge className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.2em]">
                Mais popular
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
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handleCheckout(plan.slug)}
                disabled={!isLoaded || loading !== null}
              >
                {loading === plan.slug ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Comecar agora"
                )}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
