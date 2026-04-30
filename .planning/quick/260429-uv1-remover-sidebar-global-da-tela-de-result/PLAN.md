# Quick Task: Remover sidebar global da tela de resultado

## Escopo

- Remover a sidebar global do dashboard apenas na rota de comparação de currículo:
  - `/dashboard/resumes/compare/[sessionId]`
- Remover também o botão mobile de abrir menu nessa rota.
- Manter a sidebar global nas demais rotas autenticadas.
- Preservar billing notice e conteúdo da página.

## Validação

- Adicionar cobertura para `DashboardShell`.
- Rodar testes focados de dashboard shell e resultado de currículo.
- Rodar typecheck, lint e auditoria de copy.
