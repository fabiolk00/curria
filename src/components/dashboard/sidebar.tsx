"use client"

import { useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import { AnimatePresence, motion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  MessageSquare,
  PanelLeft,
  Plus,
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
import { cn } from "@/lib/utils"
import { NEW_CONVERSATION_EVENT } from "./events"

const EXPANDED_WIDTH = 240
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

type ProfileResponse = {
  profile: {
    profilePhotoUrl: string | null
  } | null
}

const navItems: NavItem[] = [
  {
    label: "Perfil",
    href: "/dashboard/resumes/new",
    icon: User,
    isActive: (pathname) =>
      pathname === "/dashboard/resumes/new" ||
      pathname.startsWith("/dashboard/resumes/new/") ||
      pathname === "/profile" ||
      pathname.startsWith("/profile/"),
  },
  {
    label: "Sessões",
    href: "/dashboard/sessions",
    icon: MessageSquare,
    isActive: (pathname) => pathname === "/dashboard/sessions",
  },
]

function getShortcutLabel(): string {
  if (typeof window !== "undefined" && /(Mac|iPhone|iPad|iPod)/i.test(window.navigator.platform)) {
    return "⌘B"
  }

  return "Ctrl+B"
}

function getInitials(fullName?: string | null, email?: string | null): string {
  const source = fullName?.trim() || email?.trim() || "Usuário"
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "U"
}

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

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
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

  if (!isOpen && !isMobile) {
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
  onToggle,
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
  onToggle: () => void
  onCloseMobile?: () => void
}) {
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const router = useRouter()
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
  const initials = getInitials(displayName, email)
  const currentCredits = creditsRemaining ?? 0
  const planLabel = currentPlan ? `Plano ${PLANS[currentPlan].name}` : "Plano indisponível"
  const avatarSrc = profilePhotoUrl ?? userImageUrl ?? user?.imageUrl ?? undefined
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+B")

  useEffect(() => {
    let isMounted = true

    const loadProfilePhoto = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as ProfileResponse
        if (!isMounted) {
          return
        }

        setProfilePhotoUrl(data.profile?.profilePhotoUrl ?? null)
      } catch {
        if (isMounted) {
          setProfilePhotoUrl(null)
        }
      }
    }

    void loadProfilePhoto()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setShortcutLabel(getShortcutLabel())
  }, [])

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

  const brand = isOpen || isMobile ? (
    <Logo size="sm" linkTo="/dashboard" />
  ) : (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Expandir sidebar"
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition-colors hover:bg-sidebar-accent/60"
    >
      <PanelLeft className="h-4 w-4 text-sidebar-foreground/75" strokeWidth={1.75} />
    </button>
  )

  const accountTrigger = (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-xl text-left transition-colors hover:bg-sidebar-accent/60",
        isOpen || isMobile ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2",
      )}
    >
      <Avatar className="h-9 w-9 border border-border/60">
        <AvatarImage src={avatarSrc} alt={displayName} />
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

  return (
    <>
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "flex items-center border-b border-border",
            isOpen || isMobile ? "justify-between px-3 py-4" : "justify-center px-2 py-4",
          )}
        >
          {brand}
          <div className={cn("flex items-center gap-1", !isOpen && !isMobile && "flex-col")}>
            {isMobile ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseMobile}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </Button>
            ) : isOpen ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggle}
                    aria-label={isOpen ? "Recolher sidebar" : "Expandir sidebar"}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition-colors hover:bg-sidebar-accent/60"
                  >
                    {isOpen ? <ChevronLeft className="h-4 w-4 text-sidebar-foreground/75" strokeWidth={1.75} /> : <ChevronRight className="h-4 w-4 text-sidebar-foreground/75" strokeWidth={1.75} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isOpen ? "Recolher sidebar" : "Expandir sidebar"} • {shortcutLabel}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
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
                    : item.label === "Sessões"
                      ? dashboardWelcomeGuideTargets.sessionsNav
                      : undefined
                }
              />
            ))}
          </nav>

          {/* Nova Conversa Button */}
          <div className="border-t border-border/30 mt-2 pt-2">
            <button
              onClick={() => {
                window.dispatchEvent(new Event(NEW_CONVERSATION_EVENT))
                router.replace("/dashboard")
                onCloseMobile?.()
              }}
              {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.newConversation)}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors w-full',
                isOpen || isMobile
                  ? 'gap-3 px-3 py-2 hover:bg-sidebar-accent/50'
                  : 'h-10 justify-center px-0 py-0 hover:bg-sidebar-accent/50',
                'text-sidebar-foreground/70 hover:text-sidebar-foreground',
              )}
              title="Nova conversa"
            >
              <Plus className="h-4 w-4 shrink-0 text-sidebar-foreground/75" strokeWidth={1.75} />
              {isOpen || isMobile ? <span>Nova Conversa</span> : null}
            </button>
          </div>

          <SessionDocumentsPanel isSidebarOpen={isOpen || isMobile} />
        </ScrollArea>

        <div className="mt-auto border-t border-border px-2 py-4">
          {hasBillingData ? (
            <div className={cn("mb-4 space-y-2", isOpen || isMobile ? "px-3" : "px-1")}>
              <div className={cn("flex items-center", isOpen || isMobile ? "justify-between" : "justify-center")}>
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
              {(isOpen || isMobile) ? (
                <>
                  <Progress value={percentage} className="h-2" />
                  {renewsIn ? (
                    <p className="text-center text-[10px] text-muted-foreground">Reseta em {renewsIn}</p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {!isOpen && !isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>{accountTrigger}</TooltipTrigger>
                  <TooltipContent side="right">{displayName}</TooltipContent>
                </Tooltip>
              ) : (
                accountTrigger
              )}
            </DropdownMenuTrigger>
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
  const {
    isOpen,
    isMounted,
    isMobileOpen,
    toggle,
    closeMobile,
  } = useSidebarContext()

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
            onToggle={toggle}
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
    return <div style={{ width: EXPANDED_WIDTH }} className="h-screen shrink-0 border-r border-border bg-sidebar" />
  }

  return (
    <motion.aside
      animate={{ width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative h-screen shrink-0 overflow-hidden border-r border-border bg-sidebar"
    >
      <SidebarContent
        isOpen={isOpen}
        isMobile={false}
        onToggle={toggle}
        creditsRemaining={creditsRemaining}
        maxCredits={maxCredits}
        renewsIn={renewsIn}
        currentPlan={currentPlan}
        activeRecurringPlan={activeRecurringPlan}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userImageUrl={userImageUrl}
      />
    </motion.aside>
  )
}
