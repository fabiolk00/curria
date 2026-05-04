"use client"

import { useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import { AnimatePresence, motion } from "motion/react"
import {
  FileText,
  HelpCircle,
  LogOut,
  Settings,
  Sparkles,
  User,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { SessionDocumentsPanel } from "@/components/dashboard/session-documents-panel"
import { PlanUpdateDialog } from "@/components/dashboard/plan-update-dialog"
import Logo from "@/components/logo"
import { SiteFaviconIcon } from "@/components/site-favicon-icon"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarContext } from "@/context/sidebar-context"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  dashboardWelcomeGuideTargets,
  getDashboardGuideTargetProps,
  type DashboardWelcomeGuideTargetId,
} from "@/lib/dashboard/welcome-guide"
import { PLANS, PlanSlug } from "@/lib/plans"
import {
  DASHBOARD_RESUMES_HISTORY_PATH,
  GENERATE_RESUME_PATH,
  PROFILE_SETUP_PATH,
} from "@/lib/routes/app"
import { startNavigationFeedback } from "@/lib/navigation/feedback"
import { getFallbackInitials } from "@/lib/user/display-name"
import { cn } from "@/lib/utils"

const COLLAPSED_WIDTH = 56

interface DashboardSidebarProps {
  creditsRemaining?: number
  maxCredits?: number
  renewsIn?: string
  currentPlan?: PlanSlug | null
  activeRecurringPlan?: PlanSlug | null
  userDisplayName?: string
  userEmail?: string
  userImageUrl?: string | null
}

type NavItem = {
  label: string
  href: string
  icon: typeof User
  isActive: (pathname: string) => boolean
}

const navItems: NavItem[] = [
  {
    label: "Perfil",
    href: PROFILE_SETUP_PATH,
    icon: User,
    isActive: (pathname) =>
      pathname === PROFILE_SETUP_PATH
      || pathname.startsWith(`${PROFILE_SETUP_PATH}/`)
      || pathname === "/profile"
      || pathname.startsWith("/profile/"),
  },
  {
    label: "Currículos",
    href: DASHBOARD_RESUMES_HISTORY_PATH,
    icon: FileText,
    isActive: (pathname) => pathname === DASHBOARD_RESUMES_HISTORY_PATH,
  },
]

