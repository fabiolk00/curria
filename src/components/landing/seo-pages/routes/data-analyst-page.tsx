"use client";

import SEOPageTemplate from "@/components/landing/seo-pages/seo-page-template";
import { Database, LineChart, TrendingUp } from "lucide-react";

export default function DataAnalystPage() {
  return (
    <SEOPageTemplate
      slug="curriculo-analista-dados-ats"
      role="Analista de Dados"
      theme={{
        accent: "bg-purple-600",
        bgAccent: "bg-purple-500/10",
        textAccent: "text-purple-600",
        badgeLabel: "Guia de Currículo para Analistas",
        icon: <Database className="w-6 h-6 text-purple-600" />,
        heroVisual: (
          <div className="w-full h-full flex flex-col justify-end bg-white p-8 rounded-b-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
            
            <div className="flex-1 flex flex-col w-full relative z-10 gap-6 justify-center">
              <div className="flex justify-between items-start px-2">
                <div>
                  <div className="text-[10px] text-zinc-500 font-mono tracking-widest mb-1">ROI DA CAMPANHA</div>
                  <div className="text-4xl font-mono font-bold text-[#0a0a0a] tracking-tighter flex items-center gap-3 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    +142% <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <div className="text-[10px] text-purple-700 font-mono bg-purple-50 px-2 py-1 rounded border border-purple-200">SQL EXTRACTION</div>
              </div>
              
              {/* Horizontal Bar Chart */}
              <div className="w-full flex flex-col gap-3 px-2 mt-4">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-500 font-mono w-4">Q1</span>
                  <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-300 w-[25%]" />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-500 font-mono w-4">Q2</span>
                  <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 w-[45%]" />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-500 font-mono w-4">Q3</span>
                  <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-[60%]" />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-emerald-600 font-mono font-bold w-4">Q4</span>
                  <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[100%] shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }}
      content={{
        heroTitle: "Currículo de Analista de Dados estruturado para o ATS",
        heroSubtitle: "Transforme suas habilidades de SQL, Python e BI em um formato legível para algoritmos e irresistível para recrutadores.",
        problemCards: [
          { title: "Consultas SQL Escondidas", desc: "Listar 'SQL' apenas uma vez no final, em vez de detalhar joins complexos, CTEs e window functions na sua experiência." },
          { title: "Valor de Negócio Ausente", desc: "Focar muito na ferramenta (ex: Tableau) e não o suficiente na receita gerada ou no tempo economizado pelo seu dashboard." },
          { title: "Formato em Vez de Dados", desc: "Usar layouts intricados de múltiplas colunas que quebram o parser, transformando sua experiência impecável com dados em texto embaralhado." }
        ],
        filterChecklist: [
          { item: "Formato cronológico padrão com datas claras", checked: true },
          { item: "Menções exatas a ferramentas (ex: Power BI, Looker)", checked: true },
          { item: "Verbos de ação que impulsionam decisões de negócios", checked: true },
          { item: "Gráficos complexos e barras de habilidade no PDF", checked: false },
          { item: "Títulos de seção não ortodoxos como 'Jornada com Dados'", checked: false }
        ],
        keywords: [
          { category: "Consultas e Scripts", term: "SQL (PostgreSQL, MySQL)" },
          { category: "Consultas e Scripts", term: "Python (Pandas, NumPy)" },
          { category: "Consultas e Scripts", term: "R" },
          { category: "Visualização", term: "Tableau" },
          { category: "Visualização", term: "Power BI" },
          { category: "Visualização", term: "Looker / Metabase" },
          { category: "Conceitos de Dados", term: "Testes A/B" },
          { category: "Conceitos de Dados", term: "Limpeza de Dados / ETL" },
          { category: "Conceitos de Dados", term: "Modelagem Estatística" },
          { category: "Cloud & Warehouse", term: "Snowflake / BigQuery" },
          { category: "Cloud & Warehouse", term: "AWS Redshift" },
          { category: "Cloud & Warehouse", term: "dbt (Data Build Tool)" }
        ],
        goodVsBad: {
          bad: "Responsável por analisar dados e fazer relatórios para a gerência.",
          good: "Desenvolveu um pipeline ETL automatizado usando Python e SQL, reduzindo o tempo de geração de relatórios em 85% e fornecendo insights em tempo real para executivos C-level."
        },
        specializations: [
          { title: "Product Analytics", desc: "Foque no comportamento do usuário, métricas de retenção, quedas de funil e testes A/B.", tags: ["Mixpanel", "Amplitude", "Testes A/B", "Retenção / Churn"] },
          { title: "Marketing Analytics", desc: "Destaque custos de aquisição de clientes (CAC), LTV, modelagem de atribuição e ROI.", tags: ["Google Analytics", "LTV/CAC", "Atribuição", "ROI de Campanhas"] },
          { title: "Financial Analytics", desc: "Enfatize previsões, análise de variância, modelagem de receita e avaliação de riscos.", tags: ["Excel / VBA", "Forecasting", "Análise de Variância", "EBITDA"] },
          { title: "Business Intelligence", desc: "Concentre-se em visualização de dados, criação de dashboards executivos e métricas chave de performance (KPIs).", tags: ["Tableau", "Power BI", "Dashboards", "Storytelling com Dados"] }
        ],
        seniority: [
          { level: "Analista Júnior", tips: ["Destaque projetos acadêmicos, bootcamps e habilidades fundamentais de SQL/Excel.", "Foque na sua capacidade de limpar dados bagunçados e construir visualizações básicas.", "Demonstre entusiasmo por aprender conhecimento de domínio."] },
          { level: "Analista Pleno", tips: ["Mostre propriedade independente sobre pipelines de relatórios.", "Quantifique as decisões de negócios tomadas como resultado de suas análises.", "Mencione a automação de tarefas repetitivas usando Python ou SQL avançado."] },
          { level: "Analista Sênior / Lead", tips: ["Foque no alinhamento estratégico: como sua estratégia de dados impulsionou a receita da empresa.", "Destaque a liderança interfuncional e o gerenciamento de stakeholders.", "Discuta mentoria de juniores e estabelecimento de governança de dados."] }
        ],
        roadmap: [
          { step: "Catalogue Suas Ferramentas", detail: "Certifique-se de que todo software de visualização, banco de dados e linguagem que você conhece esteja listado claramente." },
          { step: "Mapeie o Impacto", detail: "Traduza cada tarefa técnica em um resultado de negócio (receita alta, custos baixos, tempo economizado)." },
          { step: "Quantifique a Escala", detail: "Adicione números reais: linhas de dados, número de dashboards ou porcentagens de melhoria." },
          { step: "Limpe a Formatação", detail: "Garanta que o ATS consiga extrair facilmente o seu histórico de trabalho sem travar em gráficos ou tabelas." }
        ],
        faq: [
          { q: "Devo incluir um link para o meu portfólio?", a: "Sim, adicione um link para o seu GitHub, perfil do Tableau Public ou site pessoal. Certifique-se de que os URLs sejam clicáveis." },
          { q: "Preciso saber tanto Python quanto R?", a: "Geralmente, conhecer um dos dois muito bem é suficiente. Adapte o seu currículo à linguagem solicitada na descrição da vaga." },
          { q: "Como demonstro impacto nos negócios se eu apenas puxei os dados?", a: "Pergunte a si mesmo para que os dados foram usados. Se a sua consulta ajudou o marketing a lançar uma campanha, declare que sua extração de dados viabilizou uma campanha que gerou X leads." }
        ]
      }}
    />
  );
}



