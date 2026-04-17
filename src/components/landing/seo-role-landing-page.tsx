"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, type Variants } from "motion/react"
import { useRef } from "react"
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  Database,
  Lightbulb,
  LineChart,
  Megaphone,
  Newspaper,
  PieChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { RoleLandingConfig, RoleLandingVisualVariant } from "@/lib/seo/role-landing-config"

const reveal: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
}

const themeByVariant: Record<RoleLandingVisualVariant, {
  badge: string
  button: string
  heroGlow: string
  chip: string
  darkIcon: string
}> = {
  default: {
    badge: "border-primary/10 bg-white/80 text-primary",
    button: "bg-slate-950 text-white hover:bg-slate-800",
    heroGlow: "from-sky-200/40 via-cyan-100/30 to-transparent",
    chip: "text-primary",
    darkIcon: "text-cyan-300",
  },
  developer: {
    badge: "border-sky-200/80 bg-sky-50 text-sky-700",
    button: "bg-sky-600 text-white hover:bg-sky-500",
    heroGlow: "from-sky-200/50 via-blue-100/35 to-transparent",
    chip: "text-sky-700",
    darkIcon: "text-sky-300",
  },
  data_analyst: {
    badge: "border-violet-200/80 bg-violet-50 text-violet-700",
    button: "bg-violet-600 text-white hover:bg-violet-500",
    heroGlow: "from-violet-200/55 via-fuchsia-100/35 to-transparent",
    chip: "text-violet-700",
    darkIcon: "text-violet-300",
  },
  data_engineer: {
    badge: "border-cyan-200/80 bg-cyan-50 text-cyan-700",
    button: "bg-cyan-600 text-white hover:bg-cyan-500",
    heroGlow: "from-cyan-200/55 via-sky-100/35 to-transparent",
    chip: "text-cyan-700",
    darkIcon: "text-cyan-300",
  },
  marketing: {
    badge: "border-pink-200/80 bg-pink-50 text-pink-700",
    button: "bg-pink-600 text-white hover:bg-pink-500",
    heroGlow: "from-pink-200/55 via-orange-100/35 to-transparent",
    chip: "text-pink-700",
    darkIcon: "text-pink-300",
  },
  customer_success: {
    badge: "border-teal-200/80 bg-teal-50 text-teal-700",
    button: "bg-teal-600 text-white hover:bg-teal-500",
    heroGlow: "from-teal-200/55 via-cyan-100/35 to-transparent",
    chip: "text-teal-700",
    darkIcon: "text-teal-300",
  },
  product_manager: {
    badge: "border-amber-200/80 bg-amber-50 text-amber-700",
    button: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    heroGlow: "from-amber-200/55 via-yellow-100/35 to-transparent",
    chip: "text-amber-700",
    darkIcon: "text-amber-300",
  },
  sales: {
    badge: "border-rose-200/80 bg-rose-50 text-rose-700",
    button: "bg-rose-600 text-white hover:bg-rose-500",
    heroGlow: "from-rose-200/55 via-orange-100/35 to-transparent",
    chip: "text-rose-700",
    darkIcon: "text-rose-300",
  },
  finance: {
    badge: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    heroGlow: "from-emerald-200/55 via-lime-100/35 to-transparent",
    chip: "text-emerald-700",
    darkIcon: "text-emerald-300",
  },
}

