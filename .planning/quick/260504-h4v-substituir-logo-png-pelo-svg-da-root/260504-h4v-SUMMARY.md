# Summary

## Resultado

A logo global foi trocada de `trampofy-logo.png` para o SVG oficial da raiz do projeto, publicado como `public/trampofy-logo.svg`.

## Arquivos alterados

- `public/trampofy-logo.svg`
- `src/components/brand-wordmark.tsx`

## Validação

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `http://localhost:3002/entrar`: 200, usa `trampofy-logo.svg`
- `http://localhost:3002/criar-conta`: 200, usa `trampofy-logo.svg`
