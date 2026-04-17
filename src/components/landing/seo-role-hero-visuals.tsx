"use client"

import { motion } from "motion/react"
import {
  BarChart3,
  Code2,
  Megaphone,
  Newspaper,
  PieChart,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"

import type { RoleLandingConfig, RoleLandingVisualVariant } from "@/lib/seo/role-landing-config"
import { cn } from "@/lib/utils"

export type SeoHeroTheme = {
  badge: string
  button: string
  glow: string
  spotlight: string
  accentText: string
  accentBorder: string
  accentSoft: string
  darkAccent: string
}

type HeroVisualProps = {
  config: RoleLandingConfig
  theme: SeoHeroTheme
}

function HeroShell({ children, theme }: { children: React.ReactNode; theme: SeoHeroTheme }) {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className={cn("absolute inset-0", theme.spotlight)} />
      {children}
    </div>
  )
}

function DeveloperHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:34px_34px] opacity-45" />
      <div className="relative grid min-h-[360px] gap-5 md:grid-cols-[0.92fr_1.08fr]">
        <div className="flex flex-col justify-between gap-4">
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
            <div key={item.step} className="rounded-[22px] border border-slate-200/80 bg-white/92 px-5 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">{item.step}</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col rounded-[28px] border border-slate-200/80 bg-white/94 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Code system</p>
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
                    <div key={item} className="rounded-xl border border-sky-100 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {["Front-end", "Cloud"].map((item) => (
              <div key={item} className="rounded-full border border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {item}
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
          <div className="mt-4 rounded-[22px] bg-[linear-gradient(180deg,rgba(56,189,248,0.10),rgba(255,255,255,0.96))] p-4">
            <svg viewBox="0 0 360 92" className="h-[88px] w-full">
              <polyline fill="none" stroke="#0ea5e9" strokeWidth="4" points="8,70 56,66 104,48 152,52 200,34 248,38 296,24 344,18" />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points="8,80 56,74 104,70 152,62 200,54 248,46 296,40 344,30" />
            </svg>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function DataEngineerHero({ config, theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="absolute left-[12%] right-[12%] top-[49%] h-px bg-gradient-to-r from-cyan-100 via-cyan-300 to-sky-100 opacity-80" />
      <motion.div
        animate={{ x: ["-12%", "94%"] }}
        transition={{ duration: 5.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="absolute top-[calc(49%-5px)] h-2.5 w-14 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_20px_rgba(34,211,238,0.45)]"
      />
      <div className="relative grid min-h-[360px] gap-6 xl:grid-cols-[0.88fr_1.08fr_0.92fr]">
        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Source systems</p>
            <div className="mt-5 space-y-3">
              {["Eventos", "Batch", "APIs", "CDC"].map((item) => (
                <div key={item} className="rounded-full border border-slate-200/80 bg-white/94 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-cyan-100 bg-[linear-gradient(180deg,rgba(236,254,255,0.98),rgba(255,255,255,0.92))] p-4 shadow-[0_12px_28px_rgba(34,211,238,0.10)]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">Infra stack</div>
            <div className="grid gap-2">
              {[
                ["DB", "Databricks", "bg-rose-50 text-rose-700 border-rose-200"],
                ["KF", "Kafka", "bg-emerald-50 text-emerald-700 border-emerald-200"],
                ["SF", "Snowflake", "bg-sky-50 text-sky-700 border-sky-200"],
                ["RD", "Redis", "bg-red-50 text-red-700 border-red-200"],
                ["SP", "Apache Spark", "bg-amber-50 text-amber-700 border-amber-200"],
              ].map(([short, label, tone]) => (
                <div key={label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${tone}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10px]">{short}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="rounded-[32px] border border-cyan-200/90 bg-slate-950 px-6 py-6 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Transform layer</p>
                <p className="mt-3 text-[2rem] font-semibold leading-none">ETL / ELT</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Streaming + batch</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Spark", "Airflow", "Databricks", "Kafka"].map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/84">
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/72">Fontes, orquestração, modelagem e serving organizados como fluxo de infraestrutura.</p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[24px] border border-cyan-100 bg-white/94 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span>Processamento</span>
                <span>Última janela</span>
              </div>
              <div className="flex h-28 items-end gap-2 rounded-[18px] bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(255,255,255,0.92))] px-3 pb-3 pt-8">
                {[22, 38, 52, 68, 64, 82, 78].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-cyan-500 to-sky-400" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-cyan-100 bg-white/94 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Signals</div>
              <div className="space-y-3">
                {[["Latency", "-18%"], ["Freshness", "+24%"], ["Jobs OK", "99.2%"]].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-full border border-cyan-100 bg-cyan-50/50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="font-semibold text-cyan-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Warehouse targets</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["Snowflake", "BigQuery", "Redshift", "Databricks"].map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white/94 px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-cyan-100 bg-white/94 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Keywords em destaque</div>
            <div className="flex flex-wrap gap-2">
              {config.keywords.slice(0, 4).map((keyword) => (
                <span key={keyword.term} className="rounded-full border border-cyan-200/80 bg-cyan-50/90 px-3 py-1.5 text-xs font-medium text-cyan-700">
                  {keyword.term}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function SalesHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.96fr_1.04fr]">
        <div className="flex flex-col justify-between rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline comercial</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">CAC, growth e conversão do funil</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Mostre geração de receita, taxa de fechamento e ritmo comercial como leitura estratégica.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Meta batida", "Receita gerada", "Conversão", "CRM", "Pipeline/Funil", "Growth"].map((item) => (
              <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ["SF", "Salesforce"],
              ["SAP", "SAP CRM"],
              ["MS", "Dynamics"],
            ].map(([short, label]) => (
              <div key={label} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-emerald-700">{short}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Revenue board</p>
              <p className="mt-2 text-xl font-semibold">Meta, CAC e ticket médio</p>
            </div>
            <TrendingUp className="h-5 w-5 text-orange-300" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[["CAC", "R$ 540"], ["Win rate", "31%"], ["ARR", "R$ 2.4M"]].map(([label, value]) => (
              <div key={label} className="rounded-[22px] bg-white/6 px-4 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-[22px] bg-[linear-gradient(90deg,rgba(249,115,22,0.18),rgba(251,191,36,0.12))] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              <span>Crescimento do pipeline</span>
              <span>Trimestre</span>
            </div>
            <svg viewBox="0 0 360 120" className="h-28 w-full">
              <polyline fill="none" stroke="#f97316" strokeWidth="4" points="18,92 70,82 122,74 174,56 226,50 278,34 334,24" />
              <polyline fill="none" stroke="#fbbf24" strokeWidth="3" points="18,100 70,94 122,86 174,74 226,68 278,58 334,48" />
            </svg>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function CustomerSuccessHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.96fr_1.04fr]">
        <div className="flex flex-col justify-between rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lifecycle</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">Churn, retenção e expansão</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Posicione customer success como camada de retenção, saúde da carteira e crescimento da base.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Onboarding", "Retenção", "Churn", "NPS/CSAT", "Expansion Revenue", "Customer Lifecycle"].map((item) => (
              <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ["SF", "Salesforce"],
              ["SAP", "SAP CRM"],
              ["MS", "Dynamics"],
            ].map(([short, label]) => (
              <div key={label} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-emerald-700">{short}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Retention board</p>
              <p className="mt-2 text-xl font-semibold">Retenção, churn e renewals</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-teal-300" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[["Gross retention", "93%"], ["Net retention", "108%"], ["Churn", "2.8%"]].map(([label, value]) => (
              <div key={label} className="rounded-[22px] bg-white/6 px-4 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-[22px] bg-[linear-gradient(90deg,rgba(20,184,166,0.18),rgba(34,211,238,0.12))] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              <span>Saúde da carteira</span>
              <span>Mensal</span>
            </div>
            <svg viewBox="0 0 360 120" className="h-28 w-full">
              <polyline fill="none" stroke="#14b8a6" strokeWidth="4" points="18,88 70,84 122,72 174,68 226,58 278,46 334,38" />
              <polyline fill="none" stroke="#22d3ee" strokeWidth="3" points="18,98 70,94 122,88 174,80 226,74 278,62 334,56" />
            </svg>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function DataAnalystHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[1.12fr_0.88fr]">
        <div className="flex h-full flex-col rounded-[30px] border border-slate-200/80 bg-white/94 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Dashboard analítico</p>
              <p className="mt-2 max-w-[14ch] text-[1.95rem] font-semibold leading-[1.05] text-slate-950">KPIs, tendências e leitura de negócio</p>
            </div>
            <BarChart3 className="mt-1 h-5 w-5 text-violet-600" />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[["Conversão", "24%"], ["Retenção", "87%"], ["Receita", "132"]].map(([label, value]) => (
              <div key={label} className="rounded-[20px] border border-violet-100 bg-violet-50/80 px-4 py-4 shadow-[0_8px_18px_rgba(139,92,246,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">{label}</p>
                <p className="mt-2 text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-[linear-gradient(180deg,rgba(139,92,246,0.10),rgba(255,255,255,0.98))] p-5">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>Evolução de performance</span>
              <span>Últimos 90 dias</span>
            </div>
            <svg viewBox="0 0 360 126" className="h-[124px] w-full">
              <polyline fill="none" stroke="#8b5cf6" strokeWidth="4" points="10,92 60,84 110,88 160,56 210,60 260,46 310,28 350,22" />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="3" points="10,102 60,94 110,74 160,70 210,62 260,64 310,46 350,40" />
            </svg>
          </div>

          <div className="mt-4 rounded-[24px] border border-violet-100 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>Volume por frente</span>
              <span>Base mensal</span>
            </div>
            <div className="flex h-36 items-end gap-3 rounded-[18px] bg-[linear-gradient(180deg,rgba(139,92,246,0.05),rgba(255,255,255,0.92))] px-3 pb-3 pt-8">
              {[36, 48, 42, 66, 58, 78, 72].map((height, index) => (
                <div key={index} className="flex-1 rounded-t-[14px] bg-gradient-to-t from-violet-500 to-fuchsia-400" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Segmentação</p>
              <p className="mt-2 text-[1.9rem] font-semibold leading-[1.05]">Mix analítico</p>
            </div>
            <PieChart className="h-5 w-5 text-violet-300" />
          </div>

          <div className="mt-6 grid gap-3">
            {[["BI", "42%"], ["Produto", "30%"], ["Growth", "28%"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm">
                <span className="text-white/72">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className="relative h-40 w-40 rounded-full bg-[conic-gradient(#8b5cf6_0_42%,#38bdf8_42%_72%,#c084fc_72%_100%)]">
              <div className="absolute inset-6 rounded-full bg-slate-950" />
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            {[["Dashboards", "20+"], ["Automações", "12"], ["Insights", "R$ 200k"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[18px] border border-violet-400/15 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/68">{label}</span>
                <span className="text-sm font-semibold text-violet-200">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function MarketingHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.98fr_1.02fr]">
        <div className="rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Narrativa de campanha</p>
              <p className="mt-2 max-w-[12ch] text-xl font-semibold leading-[1.15] text-slate-950">Notícia, mídia e distribuição</p>
            </div>
            <Newspaper className="h-5 w-5 text-rose-600" />
          </div>
          <div className="mt-5 divide-y divide-slate-200/80">
            {[
              "Lançamento com foco em awareness e geração de demanda",
              "Editorial conectado a mídia paga, social e newsletter",
              "Mensagem ancorada em resultado e não só em execução",
            ].map((item) => (
              <div key={item} className="py-4 text-sm leading-7 text-slate-600">{item}</div>
            ))}
          </div>
        </div>
        <div className="flex min-h-[348px] flex-col rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Performance</p>
              <p className="mt-2 max-w-[12ch] text-[1.9rem] font-semibold leading-[1.05] text-white">Distribuição e resultado</p>
            </div>
            <Megaphone className="mt-1 h-5 w-5 text-rose-300" />
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2.5">
            {[["CTR", "3.4%"], ["ROAS", "4.8x"], ["CAC", "-22%"]].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-[20px] bg-white/6 px-3 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
                <p className="mt-2 text-[1.8rem] font-semibold leading-none tracking-[-0.03em]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-8">
            <div className="rounded-[22px] bg-[linear-gradient(90deg,rgba(244,63,94,0.18),rgba(251,146,60,0.12))] p-4">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                <span>Volume por canal</span>
                <span>Semanal</span>
              </div>
              <div className="flex h-36 items-end gap-2 rounded-[18px] bg-black/10 px-3 pb-3 pt-10">
                {[32, 54, 42, 78, 64, 88, 74].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-rose-500 to-orange-400" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function FinanceHero({ theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.96fr_1.04fr]">
        <div className="flex flex-col justify-between rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Financial board</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">Margem, forecast e leitura financeira</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Mostre orçamento, DRE, fluxo de caixa e eficiência como sinais claros de impacto financeiro.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["EBITDA", "Budget", "Forecast", "Fluxo de Caixa", "Margem", "KPI Financeiro"].map((item) => (
              <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Monetary charts</p>
              <p className="mt-2 text-xl font-semibold">Cash, margem e tendência</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[["EBITDA", "18.4%"], ["Cash flow", "R$ 4.2M"], ["Forecast", "+18%"]].map(([label, value]) => (
              <div key={label} className="rounded-[22px] bg-white/6 px-4 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-[22px] bg-[linear-gradient(90deg,rgba(16,185,129,0.18),rgba(132,204,22,0.12))] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              <span>Indicadores financeiros</span>
              <span>Mensal</span>
            </div>
            <svg viewBox="0 0 360 120" className="h-28 w-full">
              <polyline fill="none" stroke="#10b981" strokeWidth="4" points="18,94 70,84 122,88 174,62 226,68 278,54 334,42" />
              <polyline fill="none" stroke="#84cc16" strokeWidth="3" points="18,104 70,98 122,92 174,82 226,76 278,68 334,62" />
            </svg>
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function ProductManagerHero({ config, theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.92fr_1.08fr]">
        <div className="flex flex-col justify-between rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Roadmap</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">Prioridades, discovery e métrica</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Posicione produto como clareza de problema, decisão e resultado, não só como lista de cerimônias.</p>
          </div>
          <div className="mt-6 space-y-4">
            {[
              ["Q1", "Discovery e validação"],
              ["Q2", "Entrega e adoção"],
              ["Q3", "Retenção e expansão"],
            ].map(([phase, label]) => (
              <div key={phase} className="flex items-center justify-between rounded-full border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800">
                <span>{phase}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[30px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Product signals</p>
          <p className="mt-2 text-xl font-semibold">Impacto, entrega e alinhamento</p>
          <div className="mt-6 space-y-4">
            {config.atsExplanation.whatRecruitersScan.slice(0, 4).map((item, index) => (
              <div key={item} className="grid grid-cols-[auto_1fr] gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-amber-300">{index + 1}</div>
                <p className="text-sm leading-7 text-white/78">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HeroShell>
  )
}

function DefaultHero({ config, theme }: HeroVisualProps) {
  return (
    <HeroShell theme={theme}>
      <div className="relative grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Posicionamento</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{config.roleShort}</p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Uma composição limpa que valoriza clareza, contexto e aderência ao ATS sem cair em layout genérico.</p>
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
    </HeroShell>
  )
}

const heroByVariant: Record<RoleLandingVisualVariant, (props: HeroVisualProps) => JSX.Element> = {
  default: DefaultHero,
  developer: DeveloperHero,
  data_analyst: DataAnalystHero,
  data_engineer: DataEngineerHero,
  marketing: MarketingHero,
  customer_success: CustomerSuccessHero,
  product_manager: ProductManagerHero,
  sales: SalesHero,
  finance: FinanceHero,
}

export function SeoRoleHeroVisual({ config, theme }: HeroVisualProps) {
  const variant = config.visualVariant ?? "default"
  const Component = heroByVariant[variant] ?? DefaultHero

  return <Component config={config} theme={theme} />
}
