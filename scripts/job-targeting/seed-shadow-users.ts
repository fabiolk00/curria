import Module from 'node:module'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { CVState } from '../../src/types/cv'

const DEFAULT_SEED_RUN_ID = 'shadow-seed-multidomain-001'
const SEED_SOURCE = 'shadow_seed'
const CURRENT_SESSION_STATE_VERSION = 2
const FIT_LEVELS = ['high', 'adjacent', 'low'] as const

type FitLevel = (typeof FIT_LEVELS)[number]

type Domain =
  | 'data-bi'
  | 'software-engineering'
  | 'marketing'
  | 'sales'
  | 'finance'
  | 'operations'
  | 'manufacturing'
  | 'hr'
  | 'legal-admin'
  | 'health-admin'

type ShadowSeedCase = {
  caseId: string
  domain: Domain
  fitLevel: FitLevel
  fakeUser: {
    name: string
    email: string
  }
  cvState: CVState
  targetJobDescription: string
  metadata: {
    source: typeof SEED_SOURCE
    seedRunId: string
    testOnly: true
    anonymized: true
    domain: Domain
    fitLevel: FitLevel
  }
}

type CliOptions = {
  seedRunId: string
  countPerDomain: number
}

type FitProfile = {
  title: string
  summary: string
  skills: string[]
  bullets: string[]
  education: string
  certifications?: string[]
}

type DomainConfig = {
  domain: Domain
  label: string
  emailPrefix: string
  targetRole: string
  targetRequirements: string[]
  targetDifferentials: string[]
  profiles: Record<FitLevel, FitProfile>
}

type SideEffectCounts = {
  creditReservations: number
  resumeGenerations: number
}

