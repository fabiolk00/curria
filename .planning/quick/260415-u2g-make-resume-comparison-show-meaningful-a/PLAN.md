# Quick Task 260415-u2g Plan

## Goal

Fazer a tela de comparação de currículo realmente refletir uma geração útil: rota dedicada própria, score ATS coerente em pt-BR, comparação completa sem truncamento e rewriter mais assertivo quando a versão otimizada sai parecida demais com a base.

## Tasks

1. Mover o pós-geração de `dashboard/resume/new` para uma rota dedicada de comparação com carregamento por `sessionId`.
2. Expor um endpoint de comparação que recalcule score atual para os dois lados e não dependa de análise antiga da sessão.
3. Corrigir o score ATS para currículo em pt-BR e passar a analisar o texto estruturado com headings reais.
4. Tornar o `rewriteResumeFull` mais exigente para `summary`, `experience` e `skills` quando a reescrita vier quase igual.
5. Atualizar regressões do setup page, da comparação e do score ATS.

## Verification

- `npm run typecheck`
- `npm test -- src/lib/ats/score.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/user-data-page.test.tsx src/app/api/session/[id]/comparison/route.test.ts`
- `npm run audit:copy-regression`
