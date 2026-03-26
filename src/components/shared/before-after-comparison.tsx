"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function BeforeAfterComparison() {
  const [showAfter, setShowAfter] = useState(false)

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Toggle buttons */}
      <div className="flex gap-2 mb-4 justify-center">
        <button
          onClick={() => setShowAfter(false)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            !showAfter
              ? "bg-destructive/20 text-destructive"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Antes
        </button>
        <button
          onClick={() => setShowAfter(true)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            showAfter
              ? "bg-success/20 text-success"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Depois
        </button>
      </div>

      {/* Resume card */}
      <div
        className={cn(
          "relative rounded-xl border-2 p-6 transition-all duration-500",
          showAfter
            ? "border-success/50 bg-success/5"
            : "border-destructive/50 bg-destructive/5"
        )}
      >
        {/* Score badge */}
        <div className="absolute -top-3 right-4">
          <Badge
            className={cn(
              "text-sm font-bold px-3 py-1",
              showAfter
                ? "bg-success text-success-foreground"
                : "bg-destructive text-destructive-foreground"
            )}
          >
            ATS Score: {showAfter ? "94%" : "32%"}
          </Badge>
        </div>

        {/* Mock resume content */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground font-semibold">JS</span>
            </div>
            <div>
              <h4 className="font-semibold text-foreground">João Silva</h4>
              <p className="text-sm text-muted-foreground">Desenvolvedor de Software</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Skills section */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Habilidades
            </h5>
            <div className="flex flex-wrap gap-2">
              {showAfter ? (
                <>
                  <Badge variant="secondary" className="text-xs">React</Badge>
                  <Badge variant="secondary" className="text-xs">TypeScript</Badge>
                  <Badge variant="secondary" className="text-xs">Node.js</Badge>
                  <Badge variant="secondary" className="text-xs">AWS</Badge>
                  <Badge variant="secondary" className="text-xs">PostgreSQL</Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs opacity-60">JavaScript</Badge>
                  <Badge variant="outline" className="text-xs opacity-60">Programação</Badge>
                </>
              )}
            </div>
          </div>

          {/* Status indicators */}
          <div className="space-y-2 pt-2">
            {showAfter ? (
              <>
                <StatusItem success text="Palavras-chave correspondentes" />
                <StatusItem success text="Formato otimizado" />
                <StatusItem success text="Seções padronizadas" />
              </>
            ) : (
              <>
                <StatusItem success={false} text="Faltam palavras-chave" />
                <StatusItem success={false} text="Formato incorreto" />
                <StatusItem warning text="Seções não padronizadas" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusItem({
  success,
  warning,
  text,
}: {
  success?: boolean
  warning?: boolean
  text: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {success ? (
        <Check className="h-4 w-4 text-success" />
      ) : warning ? (
        <AlertTriangle className="h-4 w-4 text-warning" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={cn(
        success ? "text-success" : warning ? "text-warning" : "text-destructive"
      )}>
        {text}
      </span>
    </div>
  )
}
