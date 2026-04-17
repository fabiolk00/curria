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
    title: "Analista de Dados",
    subtitle: "SQL, Python, Power BI",
    href: "/curriculo-analista-dados-ats",
    icon: BarChart2,
    featured: true,
    background: "from-sky-800 via-cyan-700 to-teal-600",
  },
  {
    title: "Engenharia de Dados",
    subtitle: "ETL, pipelines, warehouse",
    href: "/curriculo-engenheiro-de-dados-ats",
    icon: Database,
    featured: true,
    background: "from-cyan-950 via-sky-900 to-cyan-700",
  },
  {
    title: "Marketing",
    subtitle: "Performance, SEO, Growth",
    href: "/curriculo-marketing-ats",
    icon: Megaphone,
    background: "from-violet-700 via-fuchsia-700 to-pink-600",
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
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <div className="mb-10 grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div className="max-w-2xl">
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
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:justify-self-end md:text-base">
            A navegação agora entra com mais escala e mais presença visual, usando melhor a largura da tela em vez de parecer um carrossel comprimido.
          </p>
        </div>

        <div className="relative -mx-4 md:-mx-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent md:w-14" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent md:w-14" />

          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="cursor-grab overflow-x-auto px-4 pb-4 select-none touch-pan-y active:cursor-grabbing md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-4 pr-4 md:gap-6 md:pr-8">
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
                      "group relative shrink-0 overflow-hidden rounded-[28px] border border-white/10 text-white transition-all duration-300 hover:-translate-y-1",
                      guide.featured ? "w-[332px] md:w-[392px]" : "w-[300px] md:w-[340px]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "absolute inset-0 bg-gradient-to-br transition-transform duration-500 group-hover:scale-105",
                        guide.background,
                      ].join(" ")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                    <div className="relative flex min-h-[470px] flex-col justify-between p-5 md:min-h-[560px] md:p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-2xl font-semibold md:text-[2rem] md:leading-[1.02]">
                          {guide.title}
                        </h3>
                        <p className="mt-2 text-base text-white/80">
                          {guide.subtitle}
                        </p>

                        <div className="mt-5 text-base font-medium text-white/90">
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
