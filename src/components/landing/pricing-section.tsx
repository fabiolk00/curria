import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

// Real pricing from the architecture guide - matches pricing-cards.tsx
const plans = [
  {
    name: "Grátis",
    price: "R$ 0",
    description: "Experimente sem compromisso",
    features: [
      "1 análise de currículo grátis",
      "Score ATS básico",
      "Lista de palavras-chave",
      "Sugestões de melhoria",
    ],
    cta: "Começar grátis",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Unitário",
    price: "R$ 19",
    period: "",
    description: "Para análises pontuais",
    features: [
      "3 análises ATS completas",
      "3 arquivos DOCX + PDF",
      "Download imediato",
      "Chat com IA",
    ],
    cta: "Comprar agora",
    href: "/pricing",
    highlighted: false,
  },
  {
    name: "Mensal",
    price: "R$ 39",
    period: "/mês",
    description: "Ideal para busca ativa de emprego",
    features: [
      "20 currículos por mês",
      "Chat iterativo com IA",
      "Histórico de currículos",
      "Match com vagas",
    ],
    cta: "Assinar Mensal",
    href: "/pricing",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "R$ 97",
    period: "/mês",
    description: "Para profissionais e recrutadores",
    features: [
      "50 currículos por mês",
      "Tudo do plano Mensal",
      "Suporte prioritário",
      "Acesso antecipado a recursos",
    ],
    cta: "Assinar Pro",
    href: "/pricing",
    highlighted: false,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-4">
            Preços simples e transparentes
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Escolha o plano ideal para suas necessidades. Cancele quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? "border-primary shadow-lg relative" : "relative"}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Mais popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-12 text-sm">
          💳 Pagamento seguro via Asaas • ✨ 1 análise gratuita para todos
        </p>
      </div>
    </section>
  )
}
