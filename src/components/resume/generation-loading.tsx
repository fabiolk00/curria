"use client"

import { useEffect, useState } from "react"

import Logo from "@/components/logo"
import { cn } from "@/lib/utils"

interface GenerationLoadingProps {
  isLoading: boolean
  generationType: "ATS_ENHANCEMENT" | "JOB_TARGETING"
  onComplete?: () => void
}

const loadingMessages = [
  "Analisando seu currículo...",
  "Identificando pontos de melhoria...",
  "Otimizando palavras-chave...",
  "Ajustando formatação ATS...",
  "Refinando experiências...",
  "Aplicando melhores práticas...",
  "Finalizando otimização...",
]

export function GenerationLoading({
  isLoading,
  generationType,
  onComplete,
}: GenerationLoadingProps) {
  const [progress, setProgress] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true)
      setProgress(0)
      setMessageIndex(0)
      return
    }

    if (isVisible) {
      setProgress(100)
      const timer = window.setTimeout(() => {
        setIsVisible(false)
        onComplete?.()
      }, 400)

      return () => window.clearTimeout(timer)
    }
  }, [isLoading, isVisible, onComplete])

  useEffect(() => {
    if (!isLoading || progress >= 100) {
      return
    }

    const getIncrement = () => {
      if (progress < 30) return Math.random() * 8 + 4
      if (progress < 60) return Math.random() * 5 + 2
      if (progress < 85) return Math.random() * 3 + 1
      return Math.random() * 1 + 0.5
    }

    const timer = window.setTimeout(() => {
      setProgress((previous) => {
        const next = previous + getIncrement()
        return next > 95 ? 95 : next
      })
    }, 200 + Math.random() * 300)

    return () => window.clearTimeout(timer)
  }, [isLoading, progress])

  useEffect(() => {
    const nextIndex = Math.min(
      Math.floor((progress / 100) * loadingMessages.length),
      loadingMessages.length - 1,
    )

    if (nextIndex !== messageIndex) {
      setMessageIndex(nextIndex)
    }
  }, [progress, messageIndex])

  if (!isVisible) {
    return null
  }

  const title =
    generationType === "JOB_TARGETING"
      ? "Adaptando para a vaga"
      : "Otimizando para ATS"

  return (
    <div
      data-testid="generation-loading"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-300 dark:bg-zinc-950/95",
        isVisible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-8 px-6">
        <div className="animate-pulse">
          <Logo linkTo="/dashboard/resume/new" size="default" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-2 h-6 text-sm text-zinc-500 transition-all duration-300 dark:text-zinc-400">
            {loadingMessages[messageIndex]}
          </p>
        </div>

        <div className="relative w-full">
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="relative h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div
                  className="absolute inset-0 animate-wave opacity-30"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)",
                  }}
                />
              </div>

              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute -left-full h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>

              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute bottom-0 left-[20%] h-1.5 w-1.5 animate-bubble rounded-full bg-white/40" />
                <div
                  className="absolute bottom-0 left-[50%] h-1 w-1 animate-bubble rounded-full bg-white/30"
                  style={{ animationDelay: "0.3s" }}
                />
                <div
                  className="absolute bottom-0 left-[75%] h-1.5 w-1.5 animate-bubble rounded-full bg-white/40"
                  style={{ animationDelay: "0.6s" }}
                />
              </div>

              <div className="absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-emerald-300/50 to-transparent" />
            </div>
          </div>

          <div className="mt-3 flex justify-between text-xs">
            <span className="text-zinc-400 dark:text-zinc-500">Progresso</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-2 w-2 animate-pulse rounded-full bg-emerald-500/30"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
