"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"

import { useSidebarContext } from "@/context/sidebar-context"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
  DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH,
  DASHBOARD_WELCOME_GUIDE_RESUMES_PATH,
  DASHBOARD_WELCOME_GUIDE_TARGET_ATTR,
  dashboardWelcomeGuideSteps,
  type DashboardWelcomeGuideStepDefinition,
} from "@/lib/dashboard/welcome-guide"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
  radius: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getTargetElement(step: DashboardWelcomeGuideStepDefinition): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${DASHBOARD_WELCOME_GUIDE_TARGET_ATTR}="${step.targetId}"]`,
  )
}

function measureTarget(element: HTMLElement): SpotlightRect {
  const rect = element.getBoundingClientRect()
  const computedRadius = Number.parseFloat(window.getComputedStyle(element).borderRadius)

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    radius: Number.isFinite(computedRadius) ? computedRadius : 12,
  }
}

function getDesktopCardPosition(
  rect: SpotlightRect,
  preferredSide: "left" | "right" = "right",
): { top: number; left: number } {
  const cardWidth = 320
  const margin = 16
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const fitsRight = rect.left + rect.width + margin + cardWidth <= viewportWidth - margin
  const fitsLeft = rect.left - margin - cardWidth >= margin
  const shouldUseRight = preferredSide === "right" ? fitsRight || !fitsLeft : !(fitsLeft || !fitsRight)
  const left = shouldUseRight
    ? rect.left + rect.width + margin
    : rect.left - cardWidth - margin
  const top = clamp(rect.top, margin, viewportHeight - 220)

  return { top, left: clamp(left, margin, viewportWidth - cardWidth - margin) }
}

export function DashboardWelcomeGuide({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { open, openMobile, closeMobile } = useSidebarContext()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [shouldStart, setShouldStart] = useState(false)
  const [hasResolvedPreference, setHasResolvedPreference] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const cardPrimaryActionRef = useRef<HTMLButtonElement | null>(null)
  const activeTargetRef = useRef<HTMLElement | null>(null)
  const currentStep = dashboardWelcomeGuideSteps[currentStepIndex]

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    let isCancelled = false

    const loadGuidePreference = async () => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
          cache: "no-store",
        })

        if (!response.ok) {
          if (!isCancelled) {
            setShouldStart(false)
            setHasResolvedPreference(true)
          }
          return
        }

        const data = await response.json() as { dashboardWelcomeGuideSeen?: boolean }
        if (!isCancelled) {
          setShouldStart(!data.dashboardWelcomeGuideSeen)
          setHasResolvedPreference(true)
        }
      } catch {
        if (!isCancelled) {
          setShouldStart(false)
          setHasResolvedPreference(true)
        }
      }
    }

    void loadGuidePreference()

    return () => {
      isCancelled = true
    }
  }, [hasHydrated])

  useEffect(() => {
    if (!hasHydrated || !hasResolvedPreference || !shouldStart) {
      return
    }

    const isGuidePath =
      pathname.startsWith(DASHBOARD_WELCOME_GUIDE_PROFILE_PATH)
      || pathname.startsWith(DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH)
      || pathname === DASHBOARD_WELCOME_GUIDE_RESUMES_PATH
    if (!isGuidePath) {
      return
    }

    if (!isOpen) {
      const matchingStepIndex = dashboardWelcomeGuideSteps.findIndex((step) =>
        pathname === step.path || pathname.startsWith(`${step.path}/`),
      )
      setCurrentStepIndex(Math.max(matchingStepIndex, 0))
    }
    setIsOpen(true)
  }, [currentStepIndex, hasHydrated, hasResolvedPreference, isOpen, pathname, router, shouldStart])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void closeGuide()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setSpotlightRect(null)
      if (activeTargetRef.current) {
        delete activeTargetRef.current.dataset.dashboardGuideActive
        activeTargetRef.current = null
      }
      return
    }

    if (currentStep.requiresSidebar) {
      if (isMobile) {
        openMobile()
      } else {
        open()
      }
    } else if (isMobile) {
      closeMobile()
    }

    if (pathname !== currentStep.path) {
      setSpotlightRect(null)
      router.replace(currentStep.path)
      return
    }

    let frameId = 0
    let resizeObserver: ResizeObserver | null = null
    let isCancelled = false

    const updateSpotlight = (element: HTMLElement) => {
      if (isCancelled) {
        return
      }

      element.scrollIntoView({ block: "center", inline: "nearest" })
      if (activeTargetRef.current && activeTargetRef.current !== element) {
        delete activeTargetRef.current.dataset.dashboardGuideActive
      }
      activeTargetRef.current = element
      activeTargetRef.current.dataset.dashboardGuideActive = "true"
      setSpotlightRect(measureTarget(element))
    }

    const resolveTarget = () => {
      if (isCancelled) {
        return
      }

      const element = getTargetElement(currentStep)
      if (!element) {
        frameId = window.requestAnimationFrame(resolveTarget)
        return
      }

      updateSpotlight(element)
      resizeObserver = new ResizeObserver(() => updateSpotlight(element))
      resizeObserver.observe(element)
    }

    const handleViewportUpdate = () => {
      const element = getTargetElement(currentStep)
      if (element) {
        updateSpotlight(element)
      }
    }

    frameId = window.requestAnimationFrame(resolveTarget)
    window.addEventListener("resize", handleViewportUpdate)
    window.addEventListener("scroll", handleViewportUpdate, true)

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", handleViewportUpdate)
      window.removeEventListener("scroll", handleViewportUpdate, true)
      if (activeTargetRef.current) {
        delete activeTargetRef.current.dataset.dashboardGuideActive
        activeTargetRef.current = null
      }
    }
  }, [closeMobile, currentStep, isMobile, isOpen, open, openMobile, pathname, router])

  useEffect(() => {
    if (isOpen && spotlightRect) {
      cardPrimaryActionRef.current?.focus()
    }
  }, [isOpen, spotlightRect, currentStepIndex])

  const cardPosition = useMemo(() => {
    if (!spotlightRect || typeof window === "undefined") {
      return null
    }

    if (isMobile) {
      return null
    }

    return getDesktopCardPosition(spotlightRect, currentStep.preferredSide)
  }, [currentStep.preferredSide, isMobile, spotlightRect])

  const closeGuide = async () => {
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dashboardWelcomeGuideSeen: true,
        }),
      })
    } catch {
      // Keep UX responsive even if preference persistence fails.
    }

    setIsOpen(false)
    setShouldStart(false)
  }

  const handleNextStep = async () => {
    if (currentStepIndex >= dashboardWelcomeGuideSteps.length - 1) {
      await closeGuide()
      return
    }

    setCurrentStepIndex((previous) => previous + 1)
    setSpotlightRect(null)
  }

  return (
    <>
      {children}
      {hasHydrated && isOpen && spotlightRect
        ? createPortal(
          <div className="fixed inset-0 z-[120] select-none">
            <div
              aria-hidden="true"
              data-testid="dashboard-welcome-guide-spotlight"
              data-target-id={currentStep.targetId}
              className="pointer-events-none absolute border-2 border-black bg-white/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.18)] transition-all duration-200"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                borderRadius: spotlightRect.radius,
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-welcome-guide-title"
              aria-describedby="dashboard-welcome-guide-description"
              className={cn(
                "pointer-events-auto fixed z-[121] w-[calc(100vw-2rem)] max-w-80 rounded-2xl border border-black/10 bg-background p-5 shadow-2xl",
                isMobile ? "bottom-4 left-4 right-4" : "w-80",
              )}
              style={isMobile || !cardPosition ? undefined : cardPosition}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                BEM-VINDO TOUR
              </p>
              <h2
                id="dashboard-welcome-guide-title"
                className="mt-2 text-lg font-semibold text-foreground"
              >
                {currentStep.title}
              </h2>
              <p
                id="dashboard-welcome-guide-description"
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {currentStep.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void closeGuide()}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Pular
                </button>
                <Button
                  ref={cardPrimaryActionRef}
                  type="button"
                  onClick={handleNextStep}
                  className="bg-black text-white hover:bg-black/90"
                >
                  {currentStepIndex >= dashboardWelcomeGuideSteps.length - 1 ? "Concluir" : "Próximo"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
