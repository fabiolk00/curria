"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Download, Loader2, Sparkles, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDownloadUrls } from "@/lib/dashboard/workspace-client"
import { scoreATS } from "@/lib/ats/score"
import { cn } from "@/lib/utils"
import type { ResumeGenerationType } from "@/types/agent"
import type { CVState } from "@/types/cv"

type ResumeComparisonViewProps = {
  originalCvState: CVState
  optimizedCvState: CVState
  generationType: ResumeGenerationType
  sessionId: string
  targetJobDescription?: string
  onContinue: () => void
}

function cvStateToText(cvState: CVState): string {
  const sections: string[] = []

  if (cvState.fullName) sections.push(cvState.fullName)
  if (cvState.email) sections.push(cvState.email)
  if (cvState.phone) sections.push(cvState.phone)
  if (cvState.linkedin) sections.push(cvState.linkedin)
  if (cvState.location) sections.push(cvState.location)

  if (cvState.summary) {
    sections.push("\nResumo")
    sections.push(cvState.summary)
  }

  if (cvState.experience.length > 0) {
    sections.push("\nExperiência")
    cvState.experience.forEach((experience) => {
      sections.push(`${experience.title} - ${experience.company}`)
      sections.push(`${experience.startDate} - ${experience.endDate}`)
      experience.bullets.forEach((bullet) => sections.push(`- ${bullet}`))
    })
  }

  if (cvState.skills.length > 0) {
    sections.push("\nSkills")
    sections.push(cvState.skills.join(", "))
  }

  if (cvState.education.length > 0) {
    sections.push("\nEducação")
    cvState.education.forEach((education) => {
      sections.push(`${education.degree} - ${education.institution} (${education.year})`)
    })
  }

  if ((cvState.certifications ?? []).length > 0) {
    sections.push("\nCertificações")
    cvState.certifications?.forEach((certification) => {
      sections.push(`${certification.name} - ${certification.issuer}`)
    })
  }

  return sections.join("\n")
}

function buildScoreLabel(generationType: ResumeGenerationType): string {
  return generationType === "JOB_TARGETING" ? "Score ATS da vaga" : "Score ATS geral"
}

function buildTitle(generationType: ResumeGenerationType): string {
  return generationType === "JOB_TARGETING"
    ? "Confira a versão adaptada para a vaga"
    : "Confira a versão otimizada para ATS"
}

function buildDescription(generationType: ResumeGenerationType): string {
  return generationType === "JOB_TARGETING"
    ? "Antes de seguir para o dashboard, compare o currículo base com a versão reescrita para os requisitos da vaga."
    : "Antes de seguir para o dashboard, compare o currículo base com a versão reescrita para melhorar clareza, estrutura e aderência ATS."
}

function buildPrimaryCta(generationType: ResumeGenerationType): string {
  return generationType === "JOB_TARGETING"
    ? "Seguir com esta versão para a vaga"
    : "Seguir com esta versão ATS"
}

function summarizeChanges(originalCvState: CVState, optimizedCvState: CVState): string[] {
  const changes: string[] = []

  if (originalCvState.summary.trim() !== optimizedCvState.summary.trim()) {
    changes.push("Resumo profissional reescrito para ficar mais claro e objetivo.")
  }

  if (JSON.stringify(originalCvState.experience) !== JSON.stringify(optimizedCvState.experience)) {
    changes.push("Experiências reorganizadas com bullets mais fortes e foco em impacto.")
  }

  if (JSON.stringify(originalCvState.skills) !== JSON.stringify(optimizedCvState.skills)) {
    changes.push("Skills priorizadas para destacar melhor palavras-chave relevantes.")
  }

  if (JSON.stringify(originalCvState.education) !== JSON.stringify(optimizedCvState.education)) {
    changes.push("Educação normalizada para manter a leitura consistente no currículo.")
  }

  if (JSON.stringify(originalCvState.certifications ?? []) !== JSON.stringify(optimizedCvState.certifications ?? [])) {
    changes.push("Certificações padronizadas para melhorar escaneabilidade e apresentação.")
  }

  return changes.slice(0, 4)
}

