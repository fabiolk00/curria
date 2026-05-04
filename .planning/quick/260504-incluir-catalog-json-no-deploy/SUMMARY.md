# Quick Fix Summary: incluir catalogos JSON no deploy

## Problema

Em producao, a rota `/api/profile/smart-generation` falhava ao gerar job-target com `ENOENT` ao tentar ler:

`/var/task/src/lib/agent/job-targeting/catalog/generic-taxonomy.json`

## Causa

Os catalogos JSON de job targeting sao lidos via `fs` em runtime. No ambiente serverless da Vercel, arquivos lidos dinamicamente precisam entrar no output file tracing da rota para serem copiados junto com a function.

## Correcao

Atualizei `next.config.js` para incluir os JSONs de `src/lib/agent/job-targeting/catalog` no bundle serverless da rota `/api/profile/smart-generation`.

## Validacao

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `npm run audit:copy-regression`: passou
- Trace local confirmado em `.next/server/app/api/profile/smart-generation/route.js.nft.json`
