"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { usePathname } from "next/navigation"

import { NAVIGATION_FEEDBACK_EVENT } from "@/lib/navigation/feedback"

const MIN_VISIBLE_MS = 250
const MAX_VISIBLE_MS = 7000

function shouldIgnoreClick(event: MouseEvent): boolean {
  return (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  )
}

function shouldShowForAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") {
    return false
  }

  if (anchor.hasAttribute("download")) {
    return false
  }

  const destination = new URL(anchor.href, window.location.href)
  if (destination.origin !== window.location.origin) {
    return false
  }

  const currentPath = `${window.location.pathname}${window.location.search}`
  const nextPath = `${destination.pathname}${destination.search}`

  return currentPath !== nextPath
}

export function RouteLoadingIndicator() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const startedAtRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
  const previousPathnameRef = useRef(pathname)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    setIsVisible(false)
  }, [clearTimer])

  const hideAfterMinimum = useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current
    const delay = Math.max(MIN_VISIBLE_MS - elapsed, 0)

    clearTimer()
    timeoutRef.current = window.setTimeout(hide, delay)
  }, [clearTimer, hide])

  const show = useCallback(() => {
    startedAtRef.current = Date.now()
    setIsVisible(true)
    clearTimer()
    timeoutRef.current = window.setTimeout(hide, MAX_VISIBLE_MS)
  }, [clearTimer, hide])

  useEffect(() => {
    const handleNavigationStart = () => show()

    const handleClick = (event: MouseEvent) => {
      if (shouldIgnoreClick(event)) {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || !shouldShowForAnchor(anchor)) {
        return
      }

      show()
    }

    window.addEventListener(NAVIGATION_FEEDBACK_EVENT, handleNavigationStart)
    document.addEventListener("click", handleClick, true)

    return () => {
      window.removeEventListener(NAVIGATION_FEEDBACK_EVENT, handleNavigationStart)
      document.removeEventListener("click", handleClick, true)
      clearTimer()
    }
  }, [clearTimer, show])

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }

    previousPathnameRef.current = pathname
    hideAfterMinimum()
  }, [hideAfterMinimum, pathname])

  return (
    <div
      aria-hidden={!isVisible}
      role="status"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[150] transition-opacity duration-150 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-1 overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[curria-route-progress_1.1s_ease-in-out_infinite] bg-black shadow-[0_0_16px_rgba(0,0,0,0.35)]" />
      </div>
      <div className="absolute right-4 top-3 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
        <span>Carregando</span>
      </div>
    </div>
  )
}
