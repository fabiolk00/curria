## Phase 106 Context

### Goal

Refatorar o pipeline `job_targeting` para que a validacao compartilhada bloqueie apenas drift factual severo, preserve explicitamente o isolamento do `ats_enhancement`, e extraia o cargo alvo com uma cadeia heuristica + LLM + fallback sem expandir regex hardcoded.

### Why This Phase Exists

O modo `job_targeting` esta sofrendo com tres problemas de produto e confiabilidade:

- a Regra 8 de `validateRewrite` ancora parte da validacao na experiencia reescrita, o que produz falso positivo estrutural quando a evidencia existe no curriculo original mas foi reformulada pelo modelo;
- o pipeline trata qualquer issue como hard block mesmo quando a severidade ja esta marcada como `medium`;
- `extractTargetRole` depende de regex hardcoded enviesadas para dados/BI e cai em fallback fraco fora desse dominio.

Ao mesmo tempo, `ats_enhancement` usa parte desse mesmo contrato compartilhado em producao. Qualquer alteracao precisa provar, por codigo e por artefato, por que o ATS nao regrediu.

### Required Isolation Checks

Arquivos compartilhados desta task:

- `src/lib/agent/tools/validate-rewrite.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/types/agent.ts`

Arquivos exclusivos ou efetivamente isolados ao modo `job_targeting`:

- `src/lib/agent/job-targeting-pipeline.ts`
- `src/lib/agent/tools/build-targeting-plan.ts`

Conclusoes de isolamento verificadas antes da implementacao:

1. `runAtsEnhancementPipeline(...)` chama `validateRewrite(session.cvState, optimizedCvState)` sem `context`.
2. No fluxo ATS, `context.mode`, `targetJobDescription`, `gapAnalysis` e `targetingPlan` ficam omitidos, entao apenas as Regras 1 a 8 executam.
3. As Regras 9 e 10 ja estao guardadas por `context.mode === 'job_targeting'` e continuam fora do ATS.
4. `rewriteResumeFull(...)` e compartilhado, mas o fallback interno `buildTargetingPlan(...)` so e avaliado quando `params.mode === 'job_targeting'`; o branch `ats_enhancement` nao toca essa funcao mesmo se ela se tornar `async`.
5. O ATS consome `rewriteValidation` em pipeline, scoring, contexto de agente, sessao serializada e smart-generation; por isso o campo `issues` precisa permanecer como alias de compatibilidade neste phase.

### Locked Decisions

- Nao alterar nenhuma logica exclusiva de `ats_enhancement` alem do que for estritamente necessario para compatibilidade com o novo contrato compartilhado.
- Manter `valid` no retorno de `validateRewrite` para compatibilidade, mas introduzir `blocked`, `hardIssues` e `softWarnings`.
- Tratar apenas severidade `high` como bloqueio no `job_targeting`.
- Reusar a heuristica atual de `extractTargetRole` como camada zero; nao expandir regex hardcoded novas.
- Chamar LLM para extracao de cargo somente quando a heuristica falhar.
- Documentar em artefatos de fase por que cada arquivo compartilhado nao afeta `ats_enhancement`.

### Canonical References

- `src/lib/agent/tools/validate-rewrite.ts`
- `src/lib/agent/ats-enhancement-pipeline.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/lib/agent/tools/rewrite-resume-full.ts`
- `src/lib/agent/tools/build-targeting-plan.ts`
- `src/lib/routes/smart-generation/result-normalization.ts`
- `src/app/api/session/[id]/route.ts`
- `src/types/agent.ts`
- `src/types/dashboard.ts`

### Acceptance Targets

- Skill existente em qualquer ponto do curriculo original nao vira warning ou hard issue por causa da Regra 8.
- `job_targeting` persiste e devolve `softWarnings` sem bloquear save quando nao houver `hardIssues`.
- `ats_enhancement` continua compilando e usando o contrato compartilhado sem mudanca de criterio de bloqueio.
- `buildTargetingPlan` registra `targetRoleSource`, aceita `targetRoleConfidence: 'medium'`, e extrai cargo por LLM quando a heuristica nao consegue.
- Nenhuma nova lista hardcoded de cargos aparece no codebase.

### Explicit ATS Non-Impact Checklist

- `validateRewrite`: ATS continua chamando sem `context.mode`; Regras 9 e 10 continuam inativas no ATS.
- `RewriteValidationResult`: `issues` fica mantido como alias para nao quebrar scoring, sessao, rotas e serializacao ATS nesta fase.
- `rewriteResumeFull`: o branch ATS nao executa `buildTargetingPlan`.
- `AgentState.extractionWarning`: campo aditivo, nao lido pelo ATS.
- `TargetingPlan.targetRoleSource`: apenas `job_targeting` constroi este contrato.
