"use client"

import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useSidebarContext } from "@/context/sidebar-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { PlanSlug } from "@/lib/plans"
import { cn } from "@/lib/utils"

import { DashboardSidebar } from "./sidebar"
import { DashboardWelcomeGuide } from "./welcome-guide"

interface DashboardShellProps {
  children: React.ReactNode
  billingNotice?: string | null
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
  billingNotice,
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
  const pathname = usePathname()
  const isResumeComparisonRoute = pathname?.startsWith("/dashboard/resumes/compare/") === true
    || pathname?.startsWith("/dashboard/resume/compare/") === true
  const showDashboardNavigation = !isResumeComparisonRoute

  return (
    <DashboardWelcomeGuide>
      <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
        {isMobile && showDashboardNavigation ? (
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

        {showDashboardNavigation ? (
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
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {billingNotice ? (
            <div
              data-testid="billing-notice"
              className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
              {billingNotice}
            </div>
          ) : null}

          <main
            className={cn(
              "min-h-0 min-w-0 flex-1",
              showDashboardNavigation
                ? "overflow-auto"
                : "w-full overflow-auto",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </DashboardWelcomeGuide>
  )
}
