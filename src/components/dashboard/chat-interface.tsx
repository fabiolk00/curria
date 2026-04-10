"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { FileText, Send, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { AGENT_CONFIG } from "@/lib/agent/config"
import { cn } from "@/lib/utils"
import type { AgentDoneChunk, AgentStreamChunk, Phase } from "@/types/agent"

import { ChatMessage } from "./chat-message"

const EMPTY_ASSISTANT_RESPONSE_FALLBACK = "Analisei sua mensagem, mas não consegui concluir a resposta desta vez. Tente enviar novamente."
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

type ProfileResponse = {
  profile: {
    profilePhotoUrl: string | null
  } | null
}

type SessionMessagePayload = {
  role: string
  content: string
  createdAt: string
}

function hasConversationMessages(items: Message[]): boolean {
  return items.some((message) => message.id !== "welcome")
}

function isLegacyWelcomeMessage(content: string): boolean {
  return (
    content.includes("Sou seu consultor especialista em ATS e RH.") &&
    content.includes("Envie seu currículo em PDF ou DOCX") &&
    content.includes("cole a descrição da vaga para eu iniciar a análise.")
  )
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
    description: "Cole a descricao da vaga para eu adaptar seu curriculo ATS com base no perfil salvo.",
    placeholder: "Cole a descricao da vaga aqui...",
    helperText: "Quando fizer sentido, clique em Aceito para gerar seu curriculo.",
    thinkingText: "Pensando...",
    sessionCounterLabel: "nesta an\u00E1lise",
    sessionExpiredText: "Sess\u00E3o n\u00E3o encontrada. Inicie uma nova an\u00E1lise para continuar.",
    sessionLimitText: "Esta sess\u00E3o atingiu o limite de mensagens. Inicie uma nova an\u00E1lise para continuar.",
    allowFileUpload: false,
  }
}

function createWelcomeMessage(firstName?: string): Message {
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!"

  return {
    id: "welcome",
    role: "assistant",
    content: `${greeting} Sou seu consultor especialista em ATS e RH.

Já analisei o seu perfil, qualificações e habilidades com base no que você preencheu em "Meu Perfil".

Envie o texto da vaga ou o link que vamos avaliar o match com ela!`,
    timestamp: "",
  }
}

function isCreditExhaustedError(message?: string): boolean {
  return Boolean(message && CREDIT_EXHAUSTED_ERROR_PATTERN.test(message))
}

function isRecoverableStreamError(chunk: { code?: string; error?: string }): boolean {
  return chunk.code === "LLM_INVALID_OUTPUT"
    || Boolean(chunk.error && /invalid .*payload/i.test(chunk.error))
}

