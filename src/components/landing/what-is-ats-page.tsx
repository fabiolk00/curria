"use client"

import Link from "next/link"
import { motion, type Variants } from "motion/react"
import {
  Upload,
  BarChart3,
  CheckCircle2,
  Zap,
  Target,
  Sparkles,
  EyeOff,
  Check,
  ChevronRight,
  FileSearch,
  FileText,
  X,
} from "lucide-react"

import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
}

const timelineSteps = [
  {
    icon: Target,
    title: "A Configuracao",
    desc: "A empresa cria a vaga e define as palavras-chave, habilidades e criterios obrigatorios que o robo deve buscar.",
  },
  {
    icon: Upload,
    title: "O Envio",
    desc: "Voce se candidata e faz o upload do seu curriculo em formato PDF ou DOCX no portal da empresa.",
  },
  {
    icon: FileSearch,
    title: "O Parsing",
    desc: "O sistema escaneia o documento, extraindo o texto puro e tentando categorizar suas experiencias, formacao e competencias.",
  },
  {
    icon: BarChart3,
    title: "O Match",
    desc: "Um algoritmo cruza as informacoes extraidas com os requisitos da vaga, gerando um score de compatibilidade.",
  },
  {
    icon: EyeOff,
    title: "O Filtro",
    desc: "Curriculos com scores baixos sao arquivados de forma automatizada e recebem aquele e-mail padrao de rejeicao.",
  },
  {
    icon: CheckCircle2,
    title: "O Ranking",
    desc: "Apenas o topo da lista, os 25% mais compativeis, e liberado para a leitura atenta do recrutador humano.",
  },
]

