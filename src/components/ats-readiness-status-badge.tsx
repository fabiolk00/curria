"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type AtsReadinessStatusBadgeProps = {
  badgeText: "Final" | "Estimado"
  className?: string
}

const ESTIMATED_TOOLTIP_TEXT =
  "Este score é estimado com base na estrutura do currículo, nas palavras-chave e na legibilidade para ATS."

export function AtsReadinessStatusBadge({
  badgeText,
  className,
}: AtsReadinessStatusBadgeProps) {
  const isEstimated = badgeText === "Estimado"
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <Badge
        variant="outline"
        className={isEstimated ? `pr-5 ${className ?? ""}`.trim() : className}
      >
        {badgeText}
      </Badge>
      {isEstimated ? (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Explicação do score estimado"
              onClick={() => setOpen((current) => !current)}
              className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-semibold leading-none text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              ?
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={4}
            className="max-w-[180px] rounded-md bg-black px-2.5 py-1.5 text-[10px] leading-snug text-white shadow-lg"
          >
            {ESTIMATED_TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  )
}

export { ESTIMATED_TOOLTIP_TEXT }
