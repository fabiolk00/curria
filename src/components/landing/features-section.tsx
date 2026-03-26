import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Wand2, Gauge, CalendarCheck } from "lucide-react"

const features = [
  {
    icon: Search,
    title: "Detecção de Palavras-chave",
    description: "Escaneamos a descrição da vaga e identificamos as palavras-chave, habilidades e frases exatas que o ATS procura — depois verificamos se seu currículo as contém.",
  },
  {
    icon: Wand2,
    title: "Otimização Inteligente",
    description: "Nossa IA reescreve seções do seu currículo para incluir naturalmente palavras-chave faltantes, sem parecer robótico ou forçado.",
  },
  {
    icon: Gauge,
    title: "Score ATS Antes e Depois",
    description: "Veja sua pontuação real de compatibilidade ATS antes e depois da otimização — com um detalhamento claro do que melhorou.",
  },
  {
    icon: CalendarCheck,
    title: "Mais Entrevistas, Garantido",
    description: "Nossos usuários relatam 3x mais convites para entrevistas após otimizar seus currículos com CurrIA.",
  },
]

export default function FeaturesSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-balance">
            O que a CurrIA faz por você
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
