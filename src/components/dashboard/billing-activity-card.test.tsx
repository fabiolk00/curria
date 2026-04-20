import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBillingHistory } from '@/lib/dashboard/workspace-client'

import { BillingActivityCard } from './billing-activity-card'

vi.mock('@/lib/dashboard/workspace-client', () => ({
  getBillingHistory: vi.fn(),
}))

describe('BillingActivityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders localized labels for reserve, finalize, release, and reconciliation states', async () => {
    vi.mocked(getBillingHistory).mockResolvedValue({
      entries: [
        {
          createdAt: '2026-04-20T11:00:00.000Z',
          generationIntentKey: 'intent_hold',
          reservationStatus: 'reserved',
          reconciliationStatus: 'pending',
          ledgerEntryType: 'reservation_hold',
          creditsDelta: -1,
          eventLabel: 'Crédito reservado para exportação',
          eventStatus: 'pending',
          sessionId: 'sess_1',
        },
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          generationIntentKey: 'intent_finalize',
          reservationStatus: 'finalized',
          reconciliationStatus: 'clean',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Exportação concluída e cobrada',
          eventStatus: 'completed',
          sessionId: 'sess_2',
        },
        {
          createdAt: '2026-04-20T09:00:00.000Z',
          generationIntentKey: 'intent_release',
          reservationStatus: 'released',
          reconciliationStatus: 'clean',
          ledgerEntryType: 'reservation_release',
          creditsDelta: 1,
          eventLabel: 'Crédito liberado após falha na exportação',
          eventStatus: 'released',
          sessionId: 'sess_3',
        },
        {
          createdAt: '2026-04-20T08:00:00.000Z',
          generationIntentKey: 'intent_reconcile',
          reservationStatus: 'needs_reconciliation',
          reconciliationStatus: 'pending',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Cobrança concluída com reconciliação pendente',
          eventStatus: 'attention',
          sessionId: 'sess_4',
        },
      ],
    })

    render(<BillingActivityCard />)

    await waitFor(() => {
      expect(getBillingHistory).toHaveBeenCalledWith(10)
    })

    expect(screen.getByText('Crédito reservado para exportação')).toBeInTheDocument()
    expect(screen.getByText('Exportação concluída e cobrada')).toBeInTheDocument()
    expect(screen.getByText('Crédito liberado após falha na exportação')).toBeInTheDocument()
    expect(screen.getByText('Cobrança concluída com reconciliação pendente')).toBeInTheDocument()
    expect(screen.getByText('Reserva criada e aguardando o fechamento da exportação.')).toBeInTheDocument()
    expect(screen.getByText('A exportação foi entregue e o débito foi confirmado.')).toBeInTheDocument()
    expect(screen.getByText('A tentativa não consumiu crédito no fim do fluxo.')).toBeInTheDocument()
    expect(screen.getByText('O arquivo pode ter sido entregue, mas a cobrança ainda está em conferência.')).toBeInTheDocument()
  })

  it('renders an explicit empty state instead of a blank card', async () => {
    vi.mocked(getBillingHistory).mockResolvedValue({
      entries: [],
    })

    render(<BillingActivityCard />)

    expect(await screen.findByText('Nenhuma atividade recente de exportação por aqui.')).toBeInTheDocument()
    expect(screen.getByText('Quando você gerar arquivos, as reservas, cobranças e liberações vão aparecer nesta linha do tempo.')).toBeInTheDocument()
  })

  it('keeps history failures non-blocking and explains reconciliation rows without implying double charge', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getBillingHistory)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        entries: [
          {
            createdAt: '2026-04-20T08:00:00.000Z',
            generationIntentKey: 'intent_reconcile',
            reservationStatus: 'needs_reconciliation',
            reconciliationStatus: 'pending',
            ledgerEntryType: 'reservation_finalize',
            creditsDelta: -1,
            eventLabel: 'Cobrança concluída com reconciliação pendente',
            eventStatus: 'attention',
            sessionId: 'sess_4',
          },
        ],
      })

    const { unmount } = render(<BillingActivityCard />)

    expect(await screen.findByText('Não foi possível carregar a atividade de créditos agora. A página de configurações continua disponível.')).toBeInTheDocument()
    expect(screen.queryByText('cobrança duplicada')).not.toBeInTheDocument()

    unmount()
    render(<BillingActivityCard />)

    expect(await screen.findByText('Cobrança concluída com reconciliação pendente')).toBeInTheDocument()
    expect(screen.getByText('O arquivo pode ter sido entregue, mas a cobrança ainda está em conferência.')).toBeInTheDocument()
    expect(screen.queryByText(/cobrança duplicada/i)).not.toBeInTheDocument()
  })
})
