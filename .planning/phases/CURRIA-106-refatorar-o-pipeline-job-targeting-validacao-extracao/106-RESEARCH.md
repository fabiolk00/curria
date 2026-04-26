## Phase 106 Research

### Objective

Corrigir o pipeline `job_targeting` sem contaminar o `ats_enhancement`, com foco em:

- validacao compartilhada por severidade;
- ancora correta de evidencia para skills no resumo;
- extracao de cargo alvo em camadas, sem ampliar regex hardcoded.

### Verified Isolation Findings

1. `validateRewrite(...)` e compartilhado por ambos os modos.
   - ATS call sites: `src/lib/agent/ats-enhancement-pipeline.ts:413`, `:428`, `:459`, `:487`
   - Job targeting call site: `src/lib/agent/job-targeting-pipeline.ts:381`
2. `ats_enhancement` chama `validateRewrite` sem `context`, entao:
   - `mode`, `targetJobDescription`, `gapAnalysis` e `targetingPlan` ficam omitidos;
   - somente as Regras 1 a 8 executam nesse modo.
3. As Regras 9 e 10 ja estao guardadas por `context?.mode === 'job_targeting'`.
4. `rewriteResumeFull(...)` e compartilhado, mas o fallback interno de `buildTargetingPlan(...)` fica dentro do branch `params.mode === 'job_targeting'` em `src/lib/agent/tools/rewrite-resume-full.ts:601-606`.
   - conclusao: tornar `buildTargetingPlan` async nao muda o fluxo ATS, desde que o branch continue protegido pelo modo.

### Current Consumer Map For `RewriteValidationResult`

Consumidores de `valid` e/ou `issues` fora do `job_targeting`:

- `src/lib/agent/ats-enhancement-pipeline.ts`
- `src/lib/ats/scoring/quality-gates.ts`
- `src/lib/ats/scoring/index.ts` e testes
- `src/lib/agent/context/sources/build-source-context.ts`
- `src/app/api/session/[id]/route.ts`
- `src/lib/routes/smart-generation/result-normalization.ts`
- `src/components/resume/user-data-page.tsx`
- `src/components/dashboard/resume-workspace.tsx`

Conclusao:

- `valid` precisa continuar existindo nesta fase para manter o comportamento ATS.
- `issues` precisa permanecer como alias compatível porque varias camadas de ATS, sessao, smart-generation e UI ainda leem esse campo diretamente.

### Validation Rule Findings

`src/lib/agent/tools/validate-rewrite.ts` hoje:

- calcula `originalEvidenceText` uma vez, mas a Regra 8 nao usa essa ancora como fonte principal;
- usa `optimizedExperienceText` na Regra 8, o que cria falso positivo estrutural quando a evidencia existe no original mas o modelo reformulou a experiencia;
- classifica a Regra 7 como `medium`, apesar de se tratar de skill no resumo sem evidencia original;
- retorna apenas `{ valid, issues }`, ignorando o campo `severity` na decisao do pipeline `job_targeting`.

### Job Targeting Pipeline Findings

`src/lib/agent/job-targeting-pipeline.ts` hoje:

- trata `!validation.valid` como hard block;
- reverte `optimizedCvState`, `highlightState`, `optimizedAt` e `optimizationSummary` sempre que `valid === false`, inclusive para warnings medios;
- usa `validation.valid` para gate de highlights e para status final;
- persiste `rewriteValidation` no estado, mas esse persist fica inutil para soft warnings porque o fluxo retorna falha e restaura a versao anterior.

### Target Role Extraction Findings

`src/lib/agent/tools/build-targeting-plan.ts` hoje:

- concentra a extracao de cargo em `extractTargetRole(...)`;
- usa regex hardcoded fortemente enviesadas para familias de dados/BI;
- retorna apenas `targetRoleConfidence: 'high' | 'low'`;
- nao registra a origem da extracao;
- nao usa LLM para cobrir vagas sem titulo explicito.

### Compatibility Decisions

1. `RewriteValidationResult` vai ganhar:
   - `blocked`
   - `hardIssues`
   - `softWarnings`
   - `issues` como alias compatível
2. `valid` permanecera estrito (`issues.length === 0`) nesta fase.
   - impacto: ATS continua com o mesmo criterio de bloqueio atual.
   - impacto: `job_targeting` migra para `blocked` sem mudar a semantica do ATS.
3. `TargetingPlan` vai ganhar:
   - `targetRoleConfidence: 'high' | 'medium' | 'low'`
   - `targetRoleSource: 'heuristic' | 'llm' | 'fallback'`
4. `AgentState` vai ganhar:
   - `extractionWarning?: 'low_confidence_role'`

### Recommended Implementation Order

1. Contrato compartilhado e `validateRewrite` com testes bilaterais ATS/job-targeting.
2. Ajuste do `job-targeting-pipeline` para `blocked` e persistencia de soft warnings.
3. `buildTargetingPlan` async com cadeia heuristica -> LLM -> fallback.
4. Exposicao de warnings no smart-generation success path.
5. Atualizacao de testes, review e validacao.

### Non-Negotiable Guardrails

- Nao tocar logica exclusiva de `ats_enhancement` alem da compatibilidade de contrato.
- Nao remover `issues` nesta fase.
- Nao adicionar novas listas hardcoded de cargos.
- Nao remover a heuristica existente; ela continua sendo a camada zero.
- Nao adicionar retry manual em torno da extracao por LLM.
