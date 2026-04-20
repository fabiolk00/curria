const STAGE_LABELS: Record<string, string> = {
  queued: 'Preparando exportacao',
  processing: 'Preparando exportacao',
  reserve_credit: 'Reservando crédito',
  render_artifact: 'Gerando PDF',
  finalize_credit: 'Finalizando exportacao',
  release_credit: 'Liberando crédito',
  needs_reconciliation: 'Estamos conferindo a cobranca; seu arquivo continua disponivel',
  completed: 'Concluido',
  generation_failed: 'Falha na exportacao',
}

export function getArtifactStageLabel(stage?: string): string | null {
  if (!stage) {
    return null
  }

  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}
