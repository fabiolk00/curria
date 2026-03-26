import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  linkTo?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export default function Logo({ linkTo = "/", className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }

  const content = (
    <span className={cn("font-bold tracking-tight", sizeClasses[size], className)}>
      <span className="text-foreground">Curr</span>
      <span className="text-primary">IA</span>
    </span>
  )

  if (linkTo) {
    return (
      <Link href={linkTo} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        {content}
      </Link>
    )
  }

  return content
}
