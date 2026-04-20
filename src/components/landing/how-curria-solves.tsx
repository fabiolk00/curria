"use client"

import { motion } from "motion/react"
import { FileSearch, Sparkles, Target } from "lucide-react"

import BrandWordmark from "@/components/brand-wordmark"

const steps = [
  {
    icon: FileSearch,
    title: "Lê a vaga e identifica sinais do ATS",
    description:
      "A plataforma cruza requisitos, palavras-chave e intenção da vaga para entender o que realmente precisa aparecer no currículo.",
  },
  {
    icon: Sparkles,
    title: "Reescreve seu currículo com contexto real",
    description:
      "Seu histórico é reorganizado com linguagem mais forte, termos relevantes e estrutura mais fácil de ser lida por recrutadores e robôs.",
  },
  {
    icon: Target,
    title: "Entrega uma versão pronta para aplicar",
    description:
      "Você sai com um currículo mais claro, mais alinhado à vaga e muito mais preparado para passar no filtro inicial.",
  },
]

export default function HowCurriaSolves() {
  return (
    <section className="bg-muted/20 py-24">
      <div className="container mx-auto px-4">
        <motion.div
          className="mx-auto mb-14 max-w-3xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
            Como você resolve
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            O <BrandWordmark /> transforma um currículo genérico em uma versão pronta para o ATS
          </h2>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Em vez de adivinhar o que falta, você entende o problema e aplica uma versão mais forte do seu currículo com direção prática.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="rounded-3xl border border-border/50 bg-background p-8 shadow-sm"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="mb-3 text-sm font-semibold text-primary/80">0{index + 1}</div>
              <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