function normalizeFetchedMessages(
  payload: SessionMessagePayload[],
  welcomeMessage: Message,
): Message[] {
  return payload.map((message, index) => ({
    id: String(index),
    role: message.role as "user" | "assistant",
    content:
      message.role === "assistant" && index === 0 && isLegacyWelcomeMessage(message.content)
        ? welcomeMessage.content
        : message.content,
    timestamp: new Date(message.createdAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }))
}

function choosePreferredTranscriptMessage(
  clientMessage: Message | undefined,
  serverMessage: Message,
  thinkingText: string,
): Message {
  if (!clientMessage || clientMessage.role !== serverMessage.role) {
    return serverMessage
  }

  const clientContent = clientMessage.content.trim()
  const serverContent = serverMessage.content.trim()
  const normalizedClientContent = clientContent === thinkingText ? "" : clientContent
  const normalizedServerContent = serverContent === thinkingText ? "" : serverContent

  if (!normalizedServerContent && normalizedClientContent) {
    return {
      ...serverMessage,
      content: clientMessage.content,
      timestamp: clientMessage.timestamp || serverMessage.timestamp,
    }
  }

  if (!normalizedClientContent && normalizedServerContent) {
    return serverMessage
  }

  if (normalizedClientContent.length > normalizedServerContent.length) {
    return {
      ...serverMessage,
      content: clientMessage.content,
      timestamp: clientMessage.timestamp || serverMessage.timestamp,
    }
  }

  return serverMessage
}

function mergeFetchedTranscriptMessages(
  previous: Message[],
  serverMessages: Message[],
  thinkingText: string,
): Message[] {
  const previousConversation = previous.filter((message) => message.id !== "welcome")

  if (previousConversation.length === 0) {
    return serverMessages
  }

  if (serverMessages.length === 0) {
    return previous
  }

  const comparableLength = Math.min(previousConversation.length, serverMessages.length)
  const rolesStayAligned = Array.from({ length: comparableLength }).every((_, index) =>
    previousConversation[index]?.role === serverMessages[index]?.role,
  )

  if (!rolesStayAligned) {
    return serverMessages.length < previousConversation.length ? previousConversation : serverMessages
  }

  const merged = serverMessages.map((serverMessage, index) =>
    choosePreferredTranscriptMessage(previousConversation[index], serverMessage, thinkingText),
  )

  if (previousConversation.length > serverMessages.length) {
    return [...merged, ...previousConversation.slice(serverMessages.length)]
  }

  return merged
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

type SessionSnapshotResponse = {
  session?: {
    phase?: Phase
    atsScore?: {
      total?: number
    }
    messageCount?: number
  }
}

function ChatWindowChrome() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2 rounded-full bg-[#faf9f5]/90 px-3 py-2 backdrop-blur"
    >
      <span className="h-3 w-3 rounded-full bg-rose-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="h-3 w-3 rounded-full bg-amber-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="h-3 w-3 rounded-full bg-emerald-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
    </div>
  )
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
  const preferredName = userName.trim() || user?.firstName?.trim() || undefined
  const copy = useMemo(
    () => getChatCopy(preferredName),
    [preferredName],
  )
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    createWelcomeMessage(preferredName),
  ])
  const [input, setInput] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isToolExecuting, setIsToolExecuting] = useState(false)
  const [currentToolName, setCurrentToolName] = useState<string | null>(null)
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("intake")
  const [atsScore, setAtsScore] = useState<number | undefined>()
  const [messageCount, setMessageCount] = useState(0)
  const [maxMessages] = useState(AGENT_CONFIG.maxMessagesPerSession)
  const [sessionLimitReached, setSessionLimitReached] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInputDisabled = disabled || isStreaming || sessionLimitReached || sessionExpired
  const showGenerationApproval = phase === "confirm" || (phase === "dialog" && atsScore !== undefined)

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

  const appendAssistantMessageContent = (assistantMessageId: string, content: string): void => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: message.content === copy.thinkingText ? content : message.content + content,
            }
          : message,
      ),
    )
  }

  const refreshSessionSnapshot = async (targetSessionId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/session/${targetSessionId}`, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to refetch session (${response.status})`)
      }

      const data = (await response.json()) as SessionSnapshotResponse
      if (!data.session) {
        return
      }

      if (data.session.phase) {
        setPhase(data.session.phase)
      }

      if (data.session.atsScore?.total !== undefined) {
        setAtsScore(data.session.atsScore.total)
      }

      if (data.session.messageCount !== undefined) {
        setMessageCount(data.session.messageCount)
      }
    } catch {
      console.error("[chat] failed to refetch session on done")
    }
  }

  useEffect(() => {
    const welcomeMessage = createWelcomeMessage(preferredName)

    setSessionId(initialSessionId)
    setSessionExpired(false)
    setSessionLimitReached(false)

    if (!initialSessionId) {
      setPhase("intake")
      setAtsScore(undefined)
      setMessageCount(0)
      setUploadedFile(null)
      setMessages([welcomeMessage])
    }
  }, [initialSessionId, preferredName])

  useEffect(() => {
    onStreamingChange?.(isStreaming)
  }, [isStreaming, onStreamingChange])

  useEffect(() => {
    let isMounted = true

    const loadProfilePhoto = async (): Promise<void> => {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as ProfileResponse
        if (!isMounted) {
          return
        }

        setProfilePhotoUrl(data.profile?.profilePhotoUrl ?? null)
      } catch {
        if (isMounted) {
          setProfilePhotoUrl(null)
        }
      }
    }

    void loadProfilePhoto()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const welcomeMessage = createWelcomeMessage(preferredName)

    if (!sessionId) {
      setMessages((previous) => (hasConversationMessages(previous) ? previous : [welcomeMessage]))
      return
    }

    let cancelled = false

    fetch(`/api/session/${sessionId}/messages`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return
        }

        if (data.messages?.length) {
          const nextMessages = normalizeFetchedMessages(
            data.messages as SessionMessagePayload[],
            welcomeMessage,
          )

          setMessages((previous) => {
            return mergeFetchedTranscriptMessages(previous, nextMessages, copy.thinkingText)
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
  }, [copy.thinkingText, preferredName, sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (options?: { message?: string }): Promise<void> => {
    const overrideMessage = options?.message

    if ((!overrideMessage?.trim() && !input.trim() && !uploadedFile) || isInputDisabled) {
      return
    }

    const messageToSend = overrideMessage ?? input
    const fileToSend = uploadedFile

    const baseMessageId = Date.now()
    const userMessage: Message = {
      id: String(baseMessageId),
      role: "user",
      content: fileToSend ? `${messageToSend}\n\nAnexo: ${fileToSend.name}` : messageToSend,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setInput("")
    setUploadedFile(null)
    setIsStreaming(true)
    setIsToolExecuting(false)
    setCurrentToolName(null)

    const assistantMessageId = String(baseMessageId + 1)
    setActiveAssistantMessageId(assistantMessageId)
    setMessages((previous) => [
      ...previous,
      userMessage,
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
        credentials: "include",
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
          response.status === 401
            ? "Sua sessão expirou. Faça login novamente para continuar."
            : errorPayload && "error" in errorPayload
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
      let receivedDone = false
      let receivedError = false

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

              switch (chunk.type) {
                case "text":
                  appendAssistantMessageContent(assistantMessageId, chunk.content)
                  break

                case "sessionCreated":
                  applySessionState(chunk.sessionId)
                  onSessionChange?.(chunk.sessionId)
                  break

                case "toolStart":
                  setCurrentToolName(chunk.toolName)
                  setIsToolExecuting(true)
                  break

                case "toolResult":
                  break

                case "patch":
                  setIsToolExecuting(false)
                  setCurrentToolName(null)
                  setPhase(chunk.phase)
                  if (chunk.patch.atsScore?.total !== undefined) {
                    setAtsScore(chunk.patch.atsScore.total)
                  }
                  break

                case "done":
                  receivedDone = true
                  setIsToolExecuting(false)
                  setCurrentToolName(null)
                  setMessages((previous) =>
                    previous.map((message) =>
                      message.id === assistantMessageId && message.content === copy.thinkingText
                        ? { ...message, content: EMPTY_ASSISTANT_RESPONSE_FALLBACK }
                        : message,
                    ),
                  )
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
                    void refreshSessionSnapshot(chunk.sessionId)
                  }
                  onAgentTurnCompleted?.(chunk)
                  break

                case "error": {
                  setIsToolExecuting(false)
                  setCurrentToolName(null)
                  const shouldOpenCreditsModal =
                    isCreditExhaustedError(chunk.error)
                    || (chunk.action === "new_session" && currentCredits !== undefined && currentCredits <= 0)

                  if (chunk.action === "new_session") {
                    setSessionLimitReached(true)
                  }

                  if (shouldOpenCreditsModal) {
                    receivedError = true
                    onCreditsExhausted?.()
                  }

                  if (!isRecoverableStreamError(chunk)) {
                    receivedError = true
                    setMessages((previous) =>
                      previous.map((message) =>
                        message.id === assistantMessageId
                          ? { ...message, content: `Aviso: ${chunk.error}` }
                          : message,
                      ),
                    )
                  }
                  break
                }
              }
            } catch {
              continue
            }
          }
        }
      }

      if (!receivedDone && !receivedError) {
        setMessages((previous) =>
          previous.map((message) => {
            if (message.id !== assistantMessageId) {
              return message
            }

            const interruptionMessage = "Aviso: A resposta foi interrompida. Sua sessão foi salva e você pode tentar novamente."
            return {
              ...message,
              content: message.content === copy.thinkingText
                ? interruptionMessage
                : `${message.content}\n\n${interruptionMessage}`,
            }
          }),
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado."
      setIsToolExecuting(false)
      setCurrentToolName(null)
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantMessageId ? { ...item, content: `Aviso: ${message}` } : item,
        ),
      )
    } finally {
      setIsStreaming(false)
      setIsToolExecuting(false)
      setCurrentToolName(null)
      setActiveAssistantMessageId(null)
    }
  }

  const handleApproveGeneration = async (): Promise<void> => {
    await handleSend({ message: "Aceito" })
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
    <div
      data-testid="chat-interface"
      data-message-count={String(messageCount)}
      data-phase={phase}
      data-session-id={sessionId ?? ""}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#faf9f5]"
    >
      <div className="px-3 pb-1 pt-3 md:px-4">
        <ChatWindowChrome />
      </div>

      {messageCount > 0 && (
        <div className="px-3 py-2 md:px-4">
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
        <div className="px-3 pb-8 pt-5 text-center md:px-4">
          <h1 className="mb-3 text-2xl font-bold md:text-3xl">{copy.heading}</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            {copy.description}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 bg-[#faf9f5]">
        <ScrollArea className="h-full px-2 md:px-3 bg-[#faf9f5]">
          <div className="mx-auto w-full max-w-3xl space-y-6 pt-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                {...message}
                userAvatarUrl={message.role === "user" ? profilePhotoUrl ?? user?.imageUrl ?? null : null}
                toolStatus={
                  isToolExecuting && currentToolName && message.id === activeAssistantMessageId
                    ? `Executando ${currentToolName}...`
                    : undefined
                }
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          "flex-shrink-0 bg-[#faf9f5] px-2 py-3 transition-colors md:px-3",
          isDragging && "bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto max-w-3xl space-y-2">
          {showGenerationApproval ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/45 bg-[#fffaf0] px-4 py-3">
              <p className="text-sm text-foreground">
                {phase === "confirm"
                  ? (
                    <>
                      Quando fizer sentido, clique em <span className="font-semibold">Aceito</span> para gerar seu curriculo.
                    </>
                  )
                  : (
                    <>
                      Se a versao atual ja estiver boa para voce, clique em <span className="font-semibold">Aceito</span> para gerar seu curriculo.
                    </>
                  )}
              </p>
              <Button
                data-testid="chat-accept-generate"
                variant="secondary"
                className="rounded-2xl"
                disabled={isInputDisabled}
                onClick={() => void handleApproveGeneration()}
              >
                Aceito
              </Button>
            </div>
          ) : null}
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

          <div className="rounded-[1.75rem] border border-border/35 bg-[#ffffff] p-3 shadow-[0_18px_45px_-38px_oklch(var(--foreground)/0.7)] backdrop-blur">
            <div className="flex items-end gap-2">
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
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-2xl"
                    disabled={isInputDisabled}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Textarea
                data-testid="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={copy.placeholder}
                className="max-h-[220px] min-h-[54px] resize-none border-0 bg-[#ffffff] px-1 py-3 shadow-none focus-visible:ring-0 text-card-foreground"
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
                data-testid="chat-send-button"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-2xl"
                disabled={(!input.trim() && !uploadedFile) || isInputDisabled}
                onClick={() => void handleSend()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {sessionExpired ? (
            <p className="pb-1 text-center text-xs text-amber-600">
              {copy.sessionExpiredText}
            </p>
          ) : sessionLimitReached ? (
            <p className="pb-1 text-center text-xs text-amber-600">
              {copy.sessionLimitText}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {showGenerationApproval
                ? 'Para gerar o PDF final, responda com "Aceito" ou use o botao acima.'
                : copy.helperText}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
