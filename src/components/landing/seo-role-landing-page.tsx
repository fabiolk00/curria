"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, type Variants } from "motion/react"
import { useRef, type MouseEvent, type ReactNode } from "react"
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
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
import { cn } from "@/lib/utils"
import type { RoleLandingConfig, RoleLandingVisualVariant } from "@/lib/seo/role-landing-config"

const reveal: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
}

type Theme = {
  badge: string
  button: string
  glow: string
  spotlight: string
  accentText: string
  accentBorder: string
  accentSoft: string
  darkAccent: string
}

const themeByVariant: Record<RoleLandingVisualVariant, Theme> = {
  default: {
    badge: "border-slate-200/80 bg-white/85 text-slate-700",
    button: "bg-slate-950 text-white hover:bg-slate-800",
    glow: "from-sky-200/32 via-cyan-100/24 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_48%)]",
    accentText: "text-sky-700",
    accentBorder: "border-sky-200/75",
    accentSoft: "bg-sky-50/85",
    darkAccent: "text-sky-300",
  },
  developer: {
    badge: "border-sky-200/85 bg-sky-50/90 text-sky-700",
    button: "bg-sky-600 text-white hover:bg-sky-500",
    glow: "from-sky-200/38 via-blue-100/24 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.20),transparent_46%)]",
    accentText: "text-sky-700",
    accentBorder: "border-sky-200/75",
    accentSoft: "bg-sky-50/85",
    darkAccent: "text-sky-300",
  },
  data_analyst: {
    badge: "border-violet-200/85 bg-violet-50/90 text-violet-700",
    button: "bg-violet-600 text-white hover:bg-violet-500",
    glow: "from-violet-200/36 via-fuchsia-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_46%)]",
    accentText: "text-violet-700",
    accentBorder: "border-violet-200/75",
    accentSoft: "bg-violet-50/85",
    darkAccent: "text-violet-300",
  },
  data_engineer: {
    badge: "border-cyan-200/85 bg-cyan-50/90 text-cyan-700",
    button: "bg-cyan-600 text-white hover:bg-cyan-500",
    glow: "from-cyan-200/38 via-sky-100/24 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_48%)]",
    accentText: "text-cyan-700",
    accentBorder: "border-cyan-200/75",
    accentSoft: "bg-cyan-50/85",
    darkAccent: "text-cyan-300",
  },
  marketing: {
    badge: "border-rose-200/85 bg-rose-50/90 text-rose-700",
    button: "bg-rose-600 text-white hover:bg-rose-500",
    glow: "from-rose-200/34 via-orange-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_46%)]",
    accentText: "text-rose-700",
    accentBorder: "border-rose-200/75",
    accentSoft: "bg-rose-50/85",
    darkAccent: "text-rose-300",
  },
  customer_success: {
    badge: "border-teal-200/85 bg-teal-50/90 text-teal-700",
    button: "bg-teal-600 text-white hover:bg-teal-500",
    glow: "from-teal-200/34 via-cyan-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_46%)]",
    accentText: "text-teal-700",
    accentBorder: "border-teal-200/75",
    accentSoft: "bg-teal-50/85",
    darkAccent: "text-teal-300",
  },
  product_manager: {
    badge: "border-amber-200/85 bg-amber-50/90 text-amber-700",
    button: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    glow: "from-amber-200/34 via-yellow-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_46%)]",
    accentText: "text-amber-700",
    accentBorder: "border-amber-200/75",
    accentSoft: "bg-amber-50/85",
    darkAccent: "text-amber-300",
  },
  sales: {
    badge: "border-orange-200/85 bg-orange-50/90 text-orange-700",
    button: "bg-orange-600 text-white hover:bg-orange-500",
    glow: "from-orange-200/34 via-amber-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_46%)]",
    accentText: "text-orange-700",
    accentBorder: "border-orange-200/75",
    accentSoft: "bg-orange-50/85",
    darkAccent: "text-orange-300",
  },
  finance: {
    badge: "border-emerald-200/85 bg-emerald-50/90 text-emerald-700",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    glow: "from-emerald-200/36 via-lime-100/22 to-transparent",
    spotlight: "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_46%)]",
    accentText: "text-emerald-700",
    accentBorder: "border-emerald-200/75",
    accentSoft: "bg-emerald-50/85",
    darkAccent: "text-emerald-300",
  },
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={reveal}
      className={cn("px-4", className)}
    >
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </motion.section>
  )
}

