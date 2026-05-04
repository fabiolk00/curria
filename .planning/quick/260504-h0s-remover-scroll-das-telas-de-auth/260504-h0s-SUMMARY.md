# Summary

## Resultado

As telas `/entrar` e `/criar-conta` foram ajustadas para não gerar scroll vertical nem horizontal em desktop, tablet e mobile. O layout agora usa `h-[100dvh]`, `overflow-hidden`, espaçamentos com `clamp()` e oculta elementos secundários em alturas baixas.

## Arquivos alterados

- `src/components/auth/auth-shell.tsx`
- `src/components/auth/auth-form-ui.tsx`

## Validação

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `npm test`: passou
- Playwright scroll check: passou em `/entrar` e `/criar-conta` para 1440x900, 1366x768, 1024x640, 768x1024, 430x932, 390x844, 375x667 e 320x568.
- Localhost `http://localhost:3002/entrar`: 200
- Localhost `http://localhost:3002/criar-conta`: 200
