"use client"

import Link from "next/link"
import { useRef, type MouseEvent } from "react"
import {
  BarChart2,
  Briefcase,
  Code2,
  Database,
  Megaphone,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { allRoleLandingConfigs, type RoleLandingVisualVariant } from "@/lib/seo/role-landing-config"

type RelatedGuide = {
  title: string
  subtitle: string
  href: string
  icon: LucideIcon
  background: string
}

const guideVisualByVariant: Record<
  RoleLandingVisualVariant,
  { icon: LucideIcon; background: string; subtitle: string }
> = {
  default: {
    icon: Briefcase,
    background: "from-slate-950 via-slate-900 to-slate-800",
    subtitle: "Guia ATS por área",
  },
  developer: {
    icon: Code2,
    background: "from-slate-950 via-slate-900 to-slate-800",
    subtitle: "Front-end, Back-end, Full Stack",
  },
  data_analyst: {
    icon: BarChart2,
    background: "from-sky-700 via-cyan-700 to-teal-600",
    subtitle: "SQL, Python, Power BI",
  },
  data_engineer: {
    icon: Database,
    background: "from-cyan-800 via-sky-700 to-blue-700",
    subtitle: "Pipelines, ETL, Data Warehouse",
  },
  marketing: {
    icon: Megaphone,
    background: "from-violet-700 via-fuchsia-700 to-pink-600",
    subtitle: "Performance, SEO, Growth",
  },
  customer_success: {
    icon: Users,
    background: "from-rose-700 via-red-700 to-orange-600",
    subtitle: "Onboarding, Retenção, Expansão",
  },
  product_manager: {
    icon: Briefcase,
    background: "from-amber-600 via-orange-600 to-rose-500",
    subtitle: "Discovery, Roadmap, Métricas",
  },
  sales: {
    icon: TrendingUp,
    background: "from-blue-700 via-indigo-700 to-violet-700",
    subtitle: "Meta, Receita, Conversão",
  },
  finance: {
    icon: Wallet,
    background: "from-emerald-700 via-green-700 to-lime-600",
    subtitle: "Indicadores, Controle, Planejamento",
  },
}

function getRelatedSeoPages(currentSlug: string): RelatedGuide[] {
  return allRoleLandingConfigs
    .filter((entry) => entry.slug !== currentSlug)
    .map((entry) => {
      const visual = guideVisualByVariant[entry.visualVariant ?? "default"]

      return {
        title: entry.roleShort,
        subtitle: visual.subtitle,
        href: `/${entry.slug}`,
        icon: visual.icon,
        background: visual.background,
      }
    })
}

export default function RelatedSeoPagesCarousel({ currentSlug }: { currentSlug: string }) {
  const relatedSeoPages = getRelatedSeoPages(currentSlug)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const movedRef = useRef(false)

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    isDraggingRef.current = true
    movedRef.current = false
    startXRef.current = e.pageX - scrollRef.current.offsetLeft
    scrollLeftRef.current = scrollRef.current.scrollLeft
  }

  const onMouseLeave = () => {
    isDraggingRef.current = false
  }

  const onMouseUp = () => {
    isDraggingRef.current = false
  }

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollRef.current) return
    e.preventDefault()

    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startXRef.current) * 1.2

    if (Math.abs(walk) > 4) {
      movedRef.current = true
    }

    scrollRef.current.scrollLeft = scrollLeftRef.current - walk
  }

  return (
    <section className="pt-10">
      <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.06)] md:p-10">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
            Explore currículos por área
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Guias específicos para diferentes perfis profissionais
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Descubra outras páginas ATS do CurrIA com foco por função, palavras-chave e narrativa profissional.
          </p>
        </div>

        <div className="relative -mx-4 md:-mx-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent md:w-14" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent md:w-14" />

          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="cursor-grab overflow-x-auto px-4 pb-4 select-none touch-pan-y active:cursor-grabbing md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-4 pr-4 md:gap-5 md:pr-6">
              {relatedSeoPages.map((guide, index) => {
                const Icon = guide.icon

                return (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    onClick={(e) => {
                      if (movedRef.current) {
                        e.preventDefault()
                      }
                    }}
                    className={[
                      "group relative shrink-0 overflow-hidden rounded-[24px] border border-white/10 text-white transition-all duration-300 hover:-translate-y-1",
                      index === 0
                        ? "h-[330px] w-[320px] md:h-[380px] md:w-[420px]"
                        : "h-[260px] w-[250px] md:h-[310px] md:w-[280px]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "absolute inset-0 bg-gradient-to-br transition-transform duration-500 group-hover:scale-105",
                        guide.background,
                      ].join(" ")}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

                    <div className="relative flex h-full flex-col justify-between p-5 md:p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-2xl font-semibold">{guide.title}</h3>
                        <p className="mt-2 text-sm text-white/80">{guide.subtitle}</p>

                        <div className="mt-4 text-sm font-medium text-white/90">Ver guia →</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
