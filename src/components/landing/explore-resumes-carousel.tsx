"use client"

import Link from "next/link"
import { useRef } from "react"
import {
  BarChart2,
  Briefcase,
  Code2,
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

  let isDown = false
  let startX = 0
  let scrollLeft = 0

  const onMouseDown = (e: React.MouseEvent) => {
    isDown = true
    startX = e.pageX - (scrollRef.current?.offsetLeft || 0)
    scrollLeft = scrollRef.current?.scrollLeft || 0
  }

  const onMouseLeave = () => {
    isDown = false
  }

  const onMouseUp = () => {
    isDown = false
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX) * 1.2
    scrollRef.current.scrollLeft = scrollLeft - walk
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

        <div className="relative">
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="flex w-max cursor-grab gap-4 overflow-x-auto pb-4 pr-16 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {resumeGuides.map((guide) => {
              const Icon = guide.icon

              return (
                <Link
                  key={guide.href}
                  href={guide.href}
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
    </section>
  )
}
