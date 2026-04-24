# Quick Task Summary - 260424-dpi

## Goal

Remover o erro de build em produção na página `/chat`.

## What Changed

- Atualizei `BillingInfoSurface` em `src/lib/asaas/optional-billing-info.ts`.
- O helper agora aceita o surface `"chat_page"`, que já era o valor enviado por `src/app/(auth)/chat/page.tsx`.

## Validation

- `npm run typecheck`

## Result

O typecheck voltou a passar e a página `/chat` ficou alinhada com o contrato tipado do helper de billing opcional.
