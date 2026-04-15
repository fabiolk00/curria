"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  Sparkles,
  User,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { CVState } from "@/types/cv"

type ResumeComparisonViewProps = {
  originalCvState: CVState
  optimizedCvState: CVState
  generationType: "ATS_ENHANCEMENT" | "JOB_TARGETING"
  onContinue: () => void
  className?: string
}

type DiffSection = {
  id: string
  label: string
  icon: typeof User
  hasChanges: boolean
}

function countChanges(original: CVState, optimized: CVState): {
  sections: DiffSection[]
  totalChanges: number
} {
  const sections: DiffSection[] = []
  let totalChanges = 0

  const contactChanged =
    original.fullName !== optimized.fullName ||
    original.email !== optimized.email ||
    original.phone !== optimized.phone ||
    original.linkedin !== optimized.linkedin ||
    original.location !== optimized.location
  if (contactChanged) totalChanges++
  sections.push({ id: "contact", label: "Contato", icon: User, hasChanges: contactChanged })

  const summaryChanged = original.summary !== optimized.summary
  if (summaryChanged) totalChanges++
  sections.push({ id: "summary", label: "Resumo", icon: FileText, hasChanges: summaryChanged })

  const experienceChanged =
    JSON.stringify(original.experience) !== JSON.stringify(optimized.experience)
  if (experienceChanged) totalChanges++
  sections.push({ id: "experience", label: "Experiencia", icon: Briefcase, hasChanges: experienceChanged })

  const skillsChanged = JSON.stringify(original.skills) !== JSON.stringify(optimized.skills)
  if (skillsChanged) totalChanges++
  sections.push({ id: "skills", label: "Skills", icon: Sparkles, hasChanges: skillsChanged })

  const educationChanged =
    JSON.stringify(original.education) !== JSON.stringify(optimized.education)
  if (educationChanged) totalChanges++
  sections.push({ id: "education", label: "Educacao", icon: GraduationCap, hasChanges: educationChanged })

  const certificationsChanged =
    JSON.stringify(original.certifications) !== JSON.stringify(optimized.certifications)
  if (certificationsChanged) totalChanges++
  sections.push({ id: "certifications", label: "Certificacoes", icon: CheckCircle2, hasChanges: certificationsChanged })

  return { sections, totalChanges }
}

function AnimatedSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  )
}

