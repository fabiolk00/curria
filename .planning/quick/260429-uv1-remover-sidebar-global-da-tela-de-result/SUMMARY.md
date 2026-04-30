# Summary: Remover sidebar global da tela de resultado

## Implementado

- `DashboardShell` agora detecta a rota `/dashboard/resumes/compare/*`.
- Nessa rota, a sidebar global do dashboard não é renderizada.
- O botão mobile "Abrir menu" também não aparece nessa rota.
- O conteúdo principal usa largura total com `min-h-screen w-full overflow-auto`.
- Demais rotas autenticadas continuam renderizando a sidebar normalmente.

## Arquivos alterados

- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-shell.test.tsx`

## Validação

- `npm test -- src/components/dashboard/dashboard-shell.test.tsx src/components/resume/resume-comparison-view.test.tsx src/components/resume/review-warning-panel.test.tsx src/components/resume/job-targeting-score-card.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
