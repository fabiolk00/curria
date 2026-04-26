# PT-BR Copy Audit

- Files scanned for PT-BR review: 572
- Files scanned for mojibake: 572
- Mojibake issues: 8
- PT-BR copy review issues: 4

## Mojibake

- src/lib/agent/streaming-loop.test.ts:1269 - bullets: ['ExperiÃªncia base antiga.'],

- src/lib/agent/tools/generate-file-intake.ts:132 - 'Gere uma nova versÃ£o otimizada pela IA antes de exportar este currÃ­culo.',

- src/lib/agent/tools/pipeline.test.ts:1413 - improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiÃªncia.'],

- src/lib/resume/cv-highlight-artifact.test.ts:194 - const text = 'Otimizei pipelines com salting e repartitioning, reduzindo em atÃ© 40% o tempo de processamento.'

- src/lib/resume/cv-highlight-artifact.test.ts:197 - buildRange(text, 'Otimizei pipelines com salting e repartitioning, reduzindo em atÃ© 40%', 'metric_impact'),

- src/lib/resume/cv-highlight-artifact.test.ts:201 - expect(text.slice(range!.start, range!.end)).toBe('reduzindo em atÃ© 40% o tempo de processamento')

- src/lib/resume/cv-highlight-artifact.test.ts:323 - const text = 'Atuei nos processos Ã§reduzindo desperdÃ­cio operacional'

- src/lib/resume/cv-highlight-artifact.ts:519 - return /^(?:and|or|but|e|ou|mas|para|com|de|do|da|dos|das|em|no|na|nos|nas|ao|aos|a|Ã )\b/i.test(value.trim())

## PT-BR Copy Review

- src/lib/agent/tools/detect-cv-highlights.ts:218 - `ate` -> `até`
  'Invalid fragment: "Otimizei pipelines com salting e repartitioning, reduzindo em ate 40%".',

- src/lib/agent/tools/detect-cv-highlights.ts:219 - `ate` -> `até`
  'Valid fragment: "reduzindo em ate 40% o tempo de processamento".',

- src/lib/agent/tools/pipeline.test.ts:174 - `experiencia` -> `experiência`
  summary: ['Aproxime o posicionamento da vaga sem inventar experiencia.'],

- src/lib/agent/tools/validate-rewrite.test.ts:33 - `experiencia` -> `experiência`
  summary: 'Profissional de dados com foco em BI e SQL. Requisitos obrigatorios atendidos com base na experiencia.',
