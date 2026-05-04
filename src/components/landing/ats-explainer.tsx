"use client"

import Link from "next/link"
import {
  ArrowRightCircle,
  CheckCircle2,
  Cpu,
  FileUp,
  Network,
  XCircle,
} from "lucide-react"
import { motion } from "motion/react"

const steps = [
  {
    icon: FileUp,
    title: "1. Você envia o currículo",
    description: "Seu currículo entra em uma plataforma de vagas ou no sistema da empresa.",
  },
  {
    icon: Cpu,
    title: "2. O ATS faz a triagem",
    description:
      "O sistema procura palavras-chave, estrutura e sinais de aderência antes que alguém do RH veja seu perfil.",
  },
  {
    icon: Network,
    title: "3. Você avança ou fica pelo caminho",
    description:
      "Se o currículo não estiver claro para o ATS, ele pode ser descartado antes mesmo de chegar ao recrutador.",
    showPaths: true,
  },
]

export default function AtsExplainer() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-background">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/5 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Por que seu currículo é barrado antes do RH
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            <strong className="text-foreground">Muitos currículos nem chegam ao RH.</strong>{" "}
            Antes disso, eles passam por um sistema que decide quem segue para a próxima etapa.
          </p>
        </motion.div>

        <motion.div
          className="max-w-6xl mx-auto relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.3 }}
        >
          <div className="hidden md:block absolute top-[4.5rem] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-border to-transparent -z-10" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="relative group"
              >
                <div className="h-full flex flex-col p-8 rounded-3xl bg-card border border-border/40 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="mb-8 relative inline-flex">
                    <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300 shadow-sm">
                      <step.icon className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors duration-300 stroke-[1.5]" />
                    </div>
                  </div>

                  <h3 className="font-bold text-xl mb-3 tracking-tight group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed flex-grow">
                    {step.description}
                  </p>

                  {step.showPaths && (
                    <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-sm font-medium">
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-5 w-5" />
                          <span>Fica na triagem</span>
                        </div>
                        <span className="text-destructive font-bold">75%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-sm font-medium">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Chega ao recrutador</span>
                        </div>
                        <span className="text-green-600 dark:text-green-500 font-bold">25%</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="mt-20 max-w-4xl mx-auto flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="p-[1px] rounded-3xl bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 w-full mb-10 overflow-hidden shadow-sm">
            <div className="bg-card rounded-[23px] p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
                  Veja exatamente o que está faltando no seu currículo
                </h3>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  A plataforma mostra o que está faltando, destaca as palavras-chave mais importantes e deixa seu currículo mais claro para a triagem.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/o-que-e-ats"
            className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-1"
          >
            Entender como o ATS lê seu currículo
            <ArrowRightCircle className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
