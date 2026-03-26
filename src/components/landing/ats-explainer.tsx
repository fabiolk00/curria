import { Card, CardContent } from "@/components/ui/card"
import { Upload, Bot, GitFork, Trash2, User } from "lucide-react"

const steps = [
  {
    icon: Upload,
    title: "Você se candidata",
    description: "Você envia seu currículo através de um portal de vagas.",
    step: 1,
  },
  {
    icon: Bot,
    title: "O ATS escaneia",
    description: "Software automatizado analisa seu currículo buscando palavras-chave, formatação e relevância antes que um humano veja.",
    step: 2,
  },
  {
    icon: GitFork,
    title: "Filtrado ou encaminhado",
    description: "Se seu currículo não corresponde aos critérios da vaga, é automaticamente rejeitado.",
    step: 3,
    showPaths: true,
  },
]

export default function AtsExplainer() {
  return (
    <section id="how-it-works" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-balance">
            Por que 75% dos currículos nunca chegam a olhos humanos
          </h2>
        </div>

        {/* Steps flow */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <Card key={step.step} className="relative bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{step.step}</span>
                    </div>
                    <step.icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                  
                  {step.showPaths && (
                    <div className="flex gap-4 mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs">
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="text-destructive">Rejeitado</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-4 w-4 text-success" />
                        <span className="text-success">Recrutador</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Callout */}
        <div className="mt-12 max-w-2xl mx-auto">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center">
              <p className="text-foreground font-medium">
                CurrIA faz a engenharia reversa desse processo para que seu currículo sempre caia na pilha certa.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