const sectionAccentByVariant: Record<RoleLandingVisualVariant, {
  keywordLabel: string
  keywordPanel: string
  keywordCard: string
  beforeAfterLabel: string
  beforeAfterPanel: string
  checklistLabel: string
  checklistCard: string
}> = {
  default: {
    keywordLabel: "Skill signals",
    keywordPanel: "from-sky-50 to-white",
    keywordCard: "border-sky-100 bg-sky-50/60",
    beforeAfterLabel: "Rewrite delta",
    beforeAfterPanel: "from-sky-500/10 to-transparent",
    checklistLabel: "Execution plan",
    checklistCard: "border-sky-100 bg-sky-50/60",
  },
  developer: {
    keywordLabel: "Stack signals",
    keywordPanel: "from-sky-50 to-white",
    keywordCard: "border-sky-100 bg-sky-50/60",
    beforeAfterLabel: "Code to impact",
    beforeAfterPanel: "from-sky-500/10 to-transparent",
    checklistLabel: "Implementation plan",
    checklistCard: "border-sky-100 bg-sky-50/60",
  },
  data_analyst: {
    keywordLabel: "Analytics signals",
    keywordPanel: "from-violet-50 to-white",
    keywordCard: "border-violet-100 bg-violet-50/60",
    beforeAfterLabel: "Insight delta",
    beforeAfterPanel: "from-violet-500/10 to-transparent",
    checklistLabel: "Optimization plan",
    checklistCard: "border-violet-100 bg-violet-50/60",
  },
  data_engineer: {
    keywordLabel: "Pipeline signals",
    keywordPanel: "from-cyan-50 to-white",
    keywordCard: "border-cyan-100 bg-cyan-50/60",
    beforeAfterLabel: "Architecture delta",
    beforeAfterPanel: "from-cyan-500/10 to-transparent",
    checklistLabel: "Platform plan",
    checklistCard: "border-cyan-100 bg-cyan-50/60",
  },
  marketing: {
    keywordLabel: "Growth signals",
    keywordPanel: "from-pink-50 to-white",
    keywordCard: "border-pink-100 bg-pink-50/60",
    beforeAfterLabel: "Campaign delta",
    beforeAfterPanel: "from-pink-500/10 to-transparent",
    checklistLabel: "Go-to-market plan",
    checklistCard: "border-pink-100 bg-pink-50/60",
  },
  customer_success: {
    keywordLabel: "Lifecycle signals",
    keywordPanel: "from-teal-50 to-white",
    keywordCard: "border-teal-100 bg-teal-50/60",
    beforeAfterLabel: "Retention delta",
    beforeAfterPanel: "from-teal-500/10 to-transparent",
    checklistLabel: "Expansion plan",
    checklistCard: "border-teal-100 bg-teal-50/60",
  },
  product_manager: {
    keywordLabel: "Product signals",
    keywordPanel: "from-amber-50 to-white",
    keywordCard: "border-amber-100 bg-amber-50/60",
    beforeAfterLabel: "Roadmap delta",
    beforeAfterPanel: "from-amber-500/10 to-transparent",
    checklistLabel: "Delivery plan",
    checklistCard: "border-amber-100 bg-amber-50/60",
  },
  sales: {
    keywordLabel: "Revenue signals",
    keywordPanel: "from-rose-50 to-white",
    keywordCard: "border-rose-100 bg-rose-50/60",
    beforeAfterLabel: "Pipeline delta",
    beforeAfterPanel: "from-rose-500/10 to-transparent",
    checklistLabel: "Conversion plan",
    checklistCard: "border-rose-100 bg-rose-50/60",
  },
  finance: {
    keywordLabel: "Financial signals",
    keywordPanel: "from-emerald-50 to-white",
    keywordCard: "border-emerald-100 bg-emerald-50/60",
    beforeAfterLabel: "Margin delta",
    beforeAfterPanel: "from-emerald-500/10 to-transparent",
    checklistLabel: "Control plan",
    checklistCard: "border-emerald-100 bg-emerald-50/60",
  },
}

function Shell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={reveal}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[32px] border border-white/60 bg-white/85 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-10 ${className}`}>{children}</div>
}

function DarkCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[32px] border border-white/10 bg-slate-950 p-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] md:p-10 ${className}`}>{children}</div>
}

