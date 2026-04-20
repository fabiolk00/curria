"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

type GoogleAnalyticsPageViewsProps = {
  measurementId: string
}

export default function GoogleAnalyticsPageViews({
  measurementId,
}: GoogleAnalyticsPageViewsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!window.gtag) {
      return
    }

    const search = searchParams.toString()
    const pagePath = search ? `${pathname}?${search}` : pathname

    window.gtag("event", "page_view", {
      send_to: measurementId,
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    })
  }, [measurementId, pathname, searchParams])

  return null
}
