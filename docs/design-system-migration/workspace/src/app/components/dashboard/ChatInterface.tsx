import { useEffect, useRef, useState } from "react"
import { FileText, Send, Upload, X } from "lucide-react"

import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"
import { Textarea } from "../ui/textarea"
import { cn } from "../ui/utils"
import type { AgentStreamChunk, Phase } from "../../types/agent"

import { ChatMessage } from "./ChatMessage"

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
  userName = "Você",
  disabled = false,
  onSessionChange,
  onStreamingChange,
  onAgentTurnCompleted,
}: ChatInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    createWelcomeMessage(userName),
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

    // Mock API call delay
    setTimeout(() => {
      const assistantMessageId = `${Date.now() + 1}`
      setMessages((previous) => [
        ...previous,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "Esta é uma resposta de demonstração. A integração real com o backend está pendente.",
          timestamp: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ])
      setIsStreaming(false)
      if (onAgentTurnCompleted) {
        onAgentTurnCompleted({ done: true, phase: "dialog", atsScore: { total: 85 } })
      }
    }, 1500)
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
    <div className="flex h-full min-h-[500px] flex-col relative">
      {messageCount > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mensagem {messageCount} de {maxMessages} nesta análise
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
            Olá, {userName}!
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Cole a descrição da vaga e envie seu currículo para iniciar a análise ATS.
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 px-4 md:px-6 absolute inset-0 bottom-[120px]">
        <div className="mx-auto max-w-3xl space-y-6 py-6 h-full">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div
        className={cn(
          "border-t border-border p-4 transition-colors absolute bottom-0 left-0 right-0 bg-background",
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
              placeholder="Cole a descrição da vaga aqui..."
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
              Esta sessão atingiu o limite de mensagens. Inicie uma nova análise para continuar.
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Arraste um arquivo PDF ou DOCX, ou clique no botão de upload.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
