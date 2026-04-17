"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, type Variants } from "motion/react"
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
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
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Architecture</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">Stack e produto</p>
          <div className="mt-5 grid grid-cols-5 gap-3">{["TS", "React", "Node", "SQL", "AWS"].map((item) => <div key={item} className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-4 text-center text-sm font-semibold text-slate-700">{item}</div>)}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white"><div className="space-y-2 font-mono text-xs text-sky-100/90"><div>build.resume.match(role)</div><div>score.ats.optimize()</div><div>deploy.production.ready()</div></div></div>
      </div>
    ),
    data_engineer: (
      <div className="rounded-[30px] border border-slate-200 bg-white/92 p-6">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline</p><p className="mt-2 text-xl font-semibold text-slate-950">Fluxo ETL</p></div><Database className="h-5 w-5 text-cyan-600" /></div>
        <div className="mt-6 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {["Sources", "Transform", "Serve"].map((label, index) => <div key={label} className="contents"><div className={`rounded-[24px] border p-5 ${index === 1 ? "border-slate-900 bg-slate-950 text-white" : "border-cyan-100 bg-cyan-50 text-cyan-900"}`}><p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p><div className="mt-4 space-y-2">{(index === 0 ? ["Raw events", "CRM", "ERP"] : index === 1 ? ["Spark", "Airflow", "dbt"] : ["Warehouse", "BI", "ML"]).map((item) => <div key={item} className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium">{item}</div>)}</div></div>{index < 2 ? <div className="hidden h-[2px] w-10 rounded-full bg-cyan-200 md:block" /> : null}</div>)}
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
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline</p><p className="mt-2 text-xl font-semibold text-slate-950">Funil comercial</p></div><TrendingUp className="h-5 w-5 text-rose-600" /></div>
          <div className="mt-5 space-y-3">{["Lead", "Meeting", "Proposal", "Closed Won"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">{index + 1}</div><span className="text-sm font-semibold text-slate-950">{item}</span></div>)}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Revenue board</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{["Quota", "Win rate", "ARR"].map((item, index) => <div key={item} className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{item}</p><p className="mt-2 text-2xl font-semibold">{["124%", "31%", "R$ 2.4M"][index]}</p></div>)}</div>
          <div className="mt-4 flex h-20 items-end gap-2 rounded-[22px] bg-[linear-gradient(90deg,rgba(244,63,94,0.16),rgba(251,146,60,0.10))] p-4">{[28, 46, 52, 60, 74, 82, 94].map((height, index) => <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-rose-500 to-orange-400" style={{ height: `${height}%` }} />)}</div>
        </div>
      </div>
    ),
    finance: (
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Financial board</p><p className="mt-2 text-xl font-semibold">Cash, margem e forecast</p></div><TrendingUp className="h-5 w-5 text-emerald-300" /></div><div className="mt-5 grid gap-3"><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.14em] text-white/45">EBITDA</p><p className="mt-2 text-2xl font-semibold">18.4%</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.14em] text-white/45">Cash flow</p><p className="mt-2 text-2xl font-semibold">R$ 4.2M</p></div></div></div>
        <div className="rounded-[28px] border border-slate-200 bg-white/92 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Monetary charts</p><p className="mt-2 text-xl font-semibold text-slate-950">Indicadores financeiros</p></div><LineChart className="h-5 w-5 text-emerald-600" /></div><div className="mt-5 h-24 rounded-[24px] bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(255,255,255,0.9))] p-4"><svg viewBox="0 0 320 80" className="h-full w-full"><polyline fill="none" stroke="currentColor" className="text-emerald-500" strokeWidth="4" points="8,66 52,54 96,58 140,36 184,42 228,30 272,18 312,10" /></svg></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{["Budget", "Margin", "Forecast"].map((item, index) => <div key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">{item}</p><p className="mt-2 text-xl font-semibold text-slate-950">{["96%", "+3.2pp", "+18%"][index]}</p></div>)}</div></div>
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
          <div className="container mx-auto">
            <div className="relative overflow-hidden rounded-[44px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-10 shadow-[0_40px_120px_rgba(15,23,42,0.10)] md:px-10 md:py-16">
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroGlow}`} />
              <div className="relative grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
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
                  <div className="mt-10 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Role</p><p className="mt-3 text-lg font-semibold text-slate-950">{config.role}</p></div>
                    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Keywords</p><p className="mt-3 text-lg font-semibold text-slate-950">{config.keywords.length} termos</p></div>
                    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Guidance</p><p className="mt-3 text-lg font-semibold text-slate-950">{config.improvementSteps.length} passos</p></div>
                  </div>
                </motion.div>

                <div className="space-y-5">
                  <RoleVisual config={config} />
                  <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-500" />O que o recrutador realmente procura</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {config.atsExplanation.whatRecruitersScan.slice(0, 6).map((item) => <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{item}</span>)}
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-white/70 bg-slate-950 p-6 text-white shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Mistakes</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight">{config.commonMistakes.length}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">pontos de atrito mapeados para essa pagina</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Shell className="px-4 pt-10 md:pt-14">
          <div className="container mx-auto grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><CircleAlert className="h-4 w-4 text-rose-500" />Onde o currículo quebra</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{config.problem.title}</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{config.problem.description}</p>
              <div className="mt-8 grid gap-4">{config.problem.points.map((point, index) => <div key={point} className="grid gap-3 rounded-3xl border border-rose-100 bg-rose-50/70 p-5 md:grid-cols-[auto_1fr]"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-rose-500 shadow-sm">{String(index + 1).padStart(2, "0")}</div><p className="text-sm leading-7 text-slate-600">{point}</p></div>)}</div>
            </Card>
            <DarkCard>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/55"><LineChart className={`h-4 w-4 ${theme.darkIcon}`} />Como o ATS interpreta</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">{config.atsExplanation.title}</h2>
              <p className="mt-4 text-base leading-8 text-white/72">{config.atsExplanation.description}</p>
              <div className="mt-8 grid gap-4">{config.atsExplanation.whatRecruitersScan.map((item) => <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${theme.darkIcon}`} /><p className="text-sm leading-7 text-white/78">{item}</p></div></div>)}</div>
            </DarkCard>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className={`bg-gradient-to-b ${accent.keywordPanel}`}>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Lightbulb className="h-4 w-4 text-amber-500" />{accent.keywordLabel}</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Palavras-chave importantes para {config.roleShort}</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">{config.keywords.map((keyword) => <div key={keyword.term} className={`rounded-3xl border p-5 ${accent.keywordCard}`}><p className="text-lg font-semibold text-slate-950">{keyword.term}</p><p className="mt-3 text-sm leading-7 text-slate-600">{keyword.description}</p></div>)}</div>
            </Card>
            <DarkCard>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Mistakes to avoid</p>
              <div className="mt-6 space-y-4">{config.commonMistakes.map((item) => <div key={item.mistake} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" /><div><p className="font-semibold text-white">{item.mistake}</p><p className="mt-2 text-sm leading-7 text-white/70">{item.fix}</p></div></div></div>)}</div>
            </DarkCard>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto">
            <Card>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rewrite framework</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Como reescrever as partes mais importantes</h2>
              <div className="mt-8 grid gap-6 xl:grid-cols-3">{resumeSections.map((section) => <div key={section.title} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6"><h3 className="text-xl font-semibold text-slate-950">{section.title}</h3><div className="mt-6 rounded-3xl border border-rose-100 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p><p className="mt-3 text-sm leading-7 text-slate-600">{section.bad}</p></div><div className="mt-4 rounded-3xl border border-emerald-100 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p><p className="mt-3 text-sm leading-7 text-slate-600">{section.good}</p></div></div>)}</div>
            </Card>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
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
          <div className="container mx-auto grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Paths by specialization</p>
              <div className="mt-6 space-y-4">{config.specializations.map((specialization) => <div key={specialization.title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6"><h3 className="text-xl font-semibold text-slate-950">{specialization.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{specialization.description}</p><div className="mt-4 flex flex-wrap gap-2">{specialization.keywords.map((keyword) => <span key={keyword} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{keyword}</span>)}</div></div>)}</div>
            </Card>
            <div className="space-y-6">
              <DarkCard>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">By seniority</p>
                <div className="mt-6 space-y-4">{config.seniorityLevels.map((level) => <div key={level.level} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex items-center gap-3"><BriefcaseBusiness className={`h-5 w-5 ${theme.darkIcon}`} /><h3 className="text-lg font-semibold">{level.level}</h3></div><p className="mt-3 text-sm leading-7 text-white/72">{level.focus}</p><ul className="mt-4 space-y-3">{level.tips.map((tip) => <li key={tip} className="flex items-start gap-3 text-sm leading-7 text-white/72"><CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${theme.darkIcon}`} /><span>{tip}</span></li>)}</ul></div>)}</div>
              </DarkCard>
              {config.positioningMistakes?.length ? <Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Positioning mistakes</p><div className="mt-6 space-y-3">{config.positioningMistakes.map((mistake) => <div key={mistake} className="rounded-3xl border border-amber-100 bg-amber-50/80 p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm leading-7 text-slate-600">{mistake}</p></div></div>)}</div></Card> : null}
            </div>
          </div>
        </Shell>

        {config.realExample ? <Shell className="px-4 pt-10"><div className="container mx-auto"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Concrete rewrite</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{config.realExample.title}</h2><div className="mt-8 grid gap-6 xl:grid-cols-2"><div className="rounded-[28px] border border-rose-100 bg-rose-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.before}</p></div><div className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.after}</p></div></div></Card></div></Shell> : null}

        <Shell className="px-4 pt-10">
          <div className="container mx-auto"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{accent.checklistLabel}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Como melhorar seu currículo</h2><div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{config.improvementSteps.map((step, index) => <div key={step.title} className={`rounded-[28px] border p-6 ${accent.checklistCard}`}><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Step {String(index + 1).padStart(2, "0")}</p><h3 className="mt-3 text-lg font-semibold text-slate-950">{step.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p></div>)}</div></Card></div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <DarkCard><p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">FAQ</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">Perguntas frequentes</h2><p className="mt-4 text-sm leading-7 text-white/70">Mantivemos todas as respostas da pagina em um bloco mais escaneavel para leitura longa.</p></DarkCard>
            <Card><Accordion type="single" collapsible className="w-full">{config.faqs.map((faq, index) => <AccordionItem key={faq.question} value={`faq-${index}`} className="border-b border-slate-200 last:border-b-0"><AccordionTrigger className="py-6 text-left text-base font-semibold text-slate-950">{faq.question}</AccordionTrigger><AccordionContent className="pb-6 text-sm leading-8 text-slate-600">{faq.answer}</AccordionContent></AccordionItem>)}</Accordion></Card>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Related pages</p><div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">{config.internalLinks.map((link) => <Link key={link.href} href={link.href} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]"><div className="relative aspect-[4/3] overflow-hidden"><Image src={link.image} alt={link.label} fill className="object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent" /></div><div className="p-5"><p className="text-lg font-semibold text-slate-950">{link.label}</p><p className="mt-3 text-sm leading-7 text-slate-600">{link.description}</p><div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Ver pagina<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></div></div></Link>)}</div></Card></div>
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
