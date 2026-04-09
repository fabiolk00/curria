import { Bot, Check, Download, Loader2, User, X } from "lucide-react"

import ATSScoreBadge from "@/components/ats-score-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { renderSimpleMarkdown } from "@/lib/utils/simple-markdown"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: string
  toolStatus?: string
  userAvatarUrl?: string | null
  analysisResult?: {
    scoreBefore: number
    scoreAfter: number
    matchedKeywords: string[]
    missingKeywords: string[]
    suggestions: string[]
  }
}

function ThinkingIndicator() {
  return (
    <div className="inline-flex items-center gap-2 text-sm font-medium">
      <span>Pensando</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  )
}

export function ChatMessage({
  role,
  content,
  timestamp,
  toolStatus,
  userAvatarUrl,
  analysisResult,
}: ChatMessageProps) {
  const isAssistant = role === "assistant"
  const isThinking = isAssistant && content === "Pensando..."

  return (
    <div className={cn("flex gap-3", isAssistant ? "justify-start" : "justify-end")}>
      {isAssistant && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[85%] space-y-3", !isAssistant && "order-first")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isAssistant
              ? "bg-card border border-border text-card-foreground rounded-tl-md"
              : "rounded-tr-md bg-[#f0eee6] text-foreground shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] ring-1 ring-black/5",
          )}
        >
          <div className="text-sm">
            {isThinking ? (
              <ThinkingIndicator />
            ) : isAssistant ? (
              renderSimpleMarkdown(content)
            ) : (
              <p className="whitespace-pre-wrap">{content}</p>
            )}
          </div>
          {isAssistant && toolStatus ? (
            <div
              className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="tool-status"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{toolStatus}</span>
            </div>
          ) : null}
          {timestamp && (
            <p
              className={cn(
                "text-xs mt-2",
                isAssistant ? "text-muted-foreground" : "text-muted-foreground",
              )}
            >
              {timestamp}
            </p>
          )}
        </div>

        {analysisResult && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Score Antes</p>
                  <ATSScoreBadge score={analysisResult.scoreBefore} showLabel={false} />
                </div>
                <div className="text-2xl text-muted-foreground">→</div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Score Depois</p>
                  <ATSScoreBadge score={analysisResult.scoreAfter} showLabel={false} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Palavras-chave correspondentes</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.matchedKeywords.map((keyword, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <Check className="h-3 w-3 text-green-500" />
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              {analysisResult.missingKeywords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Palavras-chave faltando (adicionadas)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.missingKeywords.map((keyword, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs gap-1 border-yellow-500/50 text-yellow-500"
                      >
                        <X className="h-3 w-3" />
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Melhorias aplicadas</p>
                <ul className="space-y-1">
                  {analysisResult.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              <Button className="w-full gap-2" size="sm">
                <Download className="h-4 w-4" />
                Baixar currículo otimizado
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {!isAssistant && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={userAvatarUrl ?? undefined} alt="Sua foto de perfil" />
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
