import { Link } from "react-router"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "./ui"
import { Check, ShieldCheck, Gift } from "lucide-react"

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
    href: "/signup",
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
    href: "/signup",
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
    href: "/signup",
    highlighted: false,
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
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col h-full transition-all duration-200 ${
                plan.highlighted 
                  ? "border-primary shadow-xl shadow-primary/10 scale-105 z-10 bg-card" 
                  : "border-border/50 hover:border-border hover:shadow-md bg-card/50"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge variant="default" className="text-xs font-bold uppercase tracking-wider py-1 px-3">
                    Mais popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pt-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground font-medium">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-8">
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="w-full font-semibold"
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
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
            <span>1 análise <strong className="text-foreground">totalmente gratuita</strong></span>
          </div>
        </div>
      </div>
    </section>
  )
}