"use client"

import { useClerk, useUser } from "@clerk/nextjs"
import {
  Coins,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import Logo from "@/components/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface DashboardSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  creditsRemaining?: number
  maxCredits?: number
  renewsIn?: string
}

const navItems = [
  {
    label: "Chat",
    href: "/dashboard",
    icon: MessageSquare,
  },
  {
    label: "Meus Curriculos",
    href: "/dashboard/resumes",
    icon: FileText,
  },
  {
    label: "O que e ATS?",
    href: "/what-is-ats",
    icon: HelpCircle,
  },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function getInitials(fullName?: string | null, email?: string | null): string {
  const source = fullName?.trim() || email?.trim() || "Usuario"
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "U"
}

export function DashboardSidebar({
  isOpen,
  onClose,
  creditsRemaining,
  maxCredits,
  renewsIn,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const hasBillingData = maxCredits !== undefined && creditsRemaining !== undefined
  const percentage =
    hasBillingData && maxCredits > 0 ? (creditsRemaining / maxCredits) * 100 : 0
  const displayName =
    user?.fullName?.trim() || user?.firstName?.trim() || user?.username || "Conta CurrIA"
  const email = user?.primaryEmailAddress?.emailAddress || ""
  const initials = getInitials(displayName, email)
  const handleSignOut = (): void => {
    onClose?.()
    void signOut({ redirectUrl: "/" })
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Logo size="sm" linkTo="/dashboard" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        <div className="mt-auto border-t border-border px-3 py-4">
          {hasBillingData ? (
            <div className="mb-4 space-y-2 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Creditos</span>
                </div>
                <span className="text-xs font-bold">
                  {creditsRemaining} / {maxCredits}
                </span>
              </div>
              <Progress value={percentage} className="h-2" />
              {renewsIn && (
                <p className="text-center text-[10px] text-muted-foreground">Reseta em {renewsIn}</p>
              )}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/60"
              >
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarImage src={user?.imageUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/60">
                    {email || "Area autenticada"}
                  </p>
                </div>
                <Settings className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                {email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/pricing" onClick={onClose}>
                  <Sparkles className="h-4 w-4" />
                  Ver planos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" onClick={onClose}>
                  <Settings className="h-4 w-4" />
                  Configuracoes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/what-is-ats" onClick={onClose}>
                  <HelpCircle className="h-4 w-4" />
                  O que e ATS?
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}
