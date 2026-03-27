"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { FileText, Send, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AgentStreamChunk, Phase } from "@/types/agent"

import { ChatMessage } from "./chat-message"

type AgentDoneChunk = Extract<AgentStreamChunk, { done: true }>

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

function createWelcomeMessage(firstName?: string): Message {
  const greeting = firstName ? `Ola, ${firstName}!` : "Ola!"

  return {
    id: "welcome",
    role: "assistant",
    content: `${greeting} Sou seu consultor especialista em ATS e RH.

Envie seu curriculo em PDF ou DOCX e cole a descricao da vaga para eu iniciar a analise.

Depois disso, vamos melhorar o curriculo, criar variacoes por vaga e gerar os arquivos finais.`,
    timestamp: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

interface ChatInterfaceProps {
  sessionId?: string
  userName?: string
  disabled?: boolean
  onSessionChange?: (sessionId: string) => void
  onStreamingChange?: (isStreaming: boolean) => void
  onAgentTurnCompleted?: (payload: AgentDoneChunk) => void
}

export function ChatInterface({
  sessionId: initialSessionId,
  userName = "Voce",
  disabled = false,
  onSessionChange,
  onStreamingChange,
  onAgentTurnCompleted,
}: ChatInterfaceProps) {
  const { user } = useUser()
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    createWelcomeMessage(user?.firstName ?? undefined),
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInputDisabled = disabled || isStreaming || sessionLimitReached

  useEffect(() => {
    setSessionId(initialSessionId)
  }, [initialSessionId])

  useEffect(() => {
    onStreamingChange?.(isStreaming)
  }, [isStreaming, onStreamingChange])

  useEffect(() => {
    const welcomeMessage = createWelcomeMessage(user?.firstName ?? undefined)

    if (!sessionId) {
      setMessages([welcomeMessage])
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
          setMessages(
            data.messages.map(
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
            ),
          )
          return
        }

        setMessages([welcomeMessage])
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([welcomeMessage])
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, user?.firstName])

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

    const assistantMessageId = `${Date.now() + 1}`
    setMessages((previous) => [
      ...previous,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ])

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
        const errorPayload = await response.json().catch(() => null) as
          | { error?: string }
          | null
        throw new Error(errorPayload?.error ?? "Nao foi possivel continuar a conversa.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const lines = decoder.decode(value).split("\n")
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
                    ? { ...message, content: message.content + chunk.delta }
                    : message,
                ),
              )
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
                setSessionId(chunk.sessionId)
                onSessionChange?.(chunk.sessionId)
              }
              onAgentTurnCompleted?.(chunk)
              continue
            }

            if ("error" in chunk) {
              if (chunk.action === "new_session") {
                setSessionLimitReached(true)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado."
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: `Aviso: ${message}` }
            : item,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (!disabled) {
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

    if (disabled) {
      return
    }

    const file = event.dataTransfer.files[0]
    if (file && (file.type === "application/pdf" || file.name.endsWith(".docx"))) {
      setUploadedFile(file)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {messageCount > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mensagem {messageCount} de {maxMessages} nesta analise
            </span>
            <div className="flex items-center gap-2 text-xs">
              {phase !== "intake" && (
                <span className="text-muted-foreground">Fase: {phase}</span>
              )}
              {atsScore !== undefined && (
                <span className="text-muted-foreground">ATS: {atsScore}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {messages.length === 1 && (
        <div className="px-4 py-12 text-center">
          <h1 className="mb-3 text-2xl font-bold md:text-3xl">
            Ola, {userName}!
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Cole a descricao da vaga e envie seu curriculo para iniciar a analise ATS.
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 px-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div
        className={cn(
          "border-t border-border p-4 transition-colors",
          isDragging && "border-primary bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {uploadedFile && (
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
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Cole a descricao da vaga aqui..."
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

          {sessionLimitReached ? (
            <p className="text-center text-xs text-amber-600">
              Esta sessao atingiu o limite de mensagens. Inicie uma nova analise para continuar.
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Arraste um arquivo PDF ou DOCX, ou clique no botao de upload.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
