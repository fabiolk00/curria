# Quick Task: Garantir ATS Enhancement sem sidebar global

## Escopo

- Garantir que a sidebar global do dashboard suma também na rota legada singular:
  - `/dashboard/resume/compare/[sessionId]`
- Manter a remoção na rota nova:
  - `/dashboard/resumes/compare/[sessionId]`
- Preservar o header limpo da tela de comparação.
- Manter o painel sticky de diagnóstico do Job Targeting.

## Validação

- Atualizar teste do `DashboardShell` para cobrir a rota legada.
- Rodar testes focados de shell e comparação.
- Rodar typecheck, lint e auditoria de copy.
