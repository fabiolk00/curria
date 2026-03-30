"use client"

import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { Moon, Sun } from "lucide-react"

export default function Header() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Como funciona
            </Link>
            <Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </Link>
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

          <SignedOut>
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Criar conta</Link>
            </Button>
          </SignedOut>

          <SignedIn>
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'h-9 w-9',
                },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </header>
  )
}
