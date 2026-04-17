"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { motion, type Variants } from "motion/react"
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Lightbulb,
  Plus,
} from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { RoleLandingConfig } from "@/lib/seo/role-landing-config"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
}

interface SeoRoleLandingPageProps {
  config: RoleLandingConfig
}

// ─── Mistakes Accordion ──────────────────────────────────────────────────────
function MistakesAccordion({ config }: { config: RoleLandingConfig }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <motion.section
      className="py-24 md:py-32"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      <div className="container mx-auto max-w-5xl px-6">
        <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Diagnóstico
        </motion.div>
        <motion.h2 variants={itemVariants} className="mb-10 text-3xl font-bold tracking-tight md:text-4xl">
          Erros mais comuns no currículo de {config.roleShort}
        </motion.h2>

        {/* 2-col grid on desktop */}
        <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-2">
          {config.commonMistakes.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-green-500/35 bg-card shadow-md shadow-green-500/8"
                    : "group border-border/50 bg-card shadow-sm hover:-translate-y-0.5 hover:border-destructive/30 hover:shadow-md"
                }`}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                {/* Always-visible row */}
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <span
                      className={`mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-200 ${
                        isOpen ? "text-green-600" : "text-destructive"
                      }`}
                    >
                      {isOpen ? "Correção" : "Erro"}
                    </span>
                    <p className={`text-sm leading-snug transition-colors duration-200 ${isOpen ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {isOpen ? item.fix : item.mistake}
                    </p>
                  </div>
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      isOpen
                        ? "rotate-45 border-green-500/40 bg-green-500/10 text-green-600"
                        : "border-border bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Revealed: original mistake shown crossed out */}
                {isOpen && (
                  <div className="border-t border-green-500/15 bg-destructive/[0.025] px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/50">Antes</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/60 line-through decoration-destructive/25">
                      {item.mistake}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>

        <motion.p variants={itemVariants} className="mt-5 text-center text-xs text-muted-foreground/50">
          Clique em cada item para ver a correção
        </motion.p>
      </div>
    </motion.section>
  )
}

export default function SeoRoleLandingPage({ config }: SeoRoleLandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">

        {/* ─── HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(var(--primary)/0.07),transparent)]" />
          <div className="container relative z-10 mx-auto max-w-4xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <h1 className="mb-7 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                {config.hero.h1.split("ATS").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">ATS</span>
                    )}
                  </span>
                ))}
              </h1>
              <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {config.hero.subtitle}
              </p>
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-9 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
                >
                  {config.hero.ctaText}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <span className="text-sm text-muted-foreground">{config.hero.ctaSubtext}</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── PROBLEM — editorial left-anchor layout ───────────────────────── */}
        <motion.section
          className="border-y border-border/40 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-6xl px-6">
            <div className="grid gap-16 lg:grid-cols-[1fr_2fr]">
              {/* Left anchor */}
              <motion.div variants={itemVariants} className="lg:sticky lg:top-24 lg:self-start">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-destructive">
                  O problema
                </p>
                <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                  {config.problem.title}
                </h2>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                  {config.problem.description}
                </p>
              </motion.div>

              {/* Staggered issue cards */}
              <div className="space-y-4">
                {config.problem.points.map((point, i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    className="group flex items-start gap-4 rounded-2xl border border-border/50 bg-card px-6 py-5 transition-colors duration-200 hover:border-destructive/30 hover:bg-destructive/[0.03]"
                    style={{ marginLeft: i % 2 === 1 ? "1.5rem" : "0" }}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold text-destructive">
                      {i + 1}
                    </span>
                    <p className="text-[15px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                      {point}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ─── REAL EXAMPLE (conditional) ──────────────────────────────────── */}
        {config.realExample && (
          <motion.section
            className="py-24 md:py-32"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="container mx-auto max-w-4xl px-6">
              <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-green-500">
                Exemplo real
              </motion.div>
              <motion.h2 variants={itemVariants} className="mb-12 text-3xl font-bold tracking-tight md:text-4xl">
                {config.realExample.title}
              </motion.h2>

              <motion.div variants={itemVariants} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
                {/* Before row */}
                <div className="border-b border-border/50 bg-destructive/[0.04] px-8 py-7">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-destructive">Antes</p>
                  <p className="text-base italic text-muted-foreground">&quot;{config.realExample.before}&quot;</p>
                </div>
                {/* Connector */}
                <div className="flex items-center gap-4 border-b border-border/50 bg-muted/20 px-8 py-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                {/* After row */}
                <div className="bg-green-500/[0.04] px-8 py-7">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-green-600">Depois</p>
                  <p className="text-base font-medium leading-relaxed text-foreground">&quot;{config.realExample.after}&quot;</p>
                </div>
              </motion.div>

              <motion.p variants={itemVariants} className="mt-5 text-sm text-muted-foreground">
                Resultados específicos e mensuráveis fazem toda a diferença para o ATS e recrutadores.
              </motion.p>
            </div>
          </motion.section>
        )}

        {/* ─── POSITIONING MISTAKES (conditional) ──────────────────────────── */}
        {config.positioningMistakes && config.positioningMistakes.length > 0 && (
          <motion.section
            className="bg-muted/30 py-24 md:py-32"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="container mx-auto max-w-4xl px-6">
              <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-orange-500">
                Atenção
              </motion.div>
              <motion.h2 variants={itemVariants} className="mb-10 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
                Você pode estar se vendendo errado se...
              </motion.h2>
              <div className="space-y-3">
                {config.positioningMistakes.map((mistake, i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    className="flex items-start gap-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-6 py-4"
                  >
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                    <span className="text-[15px] leading-relaxed text-muted-foreground">{mistake}</span>
                  </motion.div>
                ))}
              </div>
              <motion.div variants={itemVariants} className="mt-10">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-600"
                >
                  Analisar meu posicionamento
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>
          </motion.section>
        )}

        {/* ─── ERRORS — accordion 2-col ─────────────────────────────────────── */}
        <MistakesAccordion config={config} />

        {/* ─── RESUME SECTIONS — inline split panels ────────────────────────── */}
        <motion.section
          className="border-y border-border/40 bg-muted/20 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-5xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Exemplos práticos
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-14 text-3xl font-bold tracking-tight md:text-4xl">
              Exemplos de seções do currículo
            </motion.h2>

            <div className="space-y-8">
              {[config.resumeSections.summary, config.resumeSections.skills, config.resumeSections.experience].map((section, i) => (
                <motion.div key={i} variants={itemVariants} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                  <div className="border-b border-border/40 bg-muted/40 px-7 py-4">
                    <h3 className="font-semibold text-foreground">{section.title}</h3>
                  </div>
                  <div className="grid md:grid-cols-2">
                    <div className="border-b border-border/40 p-6 md:border-b-0 md:border-r">
                      <span className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Ruim
                      </span>
                      <p className="text-sm leading-relaxed text-muted-foreground">{section.bad}</p>
                    </div>
                    <div className="p-6 bg-green-500/[0.03]">
                      <span className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Bom
                      </span>
                      <p className="text-sm leading-relaxed text-foreground">{section.good}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ─── ATS EXPLANATION — full-bleed content panel ──────────────────── */}
        <motion.section
          className="py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-5xl px-6">
            <div className="grid gap-14 lg:grid-cols-[2fr_3fr]">
              <motion.div variants={itemVariants}>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  Como funciona o ATS
                </p>
                <h2 className="mb-5 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                  {config.atsExplanation.title}
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {config.atsExplanation.description}
                </p>
              </motion.div>

              <motion.div variants={itemVariants}>
                <p className="mb-5 text-sm font-semibold text-foreground">
                  O que recrutadores de {config.roleShort} escaneiam
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {config.atsExplanation.whatRecruitersScan.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3.5"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ─── KEYWORDS — grouped premium layout ───────────────────────────── */}
        <motion.section
          id="keywords"
          className="scroll-mt-20 border-y border-border/40 bg-muted/20 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-6xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              SEO + ATS
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
              Palavras-chave essenciais para {config.roleShort}
            </motion.h2>
            <motion.p variants={itemVariants} className="mb-14 max-w-2xl text-base text-muted-foreground">
              Inclua estas palavras-chave no seu currículo para maximizar sua pontuação no ATS.
            </motion.p>

            {/* Masonry-style varied keyword blocks */}
            <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.keywords.map((keyword, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border border-border/50 bg-card px-6 py-5 transition-all duration-200 hover:border-primary/30 hover:shadow-sm ${
                    i % 5 === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  <span className="mb-2.5 block text-base font-semibold text-foreground">
                    {keyword.term}
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">{keyword.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ─── SPECIALIZATIONS — mini profile panels ────────────────────────── */}
        <motion.section
          className="py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-6xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Escolha sua lane
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-14 text-3xl font-bold tracking-tight md:text-4xl">
              Currículo por especialidade
            </motion.h2>

            <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-3">
              {config.specializations.map((spec, i) => (
                <div
                  key={i}
                  className="group flex flex-col rounded-3xl border border-border/60 bg-card p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
                    Especialidade {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mb-3 text-xl font-bold tracking-tight">{spec.title}</h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">{spec.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {spec.keywords.map((kw, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ─── SENIORITY — horizontal progression timeline ──────────────────── */}
        <motion.section
          className="border-y border-border/40 bg-muted/20 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-6xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Progressão de carreira
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-14 text-3xl font-bold tracking-tight md:text-4xl">
              Currículo por senioridade
            </motion.h2>

            {/* Timeline progression */}
            <motion.div variants={itemVariants} className="relative">
              {/* connecting bar */}
              <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-border via-primary/30 to-primary/60 md:block" />

              <div className="grid gap-6 md:grid-cols-3">
                {config.seniorityLevels.map((level, i) => (
                  <div
                    key={i}
                    className="relative flex flex-col rounded-3xl border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    style={{
                      borderColor: i === 0
                        ? "oklch(var(--border))"
                        : i === 1
                        ? "oklch(var(--primary)/0.3)"
                        : "oklch(var(--primary)/0.6)",
                    }}
                  >
                    {/* Step indicator */}
                    <div
                      className="relative z-10 mb-5 flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-full border-2 text-xs font-bold"
                      style={{
                        borderColor: i === 2 ? "oklch(var(--primary))" : "oklch(var(--border))",
                        backgroundColor: i === 2 ? "oklch(var(--primary))" : "oklch(var(--background))",
                        color: i === 2 ? "oklch(var(--primary-foreground))" : "oklch(var(--muted-foreground))",
                      }}
                    >
                      {i + 1}
                    </div>

                    <h3 className="mb-1 text-lg font-bold tracking-tight">{level.level}</h3>
                    <p
                      className="mb-5 text-sm font-semibold"
                      style={{ color: i === 2 ? "oklch(var(--primary))" : undefined }}
                    >
                      {level.focus}
                    </p>
                    <ul className="space-y-3">
                      {level.tips.map((tip, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── FULL RESUME EXAMPLE ─────────────────────────────────────────── */}
        <motion.section
          className="py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-4xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-green-600">
              Modelo completo
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-14 text-3xl font-bold tracking-tight md:text-4xl">
              Currículo completo ATS-ready
            </motion.h2>

            <motion.div
              variants={itemVariants}
              className="overflow-hidden rounded-3xl border-2 border-green-500/25 bg-white shadow-xl shadow-green-500/5 dark:bg-card"
            >
              {/* Header */}
              <div className="border-b border-border/30 bg-green-500/[0.04] px-10 py-8 text-center">
                <h3 className="mb-1.5 text-xl font-bold text-foreground">{config.fullResumeExample.name}</h3>
                <p className="mb-2 font-medium text-primary">{config.fullResumeExample.title}</p>
                <p className="text-sm text-muted-foreground">{config.fullResumeExample.contact}</p>
              </div>

              <div className="px-10 py-8 space-y-8">
                {/* Summary */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Resumo Profissional</p>
                  <div className="h-px w-full bg-primary/15 mb-4" />
                  <p className="text-sm leading-relaxed text-foreground">{config.fullResumeExample.summary}</p>
                </div>

                {/* Skills */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Habilidades Técnicas</p>
                  <div className="h-px w-full bg-primary/15 mb-4" />
                  <div className="space-y-2">
                    {config.fullResumeExample.skills.map((skill, i) => (
                      <div key={i} className="flex flex-wrap gap-x-2 text-sm">
                        <span className="font-semibold text-foreground">{skill.category}:</span>
                        <span className="text-muted-foreground">{skill.items}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Experiência Profissional</p>
                  <div className="h-px w-full bg-primary/15 mb-5" />
                  <div className="space-y-7">
                    {config.fullResumeExample.experience.map((exp, i) => (
                      <div key={i} className="pl-4 border-l-2 border-primary/20">
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <h5 className="font-semibold text-foreground">{exp.role}</h5>
                          <span className="text-xs text-muted-foreground">{exp.period}</span>
                        </div>
                        <p className="mb-3 text-sm font-medium text-muted-foreground">{exp.company}</p>
                        <ul className="space-y-1.5">
                          {exp.bullets.map((bullet, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Formação Acadêmica</p>
                  <div className="h-px w-full bg-primary/15 mb-4" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">{config.fullResumeExample.education.degree}</span>
                      <span className="text-muted-foreground"> — {config.fullResumeExample.education.institution}</span>
                    </div>
                    <span className="text-muted-foreground">{config.fullResumeExample.education.year}</span>
                  </div>
                </div>

                {/* Certifications */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Certificações</p>
                  <div className="h-px w-full bg-primary/15 mb-4" />
                  <ul className="space-y-2">
                    {config.fullResumeExample.certifications.map((cert, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── BEFORE / AFTER — dramatic split ─────────────────────────────── */}
        <motion.section
          className="border-y border-border/40 bg-muted/20 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-5xl px-6">
            <motion.div variants={itemVariants} className="mb-14">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Transformação
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Antes vs Depois: Seção de Experiência
              </h2>
              <p className="mt-4 max-w-xl text-base text-muted-foreground">
                Esta é a diferença entre um currículo genérico e um currículo ATS-ready.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-0 overflow-hidden rounded-3xl border border-border/60 shadow-lg md:grid-cols-2">
              {/* Before — muted, noisy */}
              <div className="relative bg-muted/60 px-8 py-9">
                <div className="pointer-events-none absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: "repeating-linear-gradient(45deg, oklch(var(--foreground)) 0px, oklch(var(--foreground)) 1px, transparent 1px, transparent 8px)"
                  }}
                />
                <div className="relative">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-bold text-destructive">Reprovado pelo ATS</span>
                  </div>
                  <h3 className="mb-5 text-base font-semibold text-foreground/70 line-through decoration-destructive/40">
                    {config.cvExample.before.title}
                  </h3>
                  <ul className="space-y-3">
                    {config.cvExample.before.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground/70">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Divider */}
              <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-green-500/50 bg-background shadow-lg">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                </div>
              </div>

              {/* After — clean, premium */}
              <div className="relative border-t border-border/60 bg-card px-8 py-9 md:border-l md:border-t-0">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-bold text-green-600">Aprovado pelo ATS</span>
                </div>
                <h3 className="mb-5 text-base font-semibold text-foreground">
                  {config.cvExample.after.title}
                </h3>
                <ul className="space-y-3">
                  {config.cvExample.after.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── IMPROVEMENT STEPS — progressive vertical timeline ───────────── */}
        <motion.section
          className="py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-3xl px-6">
            <motion.div variants={itemVariants} className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Passo a passo
            </motion.div>
            <motion.h2 variants={itemVariants} className="mb-16 text-3xl font-bold tracking-tight md:text-4xl">
              Como melhorar seu currículo de {config.roleShort}
            </motion.h2>

            {/* Timeline wrapper — left line + right content */}
            <div className="relative">
              {/* Continuous gradient line behind all steps */}
              <div
                className="pointer-events-none absolute bottom-0 left-[1.125rem] top-0 hidden w-px bg-gradient-to-b from-border/40 via-primary/25 to-primary/50 md:block"
                aria-hidden
              />

              <div className="space-y-0">
                {config.improvementSteps.map((step, i) => {
                  const total = config.improvementSteps.length
                  const isLast = i === total - 1

                  // Progressive weight: 0 = lightest → last = strongest
                  const circleStyle = isLast
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_oklch(var(--primary)/0.15)]"
                    : i >= total - 2
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : i >= 1
                    ? "border-border/80 bg-muted/60 text-muted-foreground"
                    : "border-border/50 bg-muted/30 text-muted-foreground/60"

                  const cardShadow = isLast
                    ? "shadow-xl shadow-primary/12"
                    : i >= total - 2
                    ? "shadow-md shadow-primary/6"
                    : i >= 1
                    ? "shadow-sm"
                    : "shadow-none"

                  const cardBorder = isLast
                    ? "border-primary/35"
                    : i >= total - 2
                    ? "border-primary/20"
                    : i >= 1
                    ? "border-border/60"
                    : "border-border/35"

                  const cardBg = isLast
                    ? "bg-card"
                    : "bg-card"

                  // Slight alternating nudge for organic feel
                  const nudgeClass = i % 2 === 1 ? "md:translate-x-3" : ""

                  return (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      className={`group relative flex gap-6 ${isLast ? "pb-0" : "pb-8"}`}
                    >
                      {/* Left: circle indicator (desktop) */}
                      <div className="relative z-10 hidden shrink-0 pt-5 md:block">
                        <div
                          className={`flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 group-hover:scale-110 ${circleStyle}`}
                        >
                          {i + 1}
                        </div>
                      </div>

                      {/* Right: content card */}
                      <div
                        className={`
                          flex-1 rounded-2xl border px-6 py-5 transition-all duration-300
                          group-hover:-translate-y-0.5 group-hover:border-primary/30
                          ${cardShadow} ${cardBorder} ${cardBg} ${nudgeClass}
                          ${isLast ? "group-hover:shadow-2xl group-hover:shadow-primary/15" : ""}
                        `}
                      >
                        {/* Mobile step bubble */}
                        <div
                          className={`mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold md:hidden ${
                            isLast
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </div>

                        <h3
                          className={`mb-2 font-semibold leading-snug tracking-tight ${
                            isLast ? "text-lg text-foreground" : "text-base text-foreground"
                          }`}
                        >
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>

                        {/* Final step badge */}
                        {isLast && (
                          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Currículo pronto para o ATS
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ─── MID-PAGE CTA ────────────────────────────────────────────────── */}
        <motion.section
          className="bg-muted/30 py-20 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-4xl px-6">
            <motion.div
              variants={itemVariants}
              className="relative overflow-hidden rounded-3xl bg-card px-8 py-14 text-center shadow-sm ring-1 ring-border/60 md:px-16"
            >
              <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-primary/8 blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-primary/5 blur-[80px]" />
              <div className="relative z-10">
                <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                  <Lightbulb className="h-7 w-7" />
                </div>
                <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
                  Descubra se seu currículo de {config.roleShort.toLowerCase()} passa no ATS
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground">
                  <BrandText
                    text="Receba seu score ATS e veja exatamente o que corrigir para conquistar mais entrevistas."
                    className="font-medium text-foreground"
                  />
                </p>
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-9 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
                >
                  Analisar meu currículo agora
                  <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.section>

  {/* ─── INTERNAL LINKS ──────────────────────────────────────────────── */}
  <motion.section
  className="py-24 md:py-32"
  variants={containerVariants}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, margin: "-80px" }}
  >
  <div className="container mx-auto max-w-6xl px-6">
  <motion.div variants={itemVariants} className="mb-14">
  <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Mais recursos</p>
  <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Outros guias de currículo</h2>
  </motion.div>

  {/* Asymmetric: 3 horizontal content cards (left) + 1 tall CTA card (right) */}
  <motion.div variants={itemVariants} className="grid gap-5 lg:grid-cols-5">

    {/* Left: 3 horizontal cards stacked — gap aumentado */}
    <div className="flex flex-col gap-6 lg:col-span-3">
      {config.internalLinks.slice(0, 3).map((link, i) => (
        <Link
          key={i}
          href={link.href}
          className="group flex overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
        >
          {/* Thumbnail com zoom */}
          <div className="relative w-28 shrink-0 overflow-hidden sm:w-36">
            <Image
              src={link.image}
              alt={link.label}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:bg-black/30" />
          </div>
          {/* Text */}
          <div className="flex flex-1 flex-col justify-center px-5 py-5 transition-colors duration-200 group-hover:bg-muted/30">
            <h3 className="mb-1 text-sm font-semibold leading-snug text-foreground">{link.label}</h3>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{link.description}</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              Ver guia
              <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>

    {/* Right: Featured CTA card — hero visual */}
    {config.internalLinks[3] && (
      <Link
        href={config.internalLinks[3].href}
        className="group relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/20 lg:col-span-2"
      >
        <div className="relative h-72 overflow-hidden lg:h-full lg:min-h-[340px]">
          <Image
            src={config.internalLinks[3].image}
            alt={config.internalLinks[3].label}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-108"
          />
          {/* Overlay mais escuro no hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/15 transition-all duration-400 group-hover:from-black/98 group-hover:via-black/65 group-hover:to-black/20" />
        </div>

        {/* Content pinned to bottom */}
        <div className="absolute inset-x-0 bottom-0 p-7 transition-transform duration-300 group-hover:-translate-y-1.5">
          <span className="mb-4 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
            Gratuito
          </span>
          <h3 className="mb-2 text-xl font-bold leading-snug text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
            Descubra por que seu currículo não gera entrevistas
          </h3>
          <p className="mb-5 text-sm leading-relaxed text-white/75 [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]">
            {config.internalLinks[3].description}
          </p>
          {/* Botão com sombra sólida e mais contraste */}
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:gap-3 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_6px_24px_rgba(0,0,0,0.4)]">
            Analisar agora
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    )}
  </motion.div>
  </div>
  </motion.section>

        {/* ─── FAQ ─────────────────────────────────────────────────────��───── */}
        <motion.section
          className="border-t border-border/40 bg-muted/20 py-24 md:py-32"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-3xl px-6">
            <motion.div variants={itemVariants} className="mb-14">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">FAQ</p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Perguntas frequentes sobre currículo de {config.roleShort}
              </h2>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Accordion type="single" collapsible className="w-full divide-y divide-border/40">
                {config.faqs.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`item-${index}`} className="border-none">
                    <AccordionTrigger className="py-6 text-left text-base font-semibold transition-colors hover:text-primary hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-[15px] leading-relaxed text-muted-foreground">
                      <BrandText text={faq.answer} className="font-medium text-foreground" />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── FINAL CTA ───────────────────────────────────────────────────── */}
        <motion.section
          className="py-24 md:py-32"
          variants={itemVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="container mx-auto max-w-3xl px-6 text-center">
            <h2 className="mb-5 text-3xl font-bold tracking-tight md:text-4xl">
              Pronto para conquistar mais entrevistas?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-muted-foreground">
              Pare de enviar currículos para o buraco negro. Deixe nossa IA otimizar seu perfil de{" "}
              {config.roleShort.toLowerCase()} e comece a ser chamado para as entrevistas que você merece.
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-primary px-10 py-5 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30"
            >
              {config.hero.ctaText}
              <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.section>

      </main>
      <Footer />
    </div>
  )
}
