"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, type Variants } from "motion/react"
import {
  ArrowRight,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  Target,
  FileText,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  Users,
  GraduationCap,
  Code2,
} from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { RoleLandingConfig } from "@/lib/seo/role-landing-config"

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
}

interface SeoRoleLandingPageProps {
  config: RoleLandingConfig
}

export default function SeoRoleLandingPage({ config }: SeoRoleLandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <Header />

      <main className="relative flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-16 md:py-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
          
          <div className="container relative z-10 mx-auto max-w-5xl px-4">
            <motion.div
              className="mx-auto max-w-4xl text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="mb-6 text-balance text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                {config.hero.h1.split("ATS").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        ATS
                      </span>
                    )}
                  </span>
                ))}
              </h1>
              <p className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {config.hero.subtitle}
              </p>
              
              {/* Main CTA - Larger and more prominent */}
              <div className="mb-6">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-lg font-semibold text-primary-foreground shadow-xl transition-all hover:-translate-y-1 hover:bg-primary/90 hover:shadow-primary/25"
                >
                  {config.hero.ctaText}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <p className="mb-8 text-sm text-muted-foreground">{config.hero.ctaSubtext}</p>
              
              {/* Secondary CTA */}
              <Button asChild variant="ghost" size="lg" className="text-base font-medium text-muted-foreground hover:text-foreground">
                <a href="#keywords" className="flex items-center gap-2">
                  Ver palavras-chave essenciais
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Problem Section */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-destructive/10 p-4 text-destructive">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                {config.problem.title}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {config.problem.description}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {config.problem.points.map((point, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm transition-all hover:border-destructive/20 hover:shadow-md"
                >
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive transition-transform group-hover:scale-110" />
                  <p className="text-sm leading-relaxed text-muted-foreground">{point}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Real Example Section (conditional - strong conversion block) */}
        {config.realExample && (
          <motion.section
            className="py-16 md:py-24"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="container mx-auto max-w-4xl px-4">
              <motion.div variants={itemVariants} className="mb-8 text-center">
                <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-green-500/10 p-4 text-green-500">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                  {config.realExample.title}
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                  Veja a diferença que faz ser específico e mostrar resultados reais.
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2">
                {/* Before */}
                <div className="rounded-[2rem] border-2 border-destructive/20 bg-card p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-destructive/10 p-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-wider text-destructive">Antes</span>
                  </div>
                  <p className="text-lg text-muted-foreground italic">&quot;{config.realExample.before}&quot;</p>
                </div>

                {/* After */}
                <div className="rounded-[2rem] border-2 border-green-500/30 bg-card p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-green-500/10 p-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-wider text-green-500">Depois</span>
                  </div>
                  <p className="text-lg text-foreground">&quot;{config.realExample.after}&quot;</p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="mt-8 text-center">
                <p className="mb-4 text-sm text-muted-foreground">
                  Resultados específicos e mensuráveis fazem toda a diferença para o ATS e recrutadores.
                </p>
              </motion.div>
            </div>
          </motion.section>
        )}

        {/* Positioning Mistakes Section (conditional) */}
        {config.positioningMistakes && config.positioningMistakes.length > 0 && (
          <motion.section
            className="py-16 md:py-24"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="container mx-auto max-w-4xl px-4">
              <motion.div 
                variants={itemVariants} 
                className="rounded-[2rem] border-2 border-orange-500/30 bg-orange-500/5 p-8 md:p-12"
              >
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-xl bg-orange-500/10 p-3">
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                  </div>
                  <h2 className="text-2xl font-bold md:text-3xl">
                    Você pode estar se vendendo errado se...
                  </h2>
                </div>
                <ul className="space-y-4">
                  {config.positioningMistakes.map((mistake, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                      <span className="text-muted-foreground">{mistake}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 font-semibold text-white transition-all hover:bg-orange-600"
                  >
                    Analisar meu posicionamento
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}

        {/* Common Mistakes Section */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-orange-500/10 p-4 text-orange-500">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Erros mais comuns no currículo de {config.roleShort}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Evite esses erros que fazem currículos serem filtrados automaticamente.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              {config.commonMistakes.map((item, i) => (
                <div
                  key={i}
                  className="grid gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm md:grid-cols-2"
                >
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-destructive">Erro</span>
                      <p className="text-muted-foreground">{item.mistake}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-green-500">Correção</span>
                      <p className="text-foreground">{item.fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Resume Sections Examples */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <Code2 className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Exemplos de seções do currículo
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Veja como escrever cada seção do seu currículo de forma otimizada para ATS.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-8">
              {/* Summary Example */}
              <div className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm">
                <h3 className="mb-6 text-xl font-semibold">{config.resumeSections.summary.title}</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                      <XCircle className="h-4 w-4" /> Ruim
                    </span>
                    <p className="text-sm text-muted-foreground">{config.resumeSections.summary.bad}</p>
                  </div>
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-green-500">
                      <CheckCircle2 className="h-4 w-4" /> Bom
                    </span>
                    <p className="text-sm text-foreground">{config.resumeSections.summary.good}</p>
                  </div>
                </div>
              </div>

              {/* Skills Example */}
              <div className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm">
                <h3 className="mb-6 text-xl font-semibold">{config.resumeSections.skills.title}</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                      <XCircle className="h-4 w-4" /> Ruim
                    </span>
                    <p className="text-sm text-muted-foreground">{config.resumeSections.skills.bad}</p>
                  </div>
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-green-500">
                      <CheckCircle2 className="h-4 w-4" /> Bom
                    </span>
                    <p className="text-sm text-foreground">{config.resumeSections.skills.good}</p>
                  </div>
                </div>
              </div>

              {/* Experience Example */}
              <div className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm">
                <h3 className="mb-6 text-xl font-semibold">{config.resumeSections.experience.title}</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                      <XCircle className="h-4 w-4" /> Ruim
                    </span>
                    <p className="text-sm text-muted-foreground">{config.resumeSections.experience.bad}</p>
                  </div>
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-green-500">
                      <CheckCircle2 className="h-4 w-4" /> Bom
                    </span>
                    <p className="text-sm text-foreground">{config.resumeSections.experience.good}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ATS Explanation Section */}
        <motion.section
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <Search className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                {config.atsExplanation.title}
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
                {config.atsExplanation.description}
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm md:p-12"
            >
              <h3 className="mb-6 flex items-center gap-3 text-xl font-semibold">
                <Target className="h-6 w-6 text-primary" />
                O que recrutadores de {config.roleShort} escaneiam
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {config.atsExplanation.whatRecruitersScan.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Keywords Section (SEO Gold) */}
        <motion.section
          id="keywords"
          className="scroll-mt-20 bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Palavras-chave Essenciais para {config.roleShort}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Inclua estas palavras-chave no seu currículo para maximizar sua pontuação no ATS.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2">
              {config.keywords.map((keyword, i) => (
                <div
                  key={i}
                  className="group rounded-2xl border border-border/40 bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {keyword.term}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{keyword.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Specializations Section */}
        <motion.section
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <Users className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Currículo por Especialidade
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Palavras-chave específicas para cada especialização da área.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-3">
              {config.specializations.map((spec, i) => (
                <div
                  key={i}
                  className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm transition-all hover:shadow-md"
                >
                  <h3 className="mb-3 text-lg font-semibold">{spec.title}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{spec.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {spec.keywords.map((kw, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
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

        {/* Seniority Levels Section */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Currículo por Senioridade
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Dicas específicas para cada nível de experiência.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-3">
              {config.seniorityLevels.map((level, i) => (
                <div
                  key={i}
                  className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm"
                >
                  <h3 className="mb-2 text-lg font-semibold">{level.level}</h3>
                  <p className="mb-4 text-sm font-medium text-primary">{level.focus}</p>
                  <ul className="space-y-3">
                    {level.tips.map((tip, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Full Resume Example Section */}
        <motion.section
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-4xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-green-500/10 p-4 text-green-500">
                <FileText className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Currículo Completo ATS-Ready
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Modelo de currículo otimizado para ATS. Use como referência para estruturar o seu.
              </p>
            </motion.div>

            <motion.div 
              variants={itemVariants} 
              className="rounded-[2rem] border-2 border-green-500/30 bg-white p-8 shadow-lg md:p-12"
            >
              {/* Resume Header */}
              <div className="mb-8 border-b border-border/50 pb-6 text-center">
                <h3 className="mb-2 text-2xl font-bold text-foreground">{config.fullResumeExample.name}</h3>
                <p className="mb-3 text-lg font-medium text-primary">{config.fullResumeExample.title}</p>
                <p className="text-sm text-muted-foreground">{config.fullResumeExample.contact}</p>
              </div>

              {/* Summary */}
              <div className="mb-8">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Resumo Profissional</h4>
                <p className="text-sm leading-relaxed text-foreground">{config.fullResumeExample.summary}</p>
              </div>

              {/* Skills */}
              <div className="mb-8">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Habilidades Técnicas</h4>
                <div className="space-y-2">
                  {config.fullResumeExample.skills.map((skill, i) => (
                    <div key={i} className="flex flex-wrap gap-2 text-sm">
                      <span className="font-semibold text-foreground">{skill.category}:</span>
                      <span className="text-muted-foreground">{skill.items}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="mb-8">
                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">Experiência Profissional</h4>
                <div className="space-y-6">
                  {config.fullResumeExample.experience.map((exp, i) => (
                    <div key={i}>
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <h5 className="font-semibold text-foreground">{exp.role}</h5>
                        <span className="text-xs text-muted-foreground">{exp.period}</span>
                      </div>
                      <p className="mb-2 text-sm font-medium text-muted-foreground">{exp.company}</p>
                      <ul className="space-y-1">
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
              <div className="mb-8">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Formação Acadêmica</h4>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{config.fullResumeExample.education.degree}</span>
                    <span className="text-muted-foreground"> - {config.fullResumeExample.education.institution}</span>
                  </div>
                  <span className="text-muted-foreground">{config.fullResumeExample.education.year}</span>
                </div>
              </div>

              {/* Certifications */}
              <div>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Certificações</h4>
                <ul className="space-y-1">
                  {config.fullResumeExample.certifications.map((cert, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {cert}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Before/After CV Example (Quick Comparison) */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Antes vs Depois: Seção de Experiência
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Comparação rápida de como transformar uma experiência genérica em otimizada para ATS.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-8 lg:grid-cols-2">
              {/* Before */}
              <div className="rounded-[2rem] border-2 border-destructive/20 bg-card p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-full bg-destructive/10 p-2">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-destructive">Reprovado pelo ATS</span>
                    <h3 className="text-lg font-semibold">{config.cvExample.before.title}</h3>
                  </div>
                </div>
                <ul className="space-y-3">
                  {config.cvExample.before.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              {/* After */}
              <div className="rounded-[2rem] border-2 border-green-500/30 bg-card p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-full bg-green-500/10 p-2">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-500">Aprovado pelo ATS</span>
                    <h3 className="text-lg font-semibold">{config.cvExample.after.title}</h3>
                  </div>
                </div>
                <ul className="space-y-3">
                  {config.cvExample.after.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* How to Improve Section */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Como Melhorar seu Currículo de {config.roleShort}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Siga estes passos para otimizar seu currículo e passar pelos filtros ATS.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {config.improvementSteps.map((step, i) => (
                <div
                  key={i}
                  className="group relative rounded-2xl border border-border/40 bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                >
                  <div className="pointer-events-none absolute right-4 top-4 text-6xl font-black text-primary/5 transition-all group-hover:text-primary/10">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                    {i + 1}
                  </div>
                  <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div
              variants={itemVariants}
              className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary/30 via-primary/5 to-transparent p-[1px] shadow-lg"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

              <div className="relative z-10 rounded-[3rem] bg-card/95 p-8 text-center backdrop-blur-sm md:p-16">
                <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary shadow-inner">
                  <Lightbulb className="h-8 w-8" />
                </div>
                <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                  Descubra se seu currículo de {config.roleShort.toLowerCase()} passa no ATS
                </h2>
                <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                  <BrandText
                    text="Receba seu score ATS e veja exatamente o que corrigir para conquistar mais entrevistas."
                    className="font-medium text-foreground"
                  />
                </p>
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-lg font-semibold text-primary-foreground shadow-xl transition-all hover:-translate-y-1 hover:bg-primary/90 hover:shadow-primary/25"
                >
                  Analisar meu currículo agora
                  <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Internal Links Section */}
        <motion.section
          className="bg-muted/30 py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-6xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Outros guias de currículo
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Explore mais recursos para otimizar seu currículo.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {config.internalLinks.map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className="group relative overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={link.image}
                      alt={link.label}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>
                  
                  {/* Content overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="mb-1 text-lg font-semibold text-white">
                      {link.label}
                    </h3>
                    <p className="text-sm text-white/80">{link.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-white">
                      Ver guia
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-4xl px-4">
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Perguntas Frequentes sobre Currículo de {config.roleShort}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Dúvidas comuns sobre como otimizar seu currículo para a área.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="rounded-2xl border bg-card p-6 shadow-sm md:p-8"
            >
              <Accordion type="single" collapsible className="w-full">
                {config.faqs.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`item-${index}`}>
                    <AccordionTrigger className="py-5 text-left text-lg font-semibold transition-colors hover:text-primary">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                      <BrandText text={faq.answer} className="font-medium text-foreground" />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          className="bg-muted/30 py-16 text-center md:py-24"
          variants={itemVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="container mx-auto max-w-3xl px-4">
            <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">
              Pronto para conquistar mais entrevistas?
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Pare de enviar currículos para o buraco negro. Deixe nossa IA otimizar seu perfil de {config.roleShort.toLowerCase()} e comece a ser chamado para as entrevistas que você merece.
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-lg font-semibold text-primary-foreground shadow-xl transition-all hover:-translate-y-1 hover:bg-primary/90 hover:shadow-primary/25"
            >
              {config.hero.ctaText}
              <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  )
}