function SectionCard({
  title,
  children,
  variant = "original",
  className,
}: {
  title: string
  children: React.ReactNode
  variant?: "original" | "optimized"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-2xl border p-6 transition-all duration-300",
        variant === "original"
          ? "border-border/60 bg-muted/20"
          : "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 shadow-sm dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-emerald-900/20",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-all",
            variant === "original" 
              ? "bg-muted-foreground/30" 
              : "bg-emerald-500 shadow-sm shadow-emerald-500/50",
          )}
        />
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-widest",
            variant === "original" 
              ? "text-muted-foreground" 
              : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function TextDiff({ original, optimized }: { original: string; optimized: string }) {
  const hasChanges = original !== optimized

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard title="Antes" variant="original">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {original || "Vazio"}
        </p>
      </SectionCard>
      <SectionCard title="Depois" variant="optimized">
        <p className={cn(
          "text-sm leading-relaxed",
          hasChanges ? "text-foreground" : "text-muted-foreground"
        )}>
          {optimized || "Vazio"}
        </p>
        {hasChanges && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Otimizado pelo ATS</span>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function SkillsDiff({ original, optimized }: { original: string[]; optimized: string[] }) {
  const added = optimized.filter((skill) => !original.includes(skill))
  const removed = original.filter((skill) => !optimized.includes(skill))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard title="Antes" variant="original">
        <div className="flex flex-wrap gap-2">
          {original.length > 0 ? (
            original.map((skill, index) => (
              <Badge
                key={`${skill}-${index}`}
                variant="outline"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  removed.includes(skill) 
                    ? "border-red-200 bg-red-50 text-red-600 line-through dark:border-red-900 dark:bg-red-950/30 dark:text-red-400" 
                    : "border-border bg-background",
                )}
              >
                {skill}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma skill</span>
          )}
        </div>
        {removed.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            {removed.length} skills removidas
          </p>
        )}
      </SectionCard>
      <SectionCard title="Depois" variant="optimized">
        <div className="flex flex-wrap gap-2">
          {optimized.length > 0 ? (
            optimized.map((skill, index) => (
              <Badge
                key={`${skill}-${index}`}
                variant="outline"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  added.includes(skill) 
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" 
                    : "border-emerald-200/60 bg-white/80 dark:border-emerald-800/40 dark:bg-emerald-950/20",
                )}
              >
                {skill}
                {added.includes(skill) && (
                  <span className="ml-1.5 text-emerald-500">+</span>
                )}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma skill</span>
          )}
        </div>
        {added.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>+{added.length} skills priorizadas</span>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function ExperienceDiff({
  original,
  optimized,
}: {
  original: CVState["experience"]
  optimized: CVState["experience"]
}) {
  const [expanded, setExpanded] = useState(false)
  const showCount = expanded ? optimized.length : 2

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Antes" variant="original">
          <div className="space-y-5">
            {original.length > 0 ? (
              original.slice(0, showCount).map((exp, index) => (
                <div key={`${exp.title}-${index}`} className="text-sm">
                  <p className="font-semibold text-foreground">{exp.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {exp.company}
                    {exp.location && ` - ${exp.location}`}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {exp.startDate} - {exp.endDate}
                  </p>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {exp.bullets.slice(0, 2).map((bullet, bulletIndex) => (
                        <li 
                          key={bulletIndex} 
                          className="flex gap-2 text-xs text-muted-foreground"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          <span className="line-clamp-2">{bullet}</span>
                        </li>
                      ))}
                      {exp.bullets.length > 2 && (
                        <li className="text-xs text-muted-foreground/60">
                          +{exp.bullets.length - 2} bullets
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma experiencia</span>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Depois" variant="optimized">
          <div className="space-y-5">
            {optimized.length > 0 ? (
              optimized.slice(0, showCount).map((exp, index) => (
                <div key={`${exp.title}-${index}`} className="text-sm">
                  <p className="font-semibold text-foreground">{exp.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {exp.company}
                    {exp.location && ` - ${exp.location}`}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {exp.startDate} - {exp.endDate}
                  </p>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {exp.bullets.slice(0, 2).map((bullet, bulletIndex) => (
                        <li 
                          key={bulletIndex} 
                          className="flex gap-2 text-xs text-foreground"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                          <span className="line-clamp-2">{bullet}</span>
                        </li>
                      ))}
                      {exp.bullets.length > 2 && (
                        <li className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                          +{exp.bullets.length - 2} bullets otimizados
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma experiencia</span>
            )}
          </div>
        </SectionCard>
      </div>
      
      {optimized.length > 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="mx-auto flex gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform duration-200",
            expanded && "rotate-180"
          )} />
          {expanded ? "Mostrar menos" : `Mostrar mais ${optimized.length - 2} experiencias`}
        </Button>
      )}
    </div>
  )
}

function EducationDiff({
  original,
  optimized,
}: {
  original: CVState["education"]
  optimized: CVState["education"]
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard title="Antes" variant="original">
        <div className="space-y-3">
          {original.length > 0 ? (
            original.map((edu, index) => (
              <div key={`${edu.degree}-${index}`} className="text-sm">
                <p className="font-semibold text-foreground">{edu.degree}</p>
                <p className="text-xs text-muted-foreground">
                  {edu.institution}
                  {edu.year && ` - ${edu.year}`}
                </p>
              </div>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma educacao</span>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Depois" variant="optimized">
        <div className="space-y-3">
          {optimized.length > 0 ? (
            optimized.map((edu, index) => (
              <div key={`${edu.degree}-${index}`} className="text-sm">
                <p className="font-semibold text-foreground">{edu.degree}</p>
                <p className="text-xs text-muted-foreground">
                  {edu.institution}
                  {edu.year && ` - ${edu.year}`}
                </p>
              </div>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma educacao</span>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

export function ResumeComparisonView({
  originalCvState,
  optimizedCvState,
  generationType,
  onContinue,
  className,
}: ResumeComparisonViewProps) {
  const [headerVisible, setHeaderVisible] = useState(false)
  
  const { sections, totalChanges } = useMemo(
    () => countChanges(originalCvState, optimizedCvState),
    [originalCvState, optimizedCvState],
  )

  useEffect(() => {
    const timer = setTimeout(() => setHeaderVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const title =
    generationType === "JOB_TARGETING"
      ? "Curriculo adaptado para a vaga"
      : "Curriculo otimizado para ATS"

  const description =
    generationType === "JOB_TARGETING"
      ? "Compare as alteracoes feitas para alinhar seu curriculo com os requisitos da vaga alvo."
      : "Compare as melhorias aplicadas para maximizar a compatibilidade com sistemas ATS."

  return (
    <div
      data-testid="resume-comparison-view"
      className={cn(
        "flex min-h-screen flex-col bg-background text-foreground",
        className,
      )}
    >
      {/* Header */}
      <header 
        className={cn(
          "shrink-0 border-b border-border bg-card/80 px-6 py-6 backdrop-blur-sm transition-all duration-700 ease-out md:px-8",
          headerVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
        )}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-sm dark:from-emerald-900/50 dark:to-emerald-800/30">
                  <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                  {totalChanges} {totalChanges === 1 ? "secao alterada" : "secoes alteradas"}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {description}
              </p>
            </div>
            <Button
              onClick={onContinue}
              className="hidden gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md md:flex"
              size="lg"
            >
              Continuar para o dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Changed sections indicators */}
          <div className="mt-6 flex flex-wrap gap-2">
            {sections.map((section, index) => {
              const Icon = section.icon
              return (
                <div
                  key={section.id}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
                    section.hasChanges
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-muted/60 text-muted-foreground",
                  )}
                  style={{ 
                    transitionDelay: `${150 + index * 50}ms`,
                    opacity: headerVisible ? 1 : 0,
                    transform: headerVisible ? "translateY(0)" : "translateY(8px)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                  {section.hasChanges && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-10 px-6 py-8 md:px-8 md:py-10">
          {/* Summary */}
          <AnimatedSection delay={200}>
            <section>
              <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                Resumo profissional
              </h2>
              <TextDiff original={originalCvState.summary} optimized={optimizedCvState.summary} />
            </section>
          </AnimatedSection>

          <Separator className="bg-border/50" />

          {/* Skills */}
          <AnimatedSection delay={300}>
            <section>
              <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                Skills
              </h2>
              <SkillsDiff original={originalCvState.skills} optimized={optimizedCvState.skills} />
            </section>
          </AnimatedSection>

          <Separator className="bg-border/50" />

          {/* Experience */}
          <AnimatedSection delay={400}>
            <section>
              <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </div>
                Experiencia
              </h2>
              <ExperienceDiff
                original={originalCvState.experience}
                optimized={optimizedCvState.experience}
              />
            </section>
          </AnimatedSection>

          <Separator className="bg-border/50" />

          {/* Education */}
          <AnimatedSection delay={500}>
            <section>
              <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </div>
                Educacao
              </h2>
              <EducationDiff
                original={originalCvState.education}
                optimized={optimizedCvState.education}
              />
            </section>
          </AnimatedSection>
        </div>
      </ScrollArea>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border bg-card/80 px-6 py-4 backdrop-blur-sm md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            Revise as alteracoes acima e continue quando estiver satisfeito.
          </p>
          <Button
            onClick={onContinue}
            className="w-full gap-2 rounded-xl bg-emerald-600 px-6 text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md md:w-auto"
            size="lg"
          >
            Continuar para o dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
