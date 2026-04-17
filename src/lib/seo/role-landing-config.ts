export type RoleKeyword = {
  term: string
  description: string
}

export type BeforeAfterExample = {
  before: {
    title: string
    bullets: string[]
  }
  after: {
    title: string
    bullets: string[]
  }
}

export type RoleFaq = {
  question: string
  answer: string
}

export type ResumeSection = {
  title: string
  bad: string
  good: string
}

export type Specialization = {
  title: string
  description: string
  keywords: string[]
}

export type SeniorityLevel = {
  level: string
  focus: string
  tips: string[]
}

export type CommonMistake = {
  mistake: string
  fix: string
}

export type InternalLink = {
  label: string
  href: string
  description: string
  image: string
}

export type FullResumeExample = {
  name: string
  title: string
  contact: string
  summary: string
  skills: {
    category: string
    items: string
  }[]
  experience: {
    role: string
    company: string
    period: string
    bullets: string[]
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }
  certifications: string[]
}

export type RoleLandingVisualVariant =
  | "default"
  | "developer"
  | "data_engineer"
  | "finance"

export type RoleLandingConfig = {
  slug: string
  role: string
  roleShort: string
  visualVariant?: RoleLandingVisualVariant

  meta: {
    title: string
    description: string
    canonical: string
  }

  hero: {
    h1: string
    subtitle: string
    ctaText: string
    ctaSubtext: string
  }

  problem: {
    title: string
    description: string
    points: string[]
  }

  atsExplanation: {
    title: string
    description: string
    whatRecruitersScan: string[]
  }

  keywords: RoleKeyword[]
  commonMistakes: CommonMistake[]

  resumeSections: {
    summary: ResumeSection
    skills: ResumeSection
    experience: ResumeSection
  }

  specializations: Specialization[]
  seniorityLevels: SeniorityLevel[]
  cvExample: BeforeAfterExample
  fullResumeExample: FullResumeExample

  improvementSteps: {
    title: string
    description: string
  }[]

  internalLinks: InternalLink[]
  positioningMistakes?: string[]
  realExample?: {
    title: string
    before: string
    after: string
  }
  faqs: RoleFaq[]
}

