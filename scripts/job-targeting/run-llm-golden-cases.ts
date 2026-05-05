import { classifyRequirementWithLlm } from '@/lib/agent/job-targeting/compatibility/llm-matcher'

type GoldenCase = {
  name: string
  requirement: string
  evidence: string[]
  allowed: Array<{
    evidenceLevel: 'supported' | 'adjacent' | 'unsupported'
    rewritePermission: 'can_claim_directly' | 'can_bridge_to_target_role' | 'must_not_claim'
  }>
}

const goldenCases: GoldenCase[] = [
  {
    name: 'Qlik product variation',
    requirement: 'Conhecimento na ferramenta Qlik',
    evidence: ['Liderou migração de 30 aplicações Qlik Sense para Qlik Cloud'],
    allowed: [{ evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' }],
  },
  {
    name: 'Ferramenta concorrente',
    requirement: 'Conhecimento em Tableau',
    evidence: ['Desenvolveu dashboards em Power BI para Supply Chain'],
    allowed: [{ evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' }],
  },
  {
    name: 'BI generico',
    requirement: 'Experiência com Business Intelligence',
    evidence: ['Desenvolveu dashboards estratégicos em Power BI e Qlik Sense'],
    allowed: [{ evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' }],
  },
  {
    name: 'Skill especifico com evidencia relacionada',
    requirement: 'Conhecimento em PySpark',
    evidence: ['Implementou pipelines ETL distribuídos no Azure Databricks usando processamento Spark'],
    allowed: [{ evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' }],
  },
  {
    name: 'Requisito parcialmente atendido flexivel',
    requirement: 'Conduzir levantamento de requisitos e facilitar reuniões com negócio',
    evidence: ['Desenvolveu aplicações desde a coleta de requisitos até a visualização junto a áreas de negócio'],
    allowed: [
      { evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' },
      { evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' },
    ],
  },
  {
    name: 'Requisito ausente',
    requirement: 'Certificação Qlik formal',
    evidence: ['Conhecimento em Qlik Sense, Qlik Cloud e QlikView'],
    allowed: [{ evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' }],
  },
  {
    name: 'Skill com multiplos nomes de mercado',
    requirement: 'Experiência com Databricks',
    evidence: ['Implementou pipelines ETL no Azure Databricks com PySpark'],
    allowed: [{ evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' }],
  },
  {
    name: 'Compliance relacionado sem lei especifica',
    requirement: 'Conhecimento em LGPD e proteção de dados',
    evidence: ['Implementou controles de acesso, mascaramento de dados e práticas de privacidade em pipelines analíticos'],
    allowed: [{ evidenceLevel: 'adjacent', rewritePermission: 'can_bridge_to_target_role' }],
  },
  {
    name: 'Ferramenta especifica sem evidencia suficiente',
    requirement: 'Conhecimento em dbt',
    evidence: ['Criou pipelines SQL e modelagem dimensional'],
    allowed: [{ evidenceLevel: 'unsupported', rewritePermission: 'must_not_claim' }],
  },
  {
    name: 'Responsabilidade BI end-to-end',
    requirement: 'Conduzir desenvolvimentos de BI desde a concepção até a implementação',
    evidence: ['Desenvolveu mais de 20 aplicações personalizadas, desde a coleta de requisitos até a visualização'],
    allowed: [{ evidenceLevel: 'supported', rewritePermission: 'can_claim_directly' }],
  },
]

function isAllowed(
  actual: { evidenceLevel: string; rewritePermission: string },
  goldenCase: GoldenCase,
): boolean {
  return goldenCase.allowed.some((expected) => (
    expected.evidenceLevel === actual.evidenceLevel
    && expected.rewritePermission === actual.rewritePermission
  ))
}

async function main(): Promise<void> {
  const failures: string[] = []

  for (const goldenCase of goldenCases) {
    for (let run = 1; run <= 3; run += 1) {
      const result = await classifyRequirementWithLlm({
        requirement: {
          id: `${goldenCase.name}-${run}`,
          text: goldenCase.requirement,
          normalizedText: goldenCase.requirement.toLowerCase(),
        },
        resumeEvidence: goldenCase.evidence.map((text, index) => ({
          id: `${goldenCase.name}-evidence-${index}`,
          text,
        })),
        evidenceBullets: goldenCase.evidence,
      })
      const actual = {
        evidenceLevel: result.rawOutput?.evidenceLevel ?? 'unsupported',
        rewritePermission: result.rawOutput?.rewritePermission ?? 'must_not_claim',
      }

      if (!isAllowed(actual, goldenCase)) {
        failures.push(`${goldenCase.name} run ${run}: ${JSON.stringify(actual)}`)
      }

      console.log(JSON.stringify({
        case: goldenCase.name,
        run,
        actual,
        confidence: result.rawOutput?.confidence,
        fallbackReason: result.fallbackReason,
      }))
    }
  }

  if (failures.length > 0) {
    throw new Error(`LLM golden cases failed:\n${failures.join('\n')}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
