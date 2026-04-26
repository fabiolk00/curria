## Plan Review

### Verdict

PASS with guarded compatibility constraints.

### Why This Plan Is Safe

1. O plano separa claramente o contrato compartilhado (`validateRewrite`) do comportamento exclusivo de `job_targeting`.
2. O ATS continua protegido porque:
   - `valid` permanece;
   - `issues` permanece;
   - o ATS nao passa `context.mode === 'job_targeting'`;
   - `rewriteResumeFull` so chama `buildTargetingPlan` no branch `job_targeting`.
3. A migracao para `blocked` fica restrita ao pipeline `job_targeting`, exatamente onde a severidade ja deveria decidir o gating.

### Risks To Watch

- Reclassificar a Regra 7 para `high` pode tornar alguns payloads ATS mais estritos; isso e aceitavel apenas se os testes existentes continuarem verdes.
- Tornar `buildTargetingPlan` async exige atualizar mocks e callers; qualquer `mockReturnValue` sincrono em testes de pipeline precisa virar `mockResolvedValue`.
- A exposicao de warnings no retorno de smart-generation nao deve quebrar consumidores que fazem `expect(...).toEqual(...)` estrito.

### Required Checks Before Marking Complete

- `validateRewrite.test.ts` precisa cobrir ambos os modos com o novo contrato.
- `pipeline.test.ts` precisa provar que `job_targeting` salva com `softWarnings` e bloqueia apenas `hardIssues`.
- `build-targeting-plan.test.ts` precisa provar:
  - heuristica explicita sem chamar LLM;
  - LLM com `confidence: 'medium'`;
  - fallback com `source: 'fallback'`.
- `route.test.ts` e `session/[id]/route.test.ts` precisam compilar com o contrato expandido.
