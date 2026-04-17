"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, type Variants } from "motion/react"
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Lightbulb,
  LineChart,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { RoleLandingConfig } from "@/lib/seo/role-landing-config"

const reveal: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
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
  const chips = config.keywords.slice(0, 5).map((item) => item.term)

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(var(--chart-2)/0.14),transparent_34%),radial-gradient(circle_at_80%_20%,oklch(var(--primary)/0.10),transparent_24%)]" />
      <div className="relative grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role Focus</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">{config.role}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">{config.problem.description}</p>
        </div>
        <div className="rounded-[28px] border border-primary/10 bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">ATS Layer</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{config.keywords.length}</p>
          <p className="mt-2 text-sm text-white/70">termos chave para orientar a leitura automatizada</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function SeoRoleLandingPage({ config }: { config: RoleLandingConfig }) {
  const resumeSections = [config.resumeSections.summary, config.resumeSections.skills, config.resumeSections.experience]

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
            <div className="relative overflow-hidden rounded-[40px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-10 shadow-[0_40px_120px_rgba(15,23,42,0.10)] md:px-10 md:py-14">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(var(--chart-2)/0.12),transparent_36%),radial-gradient(circle_at_80%_20%,oklch(var(--primary)/0.10),transparent_26%)]" />
              <div className="relative grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
                <motion.div initial="hidden" animate="visible" variants={reveal} className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Guia ATS para {config.roleShort}
                  </div>
                  <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl md:leading-[1.02]">{config.hero.h1}</h1>
                  <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">{config.hero.subtitle}</p>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">
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
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><CircleAlert className="h-4 w-4 text-rose-500" />Onde o curriculo quebra</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{config.problem.title}</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{config.problem.description}</p>
              <div className="mt-8 grid gap-4">{config.problem.points.map((point, index) => <div key={point} className="grid gap-3 rounded-3xl border border-rose-100 bg-rose-50/70 p-5 md:grid-cols-[auto_1fr]"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-rose-500 shadow-sm">{String(index + 1).padStart(2, "0")}</div><p className="text-sm leading-7 text-slate-600">{point}</p></div>)}</div>
            </Card>
            <DarkCard>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/55"><LineChart className="h-4 w-4 text-cyan-300" />Como o ATS interpreta</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">{config.atsExplanation.title}</h2>
              <p className="mt-4 text-base leading-8 text-white/72">{config.atsExplanation.description}</p>
              <div className="mt-8 grid gap-4">{config.atsExplanation.whatRecruitersScan.map((item) => <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" /><p className="text-sm leading-7 text-white/78">{item}</p></div></div>)}</div>
            </DarkCard>
          </div>
        </Shell>

        <Shell className="px-4 pt-10">
          <div className="container mx-auto grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Lightbulb className="h-4 w-4 text-amber-500" />Keyword architecture</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Palavras-chave importantes para {config.roleShort}</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">{config.keywords.map((keyword) => <div key={keyword.term} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"><p className="text-lg font-semibold text-slate-950">{keyword.term}</p><p className="mt-3 text-sm leading-7 text-slate-600">{keyword.description}</p></div>)}</div>
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
            <DarkCard>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Before / after</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">{config.cvExample.after.title}</h2>
              <div className="mt-8 space-y-4">{config.cvExample.before.bullets.map((bullet) => <div key={bullet} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" /><p className="text-sm leading-7 text-white/72">{bullet}</p></div></div>)}</div>
              <div className="mt-8 space-y-4">{config.cvExample.after.bullets.map((bullet) => <div key={bullet} className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" /><p className="text-sm leading-7 text-white/84">{bullet}</p></div></div>)}</div>
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
                <div className="mt-6 space-y-4">{config.seniorityLevels.map((level) => <div key={level.level} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex items-center gap-3"><BriefcaseBusiness className="h-5 w-5 text-cyan-300" /><h3 className="text-lg font-semibold">{level.level}</h3></div><p className="mt-3 text-sm leading-7 text-white/72">{level.focus}</p><ul className="mt-4 space-y-3">{level.tips.map((tip) => <li key={tip} className="flex items-start gap-3 text-sm leading-7 text-white/72"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" /><span>{tip}</span></li>)}</ul></div>)}</div>
              </DarkCard>
              {config.positioningMistakes?.length ? <Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Positioning mistakes</p><div className="mt-6 space-y-3">{config.positioningMistakes.map((mistake) => <div key={mistake} className="rounded-3xl border border-amber-100 bg-amber-50/80 p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm leading-7 text-slate-600">{mistake}</p></div></div>)}</div></Card> : null}
            </div>
          </div>
        </Shell>

        {config.realExample ? <Shell className="px-4 pt-10"><div className="container mx-auto"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Concrete rewrite</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{config.realExample.title}</h2><div className="mt-8 grid gap-6 xl:grid-cols-2"><div className="rounded-[28px] border border-rose-100 bg-rose-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.before}</p></div><div className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Depois</p><p className="mt-4 text-sm leading-8 text-slate-600">{config.realExample.after}</p></div></div></Card></div></Shell> : null}

        <Shell className="px-4 pt-10">
          <div className="container mx-auto"><Card><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Execution checklist</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Como melhorar seu curriculo</h2><div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{config.improvementSteps.map((step, index) => <div key={step.title} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Step {String(index + 1).padStart(2, "0")}</p><h3 className="mt-3 text-lg font-semibold text-slate-950">{step.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p></div>)}</div></Card></div>
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
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.12),transparent_18%)]" />
              <div className="relative grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">CurrIA</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                    <BrandText text="Reestruture seu curriculo com a CurrIA" />
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/72 md:text-lg">Receba uma leitura orientada para ATS e ajuste seu curriculo para a vaga certa sem perder clareza nem honestidade.</p>
                </div>
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-black/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Instant view</p><p className="mt-3 text-lg font-semibold text-white">{config.hero.ctaText}</p></div>
                    <div className="rounded-3xl border border-white/10 bg-black/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Use case</p><p className="mt-3 text-lg font-semibold text-white">{config.roleShort}</p></div>
                  </div>
                  <Link href="/signup" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">Analisar meu curriculo<ArrowRight className="h-4 w-4" /></Link>
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
