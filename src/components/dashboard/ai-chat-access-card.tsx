import Link from "next/link"
import { LockKeyhole, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ChatUpgradeCardProps = {
  eyebrow?: string
  title: string
  message: string
  ctaHref?: string
  ctaLabel?: string
  className?: string
}

export function ChatUpgradeCard({
  eyebrow = "Plano PRO",
  title,
  message,
  ctaHref,
  ctaLabel = "Fazer upgrade",
  className,
}: ChatUpgradeCardProps) {
  return (
    <div
      data-testid="ai-chat-access-card"
      className={cn("flex w-full items-center justify-center", className)}
    >
      <Card className="w-full max-w-2xl rounded-[2rem] border border-border/60 bg-card/95 shadow-[0_28px_90px_-60px_oklch(var(--foreground)/0.85)]">
        <CardContent className="space-y-6 p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
            <LockKeyhole className="h-6 w-6" />
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {eyebrow}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {message}
            </p>
          </div>

          {ctaHref ? (
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
