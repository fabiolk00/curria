import { Bot, Check, Download, User, X } from "lucide-react"

import ATSScoreBadge from "@/components/ats-score-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { renderSimpleMarkdown } from "@/lib/utils/simple-markdown"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: string
  analysisResult?: {
    scoreBefore: number
    scoreAfter: number
    matchedKeywords: string[]
    missingKeywords: string[]
    suggestions: string[]
  }
}

export function ChatMessage({ role, content, timestamp, analysisResult }: ChatMessageProps) {
  const isAssistant = role === "assistant"

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
              : "bg-primary text-primary-foreground rounded-tr-md",
          )}
        >
          <div className="text-sm">
            {isAssistant ? renderSimpleMarkdown(content) : <p className="whitespace-pre-wrap">{content}</p>}
          </div>
          {timestamp && (
            <p
              className={cn(
                "text-xs mt-2",
                isAssistant ? "text-muted-foreground" : "text-primary-foreground/70",
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
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
