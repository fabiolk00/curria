"use client"

import { motion } from "motion/react"
import {
  BriefcaseBusiness,
  Building2,
  DollarSign,
  FileText,
  HeartPulse,
  MapPin,
  MessageSquare,
  Target,
  Timer,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"

const metrics = [
  {
    label: "Vagas Aplicadas",
    value: "12",
    icon: BriefcaseBusiness,
    color: "text-foreground",
    bg: "bg-primary/5",
    border: "border-primary/10",
  },
  {
    label: "Em Entrevista",
    value: "3",
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/5",
    border: "border-blue-500/10",
  },
  {
    label: "Aguardando",
    value: "5",
    icon: Timer,
    color: "text-yellow-500",
    bg: "bg-yellow-500/5",
    border: "border-yellow-500/10",
  },
  {
    label: "Negativas",
    value: "4",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/10",
  },
] as const

const showcaseCards = [
  {
    statusLabel: "Em Entrevista",
    statusIcon: MessageSquare,
    statusClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    title: "Desenvolvedor Front-end Pleno",
    company: "Nubank",
    location: "Remoto",
    salary: "R$ 11.500,00",
    benefits: [
      "VA/VR Flexivel - R$ 1.200/mes",
      "Plano de Saude - SulAmerica (Sem Coparticipacao)",
    ],
    resumeVersion: "Curriculo_Nubank_Frontend.pdf",
  },
  {
    statusLabel: "Aguardando",
    statusIcon: Timer,
    statusClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    title: "Analista Financeiro Pleno",
    company: "Itau Unibanco",
    location: "Hibrido",
    salary: "R$ 5.500,00",
    benefits: [
      "PLR - 2.2 salarios/ano",
      "Vale Alimentacao - R$ 1.050/mes",
    ],
    resumeVersion: "Curriculo_Analista_Financeiro.pdf",
  },
] as const

export default function TrackerShowcase() {
  return (
    <section className="relative overflow-hidden bg-background py-24">
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 opacity-50 blur-[128px] mix-blend-screen animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-blue-500/20 opacity-50 blur-[128px] mix-blend-screen animate-pulse"
        style={{ animationDelay: "2s" }}
      />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl"
          >
            Controle total sobre as suas <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              candidaturas
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Acompanhe o status de todas as vagas que voce se candidatou em um so lugar.
            Organize salarios, beneficios e saiba exatamente qual versao de curriculo foi enviada.
          </motion.p>
        </div>

        <div className="relative mx-auto max-w-5xl perspective-[2000px]">
          <motion.div
            animate={{ y: [0, -15, 0], rotate: [0, 2, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="absolute -left-4 -top-8 z-20 hidden items-center gap-2 rounded-full border border-border/50 bg-background px-4 py-2 shadow-xl md:-left-12 md:flex"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-sm font-semibold">Nova entrevista!</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 15, 0], rotate: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-6 -right-4 z-20 hidden items-center gap-2 rounded-full border border-border/50 bg-background px-4 py-2 shadow-xl md:-right-12 md:flex"
          >
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Match da vaga: 92%</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 10 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="transform-gpu rounded-2xl border border-border/40 bg-background/60 p-4 shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {metrics.map((metric) => (
                <motion.div
                  key={metric.label}
                  whileHover={{ scale: 1.05 }}
                  className={`flex cursor-default flex-col gap-2 rounded-xl border p-5 transition-colors ${metric.border} ${metric.bg}`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                    <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    {metric.label}
                  </span>
                  <span className={`text-3xl font-bold ${metric.color}`}>{metric.value}</span>
                </motion.div>
              ))}
            </div>

            <div className="relative grid gap-6 md:grid-cols-2">
              {showcaseCards.map((card, index) => {
                const StatusIcon = card.statusIcon

                return (
                  <motion.div
                    key={card.title}
                    whileHover={{ y: -5 }}
                    className={`group relative overflow-hidden rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:shadow-xl ${
                      index === 1 ? "hidden cursor-default sm:block" : "cursor-default"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                    <div className="relative z-10 mb-5 flex items-start justify-between">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <Badge variant="outline" className={`${card.statusClass} backdrop-blur-sm`}>
                        <StatusIcon className="mr-1.5 h-3 w-3" />
                        {card.statusLabel}
                      </Badge>
                    </div>

                    <div className="relative z-10 mb-6">
                      <h4 className="mb-1 text-lg font-bold leading-tight">{card.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80">{card.company}</span>
                        <span>/</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {card.location}
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 mb-6 space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 p-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-bold">{card.salary}</span>
                        </div>
                        <span className="rounded border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                          CLT
                        </span>
                      </div>

                      <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                          <HeartPulse className="h-4 w-4 text-rose-500" />
                          Beneficios
                        </div>
                        <ul className="space-y-2 pl-4 text-sm text-muted-foreground">
                          {card.benefits.map((benefit) => (
                            <li key={benefit} className="list-disc">
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-col gap-2 pt-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Curriculo Utilizado
                      </span>
                      <div className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-sm">
                        <div className="rounded-md bg-background p-1.5 shadow-sm">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-primary/90">{card.resumeVersion}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
