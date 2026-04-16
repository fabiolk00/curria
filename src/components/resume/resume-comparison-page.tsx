"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { ResumeComparisonView } from "@/components/resume/resume-comparison-view"
import { Button } from "@/components/ui/button"
import { getResumeComparison } from "@/lib/dashboard/workspace-client"
import type { ResumeComparisonResponse } from "@/types/dashboard"

export function ResumeComparisonPage({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [comparison, setComparison] = useState<ResumeComparisonResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const payload = await getResumeComparison(sessionId)
        if (!isMounted) {
          return
        }

        setComparison(payload)
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar a comparação.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando comparação do currículo...
        </div>
      </div>
    )
  }

  if (!comparison || error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? "Não foi possível carregar a comparação desta sessão."}
          </p>
          <Button type="button" onClick={() => router.push("/dashboard/resume/new")}>
            Voltar ao perfil
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ResumeComparisonView
      originalCvState={comparison.originalCvState}
      optimizedCvState={comparison.optimizedCvState}
      generationType={comparison.generationType}
      sessionId={comparison.sessionId}
      targetJobDescription={comparison.targetJobDescription}
      originalScore={comparison.originalScore.total}
      optimizedScore={comparison.optimizedScore.total}
      scoreLabel={comparison.originalScore.label}
      optimizationNotes={comparison.optimizationSummary?.notes ?? []}
      backHref="/dashboard/resume/new"
      onContinue={() => router.push("/dashboard/resume/new")}
    />
  )
}
