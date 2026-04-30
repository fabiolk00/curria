# Summary: Restaurar sticky do diagnóstico

## Implementado

- Restaurado `lg:sticky lg:top-4 lg:self-start` no bloco `job-targeting-diagnostic-column`.
- Mantida a remoção da sidebar global esquerda do dashboard na rota de comparação.
- Adicionada asserção no teste para proteger o comportamento sticky do painel de diagnóstico.

## Arquivos alterados

- `src/components/resume/resume-comparison-view.tsx`
- `src/components/resume/resume-comparison-view.test.tsx`

## Validação

- `npm test -- src/components/resume/resume-comparison-view.test.tsx src/components/dashboard/dashboard-shell.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
