# Summary

## Resultado

O favicon não usa mais a rota automática `/icon.png`. O HTML agora aponta diretamente para `/trampofy-icon.png`, que é o PNG transparente em `public/`.

## Arquivos alterados

- `src/app/icon.png`
- `public/trampofy-icon.png`
- `src/app/layout.tsx`

## Validação

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- HTML em `http://localhost:3002/termos`: `<link rel="icon" href="/trampofy-icon.png" type="image/png"/>`
- Asset servido em `http://localhost:3002/trampofy-icon.png`: canto com alpha 0, centro com alpha 255.
- Cache `.next` do dev server limpo e localhost reiniciado.
