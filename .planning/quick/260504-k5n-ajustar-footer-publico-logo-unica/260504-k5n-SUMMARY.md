# Summary

## Resultado

O footer público agora usa somente a logo à esquerda, em tamanho maior. O lado direito mantém apenas o ano de copyright. O link `Preços` também foi corrigido para UTF-8 limpo.

## Arquivo alterado

- `src/components/landing/footer.tsx`

## Validação

- Busca por mojibake/BrandWordmark no footer: sem ocorrências.
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `http://localhost:3002/`: 200, logo e link `Preços` presentes.
