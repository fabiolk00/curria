import { useId } from "react"

import { cn } from "@/lib/utils"

interface SiteFaviconIconProps {
  className?: string
}

export function SiteFaviconIcon({ className }: SiteFaviconIconProps) {
  const gradientId = useId()

  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("rounded-[22%]", className)}
    >
      <rect width="256" height="256" rx="56" fill={`url(#${gradientId})`} />
      <g
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(48, 48) scale(6.6666)"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </g>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="256"
          y2="256"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  )
}