export default function WhatIsAtsPageClient() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <Header />

      <main className="relative flex-1 pb-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-full max-w-5xl -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

        <div className="container relative z-10 mx-auto max-w-5xl px-4 pt-16">
          <motion.div
            className="mx-auto mb-20 max-w-3xl text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Desvendando o{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                ATS
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Entenda como funcionam os sistemas automatizados que filtram curriculos antes de chegarem ao recrutador, e aprenda as estrategias exatas para hackea-los.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-32"
          >
            <motion.section variants={itemVariants} className="space-y-12">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">O que e um ATS?</h2>
                <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                  <strong className="text-foreground">ATS (Applicant Tracking System)</strong> e um software usado por mais de 95% das grandes empresas para ler, filtrar e classificar curriculos automaticamente antes que eles cheguem as maos de um recrutador humano.
                </p>
              </div>

              <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[3rem] border border-border/50 bg-card p-8 shadow-sm md:p-16">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-destructive/5 via-transparent to-primary/5" />

                <div className="relative z-10 flex flex-col items-center gap-12 lg:flex-row">
                  <div className="text-center lg:w-1/2 lg:text-left">
                    <h3 className="mb-4 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-8xl font-black tracking-tighter text-transparent md:text-9xl">
                      75
                      <span className="text-5xl md:text-7xl">%</span>
                    </h3>
                    <h4 className="mb-4 text-2xl font-bold">A dura realidade do mercado</h4>
                    <p className="text-lg leading-relaxed text-muted-foreground">
                      De cada quatro curriculos enviados, tres sao{" "}
                      <strong className="text-foreground">descartados automaticamente</strong> por robos. Eles nunca chegam a ser lidos por uma pessoa, independentemente da sua qualificacao ou talento.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:w-1/2">
                    {[1, 2, 3, 4].map((item, idx) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: idx * 0.15 + 0.3 }}
                        className={`relative flex h-32 w-24 items-center justify-center rounded-2xl border-2 transition-transform hover:-translate-y-2 md:h-44 md:w-32 ${
                          idx < 3
                            ? "border-muted-foreground/20 bg-muted/30 text-muted-foreground/30"
                            : "border-green-500/30 bg-green-500/10 text-green-500 shadow-2xl shadow-green-500/20"
                        }`}
                      >
                        <FileText className={`h-10 w-10 md:h-12 md:w-12 ${idx < 3 ? "opacity-40" : ""}`} />

                        {idx < 3 ? (
                          <div className="absolute right-3 top-3 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur-sm">
                            <X className="h-4 w-4 stroke-[3] text-destructive md:h-5 md:w-5" />
                          </div>
                        ) : (
                          <div className="absolute right-3 top-3 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur-sm">
                            <CheckCircle2 className="h-4 w-4 stroke-[3] text-green-500 md:h-5 md:w-5" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={itemVariants}>
              <div className="mb-20 text-center">
                <h2 className="mb-4 flex items-center justify-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
                  <Zap className="h-8 w-8 text-primary" />
                  Como o ATS funciona na pratica
                </h2>
                <p className="text-lg text-muted-foreground">
                  O passo a passo invisivel entre o clique em &quot;Enviar&quot; e a mesa do recrutador.
                </p>
              </div>

              <div className="relative mx-auto max-w-4xl">
                <div className="absolute bottom-4 left-[39px] top-4 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/50 via-border to-transparent md:left-1/2" />

                {timelineSteps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    className={`relative mb-12 flex w-full flex-col items-center md:mb-16 md:flex-row md:justify-between ${
                      i % 2 === 0 ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    <div className="absolute left-[39px] top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[4px] border-background bg-card shadow-md md:left-1/2">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>

                    <div className="hidden w-[calc(50%-3rem)] md:block" />

                    <div className="w-full pl-[92px] pr-4 md:w-[calc(50%-3rem)] md:px-0">
                      <div className="group relative overflow-hidden rounded-3xl border border-border/40 bg-card p-8 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-xl md:p-10">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                        <div className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
                          Etapa 0{i + 1}
                        </div>
                        <h3 className="mb-4 text-2xl font-bold transition-colors group-hover:text-primary">
                          {step.title}
                        </h3>
                        <p className="text-lg leading-relaxed text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.section variants={itemVariants}>
              <div className="flex flex-col items-center gap-12 rounded-[3rem] border border-border/50 bg-muted/30 p-8 md:p-16 lg:flex-row">
                <div className="lg:w-1/3">
                  <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">
                    O que o robo <span className="text-primary">procura</span> no seu curriculo?
                  </h2>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    Entenda as regras do jogo para nao ser desclassificado por erros bobos de formatacao e texto.
                  </p>
                </div>
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-2/3">
                  {[
                    {
                      title: "Palavras-chave exatas",
                      desc: "O sistema busca frases identicas a descricao da vaga. Se pedem React, escrever ReactJS pode nao pontuar.",
                    },
                    {
                      title: "Formatacao limpa",
                      desc: "Layouts com colunas multiplas, graficos e tabelas confundem a extracao de texto do robo.",
                    },
                    {
                      title: "Formatos corretos",
                      desc: "Sempre use PDF legivel por texto. PDFs gerados como imagem sao ignorados porque o texto fica invisivel.",
                    },
                    {
                      title: "Titulos padrao",
                      desc: "Use Experiencia Profissional em vez de nomes criativos como Minha Jornada ou Onde Atuei.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="group flex items-start gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                    >
                      <Check className="mt-0.5 h-6 w-6 shrink-0 text-green-500 transition-transform group-hover:scale-110" />
                      <div>
                        <h4 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section variants={itemVariants}>
              <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary/30 via-primary/5 to-transparent p-[1px] shadow-lg">
                <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

                <div className="relative z-10 rounded-[3rem] bg-card/95 p-8 backdrop-blur-sm md:p-16">
                  <div className="mx-auto mb-16 max-w-2xl text-center">
                    <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary shadow-inner">
                      <Sparkles className="h-8 w-8" />
                    </div>
                    <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">
                      Como a CurrIA te ajuda a vencer
                    </h2>
                    <p className="text-lg text-muted-foreground md:text-xl">
                      Nossa IA faz a engenharia reversa do ATS para otimizar seu curriculo especificamente para a vaga que voce quer conquistar.
                    </p>
                  </div>

                  <div className="grid gap-8 sm:grid-cols-2">
                    {[
                      {
                        title: "Analise da Vaga",
                        desc: "Extraimos os requisitos ocultos da descricao.",
                      },
                      {
                        title: "Score em Tempo Real",
                        desc: "Calculamos sua nota de compatibilidade exata.",
                      },
                      {
                        title: "Otimizacao Guiada",
                        desc: "Sugerimos onde encaixar as palavras que faltam.",
                      },
                      {
                        title: "PDF a Prova de Falhas",
                        desc: "Geramos o arquivo com o codigo-fonte perfeito para robos.",
                      },
                    ].map((feature, i) => (
                      <div
                        key={feature.title}
                        className="group relative flex min-h-[240px] flex-col justify-center overflow-hidden rounded-[2rem] border border-border/40 bg-background/50 p-10 transition-colors hover:bg-muted/50 md:p-12"
                      >
                        <div className="pointer-events-none absolute right-4 top-4 text-8xl font-black text-primary/5 transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-110 group-hover:text-primary/10">
                          0{i + 1}
                        </div>
                        <h3 className="relative z-10 mb-4 w-[85%] text-2xl font-semibold md:text-3xl">
                          {feature.title}
                        </h3>
                        <p className="relative z-10 w-[90%] text-lg leading-relaxed text-muted-foreground md:leading-loose">
                          {feature.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={itemVariants} className="pt-8 text-center">
              <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">
                Pronto para passar no filtro?
              </h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
                Pare de enviar curriculos para o buraco negro. Deixe nossa IA otimizar seu perfil e comece a ser chamado para as entrevistas.
              </p>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-lg font-semibold text-primary-foreground shadow-xl transition-all hover:-translate-y-1 hover:bg-primary/90 hover:shadow-primary/25"
              >
                Crie seu curriculo
                <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.section>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
