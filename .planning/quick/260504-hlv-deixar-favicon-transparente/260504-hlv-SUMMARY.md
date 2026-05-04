# Summary

## Resultado

O fundo branco conectado às bordas do PNG foi transformado em transparência. O centro da marca permaneceu opaco. A metadata passou a usar `/trampofy-icon.png` como favicon principal para evitar cache do endpoint automático `/icon.png`.

## Arquivos alterados

- `public/trampofy-icon.png`
- `src/app/icon.png`
- `src/app/layout.tsx`

## Validação

- `public/trampofy-icon.png`: canto com alpha 0, centro com alpha 255.
- `src/app/icon.png`: canto com alpha 0, centro com alpha 255.
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
