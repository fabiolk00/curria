# Quick Task 260424-dpi - Fix production build type error for `/chat` billing surface

## Goal

Corrigir o erro de typecheck em produção causado pela página `/chat` enviar o surface `"chat_page"` para `loadOptionalBillingInfo(...)` sem que esse valor existisse no tipo `BillingInfoSurface`.

## Tasks

### Task 1 - Alinhar o contrato tipado do billing helper com a rota `/chat`

**Files**
- `src/lib/asaas/optional-billing-info.ts`

**Action**
- Adicionar `chat_page` ao union type `BillingInfoSurface`.
- Preservar os surfaces já existentes para não alterar logs nem comportamento das outras páginas.

**Verify**
- `npm run typecheck`
