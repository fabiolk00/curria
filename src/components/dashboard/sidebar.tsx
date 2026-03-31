"use client"

import { useClerk } from "@clerk/nextjs"
import { Coins, FileText, LogOut, MessageSquare, Settings, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
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
]

const bottomItems = [
  {
    label: "Configuracoes",
    href: "/settings",
    icon: Settings,
  },
]

export function DashboardSidebar({
  isOpen,
  onClose,
  creditsRemaining,
  maxCredits,
  renewsIn,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const hasBillingData = maxCredits !== undefined && creditsRemaining !== undefined
  const percentage =
    hasBillingData && maxCredits > 0 ? (creditsRemaining / maxCredits) * 100 : 0

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="text-sm font-medium text-sidebar-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
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

          <nav className="space-y-1">
            {bottomItems.map((item) => {
              const isActive = pathname === item.href
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
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </nav>
        </div>
      </div>
    </aside>
  )
}
