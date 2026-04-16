# Quick Task 260415-gld Summary

## What changed

- `src/components/resume/generation-loading.tsx` foi criado com um overlay de carregamento dedicado para a geração de currículo, incluindo progresso visual, mensagens rotativas e animações.
- `src/components/resume/user-data-page.tsx` agora renderiza esse overlay enquanto `isRunningAtsEnhancement` estiver ativo, cobrindo a espera da melhoria ATS e também o fluxo targetizado que reutiliza o mesmo estado operacional.
- `tailwind.config.js` ganhou as animações `wave`, `shimmer` e `bubble` para suportar o visual da barra de progresso.
- `src/components/resume/user-data-page.test.tsx` recebeu um teste cobrindo a aparição do overlay enquanto a request de geração ainda está pendente.

## Verification

- `npm run typecheck`
- `npm test -- src/components/resume/user-data-page.test.tsx`
- `npm run audit:copy-regression`
