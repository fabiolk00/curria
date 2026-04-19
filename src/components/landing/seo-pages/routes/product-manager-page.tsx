"use client";

import SEOPageTemplate from "@/components/landing/seo-pages/seo-page-template";
import { Target, Lightbulb, TrendingUp } from "lucide-react";

export default function ProductManagerPage() {
  return (
    <SEOPageTemplate
      slug="curriculo-product-manager-ats"
      role="Product Manager"
      theme={{
        accent: "bg-amber-500",
        bgAccent: "bg-amber-500/10",
        textAccent: "text-amber-600",
        badgeLabel: "Guia de Currículo para PMs",
        icon: <Target className="w-6 h-6 text-amber-500" />,
        heroVisual: (
          <div className="w-full h-full flex flex-col justify-center items-center bg-white p-8 rounded-b-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none" />

            <div className="w-full relative z-10 flex flex-col gap-12 mt-4">
              <div className="text-center">
                <div className="text-[10px] text-amber-600 font-mono tracking-widest uppercase mb-2">Product Roadmap 2025</div>
                <div className="text-4xl font-bold text-[#0a0a0a] tracking-tighter">Enterprise V2</div>
              </div>

              {/* Horizontal Roadmap without cards */}
              <div className="relative w-full h-24 px-8">
                {/* Background Track */}
                <div className="absolute top-1/2 left-8 right-8 h-1 bg-zinc-200 -translate-y-1/2 rounded-full" />
                {/* Active Progress */}
                <div className="absolute top-1/2 left-8 w-[65%] h-1 bg-gradient-to-r from-amber-600 to-amber-400 -translate-y-1/2 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.3)]" />

                {/* Milestones */}
                <div className="absolute top-0 left-8 right-8 h-full flex justify-between items-center">
                  {/* Q1 */}
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute bottom-full mb-3 text-[10px] text-zinc-500 font-mono">Q1</div>
                    <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] border-2 border-white z-10" />
                    <div className="absolute top-full mt-3 text-[10px] text-amber-700 font-medium whitespace-nowrap">Discovery</div>
                  </div>
                  {/* Q2 */}
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute bottom-full mb-3 text-[10px] text-zinc-500 font-mono">Q2</div>
                    <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] border-2 border-white z-10" />
                    <div className="absolute top-full mt-3 text-[10px] text-amber-700 font-medium whitespace-nowrap">MVP Launch</div>
                  </div>
                  {/* Q3 */}
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute bottom-full mb-3 text-[10px] text-amber-600 font-mono">Q3</div>
                    <div className="relative z-10 flex items-center justify-center">
                       <div className="absolute w-6 h-6 bg-amber-400/20 rounded-full animate-ping" />
                       <div className="w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow-sm" />
                    </div>
                    <div className="absolute top-full mt-3 text-[10px] text-[#0a0a0a] font-bold whitespace-nowrap">Scale</div>
                  </div>
                  {/* Q4 */}
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute bottom-full mb-3 text-[10px] text-zinc-400 font-mono">Q4</div>
                    <div className="w-3 h-3 rounded-full bg-zinc-200 border-2 border-white z-10" />
                    <div className="absolute top-full mt-3 text-[10px] text-zinc-500 font-medium whitespace-nowrap">Monetization</div>
                  </div>
                </div>
              </div>

              {/* Floating metrics */}
              <div className="flex justify-between items-end border-t border-zinc-200 pt-6 px-8">
                <div>
                  <div className="text-[10px] text-zinc-500 font-mono mb-1">MAU GROWTH</div>
                  <div className="text-2xl font-mono text-emerald-600 font-bold">+42.5%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-500 font-mono mb-1">NPS SCORE</div>
                  <div className="text-2xl font-mono text-blue-600 font-bold">72.4</div>
                </div>
              </div>
            </div>
          </div>
        )
      }}
      content={{
        heroTitle: "Currículos de Product Manager otimizado para ATS",
        heroSubtitle: "Traduza sua visão estratégica em métricas objetivas. Mostre aos algoritmos como você lidera squads e entrega resultados reais de negócio.",
        problemCards: [
          { title: "Esquecer o 'Porquê'", desc: "Listar features que você construiu sem explicar o problema do cliente ou o resultado para o negócio (ROI/Receita)." },
          { title: "Ignorar a Engenharia", desc: "Falhar ao declarar explicitamente sua colaboração com times de engenharia e design usando metodologias Ágeis/Scrum." },
          { title: "Sopa de Buzzwords", desc: "Sobrecarregar seu resumo com 'líder visionário de produto' enquanto omite métricas difíceis como crescimento de MAU ou redução de churn." }
        ],
        filterChecklist: [
          { item: "Progressão cronológica padrão", checked: true },
          { item: "Frameworks ágeis específicos mencionados (Scrum, Kanban)", checked: true },
          { item: "Impacto quantificável de lançamentos de produto", checked: true },
          { item: "Títulos funcionais criativos em vez de 'Product Manager'", checked: false },
          { item: "Layouts de duas colunas que quebram a leitura", checked: false }
        ],
        keywords: [
          { category: "Estratégia e Discovery", term: "Product Strategy / Roadmap" },
          { category: "Estratégia e Discovery", term: "A/B Testing / Experimentação" },
          { category: "Estratégia e Discovery", term: "User Research / Discovery" },
          { category: "Execução", term: "Agile / Scrum / Kanban" },
          { category: "Execução", term: "Go-to-Market (GTM) Launch" },
          { category: "Métricas", term: "Monthly Active Users (MAU)" },
          { category: "Métricas", term: "Net Promoter Score (NPS)" },
          { category: "Ferramentas", term: "Jira / Linear / Asana" },
          { category: "Ferramentas", term: "Mixpanel / Amplitude" }
        ],
        goodVsBad: {
          bad: "Escrevi requisitos e trabalhei com desenvolvedores para construir o aplicativo.",
          good: "Definiu a visão do produto e os PRDs para um novo dashboard B2B SaaS, priorizando features com base em entrevistas com usuários e gerando US$ 2,1 milhões em novo pipeline em 6 meses."
        },
        specializations: [
          { title: "Technical PM", desc: "Foco em design de APIs, infraestrutura e escalabilidade de plataforma.", tags: ["APIs", "Arquitetura de Sistemas", "Plataforma SaaS"] },
          { title: "Growth PM", desc: "Destaque em funis de conversão, loops de viralidade e experimentação rápida.", tags: ["Testes A/B", "Taxa de Conversão", "Onboarding", "PLG"] },
          { title: "Data/AI PM", desc: "Enfase em modelos de machine learning, pipelines de dados e análises preditivas.", tags: ["Machine Learning", "LLMs", "Pipelines de Dados"] },
          { title: "Core / Feature PM", desc: "Concentre-se em pesquisas com usuários, descoberta de produtos e execução ágil do dia a dia do desenvolvimento.", tags: ["Product Discovery", "Entrevistas de Usuário", "Gestão de Backlog", "Metodologia Ágil"] }
        ],
        seniority: [
          { level: "Associate PM (APM)", tips: ["Destaque a execução: escrever user stories, testes de QA e análise de feedback de usuários.", "Quantifique as features específicas que você gerenciou e lançou."] },
          { level: "Product Manager Pleno", tips: ["Mostre propriedade ponta a ponta de uma área de produto.", "Destaque a priorização orientada a métricas e os lançamentos GTM (Go-to-Market)."] },
          { level: "Group PM / VP de Produto", tips: ["Foque na estratégia de portfólio, contratação de PMs e alinhamento da visão do produto.", "Discuta responsabilidade de P&L (Lucros e Perdas) e apresentações para o conselho (Board)."] }
        ],
        roadmap: [
          { step: "Defina o Escopo", detail: "Declare claramente o produto que você gerenciou, seu público-alvo (B2B/B2C) e sua escala." },
          { step: "Detalhe o Processo", detail: "Inclua palavras-chave para as metodologias que você usa (Scrum, continuous discovery)." },
          { step: "Destaque a Colaboração", detail: "Mencione explicitamente o trabalho com engenharia, design, marketing e vendas." },
          { step: "Quantifique a Vitória", detail: "Termine todo grande bullet point com uma métrica (receita, adoção, retenção, eficiência)." }
        ],
        faq: [
          { q: "Devo incluir projetos paralelos se não tiver experiência formal como PM?", a: "Sim. Construir e lançar um projeto paralelo mostra iniciativa, empatia pelo usuário e compreensão técnica — características fundamentais de um PM." },
          { q: "Quão técnico meu currículo precisa ser?", a: "Adapte à vaga. Para um PM padrão, foque no 'o quê' e no 'porquê'. Para um PM Técnico, aprofunde-se no 'como' e no design do sistema." },
          { q: "Vale a pena listar uma certificação de Scrum Master (CSM)?", a: "Sim, liste na seção de habilidades, mas garanta que os marcadores da sua experiência mostrem que você realmente aplicou os princípios Ágeis." }
        ]
      }}
    />
  );
}