function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[40px] border border-white/70 bg-white/90 shadow-[0_28px_90px_rgba(15,23,42,0.07)] backdrop-blur-xl", className)}>
      {children}
    </div>
  )
}

function Label({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500", className)}>
      {icon}
      <span>{children}</span>
    </div>
  )
}

function HeroVisual({ config, theme }: { config: RoleLandingConfig; theme: Theme }) {
  const variant = config.visualVariant ?? "default"

  if (variant === "developer") {
    return (
      <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className={cn("absolute inset-0", theme.spotlight)} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:34px_34px] opacity-45" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 420" fill="none" aria-hidden="true">
          <path d="M300 210 L110 110" stroke="rgba(56,189,248,0.28)" strokeWidth="1.5" />
          <path d="M300 210 L230 70" stroke="rgba(56,189,248,0.28)" strokeWidth="1.5" />
          <path d="M300 210 L470 110" stroke="rgba(56,189,248,0.28)" strokeWidth="1.5" />
          <path d="M300 210 L150 300" stroke="rgba(56,189,248,0.28)" strokeWidth="1.5" />
          <path d="M300 210 L380 304" stroke="rgba(56,189,248,0.28)" strokeWidth="1.5" />
        </svg>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="absolute left-1/2 top-1/2 z-10 w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-sky-200/90 bg-slate-950 px-6 py-5 text-white shadow-[0_30px_70px_rgba(2,6,23,0.30)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Ecossistema tÃƒÂ©cnico</p>
          <p className="mt-3 text-2xl font-semibold">{config.roleShort}</p>
          <p className="mt-3 text-sm leading-6 text-white/72">Stack, arquitetura e entrega apresentados como sistema conectado.</p>
        </motion.div>
        {[
          ["Front-end", "10%", "18%"],
          ["APIs", "34%", "8%"],
          ["Cloud", "74%", "18%"],
          ["Banco", "16%", "70%"],
          ["Observabilidade", "58%", "72%"],
        ].map(([label, left, top], index) => (
          <motion.div key={label} animate={{ y: [0, index % 2 === 0 ? -5 : 5, 0] }} transition={{ duration: 7 + index, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="absolute z-10 rounded-full border border-sky-200/80 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.08)]" style={{ left, top }}>
            {label}
          </motion.div>
        ))}
        <div className="absolute inset-x-6 bottom-6 z-10 flex flex-wrap gap-2">
          {config.keywords.slice(0, 6).map((keyword) => (
            <div key={keyword.term} className="rounded-full border border-sky-200/80 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700">
              {keyword.term}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === "data_engineer") {
    return (
      <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className={cn("absolute inset-0", theme.spotlight)} />
        <div className="absolute left-[18%] right-[18%] top-[52%] h-px bg-gradient-to-r from-cyan-200 via-cyan-400 to-sky-200" />
        <motion.div animate={{ x: ["-8%", "88%"] }} transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="absolute top-[calc(52%-6px)] h-3 w-16 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 blur-[1px]" />
        <div className="relative grid min-h-[360px] gap-6 md:grid-cols-[0.95fr_0.8fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Fonte</p>
            <div className="mt-5 space-y-3">
              {["Eventos", "Batch", "APIs", "CDC"].map((item) => (
                <div key={item} className="rounded-full border border-slate-200/80 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="rounded-[30px] border border-cyan-200/90 bg-slate-950 px-6 py-6 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">TransformaÃƒÂ§ÃƒÂ£o</p>
              <p className="mt-3 text-2xl font-semibold">ETL / ELT</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Spark", "Airflow", "Databricks", "Kafka"].map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/84">
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-white/72">Fontes, orquestraÃƒÂ§ÃƒÂ£o, modelagem e serving organizados como fluxo de infraestrutura.</p>
            </motion.div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Destino</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["Snowflake", "BigQuery", "Redshift", "Databricks"].map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white/92 px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {config.keywords.slice(0, 4).map((keyword) => (
                <span key={keyword.term} className="rounded-full border border-cyan-200/80 bg-cyan-50/90 px-3 py-1.5 text-xs font-medium text-cyan-700">
                  {keyword.term}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "finance") {
    return (
      <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className={cn("absolute inset-0", theme.spotlight)} />
        <div className="relative grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Leitura financeira</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">Forecast, margem e budget</p>
              </div>
              <LineChart className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="relative mt-6 h-[240px] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96))]">
              <svg viewBox="0 0 420 240" className="h-full w-full">
                {[70, 140, 210, 280, 350].map((x) => <line key={x} x1={x} y1="24" x2={x} y2="214" stroke="rgba(148,163,184,0.18)" />)}
                {[58, 104, 150, 196].map((y) => <line key={y} x1="24" y1={y} x2="396" y2={y} stroke="rgba(148,163,184,0.18)" />)}
                <polyline fill="none" stroke="#10b981" strokeWidth="4" points="24,178 82,164 140,170 198,132 256,138 314,112 388,92" />
                <polyline fill="none" stroke="#60a5fa" strokeWidth="3" points="24,194 82,188 140,174 198,170 256,150 314,146 388,126" />
              </svg>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="absolute right-5 top-5 w-[176px] rounded-[22px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Leitura rÃƒÂ¡pida</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between"><span>Budget</span><span>96%</span></div>
                  <div className="flex items-center justify-between"><span>Margem</span><span>+3.2pp</span></div>
                  <div className="flex items-center justify-between"><span>Forecast</span><span>+18%</span></div>
                </div>
              </motion.div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Camada executiva</p>
              <p className="mt-3 text-2xl font-semibold">{config.roleShort}</p>
              <p className="mt-3 text-sm leading-6 text-white/72">Indicadores financeiros posicionados como leitura executiva, nÃƒÂ£o como dashboard genÃƒÂ©rico.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
              {[["EBITDA", "18.4%"], ["Fluxo de caixa", "R$ 4.2M"], ["EficiÃƒÂªncia", "+12%"]].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-slate-200/80 bg-white/92 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "data_analyst") {
    return (
      <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className={cn("absolute inset-0", theme.spotlight)} />
        <div className="relative grid gap-6 md:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Dashboard analÃƒÂ­tico</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">KPIs, tendÃƒÂªncias e leitura de negÃƒÂ³cio</p>
              </div>
              <BarChart3 className="h-5 w-5 text-violet-600" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[["ConversÃƒÂ£o", "24%"], ["RetenÃƒÂ§ÃƒÂ£o", "87%"], ["Receita", "132"]].map(([label, value]) => (
                <div key={label} className="rounded-[22px] border border-violet-100 bg-violet-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 h-28 rounded-[22px] bg-[linear-gradient(180deg,rgba(139,92,246,0.08),rgba(255,255,255,0.96))] p-4">
              <svg viewBox="0 0 340 90" className="h-full w-full">
                <polyline fill="none" stroke="#8b5cf6" strokeWidth="4" points="8,68 56,60 104,64 152,38 200,44 248,30 296,18 332,12" />
                <polyline fill="none" stroke="#38bdf8" strokeWidth="3" points="8,80 56,72 104,56 152,52 200,44 248,46 296,28 332,24" />
              </svg>
            </div>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">SegmentaÃƒÂ§ÃƒÂ£o</p>
                <p className="mt-2 text-xl font-semibold">Mix analÃƒÂ­tico</p>
              </div>
              <PieChart className="h-5 w-5 text-violet-300" />
            </div>
            <div className="mt-8 flex items-center justify-center">
              <div className="relative h-36 w-36 rounded-full bg-[conic-gradient(#8b5cf6_0_42%,#38bdf8_42%_72%,#c084fc_72%_100%)]">
                <div className="absolute inset-6 rounded-full bg-slate-950" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "marketing") {
    return (
      <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className={cn("absolute inset-0", theme.spotlight)} />
        <div className="relative grid gap-6 md:grid-cols-[0.98fr_1.02fr]">
          <div className="rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Narrativa de campanha</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">NotÃƒÂ­cia, mÃƒÂ­dia e distribuiÃƒÂ§ÃƒÂ£o</p>
              </div>
              <Newspaper className="h-5 w-5 text-rose-600" />
            </div>
            <div className="mt-5 divide-y divide-slate-200/80">
              {["LanÃƒÂ§amento com foco em awareness e geraÃƒÂ§ÃƒÂ£o de demanda", "Editorial conectado a mÃƒÂ­dia paga, social e newsletter", "Mensagem ancorada em resultado e nÃƒÂ£o sÃƒÂ³ em execuÃƒÂ§ÃƒÂ£o"].map((item) => (
                <div key={item} className="py-4 text-sm leading-7 text-slate-600">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Performance</p>
                <p className="mt-2 text-xl font-semibold">DistribuiÃƒÂ§ÃƒÂ£o e resultado</p>
              </div>
              <Megaphone className="h-5 w-5 text-rose-300" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[["CTR", "3.4%"], ["ROAS", "4.8x"], ["CAC", "-22%"]].map(([label, value]) => (
                <div key={label} className="rounded-[22px] bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-24 items-end gap-2 rounded-[22px] bg-[linear-gradient(90deg,rgba(244,63,94,0.18),rgba(251,146,60,0.12))] p-4">
              {[32, 54, 42, 78, 64, 88, 74].map((height, index) => <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-rose-500 to-orange-400" style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className={cn("absolute inset-0", theme.spotlight)} />
      <div className="relative grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Posicionamento</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{config.roleShort}</p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Uma composiÃƒÂ§ÃƒÂ£o limpa que valoriza clareza, contexto e aderÃƒÂªncia ao ATS sem cair em layout genÃƒÂ©rico.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {config.keywords.slice(0, 6).map((keyword) => (
              <span key={keyword.term} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", theme.accentBorder, theme.accentSoft, theme.accentText)}>
                {keyword.term}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Leitura ATS</p>
          <div className="mt-5 divide-y divide-white/10">
            {config.atsExplanation.whatRecruitersScan.slice(0, 4).map((item) => (
              <div key={item} className="py-4 text-sm leading-7 text-white/78">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SeoRoleLandingPage({ config }: { config: RoleLandingConfig }) {
  const theme = themeByVariant[config.visualVariant ?? "default"]
  const resumeSections = [config.resumeSections.summary, config.resumeSections.skills, config.resumeSections.experience]
  const relatedScrollRef = useRef<HTMLDivElement>(null)
  const isDraggingRelatedRef = useRef(false)
  const relatedStartXRef = useRef(0)
  const relatedScrollLeftRef = useRef(0)
  const relatedMovedRef = useRef(false)

  const onRelatedMouseDown = (e: MouseEvent<HTMLDivElement>) => {
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

  const onRelatedMouseMove = (e: MouseEvent<HTMLDivElement>) => {
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
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_28%,#f8fafc_100%)] text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-24 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl" />
        <div className="absolute right-[-12rem] top-[22rem] h-[28rem] w-[28rem] rounded-full bg-cyan-200/16 blur-3xl" />
        <div className="absolute left-1/3 top-[72rem] h-96 w-96 rounded-full bg-slate-200/26 blur-3xl" />
      </div>

      <Header />

      <main className="relative z-10 pb-24 pt-24 md:pt-28">
        <Section>
          <Surface className="border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-8 md:px-10 md:py-10">
            <div className={cn("absolute inset-0 bg-gradient-to-br", theme.glow)} />
            <div className={cn("absolute inset-0", theme.spotlight)} />
            <div className="relative grid gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
              <div className="max-w-3xl pt-2">
                <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", theme.badge)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Guia ATS para {config.roleShort}
                </div>
                <h1 className="mt-7 max-w-[15ch] text-4xl font-semibold tracking-[-0.05em] text-slate-950 md:text-6xl md:leading-[0.98]">
                  {config.hero.h1}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">{config.hero.subtitle}</p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Link href="/signup" className={cn("inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5", theme.button)}>
                    {config.hero.ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="text-sm text-slate-500">{config.hero.ctaSubtext}</p>
                </div>
                <div className="mt-10 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/80 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
                  <div className="grid divide-y divide-slate-200/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FunÃƒÂ§ÃƒÂ£o</p><p className="mt-2 text-base font-semibold text-slate-950">{config.role}</p></div>
                    <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Keywords</p><p className="mt-2 text-base font-semibold text-slate-950">{config.keywords.length} termos</p></div>
                    <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Melhorias</p><p className="mt-2 text-base font-semibold text-slate-950">{config.improvementSteps.length} passos</p></div>
                  </div>
                </div>
              </div>
              <div className="xl:pl-4">
                <HeroVisual config={config} theme={theme} />
              </div>
            </div>
          </Surface>
        </Section>

        <Section className="pt-10 md:pt-14">
          <Surface>
            <div className="grid xl:grid-cols-[1.02fr_0.98fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <div className="max-w-2xl">
                  <Label icon={<CircleAlert className="h-4 w-4 text-rose-500" />}>DiagnÃƒÂ³stico do currÃƒÂ­culo</Label>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{config.problem.title}</h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">{config.problem.description}</p>
                </div>
                <div className="mt-8 divide-y divide-slate-200/80">
                  {config.problem.points.map((point, index) => (
                    <div key={point} className="grid gap-4 py-5 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">{String(index + 1).padStart(2, "0")}</div>
                      <p className="max-w-2xl text-sm leading-7 text-slate-600">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950 p-8 text-white md:p-10">
                <div className="max-w-2xl">
                  <Label icon={<LineChart className={cn("h-4 w-4", theme.darkAccent)} />} className="text-white/55">Leitura ATS</Label>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">{config.atsExplanation.title}</h2>
                  <p className="mt-4 text-base leading-8 text-white/72">{config.atsExplanation.description}</p>
                </div>
                <div className="mt-8 divide-y divide-white/10">
                  {config.atsExplanation.whatRecruitersScan.map((item, index) => (
                    <div key={item} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold", theme.darkAccent)}>{index + 1}</div>
                      <p className="text-sm leading-7 text-white/78">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </Section>

        <Section className="pt-10">
          <Surface>
            <div className="grid xl:grid-cols-[1.16fr_0.84fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <div className="max-w-2xl">
                  <Label icon={<ShieldCheck className={cn("h-4 w-4", theme.accentText)} />}>Palavras-chave e sinais da vaga</Label>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">Palavras-chave importantes para {config.roleShort}</h2>
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
              <div className="p-8 md:p-10">
                <Label icon={<CircleAlert className="h-4 w-4 text-amber-500" />}>Erros que travam a leitura</Label>
                <div className="mt-7 divide-y divide-slate-200/80">
                  {config.commonMistakes.map((item, index) => (
                    <div key={item.mistake} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <p className="font-semibold text-slate-950">{item.mistake}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </Section>

        <Section className="pt-10">
          <Surface>
            <div className="grid xl:grid-cols-[1.05fr_0.95fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <div className="max-w-2xl">
                  <Label icon={<BarChart3 className={cn("h-4 w-4", theme.accentText)} />}>Recortes da ÃƒÂ¡rea</Label>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">Adapte o currÃƒÂ­culo ao recorte certo da ÃƒÂ¡rea</h2>
                </div>
                <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {config.specializations.map((specialization) => (
                    <div key={specialization.title} className="border-t border-slate-200/80 pt-4">
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
              <div className="p-8 md:p-10">
                <Label icon={<BriefcaseBusiness className={cn("h-4 w-4", theme.accentText)} />}>Senioridade e posicionamento</Label>
                <div className="mt-7 divide-y divide-slate-200/80">
                  {config.seniorityLevels.map((level) => (
                    <div key={level.level} className="py-5">
                      <h3 className="text-lg font-semibold text-slate-950">{level.level}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{level.focus}</p>
                      <ul className="mt-4 space-y-2">
                        {level.tips.map((tip) => (
                          <li key={tip} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
                            <CheckCircle2 className={cn("mt-1 h-4 w-4 shrink-0", theme.accentText)} />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {config.positioningMistakes?.length ? (
                  <div className="mt-8 border-t border-slate-200/80 pt-8">
                    <Label icon={<CircleAlert className="h-4 w-4 text-amber-500" />}>Erros de posicionamento</Label>
                    <div className="mt-4 space-y-3">
                      {config.positioningMistakes.map((mistake) => (
                        <div key={mistake} className="border-l-2 border-amber-200 pl-4">
                          <p className="text-sm leading-7 text-slate-600">{mistake}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Surface>
        </Section>

        {config.realExample ? (
          <Section className="pt-10">
            <Surface>
              <div className="grid xl:grid-cols-[0.76fr_1.24fr]">
                <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                  <Label icon={<Sparkles className={cn("h-4 w-4", theme.accentText)} />}>Exemplo real</Label>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{config.realExample.title}</h2>
                </div>
                <div className="grid gap-8 p-8 md:p-10 md:grid-cols-2">
                  <div className="border-l-2 border-rose-200 pl-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p>
                    <p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.before}</p>
                  </div>
                  <div className="border-l-2 border-emerald-300 pl-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p>
                    <p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.after}</p>
                  </div>
                </div>
              </div>
            </Surface>
          </Section>
        ) : null}

        <Section className="pt-10">
          <Surface>
            <div className="grid xl:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-slate-200/80 p-8 md:p-10 xl:border-b-0 xl:border-r">
                <Label icon={<Sparkles className={cn("h-4 w-4", theme.accentText)} />}>Plano de melhoria</Label>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">Como melhorar seu currÃƒÂ­culo</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">Mantivemos toda a orientaÃƒÂ§ÃƒÂ£o da pÃƒÂ¡gina, mas organizamos os prÃƒÂ³ximos passos como sequÃƒÂªncia editorial e nÃƒÂ£o como pilha de cartÃƒÂµes repetidos.</p>
              </div>
              <div className="p-8 md:p-10">
                <div className="divide-y divide-slate-200/80">
                  {config.improvementSteps.map((step, index) => (
                    <div key={step.title} className="grid gap-4 py-5 md:grid-cols-[auto_1fr]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </Section>

        <Section className="pt-10">
          <Surface>
            <div className="grid xl:grid-cols-[0.72fr_1.28fr]">
              <div className="bg-slate-950 p-8 text-white md:p-10">
                <Label icon={<ShieldCheck className={cn("h-4 w-4", theme.darkAccent)} />} className="text-white/55">FAQ</Label>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">Perguntas frequentes</h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-white/70">Todas as respostas continuam aqui, mas em uma leitura mais limpa, mais calma e mais consistente com o restante da experiÃƒÂªncia.</p>
              </div>
              <div className="p-8 md:p-10">
                <Accordion type="single" collapsible className="w-full">
                  {config.faqs.map((faq, index) => (
                    <AccordionItem key={faq.question} value={`faq-${index}`} className="border-b border-slate-200 last:border-b-0">
                      <AccordionTrigger className="py-6 text-left text-base font-semibold text-slate-950">{faq.question}</AccordionTrigger>
                      <AccordionContent className="pb-6 text-sm leading-8 text-slate-600">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </Surface>
        </Section>

        <Section className="pt-10">
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.06)] md:p-10">
            <div className="mb-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">PÃƒÂ¡ginas relacionadas</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Explore outros guias de currÃƒÂ­culo ATS</h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 md:justify-self-end md:text-base">Esse ÃƒÂ© o carrossel das SEO pages. Aqui a navegaÃƒÂ§ÃƒÂ£o fica mais editorial, maior e com mais presenÃƒÂ§a visual.</p>
            </div>
            <div className="relative -mx-8 md:-mx-10">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent md:w-16" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent md:w-16" />
              <div ref={relatedScrollRef} onMouseDown={onRelatedMouseDown} onMouseLeave={onRelatedMouseLeave} onMouseUp={onRelatedMouseUp} onMouseMove={onRelatedMouseMove} className="cursor-grab overflow-x-auto px-8 pb-2 select-none touch-pan-y active:cursor-grabbing md:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max gap-5 pr-8 md:gap-6 md:pr-10">
                  {config.internalLinks.map((link, index) => (
                    <Link key={link.href} href={link.href} onClick={(e) => { if (relatedMovedRef.current) e.preventDefault() }} className={[ "group relative shrink-0 overflow-hidden rounded-[30px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]", index === 0 ? "w-[332px] md:w-[400px]" : "w-[300px] md:w-[340px]"].join(" ")}>
                      <div className="relative min-h-[430px] md:min-h-[520px]">
                        <Image src={link.image} alt={link.label} fill className="object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                          <p className="text-2xl font-semibold text-white md:text-[2rem] md:leading-[1.02]">{link.label}</p>
                          <p className="mt-3 max-w-[28ch] text-base leading-7 text-white/80">{link.description}</p>
                          <div className="mt-5 inline-flex items-center gap-2 text-base font-medium text-white">Ver pÃƒÂ¡gina<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="pt-10">
          <div className="relative overflow-hidden rounded-[40px] border border-slate-200 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] md:px-12 md:py-14">
            <div className={cn("absolute inset-0 bg-gradient-to-br", theme.glow)} />
            <div className="relative grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">CurrIA</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl"><BrandText text="Reestruture seu currÃƒÂ­culo com a CurrIA" /></h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/72 md:text-lg">Receba uma leitura orientada para ATS e ajuste seu currÃƒÂ­culo para a vaga certa sem perder clareza nem honestidade.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-md"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">AÃƒÂ§ÃƒÂ£o imediata</p><p className="mt-3 text-lg font-semibold text-white">{config.hero.ctaText}</p></div>
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-md"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">FunÃƒÂ§ÃƒÂ£o</p><p className="mt-3 text-lg font-semibold text-white">{config.roleShort}</p></div>
              </div>
            </div>
            <Link href="/signup" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
              Analisar meu currÃƒÂ­culo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
