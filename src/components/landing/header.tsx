"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { UserButton, useAuth } from "@clerk/nextjs"
import { Menu, ChevronDown, X, Code2, BarChart2, Megaphone } from "lucide-react"

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

const navLinks = [
  { label: "O que é o ATS?", href: "/what-is-ats" },
  { label: "Preços", href: "/#pricing" },
]

const dropdownItems = [
  {
    label: "Desenvolvedor de Software",
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
    label: "Marketing",
    href: "/curriculo-marketing-ats",
    icon: Megaphone,
    description: "Performance, SEO, Growth",
  },
]

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
      {/* Floating pill */}
      <header
        className={cn(
          "w-full max-w-5xl rounded-2xl border border-border/50 bg-white/80 backdrop-blur-xl transition-all duration-300",
          scrolled
            ? "shadow-[0_8px_32px_rgba(0,0,0,0.10)] border-border/60 bg-white/90"
            : "shadow-[0_2px_16px_rgba(0,0,0,0.06)]",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 md:px-5">

          {/* Left: Logo + nav */}
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

              {/* Dropdown — Currículos por Área */}
              <DropdownMenu>
                <DropdownMenuTrigger className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted/60 hover:text-foreground">
                  Currículos por Área
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={10}
                  className="w-64 rounded-2xl border border-border/60 bg-white/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl"
                >
                  {dropdownItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild className="rounded-xl p-0 focus:bg-transparent">
                      <Link
                        href={item.href}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-muted/60"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          {/* Right: CTAs */}
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

            {/* Mobile menu toggle */}
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

        {/* Mobile menu */}
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
              {dropdownItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  {item.label}
                </Link>
              ))}
              {showAuthButtons && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
                  <Button asChild variant="outline" className="w-full rounded-xl">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>Entrar</Link>
                  </Button>
                  <Button asChild className="w-full rounded-xl">
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>Criar conta</Link>
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
