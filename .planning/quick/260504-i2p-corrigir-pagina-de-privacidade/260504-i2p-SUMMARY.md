# Summary

## Resultado

A página `/privacidade` foi reescrita em pt-BR correto, com Trampofy preenchido no texto legal, data de atualização corrigida e header público atual com logo nova. O uso de `BrandText` dentro do parágrafo foi removido para evitar buracos no texto.

## Arquivo alterado

- `src/app/(public)/privacidade/page.tsx`

## Validação

- Busca por mojibake na página: sem ocorrências.
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `http://localhost:3002/privacidade`: 200, logo nova presente, texto `Última atualização` presente, sem caractere `�`.
