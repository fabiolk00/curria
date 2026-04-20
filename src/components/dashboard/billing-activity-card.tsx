'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3, History, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getBillingHistory } from '@/lib/dashboard/workspace-client'
import { cn } from '@/lib/utils'
import type { BillingHistoryResponse } from '@/types/dashboard'

const HISTORY_LIMIT = 10
const LOAD_ERROR_NOTICE =
  'Não foi possível carregar a atividade de créditos agora. A página de configurações continua disponível.'

type BillingActivityRow = BillingHistoryResponse['entries'][number]

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getStatusLabel(status: BillingActivityRow['eventStatus']): string {
  switch (status) {
    case 'pending':
      return 'Reserva em andamento'
    case 'completed':
      return 'Cobrança confirmada'
    case 'released':
      return 'Crédito devolvido'
    case 'attention':
      return 'Requer acompanhamento'
    default:
      return 'Atividade recente'
  }
}

function getStatusTone(status: BillingActivityRow['eventStatus']): string {
  switch (status) {
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
    case 'released':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700'
    case 'attention':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-700'
    default:
      return 'border-border/60 bg-background/70 text-foreground'
  }
}

function getSupportingCopy(entry: BillingActivityRow): string {
  if (entry.eventStatus === 'pending') {
    return 'Reserva criada e aguardando o fechamento da exportação.'
  }

  if (entry.eventStatus === 'released') {
    return 'A tentativa não consumiu crédito no fim do fluxo.'
  }

  if (entry.eventStatus === 'attention') {
    return 'O arquivo pode ter sido entregue, mas a cobrança ainda está em conferência.'
  }

  return 'A exportação foi entregue e o débito foi confirmado.'
}

function getDeltaLabel(entry: BillingActivityRow): string {
  if (entry.creditsDelta < 0) {
    return `${entry.creditsDelta} crédito`
  }

  return `+${entry.creditsDelta} crédito`
}

export function BillingActivityCard() {
  const [entries, setEntries] = useState<BillingHistoryResponse['entries']>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadHistory() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await getBillingHistory(HISTORY_LIMIT)

        if (!isCancelled) {
          setEntries(response.entries)
        }
      } catch (loadError) {
        console.error('[billing-activity-card] failed to load history', loadError)

        if (!isCancelled) {
          setEntries([])
          setError(LOAD_ERROR_NOTICE)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <Card
      data-testid="billing-activity-card"
      className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]"
    >
      <CardHeader className="pt-8">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Billing activity
        </CardTitle>
        <CardDescription>
          Atividade recente de exportação baseada nas reservas e lançamentos de crédito mais recentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-8">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando atividade recente de exportação.
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-[1.5rem] border border-orange-500/30 bg-orange-500/10 px-4 py-4 text-sm text-orange-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {!isLoading && !error && entries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/60 px-6 py-10 text-center">
            <p className="text-sm font-medium">Nenhuma atividade recente de exportação por aqui.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando você gerar arquivos, as reservas, cobranças e liberações vão aparecer nesta linha do tempo.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article
                key={`${entry.generationIntentKey}:${entry.createdAt}:${entry.ledgerEntryType}`}
                className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-[11px]', getStatusTone(entry.eventStatus))}>
                        {getStatusLabel(entry.eventStatus)}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatActivityDate(entry.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{entry.eventLabel}</p>
                    <p className="text-sm text-muted-foreground">{getSupportingCopy(entry)}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold">{getDeltaLabel(entry)}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.sessionId ? `Sessão ${entry.sessionId}` : 'Exportação recente'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
