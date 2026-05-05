"use client"

import { UserButton, useAuth } from "@clerk/nextjs"
import {
  BarChart2,
  Briefcase,
  ChevronDown,
  Code2,
  Database,
  Megaphone,
  Menu,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import Logo from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onMenuClick?: () => void
}

type DropdownItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const atsLink = { label: "O que é ATS?", href: "/o-que-e-ats" }
const pricingLink = { label: "Preços", href: "/#pricing" }

const dropdownColumns: Array<{
  title: string
  items: DropdownItem[]
}> = [
  {
    title: "Tech & Data",
    items: [
      {
        label: "Desenvolvedor",
        href: "/curriculo-desenvolvedor-ats",
        icon: Code2,
        description: "Front-end, Back-end, Full Stack",
      },
      {
        label: "Analista de Dados",
        href: "/curriculo-analista-dados-ats",
        icon: BarChart2,
        description: "SQL, Python, Power BI",
      },
      {
        label: "Engenheiro de Dados",
        href: "/curriculo-engenheiro-de-dados-ats",
        icon: Database,
        description: "Pipelines, ETL, Data Warehouse",
      },
      {
        label: "Product Manager",
        href: "/curriculo-product-manager-ats",
        icon: Briefcase,
        description: "Discovery, Roadmap, Métricas",
      },
    ],
  },
  {
    title: "Business & Growth",
    items: [
      {
        label: "Marketing",
        href: "/curriculo-marketing-ats",
        icon: Megaphone,
        description: "Performance, SEO, Growth",
      },
      {
        label: "Vendas",
        href: "/curriculo-vendas-ats",
        icon: TrendingUp,
        description: "Meta, Receita, Conversão",
      },
      {
        label: "Customer Success",
        href: "/curriculo-customer-success-ats",
        icon: Users,
        description: "Onboarding, Retenção, Expansão",
      },
      {
        label: "Financeiro",
        href: "/curriculo-financeiro-ats",
        icon: Wallet,
        description: "Controle, Indicadores, Gestão",
      },
    ],
  },
] as const

const mobileDropdownItems = dropdownColumns.flatMap((column) => column.items)

export default function Header({ onMenuClick }: HeaderProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const showAuthButtons = !isLoaded || !isSignedIn
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileAreasOpen, setMobileAreasOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const closeMobileMenu = () => {
    setMobileAreasOpen(false)
    setMobileOpen(false)
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4">
      <header
        className={cn(
          "w-full max-w-5xl rounded-2xl border border-border/50 bg-white/80 backdrop-blur-xl transition-all duration-300",
          scrolled
            ? "border-border/60 bg-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
            : "shadow-[0_2px_16px_rgba(0,0,0,0.06)]",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 md:h-[72px] md:px-6">
          <div className="flex min-w-0 items-center gap-6 lg:gap-8">
            <Logo variant="navbar" className="shrink-0" />

            <nav className="hidden min-w-0 items-center gap-1 lg:flex">
              <Link
                href={atsLink.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
              >
                {atsLink.label}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted/60 hover:text-foreground">
                  Currículos por área
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={12}
                  className="w-[720px] rounded-3xl border border-border/60 bg-white/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-xl"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {dropdownColumns.map((column) => (
                      <div
                        key={column.title}
                        className="rounded-2xl border border-border/40 bg-muted/20 p-3"
                      >
                        <div className="mb-2 px-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                            {column.title}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {column.items.map((item) => (
                            <DropdownMenuItem
                              key={item.href}
                              asChild
                              className="rounded-2xl p-0 focus:bg-transparent"
                            >
                              <Link
                                href={item.href}
                                className="group flex min-h-[68px] cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200 hover:bg-white hover:shadow-sm"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                                  <item.icon className="h-4.5 w-4.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link
                href={pricingLink.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
              >
                {pricingLink.label}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            {showAuthButtons ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 hover:text-foreground lg:flex"
                >
                  <Link href="/entrar">Entrar</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="hidden rounded-xl px-4 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:inline-flex"
                >
                  <Link href="/criar-conta">Criar conta</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-xl px-3 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:hidden"
                >
                  <Link href="/criar-conta" data-testid="mobile-signup-link">
                    Criar conta
                  </Link>
                </Button>
              </>
            ) : null}

            {isLoaded && isSignedIn ? (
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: "h-8 w-8" } }}
              />
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              className="ml-1 rounded-xl lg:hidden"
              onClick={() => {
                onMenuClick?.()
                setMobileOpen((value) => {
                  const next = !value
                  if (!next) {
                    setMobileAreasOpen(false)
                  }
                  return next
                })
              }}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border/40 px-4 pb-4 pt-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              <Link
                href={atsLink.href}
                onClick={closeMobileMenu}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {atsLink.label}
              </Link>

              <button
                type="button"
                onClick={() => setMobileAreasOpen((value) => !value)}
                className="mt-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                <span>Currículos por área</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    mobileAreasOpen && "rotate-180",
                  )}
                />
              </button>

              {mobileAreasOpen ? (
                <div className="mt-1 flex flex-col gap-1">
                  {mobileDropdownItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              <Link
                href={pricingLink.href}
                onClick={closeMobileMenu}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {pricingLink.label}
              </Link>

              {showAuthButtons ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
                  <Button asChild variant="outline" className="w-full rounded-xl text-foreground">
                    <Link href="/entrar" onClick={closeMobileMenu}>
                      Entrar
                    </Link>
                  </Button>
                  <Button asChild className="w-full rounded-xl">
                    <Link href="/criar-conta" onClick={closeMobileMenu}>
                      Criar conta
                    </Link>
                  </Button>
                </div>
              ) : null}
            </nav>
          </div>
        ) : null}
      </header>
    </div>
  )
}
