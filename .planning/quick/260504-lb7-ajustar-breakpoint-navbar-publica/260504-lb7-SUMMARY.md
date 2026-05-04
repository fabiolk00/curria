# Summary

## Resultado

A navbar pública agora usa o hamburger abaixo de `lg`, evitando sobreposição em dimensões intermediárias. Os textos do header também foram normalizados para UTF-8 limpo.

## Arquivo alterado

- `src/components/landing/header.tsx`

## Validação

- Busca por mojibake no header: sem ocorrências.
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- Playwright 811x918 em `/termos`: `navDisplay=none`, `menuVisible=true`, `horizontalOverflow=false`.