function SidebarNavItem({
  item,
  isOpen,
  isMobile,
  onNavigate,
  guideTargetId,
}: {
  item: NavItem
  isOpen: boolean
  isMobile: boolean
  onNavigate?: () => void
  guideTargetId?: DashboardWelcomeGuideTargetId
}) {
  const pathname = usePathname()
  const isActive = item.isActive(pathname)
  const isCollapsedDesktop = !isOpen && !isMobile

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={isCollapsedDesktop ? item.label : undefined}
      {...(guideTargetId ? getDashboardGuideTargetProps(guideTargetId) : {})}
      className={cn(
        "flex items-center rounded-lg text-sm font-medium transition-colors",
        isOpen || isMobile
          ? "gap-3 px-3 py-2"
          : "h-10 w-10 justify-center px-0 py-0",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/75" strokeWidth={1.75} />
      <AnimatePresence initial={false}>
        {isOpen || isMobile ? (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Link>
  )

  if (isCollapsedDesktop) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function SidebarContent({
  isOpen,
  isMobile,
  onCloseMobile,
  creditsRemaining,
  maxCredits,
  renewsIn,
  currentPlan,
  activeRecurringPlan,
  userDisplayName,
  userEmail,
  userImageUrl,
}: DashboardSidebarProps & {
  isOpen: boolean
  isMobile: boolean
  onCloseMobile?: () => void
}) {
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(userImageUrl ?? null)
  const router = useRouter()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const hasBillingData = maxCredits !== undefined && creditsRemaining !== undefined
  const percentage =
    hasBillingData && maxCredits > 0 ? (creditsRemaining / maxCredits) * 100 : 0
  const displayName =
    userDisplayName
    || user?.fullName?.trim()
    || user?.firstName?.trim()
    || user?.username
    || "Conta CurrIA"
  const email = userEmail || user?.primaryEmailAddress?.emailAddress || ""
  const initials = getFallbackInitials(displayName, email)
  const currentCredits = creditsRemaining ?? 0
  const planLabel = currentPlan ? `Plano ${PLANS[currentPlan].name}` : "Plano indisponível"
  const avatarSrc = profilePhotoUrl ?? userImageUrl ?? user?.imageUrl ?? undefined
  const isCollapsedDesktop = !isOpen && !isMobile
  const isGenerateResumeActive =
    pathname === GENERATE_RESUME_PATH || pathname.startsWith(`${GENERATE_RESUME_PATH}/`)

  useEffect(() => {
    let isActive = true
    const loadProfilePhoto = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as {
          profile: {
            profilePhotoUrl: string | null
          } | null
        }
        const nextProfilePhotoUrl = data.profile?.profilePhotoUrl ?? null
        if (!isActive || nextProfilePhotoUrl === null) {
          return
        }
        if (nextProfilePhotoUrl === profilePhotoUrl) {
          return
        }

        const preloadImage = new Image()
        preloadImage.onload = () => {
          if (isActive) {
            setProfilePhotoUrl(nextProfilePhotoUrl)
          }
        }
        preloadImage.src = nextProfilePhotoUrl
      } catch {
        return
      }
    }

    void loadProfilePhoto()

    return () => {
      isActive = false
    }
  }, [profilePhotoUrl])

  const handleSignOut = async (): Promise<void> => {
    onCloseMobile?.()

    try {
      await signOut()
      router.push("/")
      router.refresh()
    } catch {
      window.location.assign("/")
    }
  }

  const handleNewResume = () => {
    startNavigationFeedback()
    router.push(GENERATE_RESUME_PATH)
    onCloseMobile?.()
  }

  const accountTrigger = (
    <button
      type="button"
      aria-label={isCollapsedDesktop ? "Abrir menu da conta" : undefined}
      className={cn(
        "flex items-center text-left transition-colors",
        isOpen || isMobile
          ? "w-full gap-3 rounded-xl px-3 py-2.5 hover:bg-sidebar-accent/60"
          : "h-10 w-10 justify-center rounded-lg px-0 py-0 text-sidebar-foreground/70",
      )}
    >
      <Avatar className="h-9 w-9 border border-border/60">
        <AvatarImage className="object-cover" src={avatarSrc} alt={displayName} />
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <AnimatePresence initial={false}>
        {isOpen || isMobile ? (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="min-w-0 flex-1 overflow-hidden"
          >
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{planLabel}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {isOpen || isMobile ? <Settings className="h-4 w-4 text-sidebar-foreground/60" /> : null}
    </button>
  )

  const newResumeButton = (
    <button
      type="button"
      onClick={handleNewResume}
      aria-label="Gerar currículo"
      {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.generateResumeNav)}
      className={cn(
        "flex items-center rounded-lg text-sm font-medium transition-colors",
        isOpen || isMobile
          ? "w-full gap-3 px-3 py-2"
          : "h-10 w-10 justify-center px-0 py-0",
        isGenerateResumeActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-sidebar-foreground/75" strokeWidth={1.75} />
      {isOpen || isMobile ? <span>Gerar currículo</span> : null}
    </button>
  )

  return (
    <>
      <div className="flex h-full flex-col">
        {isMobile ? (
          <div className="flex items-center justify-between border-b border-border px-3 py-4">
            <Logo size="sm" linkTo={PROFILE_SETUP_PATH} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : null}

        <ScrollArea className={cn("flex-1 px-2 pb-4", isMobile ? "pt-4" : "pt-3")}>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isOpen={isOpen}
                isMobile={isMobile}
                onNavigate={onCloseMobile}
                guideTargetId={
                  item.label === "Perfil"
                    ? dashboardWelcomeGuideTargets.profileNav
                    : item.label === "Currículos"
                      ? dashboardWelcomeGuideTargets.resumesNav
                      : undefined
                }
              />
            ))}
          </nav>

          <div className="mt-2 border-t border-border/30 pt-2">
            {isCollapsedDesktop ? (
              <Tooltip>
                <TooltipTrigger asChild>{newResumeButton}</TooltipTrigger>
                <TooltipContent side="right">Gerar currículo</TooltipContent>
              </Tooltip>
            ) : (
              newResumeButton
            )}
          </div>

          <SessionDocumentsPanel isSidebarOpen={isOpen || isMobile} />
        </ScrollArea>

        <div className="mt-auto border-t border-border px-2 py-4">
          {hasBillingData ? (
            <div className={cn("mb-4 space-y-2", isOpen || isMobile ? "px-3" : "px-1")}>
              <div
                className={cn(
                  "flex items-center",
                  isOpen || isMobile ? "justify-between" : "justify-center",
                )}
              >
                {isOpen || isMobile ? (
                  <>
                    <div className="flex items-center gap-2 text-primary">
                      <SiteFaviconIcon className="h-4 w-4 shadow-sm" />
                      <span className="text-sm font-medium">Créditos</span>
                    </div>
                    <span className="text-xs font-bold">
                      {creditsRemaining} / {maxCredits}
                    </span>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground">
                        <SiteFaviconIcon className="h-4 w-4 shadow-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Créditos: {creditsRemaining} / {maxCredits}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {isOpen || isMobile ? (
                <>
                  <Progress value={percentage} className="h-2" />
                  {renewsIn ? (
                    <p className="text-center text-[10px] text-muted-foreground">
                      Reseta em {renewsIn}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>{accountTrigger}</DropdownMenuTrigger>
            <DropdownMenuContent
              align={isOpen || isMobile ? "end" : "center"}
              side={isOpen || isMobile ? "top" : "right"}
              className="w-56"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{planLabel}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onCloseMobile?.()
                  setIsPlanDialogOpen(true)
                }}
              >
                <Sparkles className="h-4 w-4" />
                Ver planos
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" onClick={onCloseMobile}>
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/o-que-e-ats" onClick={onCloseMobile}>
                  <HelpCircle className="h-4 w-4" />
                  O que é ATS?
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault()
                  void handleSignOut()
                }}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PlanUpdateDialog
        isOpen={isPlanDialogOpen}
        onOpenChange={setIsPlanDialogOpen}
        activeRecurringPlan={activeRecurringPlan ?? null}
        currentCredits={currentCredits}
      />
    </>
  )
}

export function DashboardSidebar({
  creditsRemaining,
  maxCredits,
  renewsIn,
  currentPlan,
  activeRecurringPlan,
  userDisplayName,
  userEmail,
  userImageUrl,
}: DashboardSidebarProps) {
  const isMobile = useIsMobile()
  const { isMounted, isMobileOpen, closeMobile } = useSidebarContext()

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={(open) => !open && closeMobile()}>
        <SheetContent side="left" className="w-[240px] p-0 sm:max-w-[240px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          <SidebarContent
            isOpen
            isMobile
            onCloseMobile={closeMobile}
            creditsRemaining={creditsRemaining}
            maxCredits={maxCredits}
            renewsIn={renewsIn}
            currentPlan={currentPlan}
            activeRecurringPlan={activeRecurringPlan}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userImageUrl={userImageUrl}
          />
        </SheetContent>
      </Sheet>
    )
  }

  if (!isMounted) {
    return (
      <div
        style={{ width: COLLAPSED_WIDTH }}
        className="h-screen shrink-0 border-r border-border bg-sidebar"
      />
    )
  }

  return (
    <aside
      style={{ width: COLLAPSED_WIDTH }}
      className="relative h-screen shrink-0 overflow-hidden border-r border-border bg-sidebar"
    >
      <SidebarContent
        isOpen={false}
        isMobile={false}
        creditsRemaining={creditsRemaining}
        maxCredits={maxCredits}
        renewsIn={renewsIn}
        currentPlan={currentPlan}
        activeRecurringPlan={activeRecurringPlan}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userImageUrl={userImageUrl}
      />
    </aside>
  )
}
