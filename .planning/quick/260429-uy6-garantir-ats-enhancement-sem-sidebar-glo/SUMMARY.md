# Summary: Garantir ATS Enhancement sem sidebar global

## Implementado

- `DashboardShell` agora remove a sidebar global em ambas as rotas de comparação:
  - `/dashboard/resumes/compare/*`
  - `/dashboard/resume/compare/*`
- Isso cobre a rota atual e a rota legada singular usada por fluxos antigos, incluindo ATS Enhancement.
- O header limpo da tela de comparação continua preservado com apenas "Voltar ao Perfil".
- O painel sticky do Job Targeting foi mantido.

## Arquivos alterados

- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-shell.test.tsx`
- `src/components/resume/resume-comparison-view.test.tsx`

## Validação

- `npm test -- src/components/dashboard/dashboard-shell.test.tsx src/components/resume/resume-comparison-view.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
