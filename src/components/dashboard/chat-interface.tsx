"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { FileText, Send, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AgentStreamChunk, Phase } from "@/types/agent"

import { ChatMessage } from "./chat-message"

type AgentDoneChunk = Extract<AgentStreamChunk, { done: true }>

const CREDIT_EXHAUSTED_ERROR_PATTERN = /cr[eé]ditos acabaram/i
const CREDIT_EXHAUSTED_MESSAGE = "Seus créditos acabaram. Faça upgrade do seu plano para continuar."

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  analysisResult?: {
    scoreBefore: number
    scoreAfter: number
    matchedKeywords: string[]
    missingKeywords: string[]
    suggestions: string[]
  }
}

function hasConversationMessages(items: Message[]): boolean {
  return items.some((message) => message.id !== "welcome")
}

type ChatCopy = {
  heading: string
  description: string
  placeholder: string
  helperText: string
  thinkingText: string
  sessionCounterLabel: string
  sessionExpiredText: string
  sessionLimitText: string
  allowFileUpload: boolean
}

function getChatCopy(firstName?: string): ChatCopy {
  const greeting = firstName ? `Ol\u00E1, ${firstName}!` : "Ol\u00E1!"

  return {
    heading: greeting,
    description: "Cole a descri\u00E7\u00E3o da vaga e envie seu curr\u00EDculo para iniciar a an\u00E1lise ATS.",
    placeholder: "Cole a descri\u00E7\u00E3o da vaga aqui...",
    helperText: "Arraste um arquivo PDF ou DOCX, ou clique no bot\u00E3o de upload.",
    thinkingText: "Pensando...",
    sessionCounterLabel: "nesta an\u00E1lise",
    sessionExpiredText: "Sess\u00E3o n\u00E3o encontrada. Inicie uma nova an\u00E1lise para continuar.",
    sessionLimitText: "Esta sess\u00E3o atingiu o limite de mensagens. Inicie uma nova an\u00E1lise para continuar.",
    allowFileUpload: true,
  }
}

