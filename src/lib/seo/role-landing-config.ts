export const engenheiroDadosConfig: RoleLandingConfig = {
  slug: "curriculo-engenheiro-de-dados-ats",
  role: "Engenheiro de Dados",
  roleShort: "Eng. de Dados",
  visualVariant: "data_engineer",

  meta: {
    title: "Currículo para Engenheiro de Dados que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Aprenda como criar um currículo de engenheiro de dados otimizado para ATS. Veja exemplos com Spark, Airflow, Databricks, pipelines, ETL e cloud.",
    canonical: "/curriculo-engenheiro-de-dados-ats",
  },

  hero: {
    h1: "Currículo para Engenheiro de Dados que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você constrói pipelines, integrações e arquitetura de dados em escala, mas seu currículo pode não mostrar isso com clareza. Sistemas ATS procuram stack, volume, cloud e impacto técnico real. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },

  problem: {
    title: "Por que currículos de engenheiros de dados são rejeitados pelo ATS?",
    description: "A maioria dos currículos dessa área descreve atividades de forma genérica e não deixa claro stack, arquitetura, escala de dados e impacto da engenharia implementada.",
    points: [
      "Não mencionar volume de dados processado ou escala dos pipelines",
      "Descrever ETL/ELT sem stack técnica específica (Spark, Airflow, Databricks, dbt)",
      "Omitir cloud, data lake, warehouse ou arquitetura de dados",
      "Não explicar confiabilidade, performance ou custo dos pipelines",
      "Confundir análise de dados com engenharia de dados no posicionamento do currículo",
    ],
  },

  atsExplanation: {
    title: "Como o ATS filtra currículos de engenheiros de dados",
    description: "Recrutadores de engenharia de dados buscam stack moderna, escala, arquitetura e confiabilidade. ATS costuma priorizar currículos que mencionam pipelines, cloud, ferramentas específicas e impacto técnico mensurável.",
    whatRecruitersScan: [
      "Spark, Databricks, Airflow, dbt, Kafka ou outras ferramentas de pipeline",
      "Experiência com ETL/ELT, data lake, data warehouse e modelagem de dados",
      "Cloud (AWS, GCP, Azure) e serviços como BigQuery, Redshift ou Snowflake",
      "SQL avançado, Python e performance em processamento distribuído",
      "Volume de dados, SLA, confiabilidade e monitoramento de pipelines",
      "Arquitetura de dados, custo, observabilidade e escalabilidade",
    ],
  },

  keywords: [
    { term: "Spark / PySpark", description: "Processamento distribuído é uma das palavras-chave mais fortes da área" },
    { term: "ETL / ELT", description: "Fluxos de transformação e ingestão de dados são núcleo da função" },
    { term: "Databricks", description: "Plataforma moderna muito buscada em vagas de engenharia de dados" },
    { term: "Airflow / Orquestração", description: "Automação e agendamento de pipelines são sinais importantes para ATS" },
    { term: "BigQuery / Snowflake / Redshift", description: "Data warehouses em nuvem aparecem com frequência em vagas modernas" },
    { term: "AWS / GCP / Azure", description: "Cloud é essencial para contexto de dados em escala" },
    { term: "Kafka / Streaming", description: "Streaming e ingestão em tempo real são diferenciais fortes" },
    { term: "dbt / Modelagem", description: "Transformação e modelagem de dados moderna agregam muito valor" },
    { term: "SQL Avançado", description: "Continua sendo base forte mesmo em contextos de engenharia de dados" },
    { term: "Data Lake / Warehouse", description: "Arquitetura e organização de dados são muito relevantes para ATS" },
  ],

  commonMistakes: [
    {
      mistake: "Não mostrar escala dos dados",
      fix: "Inclua volume, frequência, throughput, SLA ou dimensão do ambiente para contextualizar a engenharia construída",
    },
    {
      mistake: "Descrever pipelines sem stack",
      fix: "Explique quais ferramentas, linguagens e plataformas você usou: Spark, Airflow, Databricks, Kafka, dbt, BigQuery etc.",
    },
    {
      mistake: "Soar como analista de dados em vez de engenheiro de dados",
      fix: "Destaque arquitetura, pipelines, ingestão, performance, cloud e confiabilidade, não apenas dashboards ou análises",
    },
    {
      mistake: "Omitir cloud e arquitetura",
      fix: "Mostre onde os pipelines rodam, como os dados fluem e quais serviços foram usados no ambiente de dados",
    },
    {
      mistake: "Não quantificar impacto técnico",
      fix: "Use métricas como tempo de processamento, custo reduzido, SLA melhorado ou confiabilidade aumentada",
    },
  ],

  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional com experiência em dados, ETL e relatórios.",
      good: "Engenheiro de Dados com 5 anos de experiência em Spark, Airflow, Databricks, SQL e cloud (AWS/GCP). Especialista em pipelines distribuídos, ingestão em escala e arquitetura de dados, com histórico de ambientes processando 8TB+ por dia com alta confiabilidade e performance.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "SQL, Python, ETL, cloud, dados",
      good: "Data Engineering: ETL/ELT, Data Lake, Data Warehouse, Streaming | Ferramentas: Spark, PySpark, Databricks, Airflow, dbt, Kafka | Cloud: AWS, GCP, BigQuery, S3, Redshift | Linguagens: SQL Avançado, Python | Arquitetura: Orquestração, Monitoramento, Performance, SLA",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Trabalhei com pipelines de dados e integrações entre sistemas.",
      good: "Desenhei e mantive pipelines distribuídos com Spark e Airflow processando 6TB/dia, reduzi tempo de processamento em 42%, melhorei confiabilidade para 99,9% de SLA e otimizei custos de infraestrutura em 18% com arquitetura em cloud.",
    },
  },

  specializations: [
    {
      title: "Batch & Big Data",
      description: "Foco em processamento distribuído, ETL em escala, data lakes e engenharia de dados robusta para grandes volumes.",
      keywords: ["Spark", "PySpark", "Databricks", "Hadoop", "Batch Processing", "ETL", "Data Lake", "S3", "Parquet", "Delta"],
    },
    {
      title: "Streaming & Real Time",
      description: "Atuação com ingestão em tempo real, eventos, mensageria e pipelines de baixa latência.",
      keywords: ["Kafka", "Streaming", "Flink", "Kinesis", "Pub/Sub", "Eventos", "Tempo Real", "CDC", "Low Latency", "Observabilidade"],
    },
    {
      title: "Warehouse & Analytics Engineering",
      description: "Foco em modelagem, transformação, warehouse, governança e camada analítica para consumo do negócio.",
      keywords: ["dbt", "BigQuery", "Snowflake", "Redshift", "Modelagem", "Warehouse", "Data Mart", "Camada Analítica", "Governança", "Qualidade"],
    },
  ],

  seniorityLevels: [
    {
      level: "Engenheiro de Dados Júnior",
      focus: "Demonstre domínio de fundamentos técnicos, ETL e stack inicial de dados",
      tips: [
        "Mostre projetos com SQL, Python, ETL e alguma ferramenta de orquestração ou cloud",
        "Inclua datasets, pipelines acadêmicos, pessoais ou experiências reais com ingestão e transformação",
        "Destaque base forte em modelagem, versionamento e boas práticas de dados",
        "Mencione projetos onde você automatizou ou estruturou fluxos de dados",
      ],
    },
    {
      level: "Engenheiro de Dados Pleno",
      focus: "Mostre escala, autonomia técnica, confiabilidade e impacto nos pipelines",
      tips: [
        "Quantifique volume de dados, frequência dos jobs, SLA ou performance do ambiente",
        "Mencione cloud, arquitetura, observabilidade e otimização de custo ou latência",
        "Destaque ownership de pipelines, orquestração e integração entre fontes e camadas",
        "Mostre impacto técnico e colaboração com analytics, BI ou produto",
      ],
    },
    {
      level: "Engenheiro de Dados Sênior / Lead",
      focus: "Demonstre visão de arquitetura, escalabilidade, governança e liderança técnica",
      tips: [
        "Mostre desenho de arquitetura, padronização, qualidade e confiabilidade da plataforma de dados",
        "Inclua decisões sobre stack, custo, performance, governance e observabilidade",
        "Mencione times ou pessoas mentoradas, padrões técnicos e evolução da plataforma",
        "Destaque visão de longo prazo e impacto em todo o ecossistema de dados da empresa",
      ],
    },
  ],

  cvExample: {
    before: {
      title: "Experiência com Dados",
      bullets: [
        "Trabalhei com ETL e dados da empresa",
        "Criei integrações entre sistemas",
        "Participei de projetos de dados",
        "Usei Python e SQL no dia a dia",
      ],
    },
    after: {
      title: "Engenheiro de Dados | Spark, Airflow, Cloud, Pipelines",
      bullets: [
        "Desenhei pipelines com Spark e Airflow processando 6TB/dia com SLA de 99,9%",
        "Reduzi tempo de processamento em 42% e custo de infraestrutura em 18% com otimizações em Databricks",
        "Estruturei arquitetura de ingestão e transformação em GCP/BigQuery para múltiplas fontes de dados",
        "Implementei monitoramento e observabilidade de pipelines, reduzindo falhas críticas em 60%",
      ],
    },
  },

  fullResumeExample: {
    name: "Bruno Ferreira",
    title: "Engenheiro de Dados | Spark, Airflow, Databricks",
    contact: "bruno.ferreira@email.com | (11) 93333-0000 | São Paulo, SP | linkedin.com/in/brunoferreira | github.com/brunoferreira",
    summary: "Engenheiro de Dados com 6 anos de experiência em Spark, PySpark, Databricks, Airflow, SQL e cloud (AWS/GCP). Especialista em arquitetura de dados, pipelines distribuídos, ingestão em escala e observabilidade. Histórico de ambientes processando 10TB+ por dia com alta confiabilidade, performance e eficiência de custo.",
    skills: [
      { category: "Data Engineering", items: "ETL/ELT, Pipelines, Data Lake, Data Warehouse, Modelagem" },
      { category: "Ferramentas", items: "Spark, PySpark, Databricks, Airflow, dbt, Kafka" },
      { category: "Cloud", items: "AWS, GCP, BigQuery, S3, Redshift, Pub/Sub" },
      { category: "Linguagens", items: "SQL Avançado, Python, Bash" },
      { category: "Arquitetura", items: "Streaming, Orquestração, SLA, Monitoramento, Observabilidade" },
      { category: "Qualidade", items: "Data Quality, Governança, Testes, Confiabilidade, Performance" },
    ],
    experience: [
      {
        role: "Engenheiro de Dados Pleno",
        company: "Data Platform Solutions",
        period: "Jan 2022 – Presente",
        bullets: [
          "Desenhei pipelines distribuídos em Spark e Databricks processando 8TB/dia com SLA de 99,9%",
          "Reduzi tempo médio de processamento em 45% com otimização de jobs PySpark e particionamento inteligente",
          "Implementei orquestração com Airflow e monitoramento proativo, reduzindo falhas críticas em 58%",
          "Apoiei evolução da arquitetura em GCP/BigQuery e reduzi custo operacional em 20% com redesign de ingestão",
        ],
      },
      {
        role: "Engenheiro de Dados Júnior",
        company: "Analytics Infra Brasil",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Desenvolvi pipelines ETL com Python e SQL para ingestão e transformação de múltiplas fontes de dados",
          "Automatizei rotinas de carga e controle de qualidade com redução de 30% no tempo operacional",
          "Participei da construção de camada analítica em warehouse com foco em confiabilidade e consistência",
          "Atuei em integração de dados com cloud e versionamento de pipelines via Git",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Sistemas de Informação",
      institution: "PUC Campinas",
      year: "2019",
    },
    certifications: [
      "Google Cloud Professional Data Engineer (2023)",
      "Databricks Data Engineer Associate (2022)",
      "Astronomer / Apache Airflow Fundamentals (2021)",
    ],
  },

  improvementSteps: [
    { title: "Mostre stack técnica completa", description: "Spark, Airflow, Databricks, dbt, Kafka, BigQuery, cloud e SQL avançado devem aparecer com clareza no currículo." },
    { title: "Inclua escala e contexto", description: "Volume de dados, frequência dos jobs, SLA, throughput ou latência ajudam o ATS a entender a complexidade do seu trabalho." },
    { title: "Explique arquitetura e camadas", description: "Data lake, warehouse, ingestão, transformação, serving e observabilidade fortalecem muito o posicionamento técnico." },
    { title: "Quantifique impacto técnico", description: "Mostre tempo economizado, falhas reduzidas, custo otimizado, performance melhorada ou confiabilidade aumentada." },
    { title: "Diferencie engenharia de análise", description: "Destaque pipelines, arquitetura, automação, cloud e confiabilidade — não apenas relatórios ou dashboards." },
    { title: "Adapte ao contexto da vaga", description: "Se a vaga é batch, streaming, platform ou analytics engineering, ajuste a linguagem e os exemplos do currículo para esse foco." },
  ],

  internalLinks: [
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Guia específico para analistas de dados", image: "/images/seo/data-analyst-career.jpg" },
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Otimização para perfis de tecnologia", image: "/images/seo/developer-career.jpg" },
    { label: "Currículo para Product Manager", href: "/curriculo-product-manager-ats", description: "Guia específico para produto", image: "/images/seo/ats-guide.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/marketing-career.jpg" },
  ],

  positioningMistakes: [
    "Parecer analista de dados em vez de engenheiro de dados",
    "Não mostrar stack, arquitetura e escala dos pipelines",
    "Omitir cloud, warehouse, lake ou observabilidade",
    "Descrever ETL de forma genérica sem ferramentas e impacto técnico",
    "Não demonstrar confiabilidade, performance ou custo do ambiente de dados",
  ],

  realExample: {
    title: "Exemplo real de impacto em Engenharia de Dados",
    before: "Trabalhei com ETL, SQL e integração de dados entre sistemas",
    after: "Desenhei pipelines com Spark e Airflow processando 6TB/dia, reduzi tempo de processamento em 42%, aumentei SLA para 99,9% e otimizei custo em 18% com arquitetura em cloud",
  },

  faqs: [
    {
      question: "O que colocar no currículo de engenheiro de dados?",
      answer: "O mais importante é mostrar stack, escala e impacto técnico. Inclua ferramentas como Spark, Airflow, Databricks, dbt, Kafka, cloud, SQL avançado e contexto do ambiente: volume de dados, frequência dos pipelines, SLA, arquitetura e resultados obtidos.",
    },
    {
      question: "Preciso colocar volume de dados no currículo?",
      answer: "Sim. Volume, frequência e escala são sinais muito fortes para ATS e recrutadores. Dizer que você processava 5TB/dia, milhões de eventos ou jobs horários com alta confiabilidade muda completamente a percepção sobre o seu nível técnico.",
    },
    {
      question: "Qual a diferença entre currículo de analista e engenheiro de dados?",
      answer: "Analistas tendem a focar mais em insights, dashboards, BI e apoio ao negócio. Engenheiros de dados devem enfatizar pipelines, ingestão, transformação, arquitetura, cloud, confiabilidade, observabilidade e performance. Essa diferença precisa ficar clara no currículo.",
    },
    {
      question: "Cloud é obrigatório para engenharia de dados?",
      answer: "Na maioria dos contextos modernos, sim. AWS, GCP e Azure aparecem com muita frequência em vagas. Mesmo que você trabalhe mais com on-premise, citar serviços e contexto cloud quando existir aumenta bastante a aderência no ATS.",
    },
    {
      question: "Vale mencionar Airflow, Databricks e dbt separadamente?",
      answer: "Sim. Ferramentas específicas têm muito peso no ATS. Citar apenas 'ETL' é pouco. O ideal é explicar como essas ferramentas foram usadas em orquestração, processamento, modelagem ou observabilidade do ambiente de dados.",
    },
    {
      question: "Como mostrar impacto sendo engenheiro de dados?",
      answer: "Mostre indicadores técnicos e operacionais: tempo de processamento reduzido, custo otimizado, falhas diminuídas, SLA melhorado, throughput aumentado, observabilidade implementada. Isso prova valor real do seu trabalho de engenharia.",
    },
    {
      question: "Streaming precisa aparecer no currículo se eu trabalhei com isso?",
      answer: "Sim. Kafka, Kinesis, Pub/Sub, eventos e pipelines em tempo real são diferenciais fortes. Se você tem essa experiência, vale destacar com clareza porque isso diferencia bastante seu perfil no ATS e no recrutamento técnico.",
    },
    {
      question: "SQL ainda importa para engenheiro de dados?",
      answer: "Muito. Mesmo em ambientes modernos com Spark e cloud, SQL continua sendo uma base essencial. O ideal é deixar claro que você domina SQL avançado além da engenharia do pipeline, especialmente em contexts de warehouse e transformação de dados.",
    },
  ],
}
