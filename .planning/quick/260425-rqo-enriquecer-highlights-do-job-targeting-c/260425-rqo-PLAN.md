# Quick Task 260425-rqo - Enriquecer highlights do job_targeting com sinais da vaga

## Goal

Enriquecer a deteccao de highlights do fluxo `job_targeting` com sinais ja extraidos da vaga, sem alterar o comportamento atual de ATS/hibrido quando esses sinais nao existirem e sem mexer nos contratos de persistencia ou logging.

## Guardrails

- Escopo fechado a 4 arquivos: `src/lib/agent/tools/detect-cv-highlights.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/agent/tools/detect-cv-highlights.test.ts` e `src/lib/agent/tools/pipeline.test.ts`.
- Nao alterar `highlightState`, `HighlightDetectionOutcome`, `CV_HIGHLIGHT_ARTIFACT_VERSION`, payloads persistidos, nomes de eventos ou campos estruturados de log.
- O caminho default do detector deve continuar equivalente ao atual quando `jobKeywords`/sinais da vaga estiverem ausentes.
- Reutilizar apenas sinais ja disponiveis no pipeline (`mustEmphasize`, com fallback para `focusKeywords`), sem criar estado novo em sessao.

## Task 1 - Enriquecer o detector de highlights apenas no fluxo job_targeting

**Files**
- `src/lib/agent/tools/detect-cv-highlights.ts`
- `src/lib/agent/job-targeting-pipeline.ts`

**Action**
- Estender o contexto do detector com uma lista opcional e nao persistida de sinais da vaga, usada somente para enriquecer o prompt/payload da chamada ao modelo quando existir.
- No `runJobTargetingPipeline(...)`, derivar uma lista deduplicada e limitada a partir de `targetingPlan.mustEmphasize`; se vier vazia, usar `targetingPlan.focusKeywords`; se ambos vierem vazios, nao enviar nenhum sinal extra.
- No detector, incluir esses sinais apenas no caminho condicional de `job_targeting`, preservando o payload legado `{ items }` e o comportamento atual para ATS/hibrido e para qualquer chamada sem `jobKeywords`.
- Nao tocar em regras de persistencia, decisao de `highlightStatePersistedReason`, `resultKind`, contadores, nem contratos de observabilidade existentes.

**Verify**
- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts`

**Done**
- O fluxo `job_targeting` consegue orientar o detector com sinais da vaga sem novo estado persistido.
- Chamadas sem `jobKeywords` continuam usando o comportamento atual.
- ATS/hibrido permanecem semanticamente intactos.

## Task 2 - Travar a nova costura com regressao focada

**Files**
- `src/lib/agent/tools/detect-cv-highlights.test.ts`
- `src/lib/agent/tools/pipeline.test.ts`

**Action**
- Adicionar um teste no detector provando que os sinais da vaga entram na request ao modelo somente quando fornecidos e que o caminho sem sinais continua emitindo o payload legado.
- Adicionar um teste no pipeline `job_targeting` provando que o pipeline repassa ao detector os sinais derivados do `targetingPlan`, sem expandir o escopo para ATS pipeline, rotas ou persistencia.
- Manter as assercoes existentes de logging/persistencia intactas; os novos testes devem validar a nova costura, nao redefinir contratos adjacentes.

**Verify**
- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts`

**Done**
- Existe cobertura para o enriquecimento condicional por sinais da vaga.
- Existe cobertura explicita para o fallback sem `jobKeywords`.
- O escopo continua restrito ao detector, pipeline de `job_targeting` e dois arquivos de teste.

## Final Verification

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts`

## Risks And Mitigations

- Risco: o novo contexto induzir mudanca involuntaria no detector fora de `job_targeting`.
  Mitigacao: anexar sinais somente quando presentes e travar o payload legado no teste sem `jobKeywords`.

- Risco: o pipeline passar a depender de contrato novo de estado.
  Mitigacao: derivar sinais apenas do `targetingPlan` em memoria e nao alterar persistencia, versao de artifact nem eventos.
