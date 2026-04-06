"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@clerk/nextjs"
import { Check, Loader2, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  buildCheckoutOnboardingPath,
  buildCheckoutResumePath,
  isPaidPlanSlug,
  type PaidPlanSlug,
} from "@/lib/billing/checkout-navigation"
import { PLANS, formatPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"

const plans = [
  {
    slug: "free" as const,
    popular: false,
  },
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

type DisplayPlan = (typeof plans)[number]["slug"]

function getSignupRedirectPath(plan: PaidPlanSlug): string {
  return `/signup?redirect_to=${encodeURIComponent(buildCheckoutResumePath(plan))}`
}

export default function PricingCards() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const autoCheckoutStartedRef = useRef(false)

  const redirectToAuth = useCallback(
    (plan: PaidPlanSlug) => {
      router.push(getSignupRedirectPath(plan))
    },
    [router],
  )

  const handleCheckout = useCallback(
    async (plan: PaidPlanSlug) => {
      if (!isLoaded) {
        return
      }

      if (!isSignedIn) {
        redirectToAuth(plan)
        return
      }

      setLoading(plan)
      try {
        router.push(buildCheckoutOnboardingPath(plan))
      } finally {
        setLoading(null)
      }
    },
    [isLoaded, isSignedIn, redirectToAuth, router],
  )

  const handlePlanAction = useCallback(
    async (plan: DisplayPlan) => {
      if (plan === "free") {
        if (!isLoaded) {
          return
        }

        if (!isSignedIn) {
          router.push("/signup")
          return
        }

        router.push("/dashboard")
        return
      }

      await handleCheckout(plan)
    },
    [handleCheckout, isLoaded, isSignedIn, router],
  )

  useEffect(() => {
    const checkoutPlan = searchParams.get("checkoutPlan")
    if (!isLoaded || !isSignedIn || autoCheckoutStartedRef.current || !checkoutPlan) {
      return
    }

    if (!isPaidPlanSlug(checkoutPlan)) {
      return
    }

    autoCheckoutStartedRef.current = true
    router.replace("/pricing")
    router.push(buildCheckoutOnboardingPath(checkoutPlan))
  }, [isLoaded, isSignedIn, router, searchParams])

  return (
    <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const config = PLANS[plan.slug]
        const period = config.billing === "monthly" ? "/mês" : ""
        const hasJobManagement = plan.slug !== "free"

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
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span className="text-sm font-medium">{feature}</span>
                  </li>
                ))}
                <li key="job-management" className="flex items-start gap-3">
                  {hasJobManagement ? (
                    <Check aria-label="Recurso incluído" className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <X aria-label="Recurso indisponível" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  )}
                  <span className={cn("text-sm font-medium", hasJobManagement ? undefined : "text-muted-foreground")}>
                    Gerenciamento de vagas
                  </span>
                </li>
              </ul>
            </CardContent>

            <CardFooter className="pb-8">
              <Button
                className="h-12 w-full rounded-full font-semibold"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => void handlePlanAction(plan.slug)}
                disabled={!isLoaded || loading !== null}
              >
                {loading === plan.slug ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  plan.slug === "free" ? "Começar grátis" : "Começar agora"
                )}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
