# Summary: Corrigir layout de Job Targeting

## Implementado

- Job Targeting agora usa duas colunas no desktop:
  - currículo à esquerda;
  - compatibilidade com a vaga e pontos para revisar à direita.
- Removida a seção "Sugestões para melhorar sua aderência" da tela.
- O botão de abrir/ocultar controla apenas o currículo do Job Targeting.
- O card "Pontos para revisar" permanece visível na coluna direita e mantém scroll interno próprio.
- ATS Enhancement continua sem sidebar e mantém comparação original/otimizado.

## Arquivos alterados

- `src/components/resume/resume-comparison-view.tsx`
- `src/components/resume/review-warning-panel.tsx`
- `src/components/resume/resume-comparison-view.test.tsx`

## Validação

- `npm test -- src/components/resume/resume-comparison-view.test.tsx src/components/resume/review-warning-panel.test.tsx src/components/resume/job-targeting-score-card.test.tsx src/components/resume/target-recommendations-card.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