export const desenvolvedorConfig: RoleLandingConfig = {
  slug: "curriculo-desenvolvedor-ats",
  role: "Desenvolvedor de Software",
  roleShort: "Desenvolvedor",
  visualVariant: "developer",
  meta: {
    title: "Currículo para Desenvolvedor que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Aprenda como criar um currículo de desenvolvedor otimizado para ATS. Exemplos de resumo profissional, skills, experiência e palavras-chave para front-end, back-end e full stack.",
    canonical: "/curriculo-desenvolvedor-ats",
  },
  hero: {
    h1: "Currículo para Desenvolvedor que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Seu currículo de desenvolvedor pode estar sendo rejeitado antes mesmo de ser lido. Sistemas ATS filtram candidatos automaticamente, e a maioria dos devs não sabe por que nunca recebe retorno. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos de desenvolvedores são rejeitados pelo ATS?",
    description: "Mesmo desenvolvedores experientes podem ter seus currículos filtrados por erros simples de formatação ou falta de palavras-chave específicas.",
    points: [
      "Usar termos genéricos como 'programação' em vez de tecnologias específicas (React, Node.js, Python)",
      "Listar tecnologias sem contexto de aplicação ou resultados mensuráveis",
      "Formato visual com colunas ou tabelas que confundem o parser do ATS",
      "Usar nomenclaturas diferentes da vaga (ReactJS vs React, NodeJS vs Node.js)",
      "Colocar habilidades técnicas em formato de ícones, gráficos ou barras de progresso",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de desenvolvedores",
    description: "Os sistemas ATS para vagas de tecnologia são configurados para buscar correspondências de stack técnico, frameworks e metodologias. Alguns ATS dão mais peso para correspondências exatas ou mais próximas da descrição da vaga, então padronizar termos pode ajudar.",
    whatRecruitersScan: [
      "Stack técnico completo (linguagens, frameworks, bancos de dados)",
      "Experiência com metodologias ágeis (Scrum, Kanban)",
      "Ferramentas de versionamento e CI/CD (Git, GitHub Actions, Jenkins)",
      "Cloud e infraestrutura (AWS, GCP, Azure, Docker, Kubernetes)",
      "Anos de experiência com cada tecnologia principal",
      "Certificações técnicas relevantes",
    ],
  },
  keywords: [
    { term: "JavaScript/TypeScript", description: "Linguagens essenciais para desenvolvimento web moderno" },
    { term: "React/Vue/Angular", description: "Frameworks front-end mais requisitados pelo mercado" },
    { term: "Node.js", description: "Runtime JavaScript para back-end, presente em grande parte das vagas full-stack" },
    { term: "Python", description: "Linguagem versátil para back-end, automação e data science" },
    { term: "SQL/NoSQL", description: "PostgreSQL, MySQL, MongoDB - bancos de dados são requisitos básicos" },
    { term: "Git/GitHub", description: "Versionamento de código é obrigatório em qualquer vaga" },
    { term: "Docker/Kubernetes", description: "Containerização e orquestração para deploy moderno" },
    { term: "AWS/GCP/Azure", description: "Cloud computing é diferencial competitivo" },
    { term: "REST APIs/GraphQL", description: "Arquitetura de APIs para integração de sistemas" },
    { term: "Scrum/Agile", description: "Metodologias ágeis presentes em praticamente todas as empresas" },
  ],
  commonMistakes: [
    {
      mistake: "Listar 30+ tecnologias sem contexto",
      fix: "Foque nas 10-15 mais relevantes para a vaga e adicione contexto de uso",
    },
    {
      mistake: "Usar barras de progresso para skills",
      fix: "Liste tecnologias em texto, agrupadas por categoria (Linguagens, Frameworks, etc.)",
    },
    {
      mistake: "Escrever 'Desenvolvedor Full Stack' sem especificar stack",
      fix: "Use 'Desenvolvedor Full Stack | React, Node.js, PostgreSQL'",
    },
    {
      mistake: "Colocar apenas links do GitHub sem descrição",
      fix: "Descreva brevemente: 'GitHub: 15+ projetos em React e Node.js'",
    },
    {
      mistake: "Usar tabelas ou colunas múltiplas",
      fix: "Use layout linear com seções claras e bullets simples",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional de tecnologia com experiência em desenvolvimento de sistemas e aplicações web.",
      good: "Desenvolvedor Full Stack com 4 anos de experiência em React, Node.js, TypeScript e PostgreSQL, atuando na construção de aplicações escaláveis e integrações via APIs REST. Experiência em ambientes ágeis (Scrum) e deploy em AWS.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Linguagens: Várias | Frameworks: Diversos | Banco de dados: Alguns | Metodologias: Ágeis",
      good: "Linguagens: JavaScript, TypeScript, Python | Frameworks: React, Node.js, Next.js, Express | Banco de dados: PostgreSQL, MongoDB, Redis | Cloud: AWS (EC2, S3, Lambda), Docker | Metodologias: Scrum, Kanban, CI/CD",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Desenvolvi sistemas para a empresa. Trabalhei em equipe. Participei de projetos importantes.",
      good: "Desenvolvi 12 aplicações web usando React e TypeScript, reduzindo tempo de carregamento em 40%. Implementei microsserviços com Node.js e Docker, suportando 50K+ requisições/dia. Liderei squad de 4 devs em Scrum.",
    },
  },
  specializations: [
    {
      title: "Desenvolvedor Front-end",
      description: "Foco em interfaces de usuário, experiência do usuário e performance de renderização.",
      keywords: ["React", "Vue.js", "Angular", "TypeScript", "CSS/Sass", "Tailwind CSS", "Next.js", "Webpack", "Performance Web", "Acessibilidade", "Responsive Design", "Jest/Testing Library"],
    },
    {
      title: "Desenvolvedor Back-end",
      description: "Foco em APIs, bancos de dados, arquitetura de sistemas e escalabilidade.",
      keywords: ["Node.js", "Python", "Java", "Go", "PostgreSQL", "MongoDB", "Redis", "REST APIs", "GraphQL", "Microsserviços", "Docker", "Kubernetes", "AWS/GCP"],
    },
    {
      title: "Desenvolvedor Full Stack",
      description: "Domínio de front-end e back-end, ideal para startups e equipes enxutas.",
      keywords: ["React + Node.js", "TypeScript", "Next.js", "PostgreSQL", "MongoDB", "Docker", "AWS", "CI/CD", "Git", "Scrum", "REST APIs", "Testes automatizados"],
    },
  ],
  seniorityLevels: [
    {
      level: "Desenvolvedor Júnior",
      focus: "Demonstre projetos pessoais, cursos e contribuições open source",
      tips: [
        "Inclua projetos do GitHub com descrição e tecnologias usadas",
        "Mencione cursos e certificações (Alura, Rocketseat, freeCodeCamp)",
        "Destaque contribuições em projetos open source, mesmo que pequenas",
        "Foque em 3-5 tecnologias que você realmente domina",
      ],
    },
    {
      level: "Desenvolvedor Pleno",
      focus: "Mostre impacto em projetos e capacidade de trabalhar de forma autônoma",
      tips: [
        "Quantifique resultados: usuários, performance, uptime",
        "Mencione projetos completos do início ao deploy",
        "Destaque colaboração cross-funcional (design, produto)",
        "Inclua experiência com code review e mentoria de júniors",
      ],
    },
    {
      level: "Desenvolvedor Sênior",
      focus: "Demonstre liderança técnica, decisões de arquitetura e mentoria",
      tips: [
        "Destaque decisões de arquitetura e seu impacto no negócio",
        "Mencione equipes lideradas ou mentoradas",
        "Inclua contribuições para processos (CI/CD, padrões de código)",
        "Mostre visão de produto além do código técnico",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência em Desenvolvimento",
      bullets: [
        "Trabalhei com programação web",
        "Desenvolvi sistemas para a empresa",
        "Participei de projetos em equipe",
        "Conhecimento em várias linguagens",
      ],
    },
    after: {
      title: "Desenvolvedor Full Stack | React, Node.js, TypeScript",
      bullets: [
        "Desenvolvi 15+ aplicações web usando React, TypeScript e Node.js, reduzindo tempo de carregamento em 40%",
        "Implementei arquitetura de microsserviços com Docker e AWS, suportando 100K+ usuários ativos",
        "Liderei equipe de 4 desenvolvedores em metodologia Scrum, entregando 95% dos sprints no prazo",
        "Integrei sistemas via REST APIs e GraphQL, processando 1M+ requisições diárias",
      ],
    },
  },
  fullResumeExample: {
    name: "João Silva",
    title: "Desenvolvedor Full Stack | React, Node.js, TypeScript",
    contact: "joao.silva@email.com | (11) 99999-0000 | São Paulo, SP | linkedin.com/in/joaosilva | github.com/joaosilva",
    summary: "Desenvolvedor Full Stack com 5 anos de experiência em React, Node.js, TypeScript e PostgreSQL. Atuação em startups e empresas de tecnologia, construindo aplicações web escaláveis que atendem 100K+ usuários. Experiência com metodologias ágeis (Scrum), CI/CD e deploy em AWS.",
    skills: [
      { category: "Linguagens", items: "JavaScript, TypeScript, Python, SQL" },
      { category: "Front-end", items: "React, Next.js, Tailwind CSS, Redux, Jest, Testing Library" },
      { category: "Back-end", items: "Node.js, Express, NestJS, REST APIs, GraphQL" },
      { category: "Banco de Dados", items: "PostgreSQL, MongoDB, Redis, Prisma ORM" },
      { category: "Cloud & DevOps", items: "AWS (EC2, S3, Lambda, RDS), Docker, GitHub Actions, Vercel" },
      { category: "Metodologias", items: "Scrum, Kanban, Code Review, TDD, CI/CD" },
    ],
    experience: [
      {
        role: "Desenvolvedor Full Stack Pleno",
        company: "TechStartup Ltda",
        period: "Jan 2022 – Presente",
        bullets: [
          "Desenvolvi 12 features críticas em React e TypeScript, aumentando retenção de usuários em 25%",
          "Implementei microsserviços com Node.js e Docker, reduzindo tempo de resposta da API em 60%",
          "Liderei migração de banco de dados MySQL para PostgreSQL, melhorando performance de queries em 40%",
          "Mentorei 2 desenvolvedores júnior em boas práticas de código e arquitetura",
        ],
      },
      {
        role: "Desenvolvedor Front-end Júnior",
        company: "AgênciaWeb",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Desenvolvi 20+ landing pages responsivas com React e Tailwind CSS",
          "Implementei testes automatizados com Jest, alcançando 85% de cobertura de código",
          "Colaborei em equipe de 5 devs usando Scrum, participando de code reviews diários",
          "Integrei APIs de terceiros (Stripe, SendGrid) em aplicações de e-commerce",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Ciência da Computação",
      institution: "Universidade de São Paulo (USP)",
      year: "2019",
    },
    certifications: [
      "AWS Certified Cloud Practitioner (2023)",
      "React – Rocketseat (2022)",
      "JavaScript Algorithms and Data Structures – freeCodeCamp (2020)",
    ],
  },
  improvementSteps: [
    { title: "Liste suas tecnologias com precisão", description: "Use os nomes exatos das tecnologias (React, não ReactJS; Node.js, não NodeJS). Inclua versões se relevante." },
    { title: "Quantifique seus resultados", description: "Transforme 'melhorei a performance' em 'reduzi o tempo de carregamento em 40%'. Números passam melhor pelos filtros." },
    { title: "Espelhe a descrição da vaga", description: "Se a vaga pede 'experiência com AWS', use exatamente 'AWS' no seu currículo, não apenas 'cloud computing'." },
    { title: "Use formato limpo e parseável", description: "Evite colunas, tabelas e ícones. O ATS lê texto linear. Use bullets simples e seções claras." },
    { title: "Inclua projetos com contexto", description: "Para cada projeto, mencione: tecnologias usadas, seu papel, métricas de resultado." },
    { title: "Adicione certificações", description: "AWS Certified, Google Cloud Professional, ou cursos reconhecidos agregam palavras-chave valiosas." },
  ],
  internalLinks: [
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Guia específico para área de dados", image: "/images/seo/data-analyst-career.jpg" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Otimização para marketing digital", image: "/images/seo/marketing-career.jpg" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS", image: "/images/seo/ats-guide.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/developer-career.jpg" },
  ],
  faqs: [
    {
      question: "Quais palavras-chave são essenciais para desenvolvedor?",
      answer: "As palavras-chave variam conforme a stack, mas geralmente incluem: JavaScript ou TypeScript, React ou Vue.js, Node.js ou Python, SQL (PostgreSQL, MySQL), Git, Docker, AWS ou GCP, REST APIs, e metodologias ágeis como Scrum. O mais importante é usar os termos exatos que aparecem na descrição da vaga.",
    },
    {
      question: "Devo listar todas as tecnologias que conheço?",
      answer: "Não é recomendado. Um currículo com 30+ tecnologias pode parecer genérico e dificulta a leitura. Foque nas 10-15 tecnologias mais relevantes para a vaga específica. Organize por categorias (Linguagens, Frameworks, Banco de Dados, Cloud) e inclua apenas tecnologias que você realmente domina e consegue discutir em entrevista.",
    },
    {
      question: "GitHub conta como experiência profissional?",
      answer: "Projetos no GitHub são muito valorizados, especialmente para desenvolvedores júnior ou em transição de carreira. Inclua um link para seu perfil e destaque projetos relevantes com descrição breve. Contribuições para projetos open source também contam e demonstram capacidade de colaboração e código de qualidade.",
    },
    {
      question: "Como destacar experiência com tecnologias recentes?",
      answer: "Mencione projetos específicos onde você utilizou a tecnologia, mesmo que sejam projetos pessoais ou de estudo. Por exemplo: 'Desenvolvi aplicação usando Next.js 14 com Server Components e App Router' demonstra que você está atualizado com as práticas mais recentes do mercado.",
    },
    {
      question: "O ATS diferencia React de ReactJS?",
      answer: "Alguns sistemas ATS podem diferenciar variações de nomenclatura. Para maximizar compatibilidade, use a nomenclatura oficial e mais comum: 'React' (não ReactJS), 'Node.js' (não NodeJS ou Node), 'TypeScript' (não TS). Quando possível, inclua ambas as variações no currículo.",
    },
    {
      question: "Vale colocar soft skills no currículo técnico?",
      answer: "Sim, mas de forma contextualizada em vez de listada. Em vez de escrever 'trabalho em equipe' como skill isolada, incorpore no contexto: 'Colaborei com equipe de 5 desenvolvedores em ambiente Scrum, participando de code reviews e pair programming'. Isso demonstra a soft skill com evidência concreta.",
    },
    {
      question: "Qual o tamanho ideal do currículo de desenvolvedor?",
      answer: "Para a maioria dos casos, 1-2 páginas é o ideal. Desenvolvedores júnior e pleno geralmente conseguem condensar em 1 página. Sêniors com muita experiência podem usar 2 páginas. O importante é que cada linha agregue valor - remova experiências antigas ou irrelevantes para a vaga.",
    },
    {
      question: "Devo incluir projetos pessoais e side projects?",
      answer: "Absolutamente. Projetos pessoais demonstram iniciativa, capacidade de aprender autonomamente e paixão por tecnologia. Inclua 2-3 projetos relevantes com: nome do projeto, tecnologias usadas, seu papel e um resultado ou aprendizado. Links para demo ou repositório são um diferencial.",
    },
  ],
}

export const analistaDadosConfig: RoleLandingConfig = {
  slug: "curriculo-analista-dados-ats",
  role: "Analista de Dados",
  roleShort: "Analista de Dados",
  meta: {
    title: "Currículo para Analista de Dados que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Crie um currículo de analista de dados otimizado para ATS. Exemplos de SQL, Python, Power BI, resumo profissional e palavras-chave para passar nos filtros automáticos.",
    canonical: "/curriculo-analista-dados-ats",
  },
  hero: {
    h1: "Currículo para Analista de Dados que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você trabalha com dados, mas seu currículo pode não estar sendo lido. Sistemas ATS filtram candidatos automaticamente, e a maioria dos profissionais de dados não sabe por que nunca recebe retorno. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos de analistas de dados são rejeitados pelo ATS?",
    description: "A área de dados exige termos técnicos específicos. Pequenos erros de nomenclatura podem fazer currículos excelentes serem filtrados automaticamente.",
    points: [
      "Usar 'análise de dados' genérico em vez de ferramentas específicas (SQL, Python, Power BI)",
      "Não mencionar bibliotecas e frameworks de data science (Pandas, NumPy, Scikit-learn)",
      "Omitir experiência com bancos de dados e data warehouses específicos",
      "Falta de métricas e KPIs nos resultados apresentados",
      "Não incluir experiência com visualização de dados e ferramentas de BI",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de analistas de dados",
    description: "Recrutadores de data configuram o ATS para buscar combinações específicas de ferramentas de análise, linguagens de programação e experiência com bancos de dados. Usar os termos exatos da vaga aumenta suas chances.",
    whatRecruitersScan: [
      "Linguagens de análise (SQL, Python, R)",
      "Ferramentas de BI (Power BI, Tableau, Looker, Metabase)",
      "Bibliotecas de data science (Pandas, NumPy, Matplotlib, Seaborn)",
      "Bancos de dados e data warehouses (PostgreSQL, BigQuery, Snowflake, Redshift)",
      "Processos de ETL e pipelines de dados",
      "Experiência com estatística e modelagem",
    ],
  },
  keywords: [
    { term: "SQL", description: "Linguagem fundamental para consultas e manipulação de dados em qualquer empresa" },
    { term: "Python", description: "Principal linguagem para análise de dados, automação e machine learning" },
    { term: "Power BI/Tableau", description: "Ferramentas de visualização e dashboards mais requisitadas" },
    { term: "Excel Avançado", description: "Ainda essencial: tabelas dinâmicas, VLOOKUP, macros e Power Query" },
    { term: "Pandas/NumPy", description: "Bibliotecas Python obrigatórias para manipulação e análise de dados" },
    { term: "ETL/Pipeline de Dados", description: "Processos de extração, transformação e carga de dados" },
    { term: "BigQuery/Snowflake", description: "Data warehouses em nuvem cada vez mais requisitados" },
    { term: "Estatística", description: "Análise estatística, testes A/B, regressão e correlação" },
    { term: "Data Visualization", description: "Criação de gráficos, dashboards e storytelling com dados" },
    { term: "Machine Learning", description: "Diferencial: Scikit-learn, modelos preditivos, classificação" },
  ],
  commonMistakes: [
    {
      mistake: "Escrever apenas 'Excel' sem especificar nível",
      fix: "Use 'Excel Avançado: Tabelas Dinâmicas, Power Query, VLOOKUP, Macros VBA'",
    },
    {
      mistake: "Listar 'análise de dados' sem ferramentas",
      fix: "Especifique: 'Análise de dados com SQL, Python (Pandas) e Power BI'",
    },
    {
      mistake: "Não mencionar volume de dados trabalhado",
      fix: "Adicione escala: 'Processei datasets de 5M+ registros'",
    },
    {
      mistake: "Usar 'dashboard' sem especificar ferramenta",
      fix: "Escreva: 'Criei 20+ dashboards em Power BI para equipe de vendas'",
    },
    {
      mistake: "Omitir impacto de negócio das análises",
      fix: "Conecte análise a resultado: 'Análise identificou economia de R$200K'",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Analista com experiência em dados e relatórios gerenciais.",
      good: "Analista de Dados com 3 anos de experiência em SQL, Python (Pandas, NumPy) e Power BI. Especialista em ETL, dashboards executivos e análise estatística. Experiência com BigQuery e processos de data warehouse em ambiente cloud (GCP).",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "SQL, Python, Excel, BI tools, Estatística, Dados",
      good: "SQL: PostgreSQL, BigQuery, Snowflake | Python: Pandas, NumPy, Matplotlib, Scikit-learn | BI: Power BI, Tableau, Looker | Excel: Power Query, Tabelas Dinâmicas, VBA | Estatística: Testes A/B, Regressão, Análise de Coorte",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Fiz análises de dados e criei relatórios para a diretoria. Trabalhei com planilhas e sistemas.",
      good: "Desenvolvi 25+ dashboards em Power BI monitorando KPIs de vendas, marketing e operações. Automatizei pipeline de ETL com Python, reduzindo tempo de processamento de 4h para 20min. Conduzi análise de coorte que identificou oportunidade de R$500K em retenção.",
    },
  },
  specializations: [
    {
      title: "Analista de BI",
      description: "Foco em dashboards, relatórios e visualização de dados para tomada de decisão.",
      keywords: ["Power BI", "Tableau", "Looker", "Data Studio", "SQL", "DAX", "Dashboards", "KPIs", "Storytelling com Dados", "Self-service BI"],
    },
    {
      title: "Analista de Dados (Analytics)",
      description: "Análise exploratória, estatística e geração de insights para áreas de negócio.",
      keywords: ["SQL", "Python", "Pandas", "Estatística", "Testes A/B", "Análise de Coorte", "Segmentação", "BigQuery", "Excel Avançado", "Google Analytics"],
    },
    {
      title: "Engenheiro de Dados",
      description: "Foco em pipelines, ETL, data warehouses e infraestrutura de dados.",
      keywords: ["Python", "SQL", "Apache Airflow", "Spark", "ETL/ELT", "Data Warehouse", "BigQuery", "Snowflake", "Databricks", "dbt", "AWS/GCP"],
    },
  ],
  seniorityLevels: [
    {
      level: "Analista Júnior",
      focus: "Demonstre conhecimento técnico e capacidade de aprender",
      tips: [
        "Inclua projetos com datasets públicos (Kaggle, dados governamentais)",
        "Mencione cursos e certificações (Google Data Analytics, IBM Data Science)",
        "Destaque SQL e pelo menos uma ferramenta de BI",
        "Mostre familiaridade com Python básico (Pandas)",
      ],
    },
    {
      level: "Analista Pleno",
      focus: "Mostre autonomia e impacto mensurável nas análises",
      tips: [
        "Quantifique o impacto: 'Análise gerou economia de R$X'",
        "Mencione projetos end-to-end (coleta, análise, apresentação)",
        "Destaque experiência com stakeholders de negócio",
        "Inclua automações criadas e tempo economizado",
      ],
    },
    {
      level: "Analista Sênior / Lead",
      focus: "Demonstre liderança técnica e visão estratégica de dados",
      tips: [
        "Destaque governança de dados e qualidade implementada",
        "Mencione times orientados ou treinados",
        "Inclua projetos de data strategy e roadmap",
        "Mostre conexão entre dados e decisões de negócio",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência com Dados",
      bullets: [
        "Analisei dados da empresa",
        "Criei relatórios gerenciais",
        "Trabalhei com planilhas",
        "Ajudei na tomada de decisões",
      ],
    },
    after: {
      title: "Analista de Dados | SQL, Python, Power BI",
      bullets: [
        "Desenvolvi 20+ dashboards em Power BI monitorando KPIs de vendas, reduzindo tempo de reporting em 60%",
        "Automatizei pipeline de ETL com Python e Pandas, processando 5M+ registros diários do data warehouse",
        "Conduzi análises estatísticas e testes A/B que aumentaram conversão em 25% no e-commerce",
        "Criei queries SQL complexas no BigQuery para segmentação de clientes, impactando R$2M em receita",
      ],
    },
  },
  fullResumeExample: {
    name: "Maria Santos",
    title: "Analista de Dados | SQL, Python, Power BI",
    contact: "maria.santos@email.com | (11) 98888-0000 | São Paulo, SP | linkedin.com/in/mariasantos",
    summary: "Analista de Dados com 4 anos de experiência em SQL, Python (Pandas, NumPy) e Power BI. Especialista em ETL, dashboards executivos e análise estatística. Experiência processando datasets de 10M+ registros e gerando insights que impactaram R$3M+ em decisões de negócio.",
    skills: [
      { category: "SQL", items: "PostgreSQL, BigQuery, Snowflake, Window Functions, CTEs, Query Optimization" },
      { category: "Python", items: "Pandas, NumPy, Matplotlib, Seaborn, Scikit-learn, Jupyter Notebooks" },
      { category: "BI & Visualização", items: "Power BI (DAX, Power Query), Tableau, Looker, Google Data Studio" },
      { category: "ETL & Pipeline", items: "Apache Airflow, dbt, Python scripts, Fivetran" },
      { category: "Excel", items: "Power Query, Tabelas Dinâmicas, VBA, Power Pivot" },
      { category: "Estatística", items: "Testes A/B, Análise de Coorte, Regressão, Segmentação RFV" },
    ],
    experience: [
      {
        role: "Analista de Dados Pleno",
        company: "E-commerce Tech S.A.",
        period: "Jan 2022 – Presente",
        bullets: [
          "Desenvolvi 30+ dashboards em Power BI para marketing, vendas e operações, reduzindo tempo de reporting em 70%",
          "Automatizei pipeline de ETL com Python e Airflow, processando 5M+ registros diários com 99.9% de uptime",
          "Conduzi análise de coorte e LTV que identificou oportunidade de R$800K em retenção de clientes",
          "Criei modelo de segmentação RFV no BigQuery, aumentando conversão de campanhas em 35%",
        ],
      },
      {
        role: "Analista de BI Júnior",
        company: "Consultoria Analytics",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Criei 50+ relatórios em Power BI e Tableau para clientes de varejo e finanças",
          "Desenvolvi queries SQL otimizadas, reduzindo tempo de processamento de 4h para 20min",
          "Automatizei 15+ relatórios recorrentes com Python, economizando 20h/mês da equipe",
          "Treinei equipe de 10+ pessoas em Power BI e SQL básico",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Estatística",
      institution: "Universidade Estadual de Campinas (Unicamp)",
      year: "2019",
    },
    certifications: [
      "Google Data Analytics Professional Certificate (2023)",
      "Microsoft Certified: Power BI Data Analyst Associate (2022)",
      "SQL for Data Science – Coursera/UC Davis (2021)",
    ],
  },
  improvementSteps: [
    { title: "Especifique suas ferramentas", description: "Liste SQL, Python, Power BI, Tableau com contexto de uso. Evite apenas 'ferramentas de análise'." },
    { title: "Inclua volume de dados", description: "Mencione escala: 'Analisei 1M+ registros' ou 'Processei 500GB de dados mensais' impressiona recrutadores." },
    { title: "Destaque impacto em negócio", description: "Conecte análises a resultados: 'Identificou oportunidade de R$500K em economia' vale mais que 'fez análises'." },
    { title: "Mencione bancos de dados", description: "PostgreSQL, MySQL, BigQuery, Snowflake - especifique onde seus dados vivem." },
    { title: "Inclua visualizações", description: "Dashboards e relatórios são o output. Quantifique: 'Criei 30+ dashboards para 5 áreas de negócio'." },
    { title: "Adicione certificações de dados", description: "Google Data Analytics, Microsoft Power BI, AWS Data Analytics agregam credibilidade." },
  ],
  internalLinks: [
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores", image: "/images/seo/developer-career.jpg" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Otimização para marketing digital", image: "/images/seo/marketing-career.jpg" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS", image: "/images/seo/ats-guide.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/data-analyst-career.jpg" },
  ],
  faqs: [
    {
      question: "SQL é realmente obrigatório para analista de dados?",
      answer: "SQL aparece na grande maioria das vagas de dados e é considerado requisito básico. É a linguagem padrão para consultar bancos de dados relacionais, que são usados em praticamente todas as empresas. Mesmo que você use Python no dia a dia, SQL será necessário para extrair dados. Invista em aprender SQL avançado com CTEs, Window Functions e otimização de queries.",
    },
    {
      question: "Preciso saber programar para ser analista de dados?",
      answer: "Depende do nível e tipo de vaga. Para posições iniciais focadas em BI, Excel Avançado e SQL podem ser suficientes. Porém, Python está cada vez mais requisitado para automação, análise exploratória e modelagem. Para posições pleno/sênior ou em empresas de tecnologia, Python com Pandas é praticamente obrigatório. R é uma alternativa válida, especialmente em áreas de pesquisa e estatística.",
    },
    {
      question: "Power BI ou Tableau: qual colocar no currículo?",
      answer: "Idealmente, mencione ambos se tiver conhecimento. Power BI é mais comum em empresas brasileiras e tem custo menor, enquanto Tableau é forte em multinacionais e empresas de tecnologia. Se conhece apenas um bem, mencione-o com profundidade e adicione algo como 'familiaridade com Tableau' se tiver noção básica. O importante é mostrar capacidade de criar visualizações efetivas.",
    },
    {
      question: "Devo incluir Excel no currículo de dados?",
      answer: "Sim, mas especifique 'Excel Avançado' e detalhe o que você sabe: Tabelas Dinâmicas, Power Query, Power Pivot, macros VBA, VLOOKUP/INDEX-MATCH, fórmulas complexas. Excel básico não precisa mencionar - é assumido. Para posições mais técnicas, Excel pode ser menos relevante, mas para cargos em empresas tradicionais ainda é muito valorizado.",
    },
    {
      question: "Como mostrar experiência sem ter trabalhado com Big Data?",
      answer: "Projetos pessoais e estudos contam muito. Use datasets públicos do Kaggle, dados abertos do governo ou APIs públicas. Documente suas análises: 'Analisei dataset de 100K+ registros de vendas usando Python e Pandas, identificando padrões sazonais'. Publique no GitHub ou em um portfólio. A metodologia e qualidade da análise importam mais que o volume absoluto de dados.",
    },
    {
      question: "Machine Learning é necessário para analista de dados?",
      answer: "Não é obrigatório para a maioria das vagas de analista de dados, mas é um diferencial crescente. Conhecimento básico de Scikit-learn, entendimento de modelos preditivos simples (regressão, classificação) e capacidade de interpretar resultados de ML te destacam. Para posições de Data Scientist, aí sim é requisito fundamental.",
    },
    {
      question: "Certificações de dados valem a pena?",
      answer: "Certificações ajudam, especialmente para quem está iniciando ou mudando de área. Google Data Analytics Certificate, Microsoft Power BI Data Analyst e AWS Certified Data Analytics são bem reconhecidas. Elas adicionam palavras-chave relevantes ao currículo e demonstram comprometimento com a área. Porém, não substituem experiência prática - combine certificação com projetos reais.",
    },
    {
      question: "Como destacar análises que geraram impacto no negócio?",
      answer: "Use a fórmula: Ação + Contexto + Resultado. Exemplo: 'Desenvolvi análise de churn (Ação) usando SQL e Python para identificar clientes em risco (Contexto), resultando em redução de 15% na taxa de cancelamento e economia de R$300K/ano (Resultado)'. Sempre que possível, inclua números e valores monetários para demonstrar impacto tangível.",
    },
  ],
}

export const marketingConfig: RoleLandingConfig = {
  slug: "curriculo-marketing-ats",
  role: "Profissional de Marketing",
  roleShort: "Marketing",
  meta: {
    title: "Currículo para Marketing que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Otimize seu currículo de marketing digital para sistemas ATS. Exemplos de resumo profissional, métricas, palavras-chave de performance, SEO e growth para conquistar mais entrevistas.",
    canonical: "/curriculo-marketing-ats",
  },
  hero: {
    h1: "Currículo para Marketing que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você otimiza campanhas, mas seu currículo pode estar sendo rejeitado antes mesmo de ser lido. Sistemas ATS filtram candidatos automaticamente, e a maioria dos profissionais de marketing não sabe por que nunca recebe retorno. Veja exatamente o que corrigir.",
    ctaText: "Descubra por que seu currículo não gera entrevistas",
    ctaSubtext: "Análise gratuita com score ATS e correções específicas",
  },
  problem: {
    title: "Por que currículos de marketing são rejeitados pelo ATS?",
    description: "Marketing é uma área ampla com muitas especialidades. Currículos genéricos que não especificam canais, ferramentas e métricas são facilmente filtrados.",
    points: [
      "Usar termos vagos como 'gerenciei redes sociais' sem métricas ou plataformas específicas",
      "Não mencionar ferramentas de marketing digital (Google Ads, Meta Ads, HubSpot)",
      "Omitir métricas de performance: CTR, ROAS, CAC, LTV",
      "Falta de palavras-chave de SEO, growth e automação",
      "Não especificar canais e estratégias utilizadas",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de marketing",
    description: "Recrutadores de marketing configuram filtros por especialidade (performance, conteúdo, branding) e ferramentas específicas. Um currículo de growth hacker precisa de palavras-chave diferentes de um brand manager.",
    whatRecruitersScan: [
      "Ferramentas de ads (Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads)",
      "Plataformas de automação (HubSpot, RD Station, Mailchimp, ActiveCampaign)",
      "Analytics e métricas (Google Analytics, Data Studio, métricas de funil)",
      "Especialidade específica (SEO, performance, conteúdo, CRM, growth)",
      "Budget gerenciado e resultados de campanhas",
      "Certificações de marketing digital",
    ],
  },
  keywords: [
    { term: "Google Ads/Meta Ads", description: "Plataformas de mídia paga mais utilizadas no mercado" },
    { term: "SEO/SEM", description: "Otimização para buscadores é requisito em marketing digital" },
    { term: "Google Analytics 4", description: "Ferramenta padrão de análise de tráfego e conversões" },
    { term: "HubSpot/RD Station", description: "Plataformas de automação e inbound marketing" },
    { term: "ROI/ROAS/CAC", description: "Métricas de performance que mostram foco em resultados" },
    { term: "CRM", description: "Gestão de relacionamento: Salesforce, Pipedrive, HubSpot CRM" },
    { term: "Marketing de Conteúdo", description: "Estratégia de conteúdo, blog, copywriting, storytelling" },
    { term: "Growth Hacking", description: "Experimentação e otimização para crescimento acelerado" },
    { term: "E-mail Marketing", description: "Automação, segmentação, nurturing e campanhas de e-mail" },
    { term: "Social Media", description: "Gestão de redes: Instagram, LinkedIn, TikTok, estratégia de conteúdo" },
  ],
  commonMistakes: [
    {
      mistake: "Escrever 'gerenciei redes sociais' sem detalhes",
      fix: "Especifique: 'Gerenciei Instagram e LinkedIn com 50K+ seguidores, alcance de 500K/mês'",
    },
    {
      mistake: "Listar 'campanhas de marketing' sem métricas",
      fix: "Adicione números: 'Campanhas de Google Ads com ROAS 4.5x e CTR de 3.2%'",
    },
    {
      mistake: "Não mencionar budget gerenciado",
      fix: "Contextualize: 'Gerenciei budget de R$200K/mês em mídia paga'",
    },
    {
      mistake: "Usar 'marketing digital' sem especificar área",
      fix: "Seja específico: 'Marketing de Performance | Google Ads, Meta Ads, SEO'",
    },
    {
      mistake: "Omitir ferramentas de automação",
      fix: "Inclua: 'Automação de marketing no HubSpot com 15 fluxos de nurturing'",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional de marketing com experiência em campanhas digitais e redes sociais.",
      good: "Analista de Marketing Digital com 4 anos de experiência em performance (Google Ads, Meta Ads) e inbound marketing (HubSpot). Gerenciei budgets de até R$300K/mês com ROAS médio de 4x. Especialista em SEO, automação e análise de funil com Google Analytics 4.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Mídia paga, SEO, Redes sociais, E-mail marketing, Análise de dados",
      good: "Mídia Paga: Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads | SEO: On-page, Off-page, SEMrush, Ahrefs | Automação: HubSpot, RD Station, Mailchimp | Analytics: GA4, Data Studio, Tag Manager | CRM: Salesforce, Pipedrive",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Criei campanhas de marketing digital. Gerenciei as redes sociais da empresa. Trabalhei com e-mail marketing.",
      good: "Gerenciei R$500K/mês em Google Ads e Meta Ads, alcançando ROAS de 4.5x e reduzindo CAC em 30%. Implementei estratégia de SEO que aumentou tráfego orgânico em 150% (50K → 125K visitas/mês). Estruturei automação no HubSpot com 15 fluxos, aumentando conversão de leads em 40%.",
    },
  },
  specializations: [
    {
      title: "Marketing de Performance",
      description: "Foco em mídia paga, ROI, conversões e otimização de campanhas.",
      keywords: ["Google Ads", "Meta Ads", "LinkedIn Ads", "TikTok Ads", "ROAS", "CAC", "LTV", "Pixel", "Conversões", "Remarketing", "A/B Testing", "CRO"],
    },
    {
      title: "Marketing de Conteúdo / SEO",
      description: "Estratégia de conteúdo, otimização para buscadores e inbound marketing.",
      keywords: ["SEO On-page", "SEO Off-page", "Link Building", "Copywriting", "Blog", "Content Strategy", "SEMrush", "Ahrefs", "Keyword Research", "Featured Snippets"],
    },
    {
      title: "Growth Marketing",
      description: "Experimentação, métricas de crescimento e otimização de funil completo.",
      keywords: ["Growth Hacking", "Product-Led Growth", "Experimentos A/B", "Métricas AARRR", "Funil de Conversão", "Onboarding", "Retenção", "Viral Loops", "Analytics", "SQL"],
    },
  ],
  seniorityLevels: [
    {
      level: "Analista Júnior",
      focus: "Demonstre conhecimento técnico das ferramentas e vontade de aprender",
      tips: [
        "Inclua certificações Google Ads, Meta Blueprint, HubSpot",
        "Mencione métricas mesmo de projetos pessoais ou estágios",
        "Destaque conhecimento em pelo menos uma especialidade",
        "Mostre familiaridade com ferramentas de analytics",
      ],
    },
    {
      level: "Analista Pleno",
      focus: "Mostre autonomia em campanhas e impacto mensurável",
      tips: [
        "Quantifique budget gerenciado e resultados (ROAS, CAC, conversões)",
        "Mencione otimizações e testes realizados",
        "Destaque projetos liderados do início ao fim",
        "Inclua experiência com múltiplos canais",
      ],
    },
    {
      level: "Coordenador / Gerente",
      focus: "Demonstre liderança, estratégia e visão de negócio",
      tips: [
        "Destaque equipes lideradas e desenvolvidas",
        "Mencione orçamentos anuais e planejamento estratégico",
        "Inclua métricas de impacto no negócio (receita, market share)",
        "Mostre visão integrada de canais e jornada do cliente",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência em Marketing",
      bullets: [
        "Gerenciei redes sociais da empresa",
        "Criei campanhas de marketing",
        "Trabalhei com e-mail marketing",
        "Ajudei no crescimento da marca",
      ],
    },
    after: {
      title: "Analista de Marketing Digital | Performance, SEO, Automação",
      bullets: [
        "Gerenciei R$500K/mês em Google Ads e Meta Ads, alcançando ROAS de 4.5x e reduzindo CAC em 30%",
        "Implementei estratégia de SEO que aumentou tráfego orgânico em 150% em 6 meses (50K para 125K visitas)",
        "Estruturei automação de marketing no HubSpot com 15 fluxos de nurturing, aumentando conversão em 40%",
        "Liderei equipe de 3 pessoas em campanhas integradas, gerando 2.000+ leads qualificados/mês",
      ],
    },
  },
  fullResumeExample: {
    name: "Ana Costa",
    title: "Analista de Marketing Digital | Performance, SEO, Automação",
    contact: "ana.costa@email.com | (11) 97777-0000 | São Paulo, SP | linkedin.com/in/anacosta",
    summary: "Analista de Marketing Digital com 5 anos de experiência em performance (Google Ads, Meta Ads) e inbound marketing (HubSpot). Gerenciei budgets de até R$500K/mês com ROAS médio de 4.5x. Especialista em SEO, automação de marketing e análise de funil com Google Analytics 4. Resultados comprovados em e-commerce e SaaS B2B.",
    skills: [
      { category: "Mídia Paga", items: "Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads, Google Shopping" },
      { category: "SEO & Conteúdo", items: "SEO On-page, Link Building, SEMrush, Ahrefs, Copywriting, WordPress" },
      { category: "Automação", items: "HubSpot, RD Station, Mailchimp, ActiveCampaign, Zapier" },
      { category: "Analytics", items: "Google Analytics 4, Data Studio, Tag Manager, Hotjar, Amplitude" },
      { category: "CRM", items: "HubSpot CRM, Salesforce, Pipedrive" },
      { category: "Metodologias", items: "Growth Hacking, A/B Testing, CRO, Funil AARRR, OKRs" },
    ],
    experience: [
      {
        role: "Analista de Marketing Digital Pleno",
        company: "SaaS Tech Ltda",
        period: "Jan 2022 – Presente",
        bullets: [
          "Gerenciei R$300K/mês em Google Ads e Meta Ads, alcançando ROAS de 4.5x e reduzindo CAC em 35%",
          "Implementei estratégia de SEO que aumentou tráfego orgânico em 180% (30K → 85K visitas/mês)",
          "Estruturei automação no HubSpot com 20 fluxos de nurturing, aumentando conversão MQL→SQL em 45%",
          "Conduzi 50+ testes A/B em landing pages, aumentando taxa de conversão de 2% para 4.5%",
        ],
      },
      {
        role: "Analista de Marketing Júnior",
        company: "E-commerce Fashion S.A.",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Gerenciei campanhas de Google Shopping e Meta Ads com budget de R$150K/mês",
          "Criei e otimizei 100+ anúncios, melhorando CTR médio de 1.2% para 2.8%",
          "Desenvolvi estratégia de e-mail marketing com segmentação RFV, aumentando receita de e-mail em 60%",
          "Implementei tracking completo com GTM e GA4, melhorando atribuição de conversões",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Comunicação Social - Publicidade e Propaganda",
      institution: "ESPM - Escola Superior de Propaganda e Marketing",
      year: "2019",
    },
    certifications: [
      "Google Ads Search Certification (2024)",
      "Meta Certified Digital Marketing Associate (2023)",
      "HubSpot Inbound Marketing Certification (2022)",
      "Google Analytics 4 Certification (2023)",
    ],
  },
  improvementSteps: [
    { title: "Especifique suas plataformas", description: "Google Ads, Meta Ads, LinkedIn Ads - nomeie cada ferramenta. Evite apenas 'mídia paga'." },
    { title: "Inclua métricas de resultado", description: "CTR, ROAS, CAC, conversão - números provam seu impacto. 'Aumentei vendas em 50%' é melhor que 'melhorei vendas'." },
    { title: "Mencione budget gerenciado", description: "Gerenciar R$10K/mês é diferente de R$500K/mês. Contextualize o tamanho da operação." },
    { title: "Destaque sua especialidade", description: "Performance, conteúdo, branding, growth - deixe claro seu foco principal." },
    { title: "Inclua certificações", description: "Google Ads, Meta Blueprint, HubSpot, RD Station - certificações validam conhecimento técnico." },
    { title: "Mostre conhecimento de funil", description: "Mencione topo, meio e fundo de funil. Entender a jornada do cliente é valorizado." },
  ],
  internalLinks: [
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores", image: "/images/seo/developer-career.jpg" },
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Otimização para área de dados", image: "/images/seo/data-analyst-career.jpg" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS", image: "/images/seo/ats-guide.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/marketing-career.jpg" },
  ],
  positioningMistakes: [
    "Não define especialidade clara (Performance? SEO? Growth? Conteúdo?)",
    "Mistura branding + performance sem mostrar clareza estratégica",
    "Não mostra impacto financeiro das campanhas (falta ROI, receita gerada)",
    "Usa termos genéricos como 'marketing digital' sem especificar canais",
    "Não conecta métricas a resultados de negócio",
  ],
  realExample: {
    title: "Exemplo de campanha real no currículo",
    before: "Gerenciei campanhas de marketing",
    after: "Gerenciei campanhas de Google Ads com budget de R$200K/mês, alcançando ROAS 4.2x e reduzindo CAC em 28%, resultando em R$840K de receita incremental no trimestre",
  },
  faqs: [
    {
      question: "Quais métricas devo incluir no currículo de marketing?",
      answer: "CTR, ROAS, CAC, LTV, conversões e crescimento percentual. Sempre contextualize com o canal (Google Ads, Meta Ads, SEO). Métricas mostram impacto real, não só atividade. Para performance: ROAS, CAC, CPA. Para SEO: tráfego orgânico, posições de ranking. Para conteúdo: engajamento, leads gerados. Conecte a resultados financeiros quando possível.",
    },
    {
      question: "Marketing tradicional ainda vale no currículo?",
      answer: "Depende da vaga. Para posições de brand marketing, trade marketing ou em empresas mais tradicionais, experiência com eventos, materiais impressos e mídia offline ainda é relevante. Para vagas de marketing digital puro, foque nas competências digitais. Uma boa estratégia é manter experiência tradicional de forma resumida e expandir a parte digital.",
    },
    {
      question: "Devo incluir número de seguidores que conquistei?",
      answer: "Sim, mas contextualize. 'Cresci Instagram de 5K para 50K seguidores em 12 meses' é bom, mas melhor ainda é adicionar: 'com taxa de engajamento de 5% e conversão de 3% para leads qualificados'. Números de seguidores sem contexto de engajamento ou conversão são menos impressionantes. Mostre que você entende métricas além de vanity metrics.",
    },
    {
      question: "Como mostrar experiência com ferramentas de automação?",
      answer: "Seja específico sobre a ferramenta e o que você construiu: 'Estruturei 15 fluxos de automação no HubSpot incluindo welcome series, nurturing de leads e reengajamento, resultando em aumento de 40% na taxa de conversão MQL para SQL'. Mencione integrações feitas, segmentações criadas e resultados obtidos.",
    },
    {
      question: "Certificações de marketing digital são importantes?",
      answer: "Certificações ajudam, especialmente Google Ads, Meta Blueprint, HubSpot e Google Analytics. Elas adicionam palavras-chave relevantes ao currículo e mostram comprometimento com atualização profissional. Para profissionais experientes, não são essenciais se você tem resultados comprovados. Para quem está começando ou mudando de área, são muito recomendadas.",
    },
    {
      question: "Como destacar experiência com budget pequeno?",
      answer: "Foque na eficiência e nos resultados percentuais em vez de valores absolutos. 'Otimizei campanhas de Google Ads reduzindo CPA em 45% e aumentando conversões em 80%' é impressionante independente do budget. Também mencione otimizações criativas, testes realizados e learnings que demonstram pensamento estratégico.",
    },
    {
      question: "Devo separar experiência B2B e B2C?",
      answer: "Se você tem experiência em ambos, vale mencionar essa versatilidade. Destaque as diferenças de estratégia: 'Marketing B2B com ciclos de venda longos (LinkedIn Ads, ABM, nurturing de 6 meses) e B2C com foco em conversão direta (Google Shopping, Meta Ads, remarketing)'. Isso mostra amplitude de conhecimento.",
    },
    {
      question: "Como incluir projetos de freelancer ou consultoria?",
      answer: "Inclua como experiência profissional normal, especificando 'Consultor de Marketing Digital' ou 'Freelancer'. Liste clientes (ou setores, se preferir manter confidencialidade) e resultados obtidos. Exemplo: 'Consultoria para 8 clientes de e-commerce, com média de aumento de 60% em ROAS e redução de 25% em CAC'. Mostra capacidade de gerar resultados em diferentes contextos.",
    },
  ],
}

export const customerSuccessConfig: RoleLandingConfig = {
  slug: "curriculo-customer-success-ats",
  role: "Profissional de Customer Success",
  roleShort: "Customer Success",
  meta: {
    title: "Currículo para Customer Success que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Crie um currículo de Customer Success otimizado para ATS. Veja exemplos com onboarding, retenção, churn, NPS, expansão de receita, CRM e lifecycle para conquistar mais entrevistas.",
    canonical: "/curriculo-customer-success-ats",
  },
  hero: {
    h1: "Currículo para Customer Success que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você ajuda clientes a ter resultado, mas seu currículo pode estar sendo filtrado antes mesmo de chegar a um recrutador. Sistemas ATS buscam termos específicos de retenção, onboarding, churn e expansão. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos de Customer Success são rejeitados pelo ATS?",
    description: "Customer Success exige clareza sobre relacionamento com clientes, métricas de retenção e ferramentas de CRM. Currículos genéricos, sem números ou sem contexto do ciclo de vida do cliente, costumam ser filtrados.",
    points: [
      "Usar descrições vagas como 'atendi clientes' sem mostrar impacto em retenção ou satisfação",
      "Não mencionar métricas como churn, NPS, expansão de receita ou taxa de retenção",
      "Omitir ferramentas de CRM e CS como Salesforce, HubSpot, Gainsight ou Zendesk",
      "Não explicar atuação em onboarding, adoção, renewals ou gestão de carteira",
      "Misturar suporte e Customer Success sem deixar claro o papel estratégico",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de Customer Success",
    description: "Recrutadores de Customer Success configuram filtros para buscar experiência com retenção, onboarding, relacionamento consultivo, gestão de carteira e métricas de saúde do cliente. Quanto mais próximo o seu currículo estiver da linguagem da vaga, melhor o match no ATS.",
    whatRecruitersScan: [
      "Métricas de retenção e churn (gross retention, net retention, renewals)",
      "Experiência com onboarding, adoção e customer lifecycle",
      "Ferramentas de CRM e CS (Salesforce, HubSpot, Gainsight, Zendesk)",
      "Gestão de carteira, expansion revenue e relacionamento consultivo",
      "Indicadores de satisfação como NPS, CSAT e health score",
      "Capacidade de trabalhar com times de produto, vendas e suporte",
    ],
  },
  keywords: [
    { term: "Onboarding", description: "Etapa crítica de ativação inicial e adoção do cliente" },
    { term: "Retenção", description: "Capacidade de manter clientes ativos e reduzir cancelamentos" },
    { term: "Churn", description: "Métrica essencial para mostrar impacto em Customer Success" },
    { term: "NPS/CSAT", description: "Indicadores de satisfação e experiência do cliente" },
    { term: "Expansion Revenue", description: "Receita de upsell, cross-sell e expansão de contas" },
    { term: "Customer Lifecycle", description: "Gestão do cliente ao longo de toda a jornada" },
    { term: "Salesforce/HubSpot", description: "Ferramentas de CRM amplamente utilizadas em times de CS" },
    { term: "Gainsight/Zendesk", description: "Plataformas comuns para acompanhamento e suporte ao cliente" },
    { term: "Renewals", description: "Renovações contratuais são indicador forte de performance" },
    { term: "Health Score", description: "Score de saúde da conta usado para prever risco e oportunidade" },
  ],
  commonMistakes: [
    {
      mistake: "Escrever apenas 'atendimento ao cliente' sem contexto estratégico",
      fix: "Especifique: 'Gerenciei carteira de 80 clientes SaaS com foco em retenção, adoção e expansão'",
    },
    {
      mistake: "Não mencionar métricas de retenção ou satisfação",
      fix: "Inclua números como churn, retenção, NPS, CSAT ou expansion revenue",
    },
    {
      mistake: "Confundir suporte com Customer Success",
      fix: "Destaque ações consultivas, onboarding, planejamento de sucesso e relacionamento proativo",
    },
    {
      mistake: "Omitir ferramentas de CRM e CS",
      fix: "Liste Salesforce, HubSpot, Gainsight, Zendesk ou outras plataformas usadas no dia a dia",
    },
    {
      mistake: "Descrever carteira sem segmentação ou impacto",
      fix: "Contextualize porte da carteira, segmento dos clientes e resultados alcançados",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional com experiência em atendimento e relacionamento com clientes.",
      good: "Profissional de Customer Success com 4 anos de experiência em onboarding, retenção e expansão de contas SaaS B2B. Gerenciei carteira com 90+ clientes, reduzindo churn em 22% e elevando NPS para 72. Experiência com Salesforce, HubSpot e estratégias de customer lifecycle.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Relacionamento com cliente, CRM, atendimento, métricas, comunicação",
      good: "Customer Success: Onboarding, Retenção, Renewals, Expansion | Métricas: Churn, NPS, CSAT, Health Score, LTV | Ferramentas: Salesforce, HubSpot, Gainsight, Zendesk | Operação: QBR, Gestão de Carteira, Mapeamento de Risco, Customer Lifecycle",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Atendi clientes da empresa, resolvi problemas e acompanhei solicitações.",
      good: "Gerenciei carteira de 75 clientes enterprise em SaaS B2B, reduzindo churn em 18% e aumentando expansion revenue em 25%. Conduzi onboarding de 40+ novas contas por trimestre, elevando adoção do produto em 35% nos primeiros 90 dias. Estruturei QBRs e planos de sucesso usando Salesforce e Gainsight.",
    },
  },
  specializations: [
    {
      title: "Onboarding",
      description: "Foco em ativação inicial, implementação, adoção e primeiros resultados do cliente.",
      keywords: ["Onboarding", "Go-live", "Time to Value", "Ativação", "Adoção", "Treinamento", "Implementação", "Kickoff", "Customer Journey", "Success Plan"],
    },
    {
      title: "Retenção & Renewals",
      description: "Atuação com redução de churn, renovações contratuais e saúde da carteira.",
      keywords: ["Retenção", "Churn", "Renewals", "Health Score", "NPS", "CSAT", "Plano de Ação", "Gestão de Carteira", "Risco", "QBR"],
    },
    {
      title: "Account Management & Expansion",
      description: "Relacionamento consultivo com foco em expansão de receita e crescimento da conta.",
      keywords: ["Expansion Revenue", "Upsell", "Cross-sell", "Gestão de Conta", "Relacionamento Consultivo", "LTV", "Carteira Enterprise", "ROI", "Stakeholder Management", "Forecast"],
    },
  ],
  seniorityLevels: [
    {
      level: "Customer Success Júnior",
      focus: "Demonstre capacidade de relacionamento, organização e aprendizado rápido em operação com clientes",
      tips: [
        "Mostre experiência com atendimento, onboarding inicial e acompanhamento de clientes",
        "Inclua ferramentas usadas como CRM, help desk ou plataformas de gestão de tickets",
        "Mencione métricas de satisfação, tempo de resposta ou volume de carteira quando possível",
        "Destaque comunicação, organização e capacidade de seguir playbooks",
      ],
    },
    {
      level: "Customer Success Pleno",
      focus: "Mostre autonomia na gestão de carteira, retenção e geração de valor para o cliente",
      tips: [
        "Quantifique churn evitado, retenção alcançada ou expansão de receita",
        "Mencione onboarding, QBRs, planos de sucesso e gestão de risco",
        "Destaque relacionamento com contas estratégicas e stakeholders múltiplos",
        "Inclua trabalho cross-functional com produto, vendas e suporte",
      ],
    },
    {
      level: "Customer Success Sênior / Lead",
      focus: "Demonstre liderança, visão de operação e capacidade de escalar retenção e expansão",
      tips: [
        "Destaque desenho de processos, playbooks e estruturação da operação de CS",
        "Mencione times liderados, metas globais da carteira e indicadores estratégicos",
        "Inclua impacto em NRR, churn, expansion revenue ou health score",
        "Mostre visão de negócio e capacidade de influenciar roadmap e estratégia",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência com Clientes",
      bullets: [
        "Atendi clientes da empresa",
        "Resolvi dúvidas e problemas",
        "Acompanhei solicitações do time",
        "Ajudei no relacionamento com contas",
      ],
    },
    after: {
      title: "Customer Success Manager | Onboarding, Retenção e Expansão",
      bullets: [
        "Gerenciei carteira de 80 clientes SaaS B2B, reduzindo churn em 20% e elevando retenção anual para 92%",
        "Conduzi onboarding de 35 novas contas por trimestre, reduzindo time to value em 30%",
        "Estruturei QBRs e planos de sucesso no Salesforce e Gainsight, aumentando health score médio da base em 18%",
        "Liderei iniciativas de expansão que geraram R$450K em expansion revenue no ano",
      ],
    },
  },
  fullResumeExample: {
    name: "Carla Mendes",
    title: "Customer Success Manager | Retenção, Onboarding, Expansão",
    contact: "carla.mendes@email.com | (11) 96666-0000 | São Paulo, SP | linkedin.com/in/carlamendes",
    summary: "Customer Success Manager com 5 anos de experiência em SaaS B2B, atuando em onboarding, retenção, renovação e expansão de contas. Gerenciei carteira com 100+ clientes, reduzindo churn em 24% e elevando NPS para 74. Forte atuação com Salesforce, HubSpot, Gainsight e relacionamento consultivo com contas estratégicas.",
    skills: [
      { category: "Customer Success", items: "Onboarding, Retenção, Renewals, Expansion, QBR, Success Plan" },
      { category: "Métricas", items: "Churn, NPS, CSAT, Health Score, Retenção, NRR, LTV" },
      { category: "Ferramentas", items: "Salesforce, HubSpot, Gainsight, Zendesk, Intercom" },
      { category: "Operação", items: "Gestão de Carteira, Mapeamento de Risco, Customer Lifecycle, Forecast" },
      { category: "Relacionamento", items: "Stakeholder Management, Comunicação Executiva, Relacionamento Consultivo" },
      { category: "Negócio", items: "Upsell, Cross-sell, Expansão de Receita, ROI, Renovações" },
    ],
    experience: [
      {
        role: "Customer Success Manager Pleno",
        company: "SaaS Growth Tech",
        period: "Jan 2022 – Presente",
        bullets: [
          "Gerenciei carteira de 95 clientes mid-market e enterprise, reduzindo churn em 24% e elevando retenção anual para 93%",
          "Conduzi onboarding de 50+ contas por trimestre, reduzindo time to value em 35% e aumentando adoção inicial do produto em 40%",
          "Implementei rotina de QBRs e mapeamento de risco via Gainsight, elevando o health score médio da carteira em 20%",
          "Identifiquei oportunidades de upsell e cross-sell que geraram R$620K em expansion revenue no período",
        ],
      },
      {
        role: "Analista de Customer Success",
        company: "Hub Solutions Brasil",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Acompanhei carteira de 60 clientes SMB com foco em onboarding, suporte consultivo e retenção",
          "Contribuí para aumento de NPS de 58 para 70 com melhoria de processos e comunicação proativa",
          "Estruturei playbooks de acompanhamento de clientes em HubSpot e Zendesk",
          "Atuei em parceria com vendas e produto para reduzir causas recorrentes de cancelamento",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Administração de Empresas",
      institution: "Universidade Presbiteriana Mackenzie",
      year: "2019",
    },
    certifications: [
      "Customer Success Manager Certification – SuccessHACKER (2023)",
      "HubSpot Customer Success Certification (2022)",
      "Salesforce Administrator Basics (2021)",
    ],
  },
  improvementSteps: [
    { title: "Mostre métricas de retenção e satisfação", description: "Inclua churn, retenção, NPS, CSAT ou expansion revenue sempre que possível para demonstrar impacto real." },
    { title: "Especifique sua atuação no ciclo do cliente", description: "Explique se você trabalhou com onboarding, adoção, renewals, gestão de carteira ou expansão de contas." },
    { title: "Liste ferramentas de CRM e Customer Success", description: "Salesforce, HubSpot, Gainsight, Zendesk e plataformas similares ajudam o ATS a identificar aderência à vaga." },
    { title: "Destaque relacionamento consultivo", description: "Mostre como você apoiou clientes a alcançar resultado, não apenas resolver chamados ou responder dúvidas." },
    { title: "Conecte seu trabalho a impacto financeiro", description: "Redução de churn, retenção e expansão de receita são sinais fortes de performance em Customer Success." },
    { title: "Adapte o currículo à segmentação da vaga", description: "Se a posição pede enterprise, SMB ou SaaS B2B, espelhe esse contexto no seu currículo com clareza." },
  ],
  internalLinks: [
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Guia específico para marketing digital", image: "/images/seo/marketing-career.jpg" },
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Otimização para área de dados", image: "/images/seo/data-analyst-career.jpg" },
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores", image: "/images/seo/developer-career.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/ats-guide.jpg" },
  ],
  positioningMistakes: [
    "Se apresentar como suporte sem mostrar atuação estratégica em retenção e expansão",
    "Não deixar claro o tipo de carteira atendida (SMB, mid-market, enterprise)",
    "Falar sobre relacionamento com clientes sem citar métricas ou impacto no negócio",
    "Omitir ferramentas de CRM e gestão do ciclo de vida do cliente",
    "Não mostrar como você gera valor ao longo da jornada do cliente",
  ],
  realExample: {
    title: "Exemplo real de resultado em Customer Success",
    before: "Fiz acompanhamento de clientes e ajudei no relacionamento com a carteira",
    after: "Gerenciei carteira de 80 clientes SaaS B2B, reduzi churn em 20%, aumentei retenção anual para 92% e gerei R$450K em expansion revenue com upsell consultivo",
  },
  faqs: [
    {
      question: "Quais métricas devo incluir no currículo de Customer Success?",
      answer: "As principais métricas para Customer Success são churn, retenção, NPS, CSAT, health score, expansion revenue e renewals. Sempre que possível, mostre o antes e depois, como por exemplo: 'reduzi churn de 8% para 5%' ou 'aumentei NPS de 60 para 74'. Essas métricas demonstram impacto direto na experiência do cliente e no negócio.",
    },
    {
      question: "Customer Success é a mesma coisa que suporte?",
      answer: "Não. Suporte costuma ser mais reativo, focado em resolver problemas pontuais. Customer Success tem atuação mais estratégica, com foco em onboarding, adoção, retenção, renovação e expansão da conta. No currículo, vale deixar essa diferença clara mostrando ações consultivas, gestão de carteira e resultados de retenção.",
    },
    {
      question: "Preciso colocar ferramentas como Salesforce e HubSpot no currículo?",
      answer: "Sim. Ferramentas de CRM e Customer Success ajudam o ATS a identificar aderência à vaga. Salesforce, HubSpot, Gainsight, Zendesk e Intercom são termos buscados com frequência. Mesmo que você não domine todas, mencione as que já utilizou no dia a dia com contexto de uso.",
    },
    {
      question: "Como mostrar experiência com onboarding no currículo?",
      answer: "Descreva o volume de contas acompanhadas, o tipo de cliente e o resultado gerado. Por exemplo: 'Conduzi onboarding de 40 novas contas por trimestre, reduzindo time to value em 30% e aumentando adoção do produto em 35%'. Isso mostra capacidade operacional e impacto real.",
    },
    {
      question: "Vale incluir expansão de receita em uma vaga de Customer Success?",
      answer: "Sim. Muitas vagas de Customer Success valorizam profissionais que conseguem equilibrar retenção com crescimento da conta. Expansion revenue, upsell e cross-sell mostram visão de negócio e relacionamento consultivo. Mesmo quando a vaga não é comercial, esse tipo de resultado costuma ser bem visto.",
    },
    {
      question: "Como destacar carteira enterprise ou SMB?",
      answer: "Contextualize o porte da carteira e a complexidade da gestão. Exemplo: 'Gerenciei carteira enterprise com 25 contas estratégicas e múltiplos stakeholders' ou 'Acompanhei base SMB com 120 clientes ativos e playbooks escaláveis'. Isso ajuda o recrutador a entender seu contexto e aderência ao perfil da vaga.",
    },
    {
      question: "Customer Success sem experiência em SaaS ainda vale?",
      answer: "Sim, especialmente se você tem experiência com relacionamento, retenção, onboarding ou atendimento consultivo em outros setores. O ideal é adaptar a linguagem do currículo para mostrar proximidade com o ciclo de vida do cliente, métricas de satisfação e foco em resultado, mesmo fora de SaaS.",
    },
    {
      question: "Como mostrar que eu ajudava clientes a ter resultado?",
      answer: "Vá além de frases genéricas como 'acompanhei clientes'. Mostre ações concretas e desfecho de negócio. Por exemplo: 'Estruturei planos de sucesso para contas estratégicas, aumentando adoção de funcionalidades críticas e reduzindo risco de cancelamento'. Isso demonstra valor real entregue ao cliente.",
    },
  ],
}

export const productManagerConfig: RoleLandingConfig = {
  slug: "curriculo-product-manager-ats",
  role: "Product Manager",
  roleShort: "Product Manager",
  meta: {
    title: "Currículo para Product Manager que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Crie um currículo de Product Manager otimizado para ATS. Veja exemplos com discovery, roadmap, priorização, métricas de produto e impacto em negócio para conquistar mais entrevistas.",
    canonical: "/curriculo-product-manager-ats",
  },
  hero: {
    h1: "Currículo para Product Manager que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você toma decisões de produto com base em dados, mas seu currículo pode estar sendo filtrado antes mesmo de ser lido. Sistemas ATS procuram métricas, discovery, roadmap e impacto real no negócio. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos de Product Manager são rejeitados pelo ATS?",
    description: "Product Managers precisam mostrar impacto em produto e negócio. Currículos genéricos, focados apenas em cerimônias ou backlog, tendem a perder força nos filtros automáticos.",
    points: [
      "Descrever tarefas sem mostrar impacto em métricas de produto ou negócio",
      "Não mencionar discovery, priorização, roadmap ou experimentação",
      "Focar em backlog e cerimônias sem evidenciar decisões estratégicas",
      "Omitir KPIs como retenção, conversão, churn ou receita incremental",
      "Não deixar claro o trabalho com times cross-functional e stakeholders",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de Product Manager",
    description: "Recrutadores de produto configuram filtros para buscar experiência com discovery, priorização, roadmap, métricas, experimentação e impacto em negócio. Quanto mais próximo da linguagem da vaga estiver o seu currículo, maior a chance de passar pelo ATS.",
    whatRecruitersScan: [
      "Métricas de produto (conversão, retenção, churn, adoção, receita)",
      "Experiência com discovery, entrevistas e validação de hipóteses",
      "Roadmap, priorização e definição de estratégia de produto",
      "Experimentação com A/B tests e análise de resultados",
      "Trabalho com times cross-functional (engenharia, design, dados, negócios)",
      "Ferramentas como Jira, Notion, Amplitude, Mixpanel, GA4 e Figma",
    ],
  },
  keywords: [
    { term: "Product Discovery", description: "Etapa de entendimento do problema, usuário e oportunidade" },
    { term: "Roadmap", description: "Planejamento estratégico de iniciativas e evolução do produto" },
    { term: "Priorização", description: "Capacidade de tomar decisões com base em impacto e esforço" },
    { term: "KPIs de Produto", description: "Métricas como conversão, retenção, churn, adoção e receita" },
    { term: "A/B Testing", description: "Experimentação para validar hipóteses e melhorar resultados" },
    { term: "User Research", description: "Pesquisa com usuários para apoiar decisões de produto" },
    { term: "Retention/Churn", description: "Indicadores essenciais para mostrar impacto do produto" },
    { term: "Amplitude/Mixpanel", description: "Ferramentas de product analytics bastante valorizadas" },
    { term: "Jira/Notion/Figma", description: "Ferramentas comuns de gestão, alinhamento e colaboração" },
    { term: "Stakeholder Management", description: "Capacidade de alinhar negócio, tecnologia e design" },
  ],
  commonMistakes: [
    {
      mistake: "Descrever apenas backlog, planning e cerimônias ágeis",
      fix: "Explique o problema atacado, a decisão tomada e o impacto gerado em métricas",
    },
    {
      mistake: "Não citar métricas de produto ou negócio",
      fix: "Inclua conversão, retenção, churn, adoção, NPS ou receita incremental quando possível",
    },
    {
      mistake: "Falar de roadmap sem mostrar priorização ou trade-offs",
      fix: "Contextualize como você priorizou iniciativas e quais resultados isso gerou",
    },
    {
      mistake: "Omitir discovery e validação com usuários",
      fix: "Mencione entrevistas, pesquisas, testes ou análise de comportamento que influenciaram decisões",
    },
    {
      mistake: "Soar operacional demais e pouco estratégico",
      fix: "Mostre visão de negócio, alinhamento com stakeholders e impacto real do produto",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Product Manager com experiência em gestão de produto e backlog.",
      good: "Product Manager com 4 anos de experiência em discovery, roadmap e priorização para produtos SaaS B2B. Liderei iniciativas que aumentaram retenção em 18%, elevaram conversão em 24% e geraram R$1,8M em receita incremental. Forte atuação com times cross-functional e decisões baseadas em dados.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Produto, Agile, backlog, comunicação, métricas",
      good: "Produto: Discovery, Roadmap, Priorização, Strategy | Data: SQL, Amplitude, Mixpanel, GA4 | Métodos: A/B Testing, User Research, Jobs to be Done | Ferramentas: Jira, Notion, Figma, Miro | Negócio: Stakeholder Management, Go-to-Market, Experimentação",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Gerenciei backlog, participei de cerimônias e trabalhei com o time de desenvolvimento.",
      good: "Liderei roadmap de produto SaaS B2B com foco em retenção e expansão, elevando adoção de feature crítica em 32% e reduzindo churn em 14%. Conduzi discovery com clientes, priorizei iniciativas com base em impacto e implementei experimentos que aumentaram conversão em 21%.",
    },
  },
  specializations: [
    {
      title: "Growth Product",
      description: "Foco em crescimento, experimentação, funis e otimização de conversão e retenção.",
      keywords: ["Growth", "A/B Testing", "Conversão", "Retention", "Churn", "Activation", "AARRR", "Experimentação", "Funil", "Revenue Impact"],
    },
    {
      title: "Product Discovery",
      description: "Atuação forte em entendimento do usuário, pesquisa, validação e definição de oportunidade.",
      keywords: ["Discovery", "User Research", "Entrevistas", "Jobs to be Done", "Problema do Usuário", "Hipóteses", "Validação", "Product Sense", "Insights", "Priorização"],
    },
    {
      title: "Platform / Product Ops",
      description: "Foco em eficiência interna, escalabilidade, plataformas e melhoria da operação de produto.",
      keywords: ["Platform", "Product Ops", "Escalabilidade", "Eficiência", "Processos", "B2B SaaS", "Integrações", "Infraestrutura", "Roadmap Técnico", "Stakeholders Internos"],
    },
  ],
  seniorityLevels: [
    {
      level: "Product Manager Júnior",
      focus: "Demonstre capacidade analítica, entendimento de produto e participação em iniciativas com impacto claro",
      tips: [
        "Mostre projetos, estágios ou experiências em que você trabalhou com produto, discovery ou análise de métricas",
        "Inclua ferramentas e frameworks usados no dia a dia (Jira, Notion, Figma, analytics)",
        "Destaque capacidade de aprender rápido e colaborar com engenharia, design e negócio",
        "Use linguagem de produto e resultado, não apenas execução operacional",
      ],
    },
    {
      level: "Product Manager Pleno",
      focus: "Mostre autonomia em discovery, priorização, roadmap e impacto mensurável em KPIs",
      tips: [
        "Quantifique ganhos em conversão, retenção, churn, receita ou adoção de features",
        "Mencione iniciativas end-to-end, do discovery ao lançamento e acompanhamento",
        "Destaque sua capacidade de tomar decisões com base em dados e trade-offs",
        "Inclua relacionamento com stakeholders e liderança cross-functional",
      ],
    },
    {
      level: "Product Manager Sênior / Lead",
      focus: "Demonstre visão estratégica, liderança de produto e influência no negócio",
      tips: [
        "Mostre impacto em roadmap estratégico, receita, expansão ou posicionamento do produto",
        "Mencione times, produtos ou squads liderados diretamente",
        "Inclua decisões complexas, priorização de portfólio e visão de longo prazo",
        "Mostre como você conecta produto, negócio, tecnologia e experiência do usuário",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência em Produto",
      bullets: [
        "Gerenciei backlog do produto",
        "Trabalhei com a equipe de desenvolvimento",
        "Participei de cerimônias ágeis",
        "Ajudei a definir funcionalidades",
      ],
    },
    after: {
      title: "Product Manager | Discovery, Roadmap, Growth",
      bullets: [
        "Liderei roadmap de produto SaaS com foco em retenção, aumentando adoção de feature-chave em 32% e reduzindo churn em 14%",
        "Conduzi discovery com usuários e stakeholders, validando hipóteses que resultaram em aumento de conversão de 21%",
        "Implementei experimentos A/B e análises em Amplitude/Mixpanel, gerando R$1,2M em receita incremental",
        "Coordenei squad cross-functional com engenharia, design e dados para entregar iniciativas estratégicas em roadmap trimestral",
      ],
    },
  },
  fullResumeExample: {
    name: "Lucas Andrade",
    title: "Product Manager | Growth, Discovery, Roadmap",
    contact: "lucas.andrade@email.com | (11) 97777-1111 | São Paulo, SP | linkedin.com/in/lucasandrade",
    summary: "Product Manager com 5 anos de experiência em SaaS B2B, liderando discovery, roadmap e experimentação para produtos digitais. Atuação orientada a métricas de retenção, conversão e receita, com histórico de iniciativas que geraram R$2M+ em impacto incremental. Forte colaboração com engenharia, design e dados.",
    skills: [
      { category: "Produto", items: "Discovery, Roadmap, Priorização, Product Strategy, Go-to-Market" },
      { category: "Dados", items: "SQL, Amplitude, Mixpanel, Google Analytics 4, Dashboards" },
      { category: "Métodos", items: "A/B Testing, User Research, Jobs to be Done, Entrevistas, Hipóteses" },
      { category: "Ferramentas", items: "Jira, Notion, Figma, Miro, Confluence" },
      { category: "Negócio", items: "Stakeholder Management, Receita, Retenção, Churn, Conversão" },
      { category: "Operação", items: "Agile, Scrum, Planning, Cross-functional Leadership" },
    ],
    experience: [
      {
        role: "Product Manager Pleno",
        company: "SaaS Product Labs",
        period: "Jan 2022 – Presente",
        bullets: [
          "Liderei roadmap de produto B2B com foco em expansão e retenção, aumentando adoção de feature estratégica em 35%",
          "Conduzi discovery com clientes enterprise e usuários finais, validando oportunidades que resultaram em redução de churn de 16%",
          "Implementei experimentos A/B em fluxos críticos de onboarding, elevando conversão em 24%",
          "Trabalhei com engenharia, design e dados em squad cross-functional, gerando R$1,9M em receita incremental em 12 meses",
        ],
      },
      {
        role: "Associate Product Manager",
        company: "Growth Tech Brasil",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Apoiei discovery, priorização e acompanhamento de métricas em produto digital voltado para SMBs",
          "Estruturei dashboards de produto e análises em GA4 e Amplitude para monitorar retenção e conversão",
          "Coordenei lançamento de funcionalidades com engenharia e design, reduzindo time-to-market em 20%",
          "Participei da definição de hipóteses e testes que elevaram ativação inicial de usuários em 18%",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Administração de Empresas",
      institution: "Insper",
      year: "2019",
    },
    certifications: [
      "Product Management Certification – Product School (2023)",
      "Amplitude Product Analytics Certification (2022)",
      "Google Analytics 4 Certification (2022)",
    ],
  },
  improvementSteps: [
    { title: "Mostre impacto em métricas de produto", description: "Inclua conversão, retenção, churn, adoção ou receita para demonstrar impacto real das suas decisões." },
    { title: "Explique contexto, decisão e resultado", description: "Evite listar apenas tarefas. Mostre qual problema você resolveu, como priorizou e qual foi o resultado." },
    { title: "Destaque discovery e experimentação", description: "Mencione entrevistas, hipóteses, validações, testes A/B e análise de comportamento sempre que possível." },
    { title: "Liste ferramentas e métodos de produto", description: "Jira, Notion, Figma, Amplitude, Mixpanel e frameworks de discovery ajudam o ATS a identificar aderência." },
    { title: "Conecte produto a negócio", description: "Mostre impacto em receita, retenção, eficiência ou posicionamento estratégico do produto." },
    { title: "Adapte o currículo ao tipo de PM da vaga", description: "Se a vaga é Growth, Platform ou Core Product, ajuste a linguagem e os exemplos do seu currículo para esse contexto." },
  ],
  internalLinks: [
    { label: "Currículo para Customer Success", href: "/curriculo-customer-success-ats", description: "Guia específico para Customer Success", image: "/images/seo/ats-guide.jpg" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Otimização para marketing digital", image: "/images/seo/marketing-career.jpg" },
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores", image: "/images/seo/developer-career.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/data-analyst-career.jpg" },
  ],
  positioningMistakes: [
    "Parecer apenas um gestor de backlog sem mostrar impacto estratégico",
    "Não conectar decisões de produto a métricas e resultados do negócio",
    "Falar de Agile e cerimônias sem mostrar discovery, priorização ou visão de produto",
    "Omitir ferramentas de analytics e validação de hipóteses",
    "Não deixar claro como você trabalhou com engenharia, design e stakeholders",
  ],
  realExample: {
    title: "Exemplo real de impacto em Product Management",
    before: "Gerenciei backlog e trabalhei com a equipe para evoluir o produto",
    after: "Liderei discovery e roadmap de produto SaaS, implementei experimentos que elevaram conversão em 21%, reduziram churn em 14% e geraram R$1,2M em receita incremental",
  },
  faqs: [
    {
      question: "Quais métricas devo incluir no currículo de Product Manager?",
      answer: "As métricas mais valorizadas são conversão, retenção, churn, adoção de funcionalidades, receita incremental, NPS e eficiência operacional. O ideal é mostrar como sua atuação impactou esses indicadores. Exemplo: 'Aumentei retenção em 18% após priorizar melhorias no onboarding'.",
    },
    {
      question: "Preciso mencionar discovery no currículo de Product Manager?",
      answer: "Sim. Discovery é uma das competências mais buscadas em Product Management. Vale mencionar entrevistas com usuários, validação de hipóteses, análise de comportamento, pesquisa qualitativa e quantitativa, além de como essas informações influenciaram decisões de roadmap.",
    },
    {
      question: "Backlog e cerimônias ágeis são suficientes para um currículo de PM?",
      answer: "Não. Essas atividades fazem parte da rotina, mas sozinhas não diferenciam um Product Manager. O currículo precisa mostrar decisão, contexto, trade-offs, impacto em métricas e visão de negócio. Focar apenas em backlog e Scrum pode deixar seu perfil com cara operacional demais.",
    },
    {
      question: "Quais ferramentas devo citar no currículo de Product Manager?",
      answer: "Jira, Notion, Figma, Miro, Confluence, Amplitude, Mixpanel, Google Analytics e até SQL são bons exemplos. Não cite apenas como lista solta: sempre que possível, contextualize com o uso. Ferramentas de analytics e discovery costumam pesar bastante em vagas de PM.",
    },
    {
      question: "Como mostrar impacto de negócio sendo Product Manager?",
      answer: "Conecte a iniciativa ao resultado. Em vez de 'lancei nova feature', prefira 'priorizei e lancei nova funcionalidade que elevou adoção em 30% e gerou R$800K em receita incremental'. Essa estrutura mostra produto + negócio de forma muito mais forte.",
    },
    {
      question: "Vale incluir experiência cross-functional no currículo?",
      answer: "Sim, porque Product Managers trabalham justamente articulando engenharia, design, dados, marketing, vendas e liderança. Mostrar essa capacidade de alinhamento é importante para o ATS e para recrutadores. Use exemplos concretos, não apenas frases genéricas como 'trabalhei com várias áreas'.",
    },
    {
      question: "Product Manager precisa saber SQL?",
      answer: "Nem toda vaga exige SQL, mas saber usar SQL e ferramentas de analytics é um diferencial relevante. Isso mostra capacidade de tomar decisões com base em dados, analisar comportamento de usuários e acompanhar KPIs com mais autonomia. Se você usa SQL, vale mencionar com contexto.",
    },
    {
      question: "Como adaptar o currículo para vagas de Growth PM ou Core PM?",
      answer: "Ajuste a linguagem e os resultados destacados. Para Growth PM, foque em conversão, retenção, experimentação e receita. Para Core PM, dê mais ênfase a discovery, experiência do usuário, evolução do produto e alinhamento estratégico. O ATS costuma valorizar esse match de contexto.",
    },
  ],
}

export const vendasConfig: RoleLandingConfig = {
  slug: "curriculo-vendas-ats",
  role: "Profissional de Vendas",
  roleShort: "Vendas",
  meta: {
    title: "Currículo para Vendas que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Crie um currículo de vendas otimizado para ATS. Veja exemplos com metas batidas, receita gerada, conversão, CRM e pipeline para conquistar mais entrevistas.",
    canonical: "/curriculo-vendas-ats",
  },
  hero: {
    h1: "Currículo para Vendas que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você bate meta, mas seu currículo pode estar sendo ignorado antes mesmo de ser lido. Sistemas ATS procuram números, receita, conversão e ferramentas de vendas. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos de vendas são rejeitados pelo ATS?",
    description: "Em vendas, não mostrar números é um dos erros mais graves. Currículos sem metas, receita, conversão ou contexto comercial real costumam parecer fracos para ATS e recrutadores.",
    points: [
      "Não incluir metas batidas, receita gerada ou percentual de performance",
      "Descrever atividades comerciais sem impacto financeiro claro",
      "Não mencionar CRM, pipeline ou ferramentas de prospecção",
      "Usar linguagem genérica como 'atendi clientes' sem conversão ou fechamento",
      "Não explicar sua atuação no funil de vendas (prospecção, qualificação, fechamento, pós-venda)",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos de vendas",
    description: "Recrutadores de vendas procuram perfis orientados a resultado. ATS costuma priorizar currículos com metas, receita, conversão, ticket médio, volume de carteira e ferramentas como Salesforce, HubSpot ou Pipedrive.",
    whatRecruitersScan: [
      "Percentual de meta batida",
      "Receita gerada ou carteira movimentada",
      "Taxa de conversão no funil comercial",
      "Ferramentas CRM e sales tech (Salesforce, HubSpot, Pipedrive, RD Station CRM)",
      "Ticket médio e volume de clientes ou leads trabalhados",
      "Experiência com inbound, outbound, inside sales ou field sales",
    ],
  },
  keywords: [
    { term: "Meta batida", description: "Percentual de meta atingida é um dos principais sinais de performance em vendas" },
    { term: "Receita gerada", description: "Impacto direto em faturamento mostra resultado real" },
    { term: "Conversão", description: "Taxa de conversão ao longo do funil comercial" },
    { term: "CRM", description: "Ferramentas como Salesforce, HubSpot, Pipedrive e RD Station CRM" },
    { term: "Pipeline/Funil", description: "Gestão de oportunidades e etapas comerciais" },
    { term: "Ticket Médio", description: "Valor médio das vendas realizadas" },
    { term: "Inside Sales", description: "Modelo de vendas remoto e consultivo muito buscado" },
    { term: "Outbound/Inbound", description: "Estratégias de aquisição e prospecção comercial" },
    { term: "Negociação", description: "Competência essencial para avanço e fechamento de oportunidades" },
    { term: "Forecast", description: "Previsibilidade comercial e acompanhamento de pipeline" },
  ],
  commonMistakes: [
    {
      mistake: "Não incluir números ou metas",
      fix: "Mostre percentual de meta batida, receita gerada, conversão ou ticket médio",
    },
    {
      mistake: "Descrever tarefas em vez de resultados",
      fix: "Troque 'atendi clientes' por impacto comercial concreto, como fechamentos, expansão ou crescimento de carteira",
    },
    {
      mistake: "Não mencionar CRM ou ferramentas comerciais",
      fix: "Inclua Salesforce, HubSpot, Pipedrive, RD Station CRM, Apollo, LinkedIn Sales Navigator ou outras plataformas relevantes",
    },
    {
      mistake: "Falar de relacionamento sem impacto financeiro",
      fix: "Conecte relacionamento a retenção, upsell, aumento de ticket ou avanço no pipeline",
    },
    {
      mistake: "Não deixar claro seu modelo de venda",
      fix: "Especifique se atuou com inside sales, field sales, inbound, outbound ou gestão de carteira",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional com experiência em vendas e atendimento ao cliente.",
      good: "Executivo de Vendas com 5 anos de experiência em inside sales B2B, histórico de 128% da meta anual e R$4,2M em receita gerada. Forte atuação com CRM, pipeline, prospecção outbound e negociação consultiva.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Vendas, negociação, atendimento, metas, CRM",
      good: "Vendas: Inside Sales, Outbound, Inbound, Fechamento | Métricas: Meta, Conversão, Receita, Ticket Médio, Forecast | Ferramentas: Salesforce, HubSpot, Pipedrive, LinkedIn Sales Navigator | Comercial: Prospecção, Qualificação, Negociação, Gestão de Pipeline",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Atuei com vendas da empresa e relacionamento com clientes.",
      good: "Gerei R$2,7M em receita anual, bati 123% da meta por 3 anos consecutivos e aumentei conversão do pipeline em 19%. Trabalhei com Salesforce e HubSpot para gerir carteira, forecast e oportunidades enterprise.",
    },
  },
  specializations: [
    {
      title: "Inside Sales",
      description: "Vendas remotas, consultivas e baseadas em CRM, pipeline e previsibilidade comercial.",
      keywords: ["Inside Sales", "CRM", "Pipeline", "Conversão", "Outbound", "Inbound", "Qualificação", "Follow-up", "Fechamento", "Forecast"],
    },
    {
      title: "Field Sales",
      description: "Vendas presenciais, relacionamento de longo prazo e negociação mais direta com contas e territórios.",
      keywords: ["Field Sales", "Negociação", "Relacionamento", "Visitas", "Carteira", "Território", "Fechamento", "Expansão", "Key Accounts", "Proposta Comercial"],
    },
    {
      title: "Sales Leadership",
      description: "Gestão de times, metas, forecast e desenvolvimento de operação comercial de alta performance.",
      keywords: ["Sales Manager", "Liderança", "Meta", "Forecast", "Playbook", "Coaching", "Pipeline Review", "Time Comercial", "Receita", "Escala"],
    },
  ],
  seniorityLevels: [
    {
      level: "Vendas Júnior",
      focus: "Demonstre disciplina comercial, capacidade de aprendizado e primeiros resultados em prospecção e fechamento",
      tips: [
        "Mostre volume de leads, reuniões agendadas, fechamentos ou metas iniciais batidas",
        "Inclua ferramentas comerciais usadas no dia a dia",
        "Destaque capacidade de seguir processo, funil e playbook",
        "Mencione evolução de performance e aprendizado rápido",
      ],
    },
    {
      level: "Vendas Pleno",
      focus: "Mostre consistência em receita, conversão, negociação e autonomia comercial",
      tips: [
        "Quantifique meta batida, receita gerada e taxa de conversão",
        "Mencione carteira, ticket médio, ciclo de vendas e segmentos atendidos",
        "Destaque previsibilidade no pipeline e qualidade de forecast",
        "Inclua resultados recorrentes, não apenas um pico isolado",
      ],
    },
    {
      level: "Vendas Sênior / Liderança",
      focus: "Demonstre capacidade de escalar receita, liderar pessoas e melhorar operação comercial",
      tips: [
        "Mostre impacto em metas do time, forecast, expansão de receita ou estrutura comercial",
        "Mencione liderança de equipe, coaching e desenvolvimento de vendedores",
        "Inclua visão de negócio, território, grandes contas ou estratégia comercial",
        "Destaque resultados consistentes em escala, não apenas individuais",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência em Vendas",
      bullets: [
        "Vendi produtos da empresa",
        "Atendi clientes interessados",
        "Trabalhei com metas comerciais",
        "Usei sistema para acompanhar oportunidades",
      ],
    },
    after: {
      title: "Executivo de Vendas | Inside Sales, CRM, Receita",
      bullets: [
        "Gerei R$2,4M em receita anual e bati 125% da meta por 3 anos consecutivos",
        "Aumentei conversão do pipeline em 18% com melhoria de qualificação e follow-up",
        "Gerenciei carteira de 90 oportunidades ativas em Salesforce e HubSpot com forecast semanal",
        "Atuei em vendas consultivas B2B com ticket médio de R$28K e ciclo médio de 45 dias",
      ],
    },
  },
  fullResumeExample: {
    name: "Rafael Lima",
    title: "Executivo de Vendas | B2B, CRM, Conversão",
    contact: "rafael.lima@email.com | (11) 95555-0000 | São Paulo, SP | linkedin.com/in/rafaellima",
    summary: "Executivo de Vendas com 6 anos de experiência em inside sales B2B e SaaS. Histórico consistente de 130% da meta anual e mais de R$5M em receita gerada. Forte atuação com Salesforce, HubSpot, prospecção outbound, gestão de pipeline e negociação consultiva para contas mid-market e enterprise.",
    skills: [
      { category: "Vendas", items: "Inside Sales, Outbound, Inbound, Fechamento, Expansão" },
      { category: "Métricas", items: "Meta, Receita, Conversão, Ticket Médio, Forecast, Pipeline" },
      { category: "Ferramentas", items: "Salesforce, HubSpot, Pipedrive, Apollo, LinkedIn Sales Navigator" },
      { category: "Comercial", items: "Prospecção, Qualificação, Negociação, Follow-up, Gestão de Carteira" },
      { category: "Negócio", items: "B2B SaaS, Mid-market, Enterprise, Consultative Selling" },
      { category: "Operação", items: "Playbook, Cadência, Forecast Review, Pipeline Hygiene" },
    ],
    experience: [
      {
        role: "Executivo de Vendas Pleno",
        company: "SaaS Revenue Tech",
        period: "Jan 2022 – Presente",
        bullets: [
          "Gerei R$2,8M em receita anual e bati 132% da meta em 2023",
          "Aumentei conversão de SQL para fechamento em 21% com melhoria na qualificação e negociação",
          "Gerenciei pipeline com 100+ oportunidades ativas em Salesforce, mantendo forecast semanal com alta previsibilidade",
          "Atuei em negociações B2B com ticket médio de R$32K para contas mid-market e enterprise",
        ],
      },
      {
        role: "Sales Development / Account Executive",
        company: "Growth Comercial Brasil",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Bati 118% da meta anual e contribui com R$1,6M em receita no período",
          "Estruturei cadências outbound com HubSpot e LinkedIn Sales Navigator, elevando taxa de resposta em 27%",
          "Realizei qualificação e fechamento de oportunidades em ciclo comercial consultivo",
          "Contribuí para redução do tempo médio de fechamento em 15% com melhoria no processo comercial",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Administração de Empresas",
      institution: "Universidade Anhembi Morumbi",
      year: "2019",
    },
    certifications: [
      "Sales Enablement Certification (2023)",
      "HubSpot Sales Software Certification (2022)",
      "LinkedIn Sales Navigator Certification (2022)",
    ],
  },
  improvementSteps: [
    { title: "Mostre números comerciais", description: "Inclua meta batida, receita gerada, conversão, ticket médio ou volume de carteira para provar resultado." },
    { title: "Troque tarefas por impacto", description: "Em vez de dizer que vendeu ou atendeu clientes, mostre quanto vendeu, para quem e com qual resultado." },
    { title: "Liste ferramentas de vendas", description: "Salesforce, HubSpot, Pipedrive, Apollo e LinkedIn Sales Navigator ajudam o ATS a identificar aderência à vaga." },
    { title: "Deixe claro seu modelo comercial", description: "Explique se atuou com inside sales, outbound, inbound, field sales ou gestão de carteira." },
    { title: "Mostre domínio do funil", description: "Descreva sua atuação em prospecção, qualificação, negociação, fechamento e forecast sempre que possível." },
    { title: "Adapte o currículo ao segmento da vaga", description: "Se a vaga é B2B, SaaS, enterprise ou varejo, ajuste sua linguagem e exemplos para esse contexto." },
  ],
  internalLinks: [
    { label: "Currículo para Product Manager", href: "/curriculo-product-manager-ats", description: "Guia específico para Product Manager", image: "/images/seo/ats-guide.jpg" },
    { label: "Currículo para Customer Success", href: "/curriculo-customer-success-ats", description: "Otimização para Customer Success", image: "/images/seo/marketing-career.jpg" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Guia específico para marketing digital", image: "/images/seo/marketing-career.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/developer-career.jpg" },
  ],
  positioningMistakes: [
    "Não mostrar números mesmo trabalhando com metas e receita",
    "Parecer apenas operacional, sem impacto comercial claro",
    "Não deixar evidente o tipo de venda (B2B, inside sales, enterprise, outbound)",
    "Omitir CRM, pipeline e previsibilidade comercial",
    "Falar de relacionamento sem conectar isso a fechamento ou expansão de receita",
  ],
  realExample: {
    title: "Exemplo real de resultado em Vendas",
    before: "Atuei com vendas e relacionamento com clientes da carteira",
    after: "Gerei R$2,4M em receita anual, bati 125% da meta e aumentei conversão do pipeline em 18% com negociação consultiva e gestão ativa em Salesforce",
  },
  faqs: [
    {
      question: "O que colocar no currículo de vendas?",
      answer: "O mais importante é mostrar resultado. Inclua meta batida, receita gerada, conversão, ticket médio, carteira, segmento atendido e ferramentas de CRM. Em vendas, currículo sem número parece fraco, mesmo quando a experiência é boa.",
    },
    {
      question: "Preciso colocar a porcentagem da meta batida?",
      answer: "Sim. Percentual de meta é um dos sinais mais fortes de performance comercial. Se possível, mostre consistência ao longo do tempo, como 'bati 120% da meta por 3 anos consecutivos'. Isso tem muito mais peso do que dizer apenas que trabalhou com metas.",
    },
    {
      question: "CRM é importante no currículo de vendas?",
      answer: "Sim. Salesforce, HubSpot, Pipedrive, RD Station CRM e ferramentas similares são frequentemente buscadas em ATS. Além de citar a ferramenta, vale contextualizar como você a usava: pipeline, forecast, gestão de carteira, cadências ou acompanhamento de oportunidades.",
    },
    {
      question: "Como mostrar resultado sem expor números confidenciais?",
      answer: "Você pode usar percentuais ou faixas. Em vez de informar receita exata, diga 'gerei mais de R$1M no ano' ou 'bati 125% da meta'. O importante é não deixar o currículo sem indicadores de performance.",
    },
    {
      question: "Devo deixar claro se trabalhei com inside sales ou field sales?",
      answer: "Sim. Isso ajuda o ATS e o recrutador a entender seu contexto. Inside sales, outbound, inbound, field sales, B2B, B2C, enterprise ou SMB mudam bastante o perfil da vaga. Ajustar essa linguagem aumenta aderência e relevância.",
    },
    {
      question: "Como mostrar habilidade de negociação no currículo?",
      answer: "Em vez de listar 'negociação' como habilidade solta, mostre o efeito dela. Exemplo: 'negociei contratos com ticket médio de R$30K e aumentei taxa de fechamento em 18%'. Isso transforma habilidade em prova de resultado.",
    },
    {
      question: "Vale incluir prospecção outbound no currículo?",
      answer: "Sim, principalmente para vagas de SDR, BDR, inside sales ou sales executive. Vale mencionar volume de leads trabalhados, taxa de resposta, reuniões geradas, qualidade da qualificação e impacto em pipeline. Isso mostra capacidade comercial real.",
    },
    {
      question: "Como diferenciar currículo de executivo de vendas e gerente comercial?",
      answer: "Executivos de vendas devem focar em performance individual: meta, receita, pipeline, conversão, ticket médio e carteira. Gerentes comerciais devem destacar liderança, forecast, desenvolvimento do time, metas coletivas, processos e crescimento da operação. O ATS costuma valorizar esse contexto corretamente alinhado.",
    },
  ],
}

export const financeiroConfig: RoleLandingConfig = {
  slug: "curriculo-financeiro-ats",
  role: "Analista Financeiro",
  roleShort: "Financeiro",
  visualVariant: "finance",
  meta: {
    title: "Currículo para Analista Financeiro que Passa no ATS (Guia, Exemplo e Palavras-chave) | CurrIA",
    description: "Crie um currículo de analista financeiro otimizado para ATS. Veja exemplos com DRE, fluxo de caixa, orçamento, KPIs e impacto financeiro para conquistar mais entrevistas.",
    canonical: "/curriculo-financeiro-ats",
  },
  hero: {
    h1: "Currículo para Analista Financeiro que Passa no ATS (Guia, Exemplo e Palavras-chave)",
    subtitle: "Você trabalha com números, custos e indicadores, mas seu currículo pode não mostrar impacto financeiro real. Sistemas ATS procuram redução de custos, orçamento, DRE e resultados claros. Veja exatamente o que corrigir.",
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
  },
  problem: {
    title: "Por que currículos financeiros são rejeitados pelo ATS?",
    description: "Muitos profissionais de finanças descrevem rotinas, mas não mostram o efeito do seu trabalho sobre margem, orçamento, eficiência ou resultado financeiro.",
    points: [
      "Não incluir redução de custos, ganhos de eficiência ou impacto no resultado",
      "Descrever fechamento, conciliação e relatórios sem mostrar contexto financeiro",
      "Não mencionar DRE, fluxo de caixa, orçamento ou indicadores financeiros",
      "Omitir ferramentas como Excel Avançado, ERP, Power BI ou SAP",
      "Falar de análises sem conectar a decisões de negócio",
    ],
  },
  atsExplanation: {
    title: "Como o ATS filtra currículos financeiros",
    description: "Recrutadores de finanças procuram profissionais orientados a controle, previsibilidade e impacto em indicadores. ATS costuma priorizar currículos com DRE, fluxo de caixa, orçamento, KPIs, redução de custos e ferramentas financeiras claras.",
    whatRecruitersScan: [
      "Indicadores financeiros e KPIs (margem, EBITDA, fluxo de caixa, budget vs actual)",
      "Experiência com DRE, orçamento, forecast e fechamento financeiro",
      "Redução de custos, eficiência operacional e impacto em resultado",
      "Ferramentas como Excel Avançado, Power BI, SAP, Oracle, TOTVS ou ERPs similares",
      "Capacidade analítica com relatórios executivos e apoio à tomada de decisão",
      "Relacionamento com controladoria, FP&A, contabilidade e liderança",
    ],
  },
  keywords: [
    { term: "DRE", description: "Demonstração do Resultado do Exercício é uma palavra-chave central em finanças" },
    { term: "Fluxo de Caixa", description: "Gestão e análise de entrada e saída de recursos" },
    { term: "Orçamento / Budget", description: "Planejamento e acompanhamento orçamentário" },
    { term: "Forecast", description: "Previsão financeira e acompanhamento de cenário" },
    { term: "KPIs Financeiros", description: "Indicadores como margem, EBITDA, ROI, budget vs actual" },
    { term: "Excel Avançado", description: "Ferramenta essencial para análise, modelagem e controle financeiro" },
    { term: "Power BI", description: "Visualização e acompanhamento de indicadores financeiros" },
    { term: "ERP / SAP", description: "Sistemas de gestão financeira muito valorizados no ATS" },
    { term: "Redução de Custos", description: "Impacto direto na eficiência e no resultado do negócio" },
    { term: "FP&A / Controladoria", description: "Áreas e contextos muito buscados em posições financeiras" },
  ],
  commonMistakes: [
    {
      mistake: "Descrever rotinas sem mostrar impacto financeiro",
      fix: "Mostre redução de custos, ganho de eficiência, melhoria de forecast ou impacto em margem",
    },
    {
      mistake: "Não citar indicadores financeiros",
      fix: "Inclua DRE, fluxo de caixa, EBITDA, margem, budget vs actual ou KPIs similares",
    },
    {
      mistake: "Omitir ferramentas importantes",
      fix: "Liste Excel Avançado, Power BI, SAP, Oracle, TOTVS ou ERPs usados no dia a dia",
    },
    {
      mistake: "Parecer operacional demais",
      fix: "Mostre apoio à tomada de decisão, análise crítica e impacto em negócio",
    },
    {
      mistake: "Não quantificar ganhos financeiros",
      fix: "Use números para demonstrar economia, recuperação de caixa, redução de erro ou melhoria de controle",
    },
  ],
  resumeSections: {
    summary: {
      title: "Resumo Profissional",
      bad: "Profissional com experiência em finanças, relatórios e controles.",
      good: "Analista Financeiro com 5 anos de experiência em DRE, fluxo de caixa, orçamento e indicadores financeiros. Atuação focada em redução de custos, modelagem financeira e suporte à tomada de decisão, com impacto de R$1,2M em eficiência operacional.",
    },
    skills: {
      title: "Seção de Habilidades",
      bad: "Finanças, Excel, relatórios, controle, indicadores",
      good: "Finanças: DRE, Fluxo de Caixa, Budget, Forecast, KPIs | Ferramentas: Excel Avançado, Power BI, SAP, Oracle | Análise: Modelagem Financeira, Budget vs Actual, Rentabilidade, Custos | Operação: Fechamento, Conciliação, Reporting Executivo",
    },
    experience: {
      title: "Experiência Profissional",
      bad: "Trabalhei com controles financeiros, relatórios e fechamento do mês.",
      good: "Estruturei análises financeiras e relatórios executivos que reduziram custos em R$850K/ano, melhorei a precisão do forecast em 18% e apoiei decisões de orçamento com impacto direto em margem e eficiência operacional.",
    },
  },
  specializations: [
    {
      title: "Controladoria",
      description: "Foco em fechamento, compliance, análise de resultado e controle gerencial.",
      keywords: ["DRE", "Fechamento", "Controladoria", "Conciliação", "Budget vs Actual", "Indicadores", "Compliance", "ERP", "Resultado", "Reporting"],
    },
    {
      title: "FP&A / Planejamento Financeiro",
      description: "Atuação com orçamento, forecast, cenários, modelagem e apoio estratégico à liderança.",
      keywords: ["FP&A", "Orçamento", "Forecast", "Modelagem Financeira", "Cenários", "KPIs", "Planejamento", "EBITDA", "Margem", "Business Partner"],
    },
    {
      title: "Tesouraria / Caixa",
      description: "Gestão de fluxo de caixa, liquidez, projeções e eficiência de capital de giro.",
      keywords: ["Fluxo de Caixa", "Tesouraria", "Liquidez", "Capital de Giro", "Projeção", "Contas a Pagar", "Contas a Receber", "Bancos", "Conciliação", "Eficiência"],
    },
  ],
  seniorityLevels: [
    {
      level: "Financeiro Júnior",
      focus: "Demonstre domínio de rotina financeira, organização e capacidade analítica inicial",
      tips: [
        "Mostre experiência com fechamento, conciliação, controles e relatórios",
        "Inclua ferramentas como Excel, ERP e dashboards financeiros",
        "Destaque atenção a detalhe, organização e consistência nos números",
        "Mencione participação em rotinas mensais, acompanhamento orçamentário ou melhoria operacional",
      ],
    },
    {
      level: "Financeiro Pleno",
      focus: "Mostre autonomia em análise, indicadores, budget e impacto financeiro real",
      tips: [
        "Quantifique redução de custos, ganho de eficiência, melhoria de forecast ou acurácia de relatórios",
        "Mencione experiências com budget, DRE, fluxo de caixa e suporte à tomada de decisão",
        "Destaque relacionamento com áreas de negócio, controladoria ou liderança",
        "Inclua modelagem, análises críticas e reporting executivo",
      ],
    },
    {
      level: "Financeiro Sênior / Lead",
      focus: "Demonstre visão estratégica, liderança e capacidade de influenciar resultados financeiros",
      tips: [
        "Mostre impacto em margem, EBITDA, eficiência, budget ou reestruturação de processo",
        "Mencione times liderados, projetos estruturados ou governança financeira implementada",
        "Inclua visão de negócio, cenários e apoio à liderança executiva",
        "Destaque resultados financeiros com escala e previsibilidade",
      ],
    },
  ],
  cvExample: {
    before: {
      title: "Experiência em Finanças",
      bullets: [
        "Trabalhei com controles financeiros",
        "Fiz relatórios mensais",
        "Acompanhei orçamento da empresa",
        "Participei do fechamento financeiro",
      ],
    },
    after: {
      title: "Analista Financeiro | DRE, Budget, Fluxo de Caixa",
      bullets: [
        "Reduzi custos operacionais em R$850K/ano com análise de contratos, orçamento e eficiência financeira",
        "Melhorei a precisão do forecast em 18% com revisão de premissas e modelagem financeira",
        "Estruturei dashboards em Power BI para acompanhamento de DRE, margem e budget vs actual",
        "Apoiei decisões executivas com relatórios financeiros e análises que impactaram diretamente a rentabilidade",
      ],
    },
  },
  fullResumeExample: {
    name: "Carlos Souza",
    title: "Analista Financeiro | DRE, Orçamento, Fluxo de Caixa",
    contact: "carlos.souza@email.com | (11) 94444-0000 | São Paulo, SP | linkedin.com/in/carlossouza",
    summary: "Analista Financeiro com 6 anos de experiência em DRE, fluxo de caixa, orçamento, forecast e modelagem financeira. Forte atuação com Excel Avançado, Power BI e SAP, com histórico de redução de custos em R$1,3M e melhoria de previsibilidade financeira em ambientes corporativos.",
    skills: [
      { category: "Finanças", items: "DRE, Fluxo de Caixa, Orçamento, Forecast, KPIs Financeiros" },
      { category: "Ferramentas", items: "Excel Avançado, Power BI, SAP, Oracle, ERP" },
      { category: "Análise", items: "Budget vs Actual, Modelagem Financeira, Rentabilidade, Custos" },
      { category: "Operação", items: "Fechamento Financeiro, Conciliação, Reporting Executivo" },
      { category: "Negócio", items: "Margem, EBITDA, Planejamento Financeiro, Business Partner" },
      { category: "Controle", items: "Compliance, Governança, Eficiência Operacional" },
    ],
    experience: [
      {
        role: "Analista Financeiro Pleno",
        company: "Grupo Finance Corp",
        period: "Jan 2022 – Presente",
        bullets: [
          "Reduzi custos operacionais em R$900K/ano com revisão de contratos, centros de custo e análises de eficiência",
          "Melhorei a precisão do forecast em 20% com revisão de premissas financeiras e modelagem em Excel",
          "Estruturei dashboards de DRE, margem e budget vs actual em Power BI para acompanhamento executivo",
          "Apoiei decisões estratégicas de orçamento e rentabilidade, contribuindo para aumento de margem em 3,2 p.p.",
        ],
      },
      {
        role: "Analista Financeiro Júnior",
        company: "Empresa Brasil Holding",
        period: "Mar 2020 – Dez 2021",
        bullets: [
          "Atuei em fechamento financeiro, conciliações e relatórios de fluxo de caixa mensal",
          "Automatizei controles em Excel, reduzindo tempo de preparação de relatórios em 30%",
          "Acompanhei orçamento e desvios orçamentários, apoiando times de controladoria e FP&A",
          "Contribuí para melhoria da qualidade de dados financeiros em ERP SAP",
        ],
      },
    ],
    education: {
      degree: "Bacharel em Administração de Empresas",
      institution: "FGV",
      year: "2019",
    },
    certifications: [
      "Excel Avançado para Finanças (2023)",
      "Power BI para Análise Financeira (2022)",
      "Planejamento Financeiro e Orçamento Corporativo (2021)",
    ],
  },
  improvementSteps: [
    { title: "Inclua impacto financeiro real", description: "Mostre redução de custos, melhora de forecast, ganho de eficiência ou impacto em margem e rentabilidade." },
    { title: "Liste indicadores e rotinas-chave", description: "DRE, fluxo de caixa, orçamento, budget vs actual, EBITDA e KPIs ajudam o ATS a identificar aderência à vaga." },
    { title: "Destaque ferramentas financeiras", description: "Excel Avançado, Power BI, SAP, Oracle, TOTVS e ERPs similares são termos muito buscados." },
    { title: "Troque rotina por decisão", description: "Mostre como suas análises ajudaram líderes a tomar decisões, não apenas que você gerou relatórios." },
    { title: "Quantifique eficiência e controle", description: "Tempo economizado, custo reduzido, melhoria de acurácia ou visibilidade financeira fortalecem seu currículo." },
    { title: "Adapte ao contexto da vaga", description: "Se a vaga é controladoria, FP&A, tesouraria ou custos, ajuste sua linguagem e experiências para esse contexto." },
  ],
  internalLinks: [
    { label: "Currículo para Vendas", href: "/curriculo-vendas-ats", description: "Guia específico para profissionais de vendas", image: "/images/seo/ats-guide.jpg" },
    { label: "Currículo para Product Manager", href: "/curriculo-product-manager-ats", description: "Otimização para Product Manager", image: "/images/seo/marketing-career.jpg" },
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Guia específico para área de dados", image: "/images/seo/data-analyst-career.jpg" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente", image: "/images/seo/developer-career.jpg" },
  ],
  positioningMistakes: [
    "Descrever rotina financeira sem mostrar impacto no resultado da empresa",
    "Não deixar claro se atua com controladoria, FP&A, tesouraria ou custos",
    "Omitir indicadores financeiros e ganhos concretos de eficiência",
    "Parecer operacional demais e pouco analítico ou estratégico",
    "Não mostrar como seus relatórios ajudaram na tomada de decisão",
  ],
  realExample: {
    title: "Exemplo real de resultado em Finanças",
    before: "Atuei com relatórios, fechamento financeiro e apoio ao orçamento",
    after: "Reduzi custos operacionais em R$850K/ano, melhorei a precisão do forecast em 18% e estruturei dashboards financeiros que apoiaram decisões executivas de orçamento e rentabilidade",
  },
  faqs: [
    {
      question: "O que colocar no currículo de analista financeiro?",
      answer: "O mais importante é mostrar impacto financeiro. Inclua DRE, fluxo de caixa, orçamento, forecast, KPIs, ferramentas usadas e ganhos concretos como redução de custos, melhoria de acurácia ou eficiência operacional. Currículo financeiro sem indicadores tende a parecer apenas operacional.",
    },
    {
      question: "Preciso mencionar DRE e fluxo de caixa no currículo?",
      answer: "Sim. DRE, fluxo de caixa, budget, forecast e budget vs actual são termos muito buscados em ATS para vagas financeiras. Mesmo que você não atue com todos, deve deixar claro quais rotinas financeiras domina e em qual profundidade.",
    },
    {
      question: "Excel Avançado ainda é importante para área financeira?",
      answer: "Muito. Excel Avançado continua sendo uma das habilidades mais valorizadas em finanças. Vale mencionar modelagem financeira, tabelas dinâmicas, fórmulas avançadas, Power Query e automações quando fizer sentido. Isso fortalece bastante o currículo no ATS.",
    },
    {
      question: "Como mostrar impacto sem expor dados confidenciais?",
      answer: "Você pode usar percentuais, faixas ou valores aproximados. Em vez de detalhar números sensíveis, diga algo como 'reduzi custos em mais de R$500K por ano' ou 'melhorei a acurácia do forecast em 18%'. O importante é não deixar o impacto invisível.",
    },
    {
      question: "Vale mencionar ERP no currículo financeiro?",
      answer: "Sim. SAP, Oracle, TOTVS e outros ERPs são frequentemente buscados em vagas financeiras. ATS e recrutadores usam isso como sinal de aderência. O ideal é citar o sistema e o contexto: fechamento, conciliação, controles, reporting ou integração com áreas de negócio.",
    },
    {
      question: "Como diferenciar currículo de controladoria e FP&A?",
      answer: "Controladoria costuma ter mais foco em fechamento, compliance, análise de resultado e controle gerencial. FP&A tende a focar mais em orçamento, forecast, cenários, planejamento e suporte estratégico. Ajustar a linguagem para a vaga ajuda muito no match com ATS.",
    },
    {
      question: "Power BI ajuda no currículo de finanças?",
      answer: "Sim. Power BI é um diferencial forte porque mostra capacidade de transformar dados financeiros em visibilidade executiva. Se você criou dashboards de DRE, margem, fluxo de caixa ou budget vs actual, vale destacar isso claramente no currículo.",
    },
    {
      question: "Como mostrar que minhas análises ajudaram na tomada de decisão?",
      answer: "Explique o contexto e o resultado. Em vez de 'gerei relatórios', use algo como 'estruturei análises de custo e margem que apoiaram revisão orçamentária e contribuíram para redução de R$850K/ano'. Isso transforma rotina em impacto estratégico.",
    },
  ],
}

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

export const roleLandingConfigBySlug: Record<string, RoleLandingConfig> = {
  "curriculo-desenvolvedor-ats": desenvolvedorConfig,
  "curriculo-analista-dados-ats": analistaDadosConfig,
  "curriculo-marketing-ats": marketingConfig,
  "curriculo-customer-success-ats": customerSuccessConfig,
  "curriculo-product-manager-ats": productManagerConfig,
  "curriculo-vendas-ats": vendasConfig,
  "curriculo-financeiro-ats": financeiroConfig,
  "curriculo-engenheiro-de-dados-ats": engenheiroDadosConfig,
}

export function getRoleLandingConfigBySlug(slug: string): RoleLandingConfig | undefined {
  return roleLandingConfigBySlug[slug]
}

export const allRoleLandingConfigs: RoleLandingConfig[] = [
  desenvolvedorConfig,
  analistaDadosConfig,
  marketingConfig,
  customerSuccessConfig,
  productManagerConfig,
  vendasConfig,
  financeiroConfig,
  engenheiroDadosConfig,
]
