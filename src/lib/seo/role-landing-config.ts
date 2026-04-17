// Configuration for programmatic SEO landing pages
// Each role has its own config with specific content optimized for that profession

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

export type RoleLandingConfig = {
  slug: string
  role: string
  roleShort: string
  
  // SEO metadata
  meta: {
    title: string
    description: string
    canonical: string
  }
  
  // Hero section
  hero: {
    h1: string
    subtitle: string
    ctaText: string
    ctaSubtext: string
  }
  
  // Problem section - softened copy
  problem: {
    title: string
    description: string
    points: string[]
  }
  
  // ATS explanation for this role - softened copy
  atsExplanation: {
    title: string
    description: string
    whatRecruitersScan: string[]
  }
  
  // Keywords section (SEO gold)
  keywords: RoleKeyword[]
  
  // NEW: Common mistakes section
  commonMistakes: CommonMistake[]
  
  // NEW: Resume sections examples (resumo, skills, experiência)
  resumeSections: {
    summary: ResumeSection
    skills: ResumeSection
    experience: ResumeSection
  }
  
  // NEW: Specializations (frontend, backend, fullstack for dev)
  specializations: Specialization[]
  
  // NEW: Seniority levels
  seniorityLevels: SeniorityLevel[]
  
  // Before/After CV example
  cvExample: BeforeAfterExample
  
  // NEW: Full resume example (complete ATS-ready resume)
  fullResumeExample: FullResumeExample
  
  // How to improve steps
  improvementSteps: {
    title: string
    description: string
  }[]
  
  // NEW: Internal links for SEO
  internalLinks: InternalLink[]
  
  // FAQs - expanded with full answers
  faqs: RoleFaq[]
}

// Developer (Desenvolvedor) configuration
export const desenvolvedorConfig: RoleLandingConfig = {
  slug: "curriculo-desenvolvedor-ats",
  role: "Desenvolvedor de Software",
  roleShort: "Desenvolvedor",
  
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
      fix: "Foque nas 10-15 mais relevantes para a vaga e adicione contexto de uso" 
    },
    { 
      mistake: "Usar barras de progresso para skills", 
      fix: "Liste tecnologias em texto, agrupadas por categoria (Linguagens, Frameworks, etc.)" 
    },
    { 
      mistake: "Escrever 'Desenvolvedor Full Stack' sem especificar stack", 
      fix: "Use 'Desenvolvedor Full Stack | React, Node.js, PostgreSQL'" 
    },
    { 
      mistake: "Colocar apenas links do GitHub sem descrição", 
      fix: "Descreva brevemente: 'GitHub: 15+ projetos em React e Node.js'" 
    },
    { 
      mistake: "Usar tabelas ou colunas múltiplas", 
      fix: "Use layout linear com seções claras e bullets simples" 
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
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Guia específico para área de dados" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Otimização para marketing digital" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente" },
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

// Data Analyst (Analista de Dados) configuration
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
    subtitle: "Seu currículo de analista de dados pode estar sendo rejeitado antes mesmo de ser lido. Sistemas ATS filtram candidatos automaticamente, e a maioria dos profissionais de dados não sabe por que nunca recebe retorno. Veja exatamente o que corrigir.",
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
      fix: "Use 'Excel Avançado: Tabelas Dinâmicas, Power Query, VLOOKUP, Macros VBA'" 
    },
    { 
      mistake: "Listar 'análise de dados' sem ferramentas", 
      fix: "Especifique: 'Análise de dados com SQL, Python (Pandas) e Power BI'" 
    },
    { 
      mistake: "Não mencionar volume de dados trabalhado", 
      fix: "Adicione escala: 'Processei datasets de 5M+ registros'" 
    },
    { 
      mistake: "Usar 'dashboard' sem especificar ferramenta", 
      fix: "Escreva: 'Criei 20+ dashboards em Power BI para equipe de vendas'" 
    },
    { 
      mistake: "Omitir impacto de negócio das análises", 
      fix: "Conecte análise a resultado: 'Análise identificou economia de R$200K'" 
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
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores" },
    { label: "Currículo para Marketing", href: "/curriculo-marketing-ats", description: "Otimização para marketing digital" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente" },
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

// Marketing configuration
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
    ctaText: "Veja seu score ATS em 30 segundos",
    ctaSubtext: "Cole seu currículo e descubra o que está errado",
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
      fix: "Especifique: 'Gerenciei Instagram e LinkedIn com 50K+ seguidores, alcance de 500K/mês'" 
    },
    { 
      mistake: "Listar 'campanhas de marketing' sem métricas", 
      fix: "Adicione números: 'Campanhas de Google Ads com ROAS 4.5x e CTR de 3.2%'" 
    },
    { 
      mistake: "Não mencionar budget gerenciado", 
      fix: "Contextualize: 'Gerenciei budget de R$200K/mês em mídia paga'" 
    },
    { 
      mistake: "Usar 'marketing digital' sem especificar área", 
      fix: "Seja específico: 'Marketing de Performance | Google Ads, Meta Ads, SEO'" 
    },
    { 
      mistake: "Omitir ferramentas de automação", 
      fix: "Inclua: 'Automação de marketing no HubSpot com 15 fluxos de nurturing'" 
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
    { label: "Currículo para Desenvolvedor", href: "/curriculo-desenvolvedor-ats", description: "Guia específico para desenvolvedores" },
    { label: "Currículo para Analista de Dados", href: "/curriculo-analista-dados-ats", description: "Otimização para área de dados" },
    { label: "O que é ATS?", href: "/what-is-ats", description: "Entenda como funcionam os sistemas ATS" },
    { label: "Analisar meu currículo", href: "/signup", description: "Receba seu score ATS gratuitamente" },
  ],
  
  faqs: [
    {
      question: "Quais métricas devo incluir no currículo de marketing?",
      answer: "As métricas mais valorizadas dependem da sua especialidade. Para performance: ROAS, CAC, LTV, CTR, CPC, taxa de conversão. Para SEO: crescimento de tráfego orgânico, posições de ranking, backlinks. Para conteúdo: engajamento, alcance, leads gerados. Sempre conecte métricas a resultados de negócio - 'ROAS de 4x que gerou R$2M em vendas' é mais poderoso que apenas 'ROAS de 4x'.",
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

// Helper to get config by slug
export function getRoleLandingConfigBySlug(slug: string): RoleLandingConfig | undefined {
  const configs: Record<string, RoleLandingConfig> = {
    "curriculo-desenvolvedor-ats": desenvolvedorConfig,
    "curriculo-analista-dados-ats": analistaDadosConfig,
    "curriculo-marketing-ats": marketingConfig,
  }
  return configs[slug]
}

// Export all configs for sitemap generation
export const allRoleLandingConfigs: RoleLandingConfig[] = [
  desenvolvedorConfig,
  analistaDadosConfig,
  marketingConfig,
]