function RoleVisual({ config }: { config: RoleLandingConfig }) {
  const variant = config.visualVariant ?? "default"
  const theme = themeByVariant[variant]
  const chips = config.keywords.slice(0, 5).map((item) => item.term)

  const visuals: Record<RoleLandingVisualVariant, React.ReactNode> = {
    default: (
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Architecture</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">Stack e produto</p>
          <div className="mt-5 grid grid-cols-5 gap-3">{["TS", "React", "Node", "SQL", "AWS"].map((item) => <div key={item} className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-4 text-center text-sm font-semibold text-slate-700">{item}</div>)}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white"><div className="space-y-2 font-mono text-xs text-sky-100/90"><div>build.resume.match(role)</div><div>score.ats.optimize()</div><div>deploy.production.ready()</div></div></div>
      </div>
    ),
    developer: (
      <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          {[
            {
              step: "01",
              title: "Selecione seu stack principal",
              body: "Mostre linguagens, frameworks e infraestrutura com a mesma clareza que a vaga pede.",
            },
            {
              step: "02",
              title: "Conecte entrega e arquitetura",
              body: "Relacione APIs, banco, cloud e impacto do produto para sair do currículo genérico.",
            },
            {
              step: "03",
              title: "Finalize com contexto real",
              body: "Seu resumo precisa soar como sistema em produção, não como lista de tecnologias.",
            },
          ].map((item) => (
            <div key={item.step} className="grid gap-3 border-l border-sky-200 pl-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">{item.step}</div>
              <div>
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Stack board</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Escolha o bloco técnico dominante</p>
            </div>
            <Code2 className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["React", "Next.js"],
              ["Node", "APIs"],
              ["SQL", "AWS"],
            ].map((items) => (
              <div key={items[0]} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item} className="rounded-xl border border-sky-100 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700">{item}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="space-y-2 font-mono text-xs text-sky-100/90">
              <div>build.resume.match(role)</div>
              <div>signal.stack.highlight()</div>
              <div>impact.delivery.prove()</div>
            </div>
          </div>
        </div>
      </div>
    ),
    data_engineer: (
      <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          {[
            {
              step: "01",
              title: "Defina a origem dos dados",
              body: "Mostre domínio de evento, batch, integrações e governança já no topo do currículo.",
            },
            {
              step: "02",
              title: "Conecte pipeline e transformação",
              body: "Explique stack, orquestração e modelagem como parte do fluxo, não como buzzword solta.",
            },
            {
              step: "03",
              title: "Entregue consumo real",
              body: "Warehouse, BI e analytics precisam aparecer como destino de negócio e não só infraestrutura.",
            },
          ].map((item) => (
            <div key={item.step} className="grid gap-3 border-l border-cyan-200 pl-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">{item.step}</div>
              <div>
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white/92 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline workspace</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Selecione seu destino de dados</p>
            </div>
            <Database className="h-5 w-5 text-cyan-600" />
          </div>
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Snowflake",
                "Redshift",
                "Databricks",
                "Amazon S3",
                "BigQuery",
                "Azure",
              ].map((item, index) => (
                <div
                  key={item}
                  className={`rounded-2xl border px-4 py-5 text-center text-sm font-semibold transition ${
                    index === 1
                      ? "border-cyan-300 bg-cyan-50 text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500">Cancelar</button>
              <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Continuar</button>
            </div>
          </div>
        </div>
      </div>
    ),
    data_analyst: (
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Interactive charts</p><p className="mt-2 text-xl font-semibold text-slate-950">Dashboard de KPIs</p></div><BarChart3 className="h-5 w-5 text-violet-600" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{["Conversion", "Retention", "Revenue"].map((item, index) => <div key={item} className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-500">{item}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{[24, 87, 132][index]}</p><div className="mt-3 h-1.5 rounded-full bg-violet-100"><div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${55 + index * 15}%` }} /></div></div>)}</div>
          <div className="mt-4 h-24 rounded-[24px] bg-[linear-gradient(180deg,rgba(139,92,246,0.08),rgba(255,255,255,0.92))] p-4"><svg viewBox="0 0 320 80" className="h-full w-full"><polyline fill="none" stroke="currentColor" className="text-violet-500" strokeWidth="4" points="6,62 50,56 94,60 138,42 182,46 226,32 270,24 314,14" /><polyline fill="none" stroke="currentColor" className="text-sky-400" strokeWidth="3" points="6,74 50,66 94,54 138,50 182,40 226,42 270,28 314,24" /></svg></div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Analytics mix</p><p className="mt-2 text-xl font-semibold">Visão por segmento</p></div><PieChart className="h-5 w-5 text-violet-300" /></div><div className="mt-5 flex items-center justify-center"><div className="relative h-32 w-32 rounded-full bg-[conic-gradient(#8b5cf6_0_42%,#38bdf8_42%_72%,#c084fc_72%_100%)]"><div className="absolute inset-5 rounded-full bg-slate-950" /></div></div></div>
      </div>
    ),
    marketing: (
      <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campaign feed</p><p className="mt-2 text-xl font-semibold text-slate-950">News, ads e conteúdo</p></div><Newspaper className="h-5 w-5 text-pink-600" /></div><div className="mt-5 space-y-3"><div className="rounded-2xl border border-pink-100 bg-pink-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-pink-500">Launch</p><p className="mt-2 text-sm font-semibold text-slate-950">Campanha de performance com foco em ROAS</p></div><div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-500">Editorial</p><p className="mt-2 text-sm font-semibold text-slate-950">Conteúdo, newsletter e social sincronizados</p></div></div></div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Paid media</p><p className="mt-2 text-xl font-semibold">Distribuição e resultado</p></div><Megaphone className="h-5 w-5 text-pink-300" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{["CTR", "ROAS", "CAC"].map((item, index) => <div key={item} className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{item}</p><p className="mt-2 text-2xl font-semibold">{["3.4%", "4.8x", "-22%"][index]}</p></div>)}</div><div className="mt-4 flex h-20 items-end gap-2 rounded-[22px] bg-[linear-gradient(90deg,rgba(236,72,153,0.18),rgba(249,115,22,0.10))] p-4">{[32, 54, 42, 78, 64, 88, 74].map((height, index) => <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-pink-500 to-orange-400" style={{ height: `${height}%` }} />)}</div></div>
      </div>
    ),
    customer_success: (
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Health score</p><p className="mt-2 text-xl font-semibold text-slate-950">Onboarding e retenção</p></div><ShieldCheck className="h-5 w-5 text-teal-600" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{["Onboarding", "Adoption", "Renewal"].map((item, index) => <div key={item} className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">{item}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{["91%", "84%", "97%"][index]}</p></div>)}</div>
          <div className="mt-4 h-3 rounded-full bg-teal-100"><div className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" style={{ width: "82%" }} /></div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Lifecycle</p>
          <div className="mt-5 space-y-3">{["Kickoff", "Value realization", "Expansion"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400/15 text-sm font-semibold text-teal-300">{index + 1}</div><span className="text-sm font-medium text-white/85">{item}</span></div>)}</div>
        </div>
      </div>
    ),
    product_manager: (
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Roadmap</p><p className="mt-2 text-xl font-semibold text-slate-950">Prioridades de produto</p></div><BriefcaseBusiness className="h-5 w-5 text-amber-600" /></div>
          <div className="mt-5 space-y-3">{["Discovery", "Delivery", "Growth"].map((item, index) => <div key={item} className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-950">{item}</p><span className="text-xs uppercase tracking-[0.14em] text-amber-700">{["P1", "P2", "P3"][index]}</span></div></div>)}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Signals</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{["Activation", "NPS", "Retention", "North Star"].map((item, index) => <div key={item} className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{item}</p><p className="mt-2 text-xl font-semibold">{["64%", "51", "88%", "+22%"][index]}</p></div>)}</div>
        </div>
      </div>
    ),
    sales: (
      <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Funil comercial</p>
            </div>
            <TrendingUp className="h-5 w-5 text-rose-600" />
          </div>
          <div className="mt-5 space-y-3">
            {["Lead", "Meeting", "Proposal", "Closed Won"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">{index + 1}</div>
                <span className="text-sm font-semibold text-slate-950">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Revenue board</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Conversão e receita previsível</p>
            </div>
            <TrendingUp className="h-5 w-5 text-rose-600" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Quota", "Win rate", "ARR"].map((item, index) => (
              <div key={item} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">{item}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{["124%", "31%", "R$ 2.4M"][index]}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>Receita por etapa</span>
              <span>9 de junho</span>
            </div>
            <div className="relative h-36 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,rgba(244,63,94,0.06),rgba(255,255,255,0.96))]">
              <svg viewBox="0 0 360 140" className="h-full w-full">
                {[60, 120, 180, 240, 300].map((x) => <line key={x} x1={x} y1="16" x2={x} y2="126" stroke="rgba(148,163,184,0.18)" />)}
                {[34, 68, 102].map((y) => <line key={y} x1="20" y1={y} x2="340" y2={y} stroke="rgba(148,163,184,0.18)" />)}
                <polyline fill="none" stroke="#f43f5e" strokeWidth="3.5" points="20,104 70,98 120,82 170,86 220,72 270,58 320,42" />
                <polyline fill="none" stroke="#fb923c" strokeWidth="2.5" points="20,114 70,108 120,102 170,94 220,90 270,80 320,74" />
              </svg>
              <div className="absolute right-4 top-4 w-[160px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Highlights</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between"><span>Meetings</span><span>82%</span></div>
                  <div className="flex items-center justify-between"><span>Propostas</span><span>+10%</span></div>
                  <div className="flex items-center justify-between"><span>Won</span><span>31%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    finance: (
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Financial board</p>
              <p className="mt-2 text-xl font-semibold">Cash, margem e forecast</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">EBITDA</p>
              <p className="mt-2 text-2xl font-semibold">18.4%</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Cash flow</p>
              <p className="mt-2 text-2xl font-semibold">R$ 4.2M</p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Monetary charts</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Indicadores financeiros</p>
            </div>
            <LineChart className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>Desempenho financeiro</span>
              <span>2 a 9 de junho</span>
            </div>
            <div className="relative h-36 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96))]">
              <svg viewBox="0 0 360 140" className="h-full w-full">
                {[60, 120, 180, 240, 300].map((x) => <line key={x} x1={x} y1="16" x2={x} y2="126" stroke="rgba(148,163,184,0.18)" />)}
                {[34, 68, 102].map((y) => <line key={y} x1="20" y1={y} x2="340" y2={y} stroke="rgba(148,163,184,0.18)" />)}
                <polyline fill="none" stroke="#10b981" strokeWidth="3.5" points="20,104 70,90 120,94 170,70 220,76 270,60 320,48" />
                <polyline fill="none" stroke="#60a5fa" strokeWidth="2.5" points="20,114 70,108 120,98 170,96 220,82 270,84 320,72" />
              </svg>
              <div className="absolute right-4 top-4 w-[170px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Leitura rápida</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between"><span>Budget</span><span>96%</span></div>
                  <div className="flex items-center justify-between"><span>Margem</span><span>+3.2pp</span></div>
                  <div className="flex items-center justify-between"><span>Forecast</span><span>+18%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  }

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/60 bg-white/88 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.10)]">
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroGlow}`} />
      <div className="relative">
        {visuals[variant]}
        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-white/70 bg-white/75 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role Focus</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-950">{config.role}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{config.problem.description}</p>
          </div>
          <div className="rounded-[24px] border border-slate-900 bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">ATS Layer</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{config.keywords.length}</p>
            <p className="mt-2 text-sm text-white/70">termos chave para orientar a leitura automatizada</p>
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip} className={`rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium ${theme.chip}`}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function SeoRoleLandingPage({ config }: { config: RoleLandingConfig }) {
  const resumeSections = [config.resumeSections.summary, config.resumeSections.skills, config.resumeSections.experience]
  const variant = config.visualVariant ?? "default"
  const theme = themeByVariant[variant]
  const accent = sectionAccentByVariant[variant]
  const relatedScrollRef = useRef<HTMLDivElement>(null)
  const isDraggingRelatedRef = useRef(false)
  const relatedStartXRef = useRef(0)
  const relatedScrollLeftRef = useRef(0)
  const relatedMovedRef = useRef(false)

  const onRelatedMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!relatedScrollRef.current) return
    isDraggingRelatedRef.current = true
    relatedMovedRef.current = false
    relatedStartXRef.current = e.pageX - relatedScrollRef.current.offsetLeft
    relatedScrollLeftRef.current = relatedScrollRef.current.scrollLeft
  }

  const onRelatedMouseLeave = () => {
    isDraggingRelatedRef.current = false
  }

  const onRelatedMouseUp = () => {
    isDraggingRelatedRef.current = false
  }

  const onRelatedMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRelatedRef.current || !relatedScrollRef.current) return
    e.preventDefault()

    const x = e.pageX - relatedScrollRef.current.offsetLeft
    const walk = (x - relatedStartXRef.current) * 1.15

    if (Math.abs(walk) > 4) {
      relatedMovedRef.current = true
    }

    relatedScrollRef.current.scrollLeft = relatedScrollLeftRef.current - walk
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-[28rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/3 top-[72rem] h-80 w-80 rounded-full bg-chart-1/10 blur-3xl" />
      </div>

      <Header />

      <main className="relative z-10 pb-24 pt-24 md:pt-28">
        <section className="px-4">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="relative overflow-hidden rounded-[44px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-8 shadow-[0_40px_120px_rgba(15,23,42,0.10)] md:px-10 md:py-12">
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroGlow}`} />
              <div className="relative grid gap-8 xl:grid-cols-[0.98fr_1.02fr] xl:items-start">
                <motion.div initial="hidden" animate="visible" variants={reveal} className="max-w-3xl">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm ${theme.badge}`}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Guia ATS para {config.roleShort}
                  </div>
                  <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl md:leading-[1.02]">{config.hero.h1}</h1>
                  <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">{config.hero.subtitle}</p>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link href="/signup" className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 ${theme.button}`}>
                      {config.hero.ctaText}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="text-sm text-slate-500">{config.hero.ctaSubtext}</p>
                  </div>
                  <div className="mt-8 overflow-hidden rounded-[28px] border border-white/80 bg-white/75 shadow-sm backdrop-blur-md">
                    <div className="grid divide-y divide-slate-200/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Role</p><p className="mt-2 text-base font-semibold text-slate-950">{config.role}</p></div>
                      <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Keywords</p><p className="mt-2 text-base font-semibold text-slate-950">{config.keywords.length} termos</p></div>
                      <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Guidance</p><p className="mt-2 text-base font-semibold text-slate-950">{config.improvementSteps.length} passos</p></div>
                    </div>
                  </div>
                </motion.div>

                <div className="space-y-4">
                  <RoleVisual config={config} />
                  <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-500" />O que o recrutador realmente procura</div>
                      <div className="mt-4 divide-y divide-slate-200/80">
                        {config.atsExplanation.whatRecruitersScan.slice(0, 4).map((item) => <div key={item} className="py-3 text-sm leading-6 text-slate-600">{item}</div>)}
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-white/70 bg-slate-950 p-6 text-white shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Mistakes</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight">{config.commonMistakes.length}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">pontos de atrito mapeados para essa página</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Shell className="px-4 pt-10 md:pt-14">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="grid xl:grid-cols-[1.02fr_0.98fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <CircleAlert className="h-4 w-4 text-rose-500" />
                    Onde o curr�culo quebra
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{config.problem.title}</h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">{config.problem.description}</p>
                </div>
                <div className="mt-8 divide-y divide-slate-200/80">
                  {config.problem.points.map((point, index) => (
                    <div key={point} className="grid gap-4 py-5 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <p className="max-w-2xl text-sm leading-7 text-slate-600">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-8 text-white md:p-10">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
                    <LineChart className={`h-4 w-4 ${theme.darkIcon}`} />
                    Como o ATS interpreta
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight">{config.atsExplanation.title}</h2>
                  <p className="mt-4 text-base leading-8 text-white/72">{config.atsExplanation.description}</p>
                </div>
                <div className="mt-8 divide-y divide-white/10">
                  {config.atsExplanation.whatRecruitersScan.map((item, index) => (
                    <div key={item} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold ${theme.darkIcon}`}>
                        {index + 1}
                      </div>
                      <p className="text-sm leading-7 text-white/78">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="grid xl:grid-cols-[1.12fr_0.88fr]">
              <div className={`border-b border-slate-200/80 bg-gradient-to-b p-8 md:p-10 xl:border-b-0 xl:border-r ${accent.keywordPanel}`}>
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    {accent.keywordLabel}
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Palavras-chave importantes para {config.roleShort}</h2>
                </div>
                <div className="mt-8 divide-y divide-slate-200/80">
                  {config.keywords.map((keyword) => (
                    <div key={keyword.term} className="grid gap-3 py-4 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:gap-6">
                      <p className="text-base font-semibold text-slate-950">{keyword.term}</p>
                      <p className="text-sm leading-7 text-slate-600">{keyword.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950 p-8 text-white md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Mistakes to avoid</p>
                <div className="mt-6 divide-y divide-white/10">
                  {config.commonMistakes.map((item, index) => (
                    <div key={item.mistake} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 text-sm font-semibold text-rose-200">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{item.mistake}</p>
                        <p className="mt-2 text-sm leading-7 text-white/72">{item.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="border-b border-slate-200/80 p-8 md:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rewrite framework</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Como reescrever as partes mais importantes</h2>
            </div>
            <div className="grid xl:grid-cols-3">
              {resumeSections.map((section, index) => (
                <div key={section.title} className={`p-8 md:p-10 ${index !== resumeSections.length - 1 ? "border-b border-slate-200/80 xl:border-b-0 xl:border-r" : ""}`}>
                  <h3 className="text-xl font-semibold text-slate-950">{section.title}</h3>
                  <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                    <div className="border-b border-slate-200/80 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{section.bad}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{section.good}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="mx-auto grid w-full max-w-[1440px] gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <DarkCard className={`bg-gradient-to-br ${accent.beforeAfterPanel}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">{accent.beforeAfterLabel}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">{config.cvExample.after.title}</h2>
              <div className="mt-8 space-y-4">{config.cvExample.before.bullets.map((bullet) => <div key={bullet} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" /><p className="text-sm leading-7 text-white/72">{bullet}</p></div></div>)}</div>
              <div className="mt-8 space-y-4">{config.cvExample.after.bullets.map((bullet) => <div key={bullet} className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5"><div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${theme.darkIcon}`} /><p className="text-sm leading-7 text-white/84">{bullet}</p></div></div>)}</div>
            </DarkCard>
            <Card>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Full resume model</p>
              <div className="mt-4 border-b border-slate-200 pb-6"><h2 className="text-3xl font-semibold tracking-tight text-slate-950">{config.fullResumeExample.name}</h2><p className="mt-2 text-lg font-medium text-slate-700">{config.fullResumeExample.title}</p><p className="mt-3 text-sm leading-7 text-slate-500">{config.fullResumeExample.contact}</p></div>
              <div className="grid gap-8 pt-6">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resumo</p><p className="mt-3 text-sm leading-7 text-slate-600">{config.fullResumeExample.summary}</p></div>
                <div className="grid gap-4 md:grid-cols-2">{config.fullResumeExample.skills.map((skill) => <div key={skill.category} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"><p className="text-sm font-semibold text-slate-950">{skill.category}</p><p className="mt-2 text-sm leading-7 text-slate-600">{skill.items}</p></div>)}</div>
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Experiencia</p><div className="mt-4 space-y-4">{config.fullResumeExample.experience.map((job) => <div key={`${job.role}-${job.company}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-1 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-950">{job.role}</p><p className="text-sm text-slate-500">{job.company}</p></div><p className="text-sm text-slate-400">{job.period}</p></div><ul className="mt-4 space-y-3">{job.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-3 text-sm leading-7 text-slate-600"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" /><span>{bullet}</span></li>)}</ul></div>)}</div></div>
                <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"><p className="text-sm font-semibold text-slate-950">Educacao</p><p className="mt-3 text-sm leading-7 text-slate-600">{config.fullResumeExample.education.degree}</p><p className="text-sm leading-7 text-slate-600">{config.fullResumeExample.education.institution}</p><p className="text-sm leading-7 text-slate-500">{config.fullResumeExample.education.year}</p></div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"><p className="text-sm font-semibold text-slate-950">Certificacoes</p><ul className="mt-3 space-y-2">{config.fullResumeExample.certifications.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" /><span>{item}</span></li>)}</ul></div>
                </div>
              </div>
            </Card>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="grid xl:grid-cols-[1.18fr_0.82fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Paths by specialization</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Adapte o currículo ao recorte certo da área</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Em vez de empilhar cartões altos com muito vazio, agrupamos as frentes de atuação em uma grade mais compacta e mais distribuída na largura da página.
                  </p>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {config.specializations.map((specialization) => (
                    <div key={specialization.title} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                      <h3 className="text-lg font-semibold text-slate-950">{specialization.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{specialization.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {specialization.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-8 text-white md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">By seniority</p>
                <div className="mt-6 divide-y divide-white/10">
                  {config.seniorityLevels.map((level) => (
                    <div key={level.level} className="py-5">
                      <div className="flex items-center gap-3">
                        <BriefcaseBusiness className={`h-5 w-5 ${theme.darkIcon}`} />
                        <h3 className="text-lg font-semibold text-white">{level.level}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/72">{level.focus}</p>
                      <ul className="mt-4 space-y-2">
                        {level.tips.map((tip) => (
                          <li key={tip} className="flex items-start gap-3 text-sm leading-7 text-white/72">
                            <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${theme.darkIcon}`} />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {config.positioningMistakes?.length ? (
                  <div className="mt-8 border-t border-white/10 pt-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Positioning mistakes</p>
                    <div className="mt-4 space-y-3">
                      {config.positioningMistakes.map((mistake) => (
                        <div key={mistake} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                            <p className="text-sm leading-7 text-white/76">{mistake}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Shell>

        {config.realExample ? <Shell className="px-4 pt-10"><div className="mx-auto w-full max-w-[1440px]"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Concrete rewrite</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{config.realExample.title}</h2><div className="mt-8 grid gap-6 xl:grid-cols-2"><div className="rounded-[28px] border border-rose-100 bg-rose-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.before}</p></div><div className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.after}</p></div></div></Card></div></Shell> : null}

        <Shell className="px-4 pt-10">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="grid xl:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{accent.checklistLabel}</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Como melhorar seu curr�culo</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
                  Em vez de v�rios cards iguais, organizamos os pr�ximos passos como uma sequ�ncia editorial mais enxuta e mais f�cil de escanear.
                </p>
              </div>
              <div className="p-8 md:p-10">
                <div className="divide-y divide-slate-200/80">
                  {config.improvementSteps.map((step, index) => (
                    <div key={step.title} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[40px] border border-white/70 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="grid xl:grid-cols-[0.72fr_1.28fr]">
              <div className="bg-slate-950 p-8 text-white md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">FAQ</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-white/70">
                  Mantivemos todas as respostas da p�gina, mas em uma estrutura mais limpa e mais consistente com o restante da experi�ncia.
                </p>
              </div>
              <div className="p-8 md:p-10">
                <Accordion type="single" collapsible className="w-full">{config.faqs.map((faq, index) => <AccordionItem key={faq.question} value={`faq-${index}`} className="border-b border-slate-200 last:border-b-0"><AccordionTrigger className="py-6 text-left text-base font-semibold text-slate-950">{faq.question}</AccordionTrigger><AccordionContent className="pb-6 text-sm leading-8 text-slate-600">{faq.answer}</AccordionContent></AccordionItem>)}</Accordion>
              </div>
            </div>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto">
            <Card className="overflow-hidden">
              <div className="mb-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-end">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Related pages</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Explore outros guias de currículo ATS</h2>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 md:justify-self-end md:text-base">
                  Esse é o carrossel das SEO pages. Aqui a navegação fica mais editorial, maior e com mais presença visual.
                </p>
              </div>

              <div className="relative -mx-8 md:-mx-10">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent md:w-16" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent md:w-16" />

                <div
                  ref={relatedScrollRef}
                  onMouseDown={onRelatedMouseDown}
                  onMouseLeave={onRelatedMouseLeave}
                  onMouseUp={onRelatedMouseUp}
                  onMouseMove={onRelatedMouseMove}
                  className="cursor-grab overflow-x-auto px-8 pb-2 select-none touch-pan-y active:cursor-grabbing md:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div className="flex w-max gap-5 pr-8 md:gap-6 md:pr-10">
                    {config.internalLinks.map((link, index) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={(e) => {
                          if (relatedMovedRef.current) {
                            e.preventDefault()
                          }
                        }}
                        className={[
                          "group relative shrink-0 overflow-hidden rounded-[30px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]",
                          index === 0 ? "w-[332px] md:w-[400px]" : "w-[300px] md:w-[340px]",
                        ].join(" ")}
                      >
                        <div className="relative min-h-[430px] md:min-h-[520px]">
                          <Image src={link.image} alt={link.label} fill className="object-cover transition duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

                          <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                            <p className="text-2xl font-semibold text-white md:text-[2rem] md:leading-[1.02]">{link.label}</p>
                            <p className="mt-3 max-w-[28ch] text-base leading-7 text-white/80">{link.description}</p>
                            <div className="mt-5 inline-flex items-center gap-2 text-base font-medium text-white">
                              Ver página
                              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto">
            <div className="relative overflow-hidden rounded-[40px] border border-slate-200 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] md:px-12 md:py-14">
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroGlow}`} />
              <div className="relative grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">CurrIA</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                    <BrandText text="Reestruture seu currículo com a CurrIA" />
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/72 md:text-lg">Receba uma leitura orientada para ATS e ajuste seu currículo para a vaga certa sem perder clareza nem honestidade.</p>
                </div>
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-black/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Instant view</p><p className="mt-3 text-lg font-semibold text-white">{config.hero.ctaText}</p></div>
                    <div className="rounded-3xl border border-white/10 bg-black/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Use case</p><p className="mt-3 text-lg font-semibold text-white">{config.roleShort}</p></div>
                  </div>
                  <Link href="/signup" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">Analisar meu currículo<ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </div>
          </div>
        </Shell>
      </main>

      <Footer />
    </div>
  )
}

