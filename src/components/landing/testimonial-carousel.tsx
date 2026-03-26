"use client"

import { useRef } from "react"
import { TestimonialCard } from "./testimonial-card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

const testimonials = [
  {
    name: "Ana Silva",
    role: "Desenvolvedora de Software",
    quote: "Eu estava me candidatando há meses sem nenhum retorno. Depois do ATS Expert, recebi 4 convites para entrevista em 2 semanas. A análise de palavras-chave foi um divisor de águas.",
    initials: "AS",
    color: "bg-primary",
  },
  {
    name: "Carlos Mendes",
    role: "Gerente de Marketing",
    quote: "Eu não fazia ideia de que meu currículo estava sendo filtrado por robôs. Meu score ATS foi de 28% para 91%. Consegui meu emprego dos sonhos.",
    initials: "CM",
    color: "bg-chart-2",
  },
  {
    name: "Juliana Costa",
    role: "Analista de Dados",
    quote: "A comparação antes/depois me impressionou muito. Tantas palavras-chave faltando que eu nunca teria pensado. Fui contratada em 3 semanas.",
    initials: "JC",
    color: "bg-chart-3",
  },
  {
    name: "Rafael Oliveira",
    role: "Designer de Produto",
    quote: "Eu estava cético, mas os resultados falam por si. 5 entrevistas em uma semana após otimizar meu currículo.",
    initials: "RO",
    color: "bg-chart-4",
  },
  {
    name: "Fernanda Lima",
    role: "Especialista em RH",
    quote: "Como alguém que trabalha em RH, posso confirmar que essa ferramenta entende exatamente como os sistemas ATS funcionam. Precisão impressionante.",
    initials: "FL",
    color: "bg-chart-5",
  },
  {
    name: "Lucas Santos",
    role: "Engenheiro Backend",
    quote: "Melhor investimento na minha carreira. As sugestões da IA foram naturais e profissionais — nada pareceu forçado ou cheio de palavras-chave.",
    initials: "LS",
    color: "bg-primary",
  },
]

export default function TestimonialCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 360
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-balance">
            Resultados reais de pessoas reais
          </h2>
        </div>

        <div className="relative">
          {/* Navigation buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/80 backdrop-blur"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/80 backdrop-blur"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Carousel */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 md:px-12 pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {testimonials.map((testimonial, index) => (
              <div key={index} className="snap-center shrink-0">
                <TestimonialCard {...testimonial} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
