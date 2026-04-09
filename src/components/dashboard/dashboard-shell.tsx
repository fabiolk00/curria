"use client"

import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSidebarContext } from "@/context/sidebar-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { PlanSlug } from "@/lib/plans"

import { DashboardSidebar } from "./sidebar"

interface DashboardShellProps {
  children: React.ReactNode
  creditsRemaining?: number
  maxCredits?: number
  renewsIn?: string | null
  currentPlan?: PlanSlug | null
  activeRecurringPlan?: PlanSlug | null
  userDisplayName?: string
  userEmail?: string
  userImageUrl?: string | null
}

export default function DashboardShell({
  children,
  creditsRemaining,
  maxCredits,
  renewsIn,
  currentPlan,
  activeRecurringPlan,
  userDisplayName,
  userEmail,
  userImageUrl,
}: DashboardShellProps) {
  const { openMobile } = useSidebarContext()
  const isMobile = useIsMobile()

  return (
    <div className="flex min-h-screen bg-background md:h-screen md:overflow-hidden">
      {isMobile ? (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-50 rounded-full bg-background/95 shadow-lg backdrop-blur lg:hidden"
          onClick={openMobile}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}

      <DashboardSidebar
        creditsRemaining={creditsRemaining}
        maxCredits={maxCredits}
        renewsIn={renewsIn ?? undefined}
        currentPlan={currentPlan ?? null}
        activeRecurringPlan={activeRecurringPlan ?? null}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userImageUrl={userImageUrl ?? null}
      />

      <main className="h-[calc(107.5svh-4rem)] min-w-0 flex-1 md:overflow-auto">{children}</main>
    </div>
  )
}
