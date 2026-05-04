import Link from "next/link"

import BrandWordmark from "@/components/brand-wordmark"
import { cn } from "@/lib/utils"

export default function Logo({
  size = "default",
  linkTo = "/",
  className,
  iconClassName,
  textClassName,
  accentClassName,
}: {
  size?: "sm" | "default"
  linkTo?: string
  className?: string
  iconClassName?: string
  textClassName?: string
  accentClassName?: string
}) {
  return (
    <Link href={linkTo} className={cn("flex items-center", className)}>
      <BrandWordmark
        className={cn(size === "sm" ? "text-[28px]" : "text-[36px]", textClassName)}
        accentClassName={cn(
          size === "sm" ? "max-h-7" : "max-h-9",
          iconClassName,
          accentClassName,
        )}
      />
    </Link>
  )
}