const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    domain: 'data-bi',
    label: 'Data BI',
    emailPrefix: 'shadow-data-bi',
    targetRole: 'Analista de BI Shadow',
    targetRequirements: ['Power BI', 'SQL', 'dashboards', 'indicadores', 'Power Query'],
    targetDifferentials: ['Tableau', 'modelagem de dados', 'ETL'],
    profiles: {
      high: {
        title: 'Analista de Dados e BI',
        summary: 'Perfil ficticio com atuacao em SQL, Power BI, dashboards, modelagem de dados, ETL, Python e acompanhamento de KPIs.',
        skills: ['SQL', 'Power BI', 'dashboards', 'modelagem de dados', 'ETL', 'Python', 'KPIs', 'Power Query'],
        bullets: [
          'Construiu dashboards em Power BI para acompanhamento de KPIs operacionais ficticios.',
          'Apoiou rotinas de ETL com SQL, Python e modelagem de dados para bases internas simuladas.',
          'Organizou indicadores em Power Query para relatorios gerenciais de uma empresa ficticia.',
        ],
        education: 'Graduacao ficticia em Sistemas de Informacao',
        certifications: ['Certificacao Shadow em Power BI'],
      },
      adjacent: {
        title: 'Analista de Relatorios',
        summary: 'Perfil ficticio com experiencia em Excel avancado, Looker Studio, relatorios recorrentes, limpeza de bases e analises descritivas.',
        skills: ['Excel avancado', 'Looker Studio', 'relatorios', 'indicadores', 'tratamento de dados', 'Python basico'],
        bullets: [
          'Preparou relatorios recorrentes com indicadores comerciais e operacionais ficticios.',
          'Tratou bases em planilhas e criou visualizacoes simples em Looker Studio.',
          'Apoiou analises descritivas, mas sem experiencia direta registrada em Power BI ou Tableau.',
        ],
        education: 'Graduacao ficticia em Administracao',
      },
      low: {
        title: 'Assistente Administrativo',
        summary: 'Perfil ficticio administrativo com foco em atendimento interno, planilhas simples e organizacao de documentos.',
        skills: ['Excel basico', 'atendimento interno', 'organizacao documental', 'rotinas administrativas'],
        bullets: [
          'Organizou controles administrativos e planilhas simples para acompanhamento interno ficticio.',
          'Apoiou atendimento a areas internas e consolidacao manual de informacoes.',
          'Nao possui experiencia registrada com SQL, BI, ETL ou modelagem de dados.',
        ],
        education: 'Ensino superior ficticio em andamento',
      },
    },
  },
  {
    domain: 'software-engineering',
    label: 'Software',
    emailPrefix: 'shadow-software',
    targetRole: 'Pessoa Desenvolvedora Backend Shadow',
    targetRequirements: ['TypeScript', 'Node.js', 'APIs REST', 'Docker', 'Kubernetes'],
    targetDifferentials: ['Kafka', 'PostgreSQL', 'testes automatizados'],
    profiles: {
      high: {
        title: 'Engenheira de Software Full Stack',
        summary: 'Perfil ficticio com TypeScript, Node.js, React, PostgreSQL, APIs REST, testes automatizados e Git.',
        skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'APIs REST', 'testes automatizados', 'Git', 'Docker'],
        bullets: [
          'Desenvolveu APIs REST em Node.js e TypeScript para produtos internos ficticios.',
          'Manteve componentes React e integracoes com PostgreSQL usando Git e revisoes de codigo.',
          'Criou testes automatizados e conteinerizou servicos simples com Docker.',
        ],
        education: 'Graduacao ficticia em Ciencia da Computacao',
        certifications: ['Certificacao Shadow em APIs Node.js'],
      },
      adjacent: {
        title: 'Desenvolvedora Web',
        summary: 'Perfil ficticio com JavaScript, React, consumo de APIs, SQL basico e manutencao de sistemas web.',
        skills: ['JavaScript', 'React', 'HTML', 'CSS', 'SQL basico', 'consumo de APIs', 'Git'],
        bullets: [
          'Construiu telas React e integrou endpoints existentes em projetos ficticios.',
          'Apoiou manutencao de sistemas web com JavaScript e consultas SQL simples.',
          'Ainda nao registra experiencia direta com Node.js em producao, Kubernetes ou Kafka.',
        ],
        education: 'Tecnologo ficticio em Analise e Desenvolvimento de Sistemas',
      },
      low: {
        title: 'Analista de Suporte de TI',
        summary: 'Perfil ficticio com suporte a usuarios, configuracao de sistemas e documentacao de chamados.',
        skills: ['suporte tecnico', 'documentacao', 'atendimento', 'sistemas internos', 'Excel'],
        bullets: [
          'Atendeu chamados de suporte e registrou procedimentos de sistemas ficticios.',
          'Apoiou configuracoes basicas e acompanhamento de incidentes internos.',
          'Nao possui experiencia registrada com desenvolvimento em TypeScript, Node.js ou APIs REST.',
        ],
        education: 'Curso tecnico ficticio em Informatica',
      },
    },
  },
  {
    domain: 'marketing',
    label: 'Marketing',
    emailPrefix: 'shadow-marketing',
    targetRole: 'Analista de Marketing Digital Shadow',
    targetRequirements: ['Google Ads', 'Meta Ads', 'GA4', 'HubSpot', 'Salesforce'],
    targetDifferentials: ['SEO tecnico', 'Looker Studio', 'funil de conversao'],
    profiles: {
      high: {
        title: 'Analista de Midia e Performance',
        summary: 'Perfil ficticio com Google Ads, Meta Ads, Google Analytics, campanhas digitais, funil de conversao e Looker Studio.',
        skills: ['Google Ads', 'Meta Ads', 'Google Analytics', 'GA4', 'campanhas digitais', 'funil de conversao', 'Looker Studio'],
        bullets: [
          'Operou campanhas ficticias em Google Ads e Meta Ads com acompanhamento de conversao.',
          'Analisou jornadas em GA4 e construiu dashboards em Looker Studio.',
          'Apoiou ajustes de funil de conversao com relatorios semanais de performance.',
        ],
        education: 'Graduacao ficticia em Marketing',
        certifications: ['Certificacao Shadow em Midia Paga'],
      },
      adjacent: {
        title: 'Assistente de Marketing',
        summary: 'Perfil ficticio com redes sociais, email marketing, criacao de conteudo e leitura de metricas basicas.',
        skills: ['redes sociais', 'email marketing', 'conteudo', 'metricas digitais', 'Google Analytics basico', 'CRM basico'],
        bullets: [
          'Apoiou publicacoes e campanhas de email marketing em uma marca ficticia.',
          'Acompanhou metricas basicas de alcance, cliques e conversao.',
          'Nao registra operacao direta de Google Ads, Meta Ads, HubSpot ou Salesforce.',
        ],
        education: 'Graduacao ficticia em Comunicacao',
      },
      low: {
        title: 'Assistente Comercial',
        summary: 'Perfil ficticio com atendimento, cadastro de clientes e apoio a eventos internos.',
        skills: ['atendimento', 'cadastro de clientes', 'eventos', 'relacionamento', 'planilhas'],
        bullets: [
          'Organizou listas de contatos e apoio logistico para eventos ficticios.',
          'Atendeu clientes e registrou informacoes em planilhas comerciais.',
          'Nao possui experiencia registrada em campanhas digitais, midia paga ou analytics.',
        ],
        education: 'Ensino superior ficticio em andamento',
      },
    },
  },
  {
    domain: 'sales',
    label: 'Sales',
    emailPrefix: 'shadow-sales',
    targetRole: 'Executivo de Vendas B2B Shadow',
    targetRequirements: ['CRM', 'prospeccao outbound', 'negociacao', 'Salesforce', 'SPIN Selling'],
    targetDifferentials: ['MEDDIC', 'pipeline comercial', 'follow-up B2B'],
    profiles: {
      high: {
        title: 'Executiva Comercial B2B',
        summary: 'Perfil ficticio com CRM, prospeccao, negociacao, pipeline comercial, follow-up e vendas B2B.',
        skills: ['CRM', 'prospeccao', 'negociacao', 'pipeline comercial', 'follow-up', 'B2B', 'Salesforce', 'SPIN Selling'],
        bullets: [
          'Geriu pipeline comercial ficticio com prospeccao outbound e follow-up estruturado.',
          'Registrou oportunidades em CRM e apoiou negociacoes B2B consultivas.',
          'Utilizou principios de SPIN Selling em reunioes comerciais simuladas.',
        ],
        education: 'Graduacao ficticia em Gestao Comercial',
        certifications: ['Certificacao Shadow em Vendas Consultivas'],
      },
      adjacent: {
        title: 'Representante de Atendimento Comercial',
        summary: 'Perfil ficticio com relacionamento com clientes, propostas comerciais, renovacoes e acompanhamento de pedidos.',
        skills: ['relacionamento com clientes', 'propostas comerciais', 'renovacoes', 'CRM basico', 'pos-venda', 'negociacao simples'],
        bullets: [
          'Acompanhou pedidos e renovacoes de clientes em base ficticia.',
          'Preparou propostas comerciais e manteve registros basicos em CRM.',
          'Nao registra prospeccao outbound estruturada, Salesforce, SPIN Selling ou MEDDIC.',
        ],
        education: 'Graduacao ficticia em Administracao',
      },
      low: {
        title: 'Auxiliar Administrativo',
        summary: 'Perfil ficticio com controle de documentos, atendimento interno e apoio operacional.',
        skills: ['controle administrativo', 'atendimento interno', 'planilhas', 'organizacao'],
        bullets: [
          'Organizou documentos comerciais e controles internos ficticios.',
          'Apoiou atendimento a areas internas sem responsabilidade direta por vendas.',
          'Nao possui experiencia registrada com CRM, prospeccao ou negociacao B2B.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
  {
    domain: 'finance',
    label: 'Finance',
    emailPrefix: 'shadow-finance',
    targetRole: 'Analista Financeiro Shadow',
    targetRequirements: ['Excel avancado', 'forecast', 'orcamento', 'SAP FI', 'IFRS'],
    targetDifferentials: ['Power Query', 'DRE', 'fluxo de caixa'],
    profiles: {
      high: {
        title: 'Analista de Planejamento Financeiro',
        summary: 'Perfil ficticio com Excel, orcamento, forecast, DRE, fluxo de caixa e analise de variacoes.',
        skills: ['Excel avancado', 'orcamento', 'forecast', 'DRE', 'fluxo de caixa', 'analise de variacoes', 'Power Query'],
        bullets: [
          'Apoiou ciclos ficticios de orcamento e forecast com analise de variacoes.',
          'Preparou DRE gerencial e acompanhamento de fluxo de caixa em Excel avancado.',
          'Automatizou conciliacoes simples com Power Query para relatorios financeiros simulados.',
        ],
        education: 'Graduacao ficticia em Ciencias Contabeis',
        certifications: ['Certificacao Shadow em FP&A'],
      },
      adjacent: {
        title: 'Assistente Financeiro',
        summary: 'Perfil ficticio com contas a pagar, contas a receber, conciliacao bancaria e planilhas de controle.',
        skills: ['contas a pagar', 'contas a receber', 'conciliacao bancaria', 'Excel intermediario', 'relatorios financeiros'],
        bullets: [
          'Executou rotinas ficticias de contas a pagar, receber e conciliacao bancaria.',
          'Preparou planilhas de controle financeiro e relatorios operacionais.',
          'Nao registra experiencia direta com forecast, SAP FI, IFRS ou Power Query.',
        ],
        education: 'Graduacao ficticia em Administracao',
      },
      low: {
        title: 'Assistente de Compras',
        summary: 'Perfil ficticio com cotacoes, cadastro de fornecedores e controles administrativos.',
        skills: ['cotacoes', 'fornecedores', 'compras', 'planilhas basicas', 'documentacao'],
        bullets: [
          'Apoiou cotacoes e organizacao de documentos de compras ficticias.',
          'Atualizou cadastros de fornecedores e controles administrativos.',
          'Nao possui experiencia registrada com orcamento, forecast, DRE ou normas IFRS.',
        ],
        education: 'Ensino superior ficticio em andamento',
      },
    },
  },
  {
    domain: 'operations',
    label: 'Operations',
    emailPrefix: 'shadow-operations',
    targetRole: 'Analista de Operacoes Shadow',
    targetRequirements: ['SLA', 'estoque', 'logistica', 'SAP MM', 'WMS avancado'],
    targetDifferentials: ['roteirizacao', 'fornecedores', 'melhoria de processos'],
    profiles: {
      high: {
        title: 'Analista de Operacoes Logisticas',
        summary: 'Perfil ficticio com logistica, estoque, SLA, fornecedores, indicadores operacionais e melhoria de processos.',
        skills: ['logistica', 'estoque', 'SLA', 'fornecedores', 'indicadores operacionais', 'melhoria de processos', 'WMS'],
        bullets: [
          'Acompanhou SLAs logisticos e indicadores operacionais de uma operacao ficticia.',
          'Controlou estoque e interface com fornecedores usando rotinas de WMS.',
          'Mapeou gargalos e propos melhorias de processo em fluxos simulados.',
        ],
        education: 'Graduacao ficticia em Logistica',
        certifications: ['Certificacao Shadow em Operacoes'],
      },
      adjacent: {
        title: 'Assistente de Operacoes',
        summary: 'Perfil ficticio com controles de pedidos, atendimento a fornecedores e planilhas de acompanhamento.',
        skills: ['controle de pedidos', 'fornecedores', 'planilhas', 'indicadores simples', 'processos operacionais'],
        bullets: [
          'Acompanhou pedidos e atualizacoes de fornecedores em operacao ficticia.',
          'Preparou controles simples de prazos e volumes em planilhas.',
          'Nao registra experiencia direta com SAP MM, WMS avancado ou roteirizacao.',
        ],
        education: 'Tecnologo ficticio em Processos Gerenciais',
      },
      low: {
        title: 'Atendente Administrativo',
        summary: 'Perfil ficticio com atendimento, organizacao de documentos e suporte a areas internas.',
        skills: ['atendimento', 'organizacao documental', 'rotinas administrativas', 'comunicacao interna'],
        bullets: [
          'Apoiou atendimento interno e organizacao de documentos em ambiente ficticio.',
          'Atualizou planilhas administrativas sem foco em logistica ou estoque.',
          'Nao possui experiencia registrada com SLA operacional, WMS ou SAP MM.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
  {
    domain: 'manufacturing',
    label: 'Manufacturing',
    emailPrefix: 'shadow-manufacturing',
    targetRole: 'Analista de Processos Industriais Shadow',
    targetRequirements: ['PCP', 'qualidade', 'FMEA', 'PPAP', 'APQP'],
    targetDifferentials: ['IATF 16949', '5S', 'melhoria continua'],
    profiles: {
      high: {
        title: 'Analista de PCP e Qualidade',
        summary: 'Perfil ficticio com PCP, qualidade, processos industriais, indicadores de producao, 5S e melhoria continua.',
        skills: ['PCP', 'qualidade', 'processos industriais', 'indicadores de producao', '5S', 'melhoria continua', 'FMEA'],
        bullets: [
          'Acompanhou plano de producao ficticio e indicadores de eficiencia industrial.',
          'Participou de rotinas de qualidade, 5S e analise de falhas usando FMEA.',
          'Apoiou iniciativas de melhoria continua em uma linha simulada.',
        ],
        education: 'Graduacao ficticia em Engenharia de Producao',
        certifications: ['Certificacao Shadow em Qualidade Industrial'],
      },
      adjacent: {
        title: 'Tecnica de Producao',
        summary: 'Perfil ficticio com acompanhamento de linha, checklist de qualidade e controle de refugos.',
        skills: ['linha de producao', 'checklist de qualidade', 'controle de refugos', 'seguranca operacional', '5S'],
        bullets: [
          'Acompanhou etapas de producao e registros de qualidade em ambiente ficticio.',
          'Apoiou controles de refugos, organizacao 5S e comunicacao com supervisao.',
          'Nao registra experiencia direta com PCP, PPAP, APQP ou IATF 16949.',
        ],
        education: 'Curso tecnico ficticio em Mecanica',
      },
      low: {
        title: 'Auxiliar de Almoxarifado',
        summary: 'Perfil ficticio com recebimento, separacao de materiais e controle administrativo simples.',
        skills: ['almoxarifado', 'recebimento', 'separacao de materiais', 'planilhas basicas'],
        bullets: [
          'Apoiou recebimento e separacao de materiais para operacao ficticia.',
          'Atualizou controles simples de entrada e saida de itens.',
          'Nao possui experiencia registrada com PCP, qualidade industrial, FMEA ou APQP.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
  {
    domain: 'hr',
    label: 'HR',
    emailPrefix: 'shadow-hr',
    targetRole: 'Analista de Recursos Humanos Shadow',
    targetRequirements: ['recrutamento', 'people analytics', 'Workday', 'SuccessFactors', 'eSocial'],
    targetDifferentials: ['relacoes sindicais', 'onboarding', 'indicadores de RH'],
    profiles: {
      high: {
        title: 'Analista de RH',
        summary: 'Perfil ficticio com recrutamento, selecao, onboarding, indicadores de RH, treinamento e people analytics.',
        skills: ['recrutamento', 'selecao', 'onboarding', 'indicadores de RH', 'treinamento', 'people analytics', 'eSocial'],
        bullets: [
          'Conduziu processos ficticios de recrutamento, selecao e onboarding.',
          'Acompanhou indicadores de RH e dashboards simples de people analytics.',
          'Apoiou treinamentos internos e rotinas relacionadas a eSocial.',
        ],
        education: 'Graduacao ficticia em Psicologia',
        certifications: ['Certificacao Shadow em People Analytics'],
      },
      adjacent: {
        title: 'Assistente de Departamento Pessoal',
        summary: 'Perfil ficticio com admissoes, beneficios, ponto, documentos trabalhistas e atendimento a colaboradores.',
        skills: ['admissoes', 'beneficios', 'ponto', 'documentos trabalhistas', 'atendimento a colaboradores', 'eSocial basico'],
        bullets: [
          'Apoiou admissoes, beneficios e controles de ponto em empresa ficticia.',
          'Manteve documentos trabalhistas e atendimento a colaboradores.',
          'Nao registra experiencia direta com Workday, SuccessFactors ou people analytics.',
        ],
        education: 'Graduacao ficticia em Gestao de Recursos Humanos',
      },
      low: {
        title: 'Assistente Administrativo',
        summary: 'Perfil ficticio com recepcao, controles administrativos e suporte geral a equipes.',
        skills: ['recepcao', 'controles administrativos', 'atendimento', 'organizacao de documentos'],
        bullets: [
          'Apoiou recepcao e organizacao de documentos administrativos ficticios.',
          'Atualizou controles internos sem responsabilidade direta por rotinas de RH.',
          'Nao possui experiencia registrada com recrutamento, people analytics ou sistemas de RH.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
  {
    domain: 'legal-admin',
    label: 'Legal Admin',
    emailPrefix: 'shadow-legal-admin',
    targetRole: 'Analista Juridico Administrativo Shadow',
    targetRequirements: ['contratos', 'compliance', 'ProJuris', 'LGPD avancada', 'due diligence'],
    targetDifferentials: ['contencioso estrategico', 'controle de prazos', 'relatorios'],
    profiles: {
      high: {
        title: 'Analista Juridico Administrativo',
        summary: 'Perfil ficticio com contratos, controle de prazos, documentacao, compliance, relatorios e atendimento interno.',
        skills: ['contratos', 'controle de prazos', 'documentacao', 'compliance', 'relatorios', 'atendimento interno', 'LGPD'],
        bullets: [
          'Controlou prazos e documentos de contratos em departamento juridico ficticio.',
          'Apoiou rotinas de compliance, relatorios e atendimento a areas internas.',
          'Participou de revisoes relacionadas a LGPD em processos simulados.',
        ],
        education: 'Graduacao ficticia em Direito',
        certifications: ['Certificacao Shadow em Compliance'],
      },
      adjacent: {
        title: 'Assistente Administrativo Juridico',
        summary: 'Perfil ficticio com organizacao de documentos, protocolos, cadastro de contratos e apoio a advogados.',
        skills: ['documentacao juridica', 'protocolos', 'cadastro de contratos', 'controle de planilhas', 'atendimento interno'],
        bullets: [
          'Organizou documentos juridicos e protocolos em escritorio ficticio.',
          'Manteve controles de contratos e apoio administrativo a advogados.',
          'Nao registra experiencia direta com ProJuris, due diligence ou LGPD avancada.',
        ],
        education: 'Graduacao ficticia em andamento em Direito',
      },
      low: {
        title: 'Secretaria Administrativa',
        summary: 'Perfil ficticio com agenda, atendimento telefonico e suporte administrativo geral.',
        skills: ['agenda', 'atendimento telefonico', 'organizacao', 'planilhas basicas'],
        bullets: [
          'Organizou agendas e atendimento telefonico em ambiente ficticio.',
          'Apoiou compras simples e arquivo de documentos administrativos.',
          'Nao possui experiencia registrada com contratos, compliance ou rotinas juridicas.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
  {
    domain: 'health-admin',
    label: 'Health Admin',
    emailPrefix: 'shadow-health-admin',
    targetRole: 'Analista Administrativo Hospitalar Shadow',
    targetRequirements: ['indicadores assistenciais', 'processos hospitalares', 'Tasy', 'MV Sistemas', 'ANS'],
    targetDifferentials: ['faturamento hospitalar', 'SLA', 'controle de agendas'],
    profiles: {
      high: {
        title: 'Analista Administrativo de Saude',
        summary: 'Perfil ficticio com atendimento, indicadores assistenciais, relatorios administrativos, processos hospitalares, SLA e controle de agendas.',
        skills: ['atendimento', 'indicadores assistenciais', 'relatorios administrativos', 'processos hospitalares', 'SLA', 'controle de agendas', 'faturamento hospitalar'],
        bullets: [
          'Acompanhou indicadores assistenciais e SLAs administrativos em unidade ficticia.',
          'Preparou relatorios de processos hospitalares e controle de agendas.',
          'Apoiou rotinas simuladas de faturamento hospitalar e atendimento interno.',
        ],
        education: 'Graduacao ficticia em Gestao Hospitalar',
        certifications: ['Certificacao Shadow em Administracao Hospitalar'],
      },
      adjacent: {
        title: 'Assistente de Clinica',
        summary: 'Perfil ficticio com atendimento a pacientes, agendamento, autorizacoes simples e organizacao de prontuarios.',
        skills: ['atendimento a pacientes', 'agendamento', 'autorizacoes', 'prontuarios', 'relatorios simples', 'SLA basico'],
        bullets: [
          'Apoiou atendimento, agendamento e organizacao de prontuarios em clinica ficticia.',
          'Acompanhou prazos de resposta e autorizacoes simples.',
          'Nao registra experiencia direta com Tasy, MV Sistemas, ANS ou indicadores assistenciais estruturados.',
        ],
        education: 'Tecnologo ficticio em Gestao de Servicos de Saude',
      },
      low: {
        title: 'Recepcionista Administrativa',
        summary: 'Perfil ficticio com recepcao, controle de documentos e atendimento geral.',
        skills: ['recepcao', 'atendimento geral', 'documentos', 'planilhas basicas'],
        bullets: [
          'Realizou recepcao e atendimento geral em organizacao ficticia.',
          'Organizou documentos administrativos e listas de contato.',
          'Nao possui experiencia registrada com processos hospitalares, Tasy, MV Sistemas ou ANS.',
        ],
        education: 'Ensino medio ficticio completo',
      },
    },
  },
]

function loadNextEnvironmentForCli(): void {
  const requireFromProject = Module.createRequire(path.join(process.cwd(), 'package.json'))
  const nextEnv = requireFromProject('@next/env') as {
    loadEnvConfig(projectDir: string): void
  }

  nextEnv.loadEnvConfig(process.cwd())
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    seedRunId: DEFAULT_SEED_RUN_ID,
    countPerDomain: 3,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--seed-run-id') {
      options.seedRunId = args[index + 1]?.trim() || DEFAULT_SEED_RUN_ID
      index += 1
      continue
    }

    if (arg === '--count-per-domain') {
      const parsed = Number(args[index + 1])
      options.countPerDomain = Number.isInteger(parsed) && parsed > 0 ? parsed : 3
      index += 1
    }
  }

  return options
}

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`)
  }

  return value
}

function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

function toIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
}

function buildTargetJobDescription(config: DomainConfig): string {
  const targetRole = config.targetRole.replace(/\s+Shadow\b/u, '')

  return [
    `Cargo: ${targetRole}`,
    `Requisitos principais: ${config.targetRequirements.join(', ')}.`,
    `Diferenciais: ${config.targetDifferentials.join(', ')}.`,
  ].join('\n')
}

function buildSourceResumeText(cvState: CVState): string {
  const experience = cvState.experience
    .flatMap((entry) => [
      `${entry.title} - ${entry.company}`,
      ...entry.bullets,
    ])
    .join('\n')

  return [
    cvState.fullName,
    cvState.email,
    cvState.phone,
    cvState.location,
    cvState.summary,
    experience,
    `Skills: ${cvState.skills.join(', ')}`,
    `Education: ${cvState.education.map((entry) => `${entry.degree} - ${entry.institution}`).join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCvState(input: {
  config: DomainConfig
  profile: FitProfile
  name: string
  email: string
  index: number
}): CVState {
  const suffix = String(input.index).padStart(3, '0')

  return {
    fullName: input.name,
    email: input.email,
    phone: `+55 11 90000-${String(1000 + input.index).slice(-4)}`,
    location: 'Brasil',
    summary: `${input.profile.summary} Caso ${suffix} totalmente ficticio e anonimo para validacao shadow.`,
    experience: [
      {
        title: input.profile.title,
        company: `Empresa Shadow ${input.config.label} ${suffix}`,
        location: 'Brasil',
        startDate: '2021-01',
        endDate: 'present',
        bullets: input.profile.bullets,
      },
      {
        title: 'Projeto Shadow de Validacao',
        company: `Laboratorio Ficticio ${input.config.label}`,
        location: 'Remoto',
        startDate: '2019-01',
        endDate: '2020-12',
        bullets: [
          `Participou de caso ficticio para simular sinais de ${input.config.domain}.`,
          'Documentou resultados anonimos sem uso de dados reais ou de clientes.',
        ],
      },
    ],
    skills: input.profile.skills,
    education: [
      {
        degree: input.profile.education,
        institution: 'Instituicao Shadow de Ensino',
        year: '2018',
      },
    ],
    certifications: input.profile.certifications?.map((name) => ({
      name,
      issuer: 'Instituto Shadow',
      year: '2024',
    })),
  }
}

function buildCases(seedRunId: string, countPerDomain: number): ShadowSeedCase[] {
  const selectedFitLevels = FIT_LEVELS.slice(0, countPerDomain)

  if (selectedFitLevels.length !== countPerDomain) {
    throw new Error(`count-per-domain must be between 1 and ${FIT_LEVELS.length}.`)
  }

  return DOMAIN_CONFIGS.flatMap((config) => selectedFitLevels.map((fitLevel, fitIndex) => {
    const number = fitIndex + 1
    const suffix = String(number).padStart(3, '0')
    const caseId = `${config.emailPrefix}-${suffix}`
    const name = `Pessoa Shadow ${config.label} ${suffix}`
    const email = `${config.emailPrefix}-${suffix}@example.invalid`
    const profile = config.profiles[fitLevel]
    const metadata = {
      source: SEED_SOURCE,
      seedRunId,
      testOnly: true,
      anonymized: true,
      domain: config.domain,
      fitLevel,
    } satisfies ShadowSeedCase['metadata']

    return {
      caseId,
      domain: config.domain,
      fitLevel,
      fakeUser: {
        name,
        email,
      },
      cvState: buildCvState({
        config,
        profile,
        name,
        email,
        index: DOMAIN_CONFIGS.indexOf(config) * FIT_LEVELS.length + number,
      }),
      targetJobDescription: buildTargetJobDescription(config),
      metadata,
    }
  }))
}

function buildUserId(testCase: ShadowSeedCase): string {
  return `usr_${toIdPart(testCase.caseId)}`
}

function buildProfileId(testCase: ShadowSeedCase): string {
  return `profile_${toIdPart(testCase.caseId)}`
}

function buildSessionId(seedRunId: string, testCase: ShadowSeedCase): string {
  return `sess_${toIdPart(seedRunId)}_${toIdPart(testCase.caseId)}`
}

async function readExistingIds(
  supabase: SupabaseClient,
  table: 'users' | 'sessions',
  ids: string[],
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .in('id', ids)

  if (error) {
    throw new Error(`Failed to read existing ${table}: ${error.message}`)
  }

  return new Set((data ?? []).map((row: { id: string }) => row.id))
}

async function readSideEffectCounts(
  supabase: SupabaseClient,
  sessionIds: string[],
): Promise<SideEffectCounts> {
  const [creditReservations, resumeGenerations] = await Promise.all([
    supabase
      .from('credit_reservations')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds),
    supabase
      .from('resume_generations')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds),
  ])

  if (creditReservations.error) {
    throw new Error(`Failed to count credit reservations: ${creditReservations.error.message}`)
  }
  if (resumeGenerations.error) {
    throw new Error(`Failed to count resume generations: ${resumeGenerations.error.message}`)
  }

  return {
    creditReservations: creditReservations.count ?? 0,
    resumeGenerations: resumeGenerations.count ?? 0,
  }
}

function countDomains(cases: ShadowSeedCase[]): Record<Domain, number> {
  return DOMAIN_CONFIGS.reduce((acc, config) => {
    acc[config.domain] = cases.filter((testCase) => testCase.domain === config.domain).length
    return acc
  }, {} as Record<Domain, number>)
}

function buildAgentState(testCase: ShadowSeedCase, sessionId: string) {
  return {
    parseStatus: 'parsed',
    rewriteHistory: {},
    workflowMode: 'job_targeting',
    targetJobDescription: testCase.targetJobDescription,
    sourceResumeText: buildSourceResumeText(testCase.cvState),
    source: SEED_SOURCE,
    seedRunId: testCase.metadata.seedRunId,
    caseId: testCase.caseId,
    sessionExternalId: sessionId,
    domain: testCase.domain,
    fitLevel: testCase.fitLevel,
    testOnly: true,
    anonymized: true,
    metadata: testCase.metadata,
  }
}

async function main(): Promise<void> {
  loadNextEnvironmentForCli()

  const options = parseArgs(process.argv.slice(2))
  const cases = buildCases(options.seedRunId, options.countPerDomain)
  const supabase = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const userIds = cases.map(buildUserId)
  const sessionIds = cases.map((testCase) => buildSessionId(options.seedRunId, testCase))

  const [existingUsers, existingSessions, beforeSideEffects] = await Promise.all([
    readExistingIds(supabase, 'users', userIds),
    readExistingIds(supabase, 'sessions', sessionIds),
    readSideEffectCounts(supabase, sessionIds),
  ])

  const userRows = cases.map((testCase) => ({
    id: buildUserId(testCase),
    status: 'active',
    display_name: testCase.fakeUser.name,
    primary_email: testCase.fakeUser.email,
    updated_at: now,
  }))

  const profileRows = cases.map((testCase) => ({
    id: buildProfileId(testCase),
    user_id: buildUserId(testCase),
    cv_state: testCase.cvState,
    source: SEED_SOURCE,
    linkedin_url: null,
    profile_photo_url: null,
    extracted_at: now,
    updated_at: now,
  }))

  const sessionRows = cases.map((testCase) => {
    const sessionId = buildSessionId(options.seedRunId, testCase)

    return {
      id: sessionId,
      user_id: buildUserId(testCase),
      state_version: CURRENT_SESSION_STATE_VERSION,
      phase: 'analysis',
      cv_state: testCase.cvState,
      agent_state: buildAgentState(testCase, sessionId),
      generated_output: { status: 'idle' },
      ats_score: null,
      credits_used: 0,
      message_count: 0,
      credit_consumed: false,
      updated_at: now,
    }
  })

  const userResult = await supabase
    .from('users')
    .upsert(userRows, { onConflict: 'id' })

  if (userResult.error) {
    throw new Error(`Failed to upsert users: ${userResult.error.message}`)
  }

  const profileResult = await supabase
    .from('user_profiles')
    .upsert(profileRows, { onConflict: 'user_id' })

  if (profileResult.error) {
    throw new Error(`Failed to upsert user profiles: ${profileResult.error.message}`)
  }

  const sessionResult = await supabase
    .from('sessions')
    .upsert(sessionRows, { onConflict: 'id' })

  if (sessionResult.error) {
    throw new Error(`Failed to upsert sessions: ${sessionResult.error.message}`)
  }

  const [persistedSessions, afterSideEffects] = await Promise.all([
    readExistingIds(supabase, 'sessions', sessionIds),
    readSideEffectCounts(supabase, sessionIds),
  ])

  if (persistedSessions.size !== sessionIds.length) {
    throw new Error(`Expected ${sessionIds.length} persisted sessions, found ${persistedSessions.size}.`)
  }

  const summary = {
    seedRunId: options.seedRunId,
    usersCreated: userIds.filter((id) => !existingUsers.has(id)).length,
    usersReused: userIds.filter((id) => existingUsers.has(id)).length,
    sessionsCreated: sessionIds.filter((id) => !existingSessions.has(id)).length,
    sessionsReused: sessionIds.filter((id) => existingSessions.has(id)).length,
    domains: countDomains(cases),
    creditReservationsCreated: Math.max(
      0,
      afterSideEffects.creditReservations - beforeSideEffects.creditReservations,
    ),
    resumeGenerationsCreated: Math.max(
      0,
      afterSideEffects.resumeGenerations - beforeSideEffects.resumeGenerations,
    ),
    artifactsCreated: 0,
    OpenAICalls: 0,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
