"use client"

import { useTheme } from "next-themes"
import { SignedIn, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { Moon, Sun, Menu } from "lucide-react"

interface DashboardNavbarProps {
  pageTitle?: string
  onMenuClick?: () => void
}

export function DashboardNavbar({ pageTitle, onMenuClick }: DashboardNavbarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left side - Logo and page title */}
        <div className="flex items-center gap-4">
          <Logo linkTo="/dashboard" />
          {pageTitle && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-sm font-medium text-muted-foreground">{pageTitle}</span>
            </>
          )}
        </div>

        {/* Right side - Actions */}
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

          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'h-9 w-9',
                },
              }}
            />
          </SignedIn>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
