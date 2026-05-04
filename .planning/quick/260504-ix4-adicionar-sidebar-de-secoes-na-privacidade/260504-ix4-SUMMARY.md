# Summary

## Resultado

A página `/privacidade` agora segue o padrão de `/termos`: header público no topo, sidebar sticky com seções clicáveis no desktop, destaque automático da seção ativa e conteúdo centralizado.

## Arquivos alterados

- `src/app/(public)/privacidade/page.tsx`
- `src/components/privacy/privacy-page.tsx`

## Validação

- Busca por mojibake nos arquivos novos: sem ocorrências.
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou após repetir erro transitório de cache do Next.
- `http://localhost:3002/privacidade`: 200, logo nova presente, sidebar presente.
