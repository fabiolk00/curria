"use client"

import React, { useEffect, useRef, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2 } from "lucide-react"
import { navigateToUrl } from "@/lib/navigation/external"
import { cn } from "@/lib/utils"
import { PLANS, formatPrice } from "@/lib/plans"

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
]

const CHECKOUT_ERROR_MESSAGE = "Nao foi possivel iniciar o checkout. Tente novamente."
const CHECKOUT_RETRY_DELAY_MS = 750

type CheckoutPlan = typeof plans[number]["slug"]

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getCheckoutErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    const message = payload.error.trim()
    if (message && message !== "Internal server error" && message !== "Unauthorized") {
      return message
    }
  }

  return CHECKOUT_ERROR_MESSAGE
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export default function PricingCards() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const autoCheckoutStartedRef = useRef(false)

  const redirectToAuth = (plan: CheckoutPlan) => {
    router.push(getSignupRedirectPath(plan))
  }

  const requestCheckout = async (plan: CheckoutPlan): Promise<CheckoutAttemptResult> => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      let payload: unknown = null
      try {
        payload = await res.json()
      } catch {
        payload = null
      }

      if (res.ok && isRecord(payload) && typeof payload.url === "string" && payload.url.length > 0) {
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
  }

  const handleCheckout = async (plan: CheckoutPlan) => {
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
        await sleep(CHECKOUT_RETRY_DELAY_MS)
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
  }

  useEffect(() => {
    const checkoutPlan = searchParams.get('checkoutPlan')
    if (!isLoaded || !isSignedIn || autoCheckoutStartedRef.current || !checkoutPlan) {
      return
    }

    if (checkoutPlan !== 'unit' && checkoutPlan !== 'monthly' && checkoutPlan !== 'pro') {
      return
    }

    autoCheckoutStartedRef.current = true
    router.replace('/pricing')
    void handleCheckout(checkoutPlan)
  }, [isLoaded, isSignedIn, router, searchParams])

  return (
    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {plans.map((plan) => {
        const config = PLANS[plan.slug]
        const period = config.billing === 'monthly' ? '/mês' : ''

        return (
          <Card
            key={config.name}
            className={cn(
              "relative flex flex-col",
              plan.popular && "border-primary shadow-lg"
            )}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Mais popular
              </Badge>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{config.name}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-center flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold">{formatPrice(config.price)}</span>
                <span className="text-muted-foreground">{period}</span>
              </div>
              <ul className="space-y-3 text-left">
                {config.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
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
                  'Começar agora'
                )}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
