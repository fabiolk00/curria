import Link from "next/link"

import BrandWordmark from "@/components/brand-wordmark"
import { cn } from "@/lib/utils"

type LogoSize = "sm" | "default"
type LogoPreset = "default" | "auth" | "navbar"

const logoSizeClasses: Record<LogoSize, { text: string; accent: string }> = {
  sm: {
    text: "text-[28px]",
    accent: "max-h-7",
  },
  default: {
    text: "text-[36px]",
    accent: "max-h-9",
  },
}

const logoPresetClasses: Record<LogoPreset, { text: string; accent: string }> = {
  default: logoSizeClasses.default,
  auth: {
    text: "text-[clamp(40px,6vh,64px)]",
    accent: "max-h-[clamp(2.5rem,6vh,4rem)]",
  },
  navbar: {
    text: "text-[38px] md:text-[44px]",
    accent: "max-h-10 md:max-h-11",
  },
}

export default function Logo({
  size = "default",
  variant,
  linkTo = "/",
  className,
  iconClassName,
  textClassName,
  accentClassName,
}: {
  size?: LogoSize
  variant?: LogoPreset
  linkTo?: string
  className?: string
  iconClassName?: string
  textClassName?: string
  accentClassName?: string
}) {
  const classes = variant ? logoPresetClasses[variant] : logoSizeClasses[size]

  return (
    <Link href={linkTo} className={cn("flex items-center", className)}>
      <BrandWordmark
        className={cn(classes.text, textClassName)}
        accentClassName={cn(classes.accent, iconClassName, accentClassName)}
      />
    </Link>
  )
}
