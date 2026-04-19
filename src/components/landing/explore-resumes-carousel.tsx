"use client"

import Link from "next/link"
import { useRef } from "react"
import {
  BarChart2,
  Briefcase,
  Code2,
  Database,
  Megaphone,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

const resumeGuides = [
  {
    title: "Desenvolvedor",
    subtitle: "Front-end, Back-end, Full Stack",
    href: "/curriculo-desenvolvedor-ats",
    icon: Code2,
    featured: true,
    background: "from-slate-950 via-slate-900 to-slate-800",
  },
  {
    title: "Marketing",
    subtitle: "Performance, SEO, Growth",
    href: "/curriculo-marketing-ats",
    icon: Megaphone,
    background: "from-violet-700 via-fuchsia-700 to-pink-600",
  },
  {
    title: "Analista de Dados",
    subtitle: "SQL, Python, Power BI",
    href: "/curriculo-analista-dados-ats",
    icon: BarChart2,
    background: "from-sky-700 via-cyan-700 to-teal-600",
  },
  {
    title: "Engenheiro de Dados",
    subtitle: "Pipelines, ETL, Data Warehouse",
    href: "/curriculo-engenheiro-de-dados-ats",
    icon: Database,
    background: "from-cyan-800 via-sky-700 to-blue-700",
  },
  {
    title: "Product Manager",
    subtitle: "Discovery, Roadmap, Métricas",
    href: "/curriculo-product-manager-ats",
    icon: Briefcase,
    background: "from-amber-600 via-orange-600 to-rose-500",
  },
  {
    title: "Analista Financeiro",
    subtitle: "Indicadores, Controle, Planejamento",
    href: "/curriculo-financeiro-ats",
    icon: Wallet,
    background: "from-emerald-700 via-green-700 to-lime-600",
  },
  {
    title: "Vendas",
    subtitle: "Meta, Receita, Conversão",
    href: "/curriculo-vendas-ats",
    icon: TrendingUp,
    background: "from-blue-700 via-indigo-700 to-violet-700",
  },
  {
    title: "Customer Success",
    subtitle: "Onboarding, Retenção, Expansão",
    href: "/curriculo-customer-success-ats",
    icon: Users,
    background: "from-rose-700 via-red-700 to-orange-600",
  },
]

export default function ExploreResumesCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const movedRef = useRef(false)

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
    <section className="overflow-hidden py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
            Explore currículos por área
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Guias específicos para diferentes perfis profissionais
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Descubra exemplos, palavras-chave e ajustes práticos para montar um currículo mais forte para a sua área.
          </p>
        </div>

        <div className="relative -mx-4 md:-mx-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent md:w-14" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent md:w-14" />

          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="overflow-x-auto px-4 pb-4 md:px-6 cursor-grab active:cursor-grabbing select-none touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-4 md:gap-5 pr-4 md:pr-6">
              {resumeGuides.map((guide) => {
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
                      guide.featured
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
                        <h3 className="text-2xl font-semibold">
                          {guide.title}
                        </h3>
                        <p className="mt-2 text-sm text-white/80">
                          {guide.subtitle}
                        </p>

                        <div className="mt-4 text-sm font-medium text-white/90">
                          Ver guia →
                        </div>
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
