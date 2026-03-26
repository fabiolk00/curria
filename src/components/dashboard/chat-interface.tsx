"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage } from "./chat-message"
import { Send, Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Phase } from "@/types/agent"

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

// Welcome message
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Olá! Sou a CurrIA. Cole uma descrição de vaga e envie seu currículo para começar a análise.",
  timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
}

interface ChatInterfaceProps {
  sessionId: string
  userName?: string
}

export function ChatInterface({ sessionId, userName = "Você" }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [phase, setPhase] = useState<Phase>("intake")
  const [atsScore, setAtsScore] = useState<number | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load existing messages on mount
  useEffect(() => {
    fetch(`/api/session/${sessionId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages(
            data.messages.map(
              (
                m: { role: string; content: string; createdAt: string },
                i: number
              ) => ({
                id: String(i),
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            )
          )
        } else {
          setMessages([WELCOME_MESSAGE])
        }
      })
  }, [sessionId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if ((!input.trim() && !uploadedFile) || isStreaming) return

    // Add user message immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: uploadedFile ? `${input}\n\n📎 ${uploadedFile.name}` : input,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    const fileToSend = uploadedFile
    setUploadedFile(null)
    setIsStreaming(true)

    // Convert file to base64 if present
    let fileBase64: string | undefined
    let fileMime: string | undefined
    if (fileToSend) {
      fileBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.readAsDataURL(fileToSend)
      })
      fileMime = fileToSend.type
    }

    // Call /api/agent and stream the response
    const agentMsgId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      {
        id: agentMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ])

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: input,
          file: fileBase64,
          fileMime,
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split("\n")
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const chunk = JSON.parse(line.slice(6))
            if (chunk.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, content: m.content + chunk.delta }
                    : m
                )
              )
            }
            if (chunk.done) {
              setPhase(chunk.phase)
              if (chunk.atsScore?.total) setAtsScore(chunk.atsScore.total)
            }
            if (chunk.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, content: "Erro: " + chunk.error }
                    : m
                )
              )
            }
          } catch {
            /* skip malformed lines */
          }
        }
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (
      file &&
      (file.type === "application/pdf" || file.name.endsWith(".docx"))
    ) {
      setUploadedFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Welcome header */}
      {messages.length === 1 && (
        <div className="text-center py-12 px-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Olá, {userName}!
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Cole uma descrição de vaga e envie seu currículo para começar a
            análise ATS.
          </p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 md:px-6">
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div
        className={cn(
          "border-t border-border p-4 transition-colors",
          isDragging && "bg-primary/5 border-primary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Uploaded file chip */}
          {uploadedFile && (
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-fit">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">{uploadedFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setUploadedFile(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Input row */}
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
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
              disabled={isStreaming}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cole a descrição da vaga aqui..."
              className="min-h-[44px] max-h-[200px] resize-none"
              rows={1}
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={(!input.trim() && !uploadedFile) || isStreaming}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Arraste e solte um arquivo PDF ou DOCX, ou clique no botão de upload
          </p>
        </div>
      </div>
    </div>
  )
}
