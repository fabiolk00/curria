# PT-BR Copy Audit

- Files scanned for PT-BR review: 532
- Files scanned for mojibake: 532
- Mojibake issues: 18
- PT-BR copy review issues: 4

## Mojibake

- src\app\api\profile\smart-generation\route.test.ts:497 - message: 'O resumo otimizado menciona skills sem alinhamento com a experiÃªncia reescrita.',

- src\components\dashboard\resume-workspace.test.tsx:528 - message: "A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currÃ­culo original.",

- src\components\resume\user-data-page.tsx:288 - "CurrÃ­culo mais claro e compatÃ­vel com ATS",

- src\components\resume\user-data-page.tsx:290 - "ExperiÃªncias reescritas em bullets fortes",

- src\components\resume\user-data-page.tsx:292 - "VersÃ£o pronta para comparar e exportar",

- src\components\resume\user-data-page.tsx:293 - "Seu currÃ­culo base continua preservado",

- src\components\resume\user-data-page.tsx:1710 - <p key={reason}>â€¢ {reason}</p>

- src\lib\agent\streaming-loop.test.ts:1267 - bullets: ['ExperiÃªncia base antiga.'],

- src\lib\agent\tools\generate-file-intake.ts:132 - 'Gere uma nova versÃ£o otimizada pela IA antes de exportar este currÃ­culo.',

- src\lib\agent\tools\index.test.ts:825 - error: 'Gere uma nova versÃ£o otimizada pela IA antes de exportar este currÃ­culo.',

- src\lib\agent\tools\pipeline.test.ts:1374 - improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiÃªncia.'],

- src\lib\resume\cv-highlight-artifact.test.ts:194 - const text = 'Otimizei pipelines com salting e repartitioning, reduzindo em atÃ© 40% o tempo de processamento.'

- src\lib\resume\cv-highlight-artifact.test.ts:197 - buildRange(text, 'Otimizei pipelines com salting e repartitioning, reduzindo em atÃ© 40%', 'metric_impact'),

- src\lib\resume\cv-highlight-artifact.test.ts:201 - expect(text.slice(range!.start, range!.end)).toBe('reduzindo em atÃ© 40% o tempo de processamento')

- src\lib\resume\cv-highlight-artifact.test.ts:323 - const text = 'Atuei nos processos Ã§reduzindo desperdÃ­cio operacional'

- src\lib\resume\cv-highlight-artifact.ts:519 - return /^(?:and|or|but|e|ou|mas|para|com|de|do|da|dos|das|em|no|na|nos|nas|ao|aos|a|Ã )\b/i.test(value.trim())

- src\lib\resume-generation\generate-billable-resume.test.ts:1032 - error: 'A geraÃ§Ã£o pendente esperada nÃ£o foi criada antes de continuar a exportaÃ§Ã£o.',

- src\lib\resume-generation\generate-billable-resume.ts:1082 - 'A geraÃ§Ã£o pendente esperada nÃ£o foi criada antes de continuar a exportaÃ§Ã£o.',

## PT-BR Copy Review

- src\components\resume\user-data-page.test.tsx:683 - `experiencia` -> `experiência`
  message: "O resumo otimizado menciona skills sem alinhamento com a experiencia reescrita.",

- src\lib\agent\tools\detect-cv-highlights.ts:196 - `ate` -> `até`
  'Invalid fragment: "Otimizei pipelines com salting e repartitioning, reduzindo em ate 40%".',

- src\lib\agent\tools\detect-cv-highlights.ts:197 - `ate` -> `até`
  'Valid fragment: "reduzindo em ate 40% o tempo de processamento".',

- src\lib\agent\tools\validate-rewrite.test.ts:33 - `experiencia` -> `experiência`
  summary: 'Profissional de dados com foco em BI e SQL. Requisitos obrigatorios atendidos com base na experiencia.',
