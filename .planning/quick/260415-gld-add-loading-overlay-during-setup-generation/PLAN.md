# Quick Task 260415-gld Plan

## Goal

Adicionar um overlay visual de carregamento durante a geração de currículo na tela `dashboard/resume/new`, com foco especial no fluxo de melhoria ATS.

## Tasks

1. Criar um componente de loading com progresso visual e mensagens de geração.
2. Integrar o componente ao `user-data-page` enquanto a request de smart generation estiver em andamento.
3. Adicionar as animações necessárias no Tailwind e cobrir o comportamento com teste.

## Verification

- `npm run typecheck`
- `npm test -- src/components/resume/user-data-page.test.tsx`
- `npm run audit:copy-regression`
