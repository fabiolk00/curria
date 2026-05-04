# Summary

## Resultado

Telas `/entrar` e `/criar-conta` atualizadas com a estética do zip enviado, mantendo os formulários reais de autenticação do app. A nova logo PNG da Trampofy foi aplicada no componente global de marca, removendo o ícone antigo de robô e o wordmark textual montado em React.

## Arquivos principais

- `public/trampofy-logo.png`
- `src/components/brand-wordmark.tsx`
- `src/components/logo.tsx`
- `src/components/auth/auth-shell.tsx`
- `src/components/landing/seo-pages/routes/developer-page.tsx`

## Validação

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm test`: passou
- `npm run build`: passou
- `http://localhost:3002/entrar`: 200, contém `trampofy-logo.png`
- `http://localhost:3002/criar-conta`: 200, contém `trampofy-logo.png`