function createWelcomeMessage(firstName?: string): Message {
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!"

  return {
    id: "welcome",
    role: "assistant",
    content: `${greeting} Sou seu consultor especialista em ATS e RH.

Envie seu currículo em PDF ou DOCX e cole a descrição da vaga para eu iniciar a análise.

Depois disso, vamos melhorar o currículo, criar variações por vaga e gerar os arquivos finais.`,
    timestamp: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

function isCreditExhaustedError(message?: string): boolean {
  return Boolean(message && CREDIT_EXHAUSTED_ERROR_PATTERN.test(message))
}

interface ChatInterfaceProps {
  sessionId?: string
  userName?: string
  disabled?: boolean
  currentCredits?: number
  onSessionChange?: (sessionId: string) => void
  onStreamingChange?: (isStreaming: boolean) => void
  onAgentTurnCompleted?: (payload: AgentDoneChunk) => void
  onCreditsExhausted?: () => void
}

export function ChatInterface({
  sessionId: initialSessionId,
  userName = "Você",
  disabled = false,
  currentCredits,
  onSessionChange,
  onStreamingChange,
  onAgentTurnCompleted,
  onCreditsExhausted,
}: ChatInterfaceProps) {
  const { user } = useUser()
  const copy = useMemo(
    () => getChatCopy(user?.firstName?.trim() || userName.trim() || undefined),
    [user?.firstName, userName],
  )
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    createWelcomeMessage(user?.firstName?.trim() || userName.trim() || undefined),
  ])
  const [input, setInput] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [phase, setPhase] = useState<Phase>("intake")
  const [atsScore, setAtsScore] = useState<number | undefined>()
  const [messageCount, setMessageCount] = useState(0)
  const [maxMessages] = useState(15)
  const [sessionLimitReached, setSessionLimitReached] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInputDisabled = disabled || isStreaming || sessionLimitReached || sessionExpired

  const applySessionState = (nextSessionId: string | undefined): void => {
    setSessionId(nextSessionId)
    if (nextSessionId) {
      setSessionExpired(false)
      setSessionLimitReached(false)
    }
  }

  const replaceAssistantMessage = (assistantMessageId: string, content: string): void => {
    setMessages((previous) =>
      previous.map((item) =>
        item.id === assistantMessageId ? { ...item, content } : item,
      ),
    )
  }

  useEffect(() => {
    setSessionId(initialSessionId)
    if (initialSessionId) {
      setSessionExpired(false)
      setSessionLimitReached(false)
    }
  }, [initialSessionId])

  useEffect(() => {
    onStreamingChange?.(isStreaming)
  }, [isStreaming, onStreamingChange])

  useEffect(() => {
    const welcomeMessage = createWelcomeMessage(user?.firstName?.trim() || userName.trim() || undefined)

    if (!sessionId) {
      setMessages((previous) => (hasConversationMessages(previous) ? previous : [welcomeMessage]))
      return
    }

    let cancelled = false

    fetch(`/api/session/${sessionId}/messages`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return
        }

        if (data.messages?.length) {
          const nextMessages = data.messages.map(
              (
                message: { role: string; content: string; createdAt: string },
                index: number,
              ) => ({
                id: String(index),
                role: message.role as "user" | "assistant",
                content: message.content,
                timestamp: new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }),
            )

          setMessages((previous) => {
            if (hasConversationMessages(previous) && nextMessages.length < previous.length) {
              return previous
            }

            return nextMessages
          })
          return
        }

        setMessages((previous) => (hasConversationMessages(previous) ? previous : [welcomeMessage]))
      })
      .catch(() => {
        if (!cancelled) {
          setMessages((previous) => (hasConversationMessages(previous) ? previous : [welcomeMessage]))
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, user?.firstName, userName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (): Promise<void> => {
    if ((!input.trim() && !uploadedFile) || isInputDisabled) {
      return
    }

    const messageToSend = input
    const fileToSend = uploadedFile

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: fileToSend ? `${messageToSend}\n\nAnexo: ${fileToSend.name}` : messageToSend,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setMessages((previous) => [...previous, userMessage])
    setInput("")
    setUploadedFile(null)
    setIsStreaming(true)

    const assistantMessageId = `${Date.now() + 1}`
    setMessages((previous) => [
      ...previous,
      {
        id: assistantMessageId,
        role: "assistant",
        content: copy.thinkingText,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ])

    const canReuseCurrentSession = Boolean(sessionId) && !sessionExpired && !sessionLimitReached
    if (!canReuseCurrentSession && currentCredits !== undefined && currentCredits <= 0) {
      onCreditsExhausted?.()
      replaceAssistantMessage(assistantMessageId, `Aviso: ${CREDIT_EXHAUSTED_MESSAGE}`)
      setIsStreaming(false)
      return
    }

    let fileBase64: string | undefined
    let fileMime: string | undefined

    if (fileToSend) {
      fileBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : ""
          resolve(result.split(",")[1] ?? "")
        }
        reader.readAsDataURL(fileToSend)
      })
      fileMime = fileToSend.type
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: messageToSend,
          file: fileBase64,
          fileMime,
        }),
      })

      if (!response.ok || !response.body) {
        const errorPayload = (await response.json().catch(() => null)) as AgentStreamChunk | null

        if (errorPayload && "error" in errorPayload) {
          const sessionEnded = response.status === 404 || errorPayload.action === "new_session"
          const shouldOpenCreditsModal =
            (response.status === 402 && isCreditExhaustedError(errorPayload.error))
            || (sessionEnded && currentCredits !== undefined && currentCredits <= 0)
          if (response.status === 404) {
            setSessionExpired(true)
          } else if (errorPayload.action === "new_session") {
            setSessionLimitReached(true)
          }
          if (shouldOpenCreditsModal) {
            onCreditsExhausted?.()
          }
          if (errorPayload.messageCount !== undefined) {
            setMessageCount(errorPayload.messageCount)
          }
        }

        const errorMessage =
          errorPayload && "error" in errorPayload
            ? errorPayload.error
            : "Não foi possível continuar a conversa."
        throw new Error(errorMessage)
      }

      // Read session ID from header immediately — available before any SSE
      // chunk is parsed, so a refresh right after fetch resolves still
      // preserves the session.
      const headerSessionId = response.headers.get("X-Session-Id")
      if (headerSessionId) {
        applySessionState(headerSessionId)
        onSessionChange?.(headerSessionId)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const event of events) {
          const lines = event.split("\n")
          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue
            }

            try {
              const chunk = JSON.parse(line.slice(6)) as AgentStreamChunk

              if ("delta" in chunk) {
                setMessages((previous) =>
                  previous.map((message) =>
                    message.id === assistantMessageId
                      ? {
                          ...message,
                          content: message.content === copy.thinkingText ? chunk.delta : message.content + chunk.delta,
                        }
                      : message,
                  ),
                )
                continue
              }

              if ("sessionCreated" in chunk && chunk.sessionCreated) {
                applySessionState(chunk.sessionId)
                onSessionChange?.(chunk.sessionId)
                continue
              }

              if ("done" in chunk && chunk.done) {
                setPhase(chunk.phase)
                if (chunk.atsScore?.total !== undefined) {
                  setAtsScore(chunk.atsScore.total)
                }
                if (chunk.messageCount !== undefined) {
                  setMessageCount(chunk.messageCount)
                }
                if (chunk.sessionId) {
                  applySessionState(chunk.sessionId)
                  onSessionChange?.(chunk.sessionId)
                }
                onAgentTurnCompleted?.(chunk)
                continue
              }

              if ("error" in chunk) {
                const shouldOpenCreditsModal =
                  isCreditExhaustedError(chunk.error)
                  || (chunk.action === "new_session" && currentCredits !== undefined && currentCredits <= 0)

                if (chunk.action === "new_session") {
                  setSessionLimitReached(true)
                }

                if (shouldOpenCreditsModal) {
                  onCreditsExhausted?.()
                }

                setMessages((previous) =>
                  previous.map((message) =>
                    message.id === assistantMessageId
                      ? { ...message, content: `Aviso: ${chunk.error}` }
                      : message,
                  ),
                )
              }
            } catch {
              continue
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado."
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantMessageId ? { ...item, content: `Aviso: ${message}` } : item,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (!disabled && copy.allowFileUpload) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)

    if (disabled || !copy.allowFileUpload) {
      return
    }

    const file = event.dataTransfer.files[0]
    if (file && (file.type === "application/pdf" || file.name.endsWith(".docx"))) {
      setUploadedFile(file)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (!copy.allowFileUpload) {
      return
    }

    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {messageCount > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mensagem {messageCount} de {maxMessages} {copy.sessionCounterLabel}
            </span>
            <div className="flex items-center gap-2 text-xs">
              {phase !== "intake" ? <span className="text-muted-foreground">Fase: {phase}</span> : null}
              {atsScore !== undefined ? <span className="text-muted-foreground">ATS: {atsScore}</span> : null}
            </div>
          </div>
        </div>
      )}

      {messages.length === 1 && (
        <div className="px-4 py-12 text-center">
          <h1 className="mb-3 text-2xl font-bold md:text-3xl">{copy.heading}</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            {copy.description}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full px-4 md:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} {...message} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          "border-t border-border bg-background p-4 transition-colors",
          isDragging && "border-primary bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {copy.allowFileUpload && uploadedFile && (
            <div className="flex w-fit items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">{uploadedFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={isInputDisabled}
                onClick={() => setUploadedFile(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {copy.allowFileUpload ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={isInputDisabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.placeholder}
              className="max-h-[200px] min-h-[44px] resize-none"
              rows={1}
              disabled={isInputDisabled}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0"
              disabled={(!input.trim() && !uploadedFile) || isInputDisabled}
              onClick={() => void handleSend()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {sessionExpired ? (
            <p className="text-center text-xs text-amber-600">
              {copy.sessionExpiredText}
            </p>
          ) : sessionLimitReached ? (
            <p className="text-center text-xs text-amber-600">
              {copy.sessionLimitText}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {copy.helperText}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
