# PT-BR Copy Audit

- Files scanned for PT-BR review: 615
- Files scanned for mojibake: 70
- Mojibake issues: 0
- PT-BR copy review issues: 20

## Mojibake

Nenhum mojibake encontrado.

## PT-BR Copy Review

- src/app/api/profile/smart-generation/route.test.ts:285 - `creditos` -> `créditos`
  summary: 'Resumo otimizado depois da recarga de creditos.',

- src/components/resume/review-diagnostic-card.tsx:74 - `experiencia` -> `experiência`
  || normalized === "experiencia anterior"

- src/lib/agent/highlight/override-review-highlights.ts:138 - `experiencia` -> `experiência`
  const ignore = new Set(['profissional', 'experiencia', 'experiência', 'atuacao', 'atuação', 'resumo'])

- src/lib/agent/job-targeting/recoverable-validation.test.ts:82 - `curriculo` -> `currículo`
  rationale: 'Existe no curriculo.',

- src/lib/agent/job-targeting/recoverable-validation.ts:57 - `versao` -> `versão`
  'controle de versao',

- src/lib/agent/job-targeting/recoverable-validation.ts:58 - `versao` -> `versão`
  'controle de versao de codigo',

- src/lib/agent/job-targeting/rewrite-target-plan.ts:110 - `curriculo` -> `currículo`
  const allowed = params.allowedClaims.join(', ') || 'nenhum claim novo alem do curriculo original'

- src/lib/agent/job-targeting/rewrite-target-plan.ts:114 - `secao` -> `seção`
  ? `Posicione a secao para ${params.targetRole} usando somente evidencias reais.`

- src/lib/agent/job-targeting/rewrite-target-plan.ts:115 - `secao` -> `seção`
  : 'Ancora a secao nos requisitos da vaga sem forcar um cargo alvo literal.'

- src/lib/agent/job-targeting/rewrite-target-plan.ts:122 - `Nao` -> `Não`
  `Nao declare dominio, cargo, ferramenta ou metodologia sem evidencia para: ${forbidden}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:129 - `Nao` -> `Não`
  `Nao invente ferramentas, dominios, senioridade, stakeholders ou escopo para: ${forbidden}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:135 - `Nao` -> `Não`
  `Nao adicione como skill direta: ${forbidden}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:136 - `curriculo` -> `currículo`
  `Itens adjacentes devem ficar fora de Skills, salvo se ja existirem no curriculo: ${bridge}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:139 - `formacao` -> `formação`
  'Mantenha formacao factual e apenas melhore consistencia.',

- src/lib/agent/job-targeting/rewrite-target-plan.ts:140 - `Nao` -> `Não`
  `Nao transforme requisitos sem evidencia em formacao ou certificacao: ${forbidden}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:140 - `formacao` -> `formação`
  `Nao transforme requisitos sem evidencia em formacao ou certificacao: ${forbidden}.`,

- src/lib/agent/job-targeting/rewrite-target-plan.ts:144 - `Nao` -> `Não`
  `Nao criar certificacoes nem equivalencias para: ${forbidden}.`,

- src/lib/agent/request-orchestrator.test.ts:267 - `curriculo` -> `currículo`
  message: 'analise meu curriculo',

- src/lib/routes/smart-generation/decision.test.ts:335 - `credito` -> `crédito`
  label: 'Gerar mesmo assim (1 credito)',

- src/types/agent.ts:182 - `experiencia` -> `experiência`
  * "Adicione apenas se isso fizer parte da sua experiencia real."
