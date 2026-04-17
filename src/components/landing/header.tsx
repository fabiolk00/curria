"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { UserButton, useAuth } from "@clerk/nextjs"
import {
  Menu,
  ChevronDown,
  X,
  Code2,
  BarChart2,
  Megaphone,
  Briefcase,
  TrendingUp,
  Users,
  Wallet,
  Database,
} from "lucide-react"

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

const navLinks = [
  { label: "O que é o ATS?", href: "/what-is-ats" },
  { label: "Preços", href: "/#pricing" },
]

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
]

const mobileDropdownItems = dropdownColumns.flatMap((column) => column.items)

export default function Header({ onMenuClick }: HeaderProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const showAuthButtons = !isLoaded || !isSignedIn
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <header
        className={cn(
          "w-full max-w-5xl rounded-2xl border border-border/50 bg-white/80 backdrop-blur-xl transition-all duration-300",
          scrolled
            ? "shadow-[0_8px_32px_rgba(0,0,0,0.10)] border-border/60 bg-white/90"
            : "shadow-[0_2px_16px_rgba(0,0,0,0.06)]",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 md:px-5">
          <div className="flex items-center gap-7">
            <Logo />

            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted/60 hover:text-foreground">
                  Currículos por Área
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
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            {showAuthButtons && (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:flex"
                >
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-xl px-4 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link href="/signup">Criar conta</Link>
                </Button>
              </>
            )}

            {isLoaded && isSignedIn && (
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: "h-8 w-8" } }}
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="ml-1 rounded-xl md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border/40 px-4 pb-4 pt-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <p className="mt-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                Currículos por Área
              </p>
              {mobileDropdownItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </Link>
              ))}
              {showAuthButtons && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
                  <Button asChild variant="outline" className="w-full rounded-xl">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Entrar
                    </Link>
                  </Button>
                  <Button asChild className="w-full rounded-xl">
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>
                      Criar conta
                    </Link>
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </div>
  )
}