function ResumeSnapshot({
  title,
  accentClassName,
  score,
  scoreLabel,
  cvState,
}: {
  title: string
  accentClassName: string
  score: number
  scoreLabel: string
  cvState: CVState
}) {
  const topSkills = cvState.skills.slice(0, 8)
  const topExperiences = cvState.experience.slice(0, 3)
  const topEducation = cvState.education.slice(0, 2)

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base text-foreground">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{cvState.fullName || "Seu nome aparece aqui"}</p>
          </div>
          <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", accentClassName)}>
            {scoreLabel}: {score}/100
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {cvState.email ? <p>{cvState.email}</p> : null}
          {cvState.phone ? <p>{cvState.phone}</p> : null}
          {cvState.location ? <p>{cvState.location}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumo</h3>
          <p className="text-sm leading-6 text-foreground">
            {cvState.summary || "O resumo profissional aparece aqui quando estiver preenchido."}
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {(topSkills.length > 0 ? topSkills : ["As principais skills aparecem aqui"]).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Experiência</h3>
          <div className="space-y-3">
            {topExperiences.length > 0 ? topExperiences.map((experience, index) => (
              <div key={`${experience.title}-${index}`} className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {experience.title || "Cargo"}{experience.company ? ` · ${experience.company}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {experience.startDate || "Início"}{experience.endDate ? ` - ${experience.endDate}` : ""}
                </p>
                {experience.bullets.slice(0, 2).map((bullet, bulletIndex) => (
                  <p key={`${experience.title}-${bulletIndex}`} className="text-xs leading-5 text-muted-foreground">
                    • {bullet}
                  </p>
                ))}
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">As experiências principais aparecem aqui.</p>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Educação</h3>
          <div className="space-y-2">
            {topEducation.length > 0 ? topEducation.map((education, index) => (
              <div key={`${education.degree}-${index}`}>
                <p className="text-sm font-medium text-foreground">{education.degree || "Formação"}</p>
                <p className="text-xs text-muted-foreground">
                  {education.institution || "Instituição"}{education.year ? ` · ${education.year}` : ""}
                </p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">As formações cadastradas aparecem aqui.</p>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export function ResumeComparisonView({
  originalCvState,
  optimizedCvState,
  generationType,
  sessionId,
  targetJobDescription,
  onContinue,
}: ResumeComparisonViewProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const scoreLabel = buildScoreLabel(generationType)
  const title = buildTitle(generationType)
  const description = buildDescription(generationType)
  const primaryCta = buildPrimaryCta(generationType)
  const changeHighlights = useMemo(
    () => summarizeChanges(originalCvState, optimizedCvState),
    [originalCvState, optimizedCvState],
  )

  const originalScore = useMemo(
    () => scoreATS(cvStateToText(originalCvState), targetJobDescription).total,
    [originalCvState, targetJobDescription],
  )
  const optimizedScore = useMemo(
    () => scoreATS(cvStateToText(optimizedCvState), targetJobDescription).total,
    [optimizedCvState, targetJobDescription],
  )

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      setDownloadError(null)

      const urls = await getDownloadUrls(sessionId)
      if (!urls.pdfUrl) {
        throw new Error("O PDF ainda não está disponível para download.")
      }

      const response = await fetch(urls.pdfUrl)
      if (!response.ok) {
        throw new Error(`Falha ao baixar o PDF (${response.status}).`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = generationType === "JOB_TARGETING" ? "currículo-vaga.pdf" : "currículo-ats.pdf"
      anchor.rel = "noopener noreferrer"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Falha ao baixar o PDF. Tente novamente.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div data-testid="resume-comparison-view" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {generationType === "JOB_TARGETING" ? <Target className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generationType === "JOB_TARGETING" ? "Comparação da vaga" : "Comparação ATS"}
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance text-foreground">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownload()}
                disabled={isDownloading}
                className="gap-2"
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>
              <Button type="button" onClick={onContinue} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                {primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {downloadError ? (
            <p className="text-sm text-destructive">{downloadError}</p>
          ) : null}

          {changeHighlights.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {changeHighlights.map((highlight) => (
                <div key={highlight} className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                  {highlight}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-2">
          <ResumeSnapshot
            title="Versão base"
            accentClassName="bg-amber-100 text-amber-800"
            score={originalScore}
            scoreLabel={scoreLabel}
            cvState={originalCvState}
          />
          <ResumeSnapshot
            title="Versão gerada"
            accentClassName="bg-emerald-100 text-emerald-800"
            score={optimizedScore}
            scoreLabel={scoreLabel}
            cvState={optimizedCvState}
          />
        </div>
      </div>
    </div>
  )
}
