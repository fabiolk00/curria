import Link from "next/link"
import { Check, Gift, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PLANS, formatPrice } from "@/lib/plans"

const plans = [
  {
    slug: "free" as const,
    cta: "Começar grátis",
    href: "/signup",
  },
  {
    slug: "unit" as const,
    cta: "Comprar agora",
    href: "/pricing",
  },
  {
    slug: "monthly" as const,
    cta: "Assinar Mensal",
    href: "/pricing",
  },
  {
    slug: "pro" as const,
    cta: "Assinar Pro",
    href: "/pricing",
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-4">
            Preços simples e transparentes
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Escolha o plano ideal para suas necessidades. Cancele quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const config = PLANS[plan.slug]

            return (
              <Card
                key={plan.slug}
                className={`relative flex flex-col h-full transition-all duration-200 ${
                  config.highlighted
                    ? "border-primary shadow-xl shadow-primary/10 scale-105 z-10 bg-card"
                    : "border-border/50 hover:border-border hover:shadow-md bg-card/50"
                }`}
              >
                {config.highlighted && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge
                      variant="default"
                      className="text-xs font-bold uppercase tracking-wider py-1 px-3"
                    >
                      Mais popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pt-8">
                  <CardTitle className="text-2xl">{config.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{config.description}</CardDescription>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {formatPrice(config.price)}
                    </span>
                    {config.billing === "monthly" && (
                      <span className="text-muted-foreground font-medium">/mês</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-8">
                  <ul className="space-y-4">
                    {config.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="w-full font-semibold"
                    variant={config.highlighted ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-16 text-sm text-muted-foreground font-medium">
          <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Pagamento 100% seguro via</span>
            <span className="font-black flex items-center text-[#0030B9] dark:text-[#4270f5] tracking-[-0.05em] text-base ml-0.5">
              asaas
            </span>
          </div>
          <span className="hidden sm:inline text-border">•</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
              <Gift className="w-3.5 h-3.5" />
            </div>
            <span>
              1 análise <strong className="text-foreground">totalmente gratuita</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
