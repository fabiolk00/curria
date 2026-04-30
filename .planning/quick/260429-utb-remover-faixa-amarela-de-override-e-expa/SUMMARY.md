# Summary: Remover faixa amarela e expandir layout

## Implementado

- Removida a faixa amarela global do estado `override_review`.
- Removido o comportamento `sticky` da coluna de diagnóstico do Job Targeting.
- A área principal de resultado agora usa `w-full`, sem limitar a largura pelo antigo `max-w-6xl`.
- O Job Targeting com diagnóstico usa duas colunas proporcionais em desktop, aproveitando a largura da tela.
- O painel "Pontos para revisar" continua com scroll interno próprio.

## Arquivos alterados

- `src/components/resume/resume-comparison-view.tsx`
- `src/components/resume/resume-comparison-view.test.tsx`

## Validação

- `npm test -- src/components/resume/resume-comparison-view.test.tsx src/components/resume/review-warning-panel.test.tsx src/components/resume/job-targeting-score-card.test.tsx src/components/resume/target-recommendations-card.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
