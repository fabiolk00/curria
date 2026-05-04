# Quick Task: Incluir JSON do catálogo no deploy

## Objetivo
Corrigir erro ENOENT em produção ao gerar job-target: arquivos JSON do catálogo de job-targeting não estão disponíveis na função serverless.

## Plano
- Localizar leitura dos JSONs do catálogo.
- Ajustar empacotamento Next/Vercel para incluir esses assets na função.
- Validar build local e rota impactada quando possível.
- Commit, push e deploy.
