"use client"

import Link from "next/link"
import { UserButton, useAuth } from "@clerk/nextjs"
import { Menu, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import Logo from "@/components/logo"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { isLoaded, isSignedIn } = useAuth()
  const showAuthButtons = !isLoaded || !isSignedIn

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          {onMenuClick && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/what-is-ats"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              O que é o ATS?
            </Link>
            <a
              href="/#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Preços
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {showAuthButtons ? (
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link href="/login">Entrar</Link>
            </Button>
          ) : null}
          {showAuthButtons ? (
            <Button asChild>
              <Link href="/signup">Criar conta</Link>
            </Button>
          ) : null}

          {isLoaded && isSignedIn ? (
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
