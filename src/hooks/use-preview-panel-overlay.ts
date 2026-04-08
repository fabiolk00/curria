'use client'

import { useEffect, useState } from 'react'

const PREVIEW_OVERLAY_BREAKPOINT = 1024

export function usePreviewPanelOverlay(): boolean {
  const [isOverlay, setIsOverlay] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth < PREVIEW_OVERLAY_BREAKPOINT
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${PREVIEW_OVERLAY_BREAKPOINT - 1}px)`)

    const update = () => {
      setIsOverlay(mediaQuery.matches)
    }

    mediaQuery.addEventListener('change', update)
    update()

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isOverlay
}
