# Quick Task: Deixar favicon transparente

## Objetivo

Remover o fundo branco do PNG usado como favicon e ícone do sidebar sem apagar detalhes internos da marca.

## Plano

- Detectar o fundo branco opaco no PNG.
- Aplicar flood fill a partir das bordas para tornar transparente apenas branco conectado ao fundo.
- Salvar o resultado em `public/trampofy-icon.png` e `src/app/icon.png`.
- Apontar metadata do favicon para o asset público transparente.
- Validar alpha, typecheck, lint e build.

## Validação

- Verificar alpha do pixel do canto.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
