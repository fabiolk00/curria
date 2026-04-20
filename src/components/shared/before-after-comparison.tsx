"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOGGLE_INTERVAL_MS = 4000
const TRANSITION_DURATION_S = 0.5
const SCAN_DURATION_S = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HighlightedSegment = { text: string; highlight?: boolean }

type ResumeSection = {
  heading: string
} & (
  | { kind: "paragraph"; content: string | HighlightedSegment[] }
  | { kind: "experience"; title: string; subtitle: string; bullets: (string | HighlightedSegment[])[] }
  | { kind: "skills"; items: string[] }
)

type ResumePreviewData = {
  name: string
  subtitle?: string
  contact: string
  atsStatus: { label: string; passed: boolean }
  sections: ResumeSection[]
  nameCenter?: boolean
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BEFORE_DATA: ResumePreviewData = {
  name: "John Doe",
  contact: "john.doe@email.com | (11) 99999-9999",
  nameCenter: true,
  atsStatus: { label: "Reprovado ATS", passed: false },
  sections: [
    {
      heading: "OBJETIVO",
      kind: "paragraph",
      content:
        "Busco uma oportunidade na área de tecnologia para crescer profissionalmente e desenvolver minhas habilidades",
    },
    {
      heading: "EXPERIÊNCIA",
      kind: "experience",
      title: "Desenvolvedor",
      subtitle: "Empresa XYZ - 2021-2023",
      bullets: [
        "Trabalhei em projetos web",
        "Ajudei a equipe com tarefas diárias",
        "Participei de reuniões e planejamentos",
      ],
    },
    {
      heading: "HABILIDADES",
      kind: "paragraph",
      content: "HTML, CSS, JavaScript, trabalho em equipe, comunicação, organização",
    },
    {
      heading: "FORMAÇÃO",
      kind: "paragraph",
      content: "Bacharel em Sistemas de Informação\nUniversidade ABC - 2020",
    },
  ],
}

const AFTER_DATA: ResumePreviewData = {
  name: "John Doe",
  subtitle: "Desenvolvedor Full Stack",
  contact: "john.doe@email.com | (11) 99999-9999",
  atsStatus: { label: "ATS Friendly", passed: true },
  sections: [
    {
      heading: "RESUMO PROFISSIONAL",
      kind: "paragraph",
      content: [
        { text: "Desenvolvedora " },
        { text: "Full Stack", highlight: true },
        { text: " com +2 anos de experiência em " },
        { text: "React", highlight: true },
        { text: ", " },
        { text: "Node.js", highlight: true },
        { text: " e " },
        { text: "TypeScript", highlight: true },
      ],
    },
    {
      heading: "EXPERIÊNCIA PROFISSIONAL",
      kind: "experience",
      title: "Desenvolvedor Full Stack",
      subtitle: "Empresa XYZ | 2021-2023",
      bullets: [
        [
          { text: "Desenvolveu " },
          { text: "15+ aplicações web", highlight: true },
          { text: " usando " },
          { text: "React", highlight: true },
          { text: " e " },
          { text: "TypeScript", highlight: true },
        ],
        [
          { text: "Otimizou performance, " },
          { text: "reduzindo carregamento em 40%", highlight: true },
        ],
        [
          { text: "Liderou equipe de " },
          { text: "3 desenvolvedores", highlight: true },
          { text: " em metodologia " },
          { text: "Agile/Scrum", highlight: true },
        ],
      ],
    },
    {
      heading: "HABILIDADES TÉCNICAS",
      kind: "skills",
      items: ["React", "TypeScript", "Node.js", "Git", "REST APIs", "PostgreSQL", "Agile", "Docker"],
    },
    {
      heading: "FORMAÇÃO ACADÊMICA",
      kind: "paragraph",
      content: "Bacharel em Sistemas de Informação\nUniversidade ABC - 2020",
    },
  ],
}

// ---------------------------------------------------------------------------
// Style helpers (deduplicated class strings)
// ---------------------------------------------------------------------------

const headingClass = (variant: "before" | "after") =>
  variant === "before"
    ? "text-sm font-semibold text-destructive/60"
    : "text-xs font-bold text-primary"

const bodyTextClass = (variant: "before" | "after") =>
  variant === "before"
    ? "text-xs text-muted-foreground/60 leading-relaxed"
    : "text-[11px] text-foreground/90 leading-relaxed"

const bulletClass = (variant: "before" | "after") =>
  variant === "before"
    ? "text-xs text-muted-foreground/60 list-disc"
    : "text-[11px] text-foreground/80 list-disc leading-relaxed"

const highlightClass = (variant: "before" | "after") =>
  variant === "before"
    ? "bg-primary/20 px-1 py-0.5 rounded font-medium"
    : "bg-green-500/20 px-1 py-0.5 rounded font-medium"

const skillBadgeClass = "bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HighlightedText({
  content,
  variant,
}: {
  content: string | HighlightedSegment[]
  variant: "before" | "after"
}) {
  if (typeof content === "string") {
    const lines = content.split("\n")
    return (
      <>
        {lines.map((line, i) => (
          <p key={i} className={cn(bodyTextClass(variant), i > 0 && "text-[10px] text-muted-foreground mt-0.5")}>
            {line}
          </p>
        ))}
      </>
    )
  }

  return (
    <p className={bodyTextClass(variant)}>
      {content.map((seg, i) =>
        seg.highlight ? (
          <span key={i} className={highlightClass(variant)}>{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  )
}

function ResumePreviewCard({
  data,
  variant,
}: {
  data: ResumePreviewData
  variant: "before" | "after"
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={cn("space-y-1.5", data.nameCenter && "text-center space-y-2")}>
        <h3
          className={cn(
            variant === "before"
              ? "text-lg font-medium text-muted-foreground"
              : "text-xl font-bold text-foreground",
          )}
        >
          {data.name}
        </h3>
        {data.subtitle && (
          <p className="text-xs font-medium text-muted-foreground">{data.subtitle}</p>
        )}
        <p
          className={cn(
            variant === "before"
              ? "text-xs text-muted-foreground/70"
              : "text-[11px] text-muted-foreground/80",
          )}
        >
          {data.contact}
        </p>
      </div>

      {/* Sections */}
      {data.sections.map((section) => (
        <div key={section.heading} className={section.kind === "experience" ? "space-y-3" : "space-y-2"}>
          <h4 className={headingClass(variant)}>{section.heading}</h4>

          {section.kind === "paragraph" && (
            <HighlightedText content={section.content} variant={variant} />
          )}

          {section.kind === "experience" && (
            <div className="space-y-2">
              <p className={cn("text-sm", variant === "before" ? "font-medium text-muted-foreground/80" : "font-semibold text-foreground text-xs")}>
                {section.title}
              </p>
              <p className={cn(variant === "before" ? "text-xs text-muted-foreground/60" : "text-[11px] text-muted-foreground")}>
                {section.subtitle}
              </p>
              <ul className="space-y-1.5 ml-4">
                {section.bullets.map((bullet, i) => (
                  <li key={i} className={bulletClass(variant)}>
                    {typeof bullet === "string" ? (
                      bullet
                    ) : (
                      <span>
                        {bullet.map((seg, j) =>
                          seg.highlight ? (
                            <span key={j} className={highlightClass(variant)}>{seg.text}</span>
                          ) : (
                            <span key={j}>{seg.text}</span>
                          ),
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.kind === "skills" && (
            <div className="flex flex-wrap gap-1.5">
              {section.items.map((skill) => (
                <span key={skill} className={skillBadgeClass}>{skill}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BeforeAfterComparison() {
  const [isImproved, setIsImproved] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisibleRef = useRef(true)
  const prefersReduced = useReducedMotion()

  // Pause cycling when off-screen
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-toggle with pause and visibility awareness
  const tick = useCallback(() => {
    if (!isPaused && isVisibleRef.current) {
      setIsImproved((prev) => !prev)
    }
  }, [isPaused])

  useEffect(() => {
    if (prefersReduced) return
    const interval = setInterval(tick, TOGGLE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tick, prefersReduced])

  const currentData = isImproved ? AFTER_DATA : BEFORE_DATA
  const transitionDuration = prefersReduced ? 0 : TRANSITION_DURATION_S

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md mx-auto aspect-[3/4] bg-card border rounded-xl overflow-hidden shadow-2xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {/* Status bar */}
      <div className="absolute top-0 left-0 w-full p-4 bg-muted/50 border-b flex justify-between items-center z-10">
        <span className="text-sm font-medium">
          {isImproved ? "Currículo Otimizado" : "Currículo Original"}
        </span>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            currentData.atsStatus.passed ? "text-green-500" : "text-destructive",
          )}
        >
          {currentData.atsStatus.passed ? (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <XCircle className="w-4 h-4" aria-hidden="true" />
          )}
          {currentData.atsStatus.label}
        </span>
      </div>

      {/* Resume content */}
      <div className="pt-16 p-6 h-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={isImproved ? "after" : "before"}
            initial={{ opacity: prefersReduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: prefersReduced ? 1 : 0 }}
            transition={{ duration: transitionDuration }}
          >
            <ResumePreviewCard
              data={currentData}
              variant={isImproved ? "after" : "before"}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scanning effect — hidden when user prefers reduced motion */}
      {!prefersReduced && (
        <motion.div
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{
            duration: SCAN_DURATION_S,
            ease: "linear",
            repeat: Infinity,
          }}
          className="absolute left-0 w-full h-[2px] bg-primary/50 shadow-[0_0_8px_rgba(var(--primary),0.5)] z-20 pointer-events-none"
        />
      )}
    </div>
  )
}
