import Image from "next/image"

import { cn } from "@/lib/utils"

interface SiteFaviconIconProps {
  className?: string
}

export function SiteFaviconIcon({ className }: SiteFaviconIconProps) {
  return (
    <Image
      src="/trampofy-icon.png"
      alt=""
      width={1254}
      height={1254}
      aria-hidden="true"
      className={cn("rounded-[22%] object-contain", className)}
    />
  )
}
