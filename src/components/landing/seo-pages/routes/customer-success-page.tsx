"use client";

import SEOPageTemplate from "@/components/landing/seo-pages/seo-page-template";
import { HeartHandshake, ShieldCheck, Activity } from "lucide-react";
import { motion as Motion } from "motion/react";

export default function CustomerSuccessPage() {
  return (
    <SEOPageTemplate
      slug="curriculo-customer-success-ats"
      role="Customer Success"
      theme={{
        accent: "bg-cyan-600",
        bgAccent: "bg-cyan-500/10",
        textAccent: "text-cyan-600",
        badgeLabel: "Guia de Currículo CS",
        icon: <HeartHandshake className="w-6 h-6 text-cyan-600" />,
        heroVisual: (
          <div className="w-full h-full flex flex-col justify-center items-center bg-white p-8 rounded-b-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 blur-[80px] pointer-events-none rounded-full" />
            
            <div className="w-full max-w-sm relative z-10 flex flex-col gap-10">
              <div className="flex justify-between items-end px-2">
                <div>
                  <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Net Retention (NRR)</span>
                  </div>
                  <div className="text-4xl font-mono font-bold text-[#0a0a0a] tracking-tighter drop-shadow-[0_0_20px_rgba(8,145,178,0.2)]">
                    115%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Upsell ARR</div>
                  <div className="text-2xl font-mono font-bold text-emerald-600">$450k</div>
                </div>
              </div>

              {/* Horizontal CS Lifecycle Flow */}
              <div className="w-full relative h-16 mt-2">
                <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-zinc-200 -translate-y-1/2" />
                <Motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.2, delay: 0.2, ease: "easeInOut" }}
                  className="absolute top-1/2 left-4 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 -translate-y-1/2 shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                />
                
                <div className="absolute top-0 left-0 w-full h-full flex justify-between items-center px-4">
                  {/* Onboarding */}
                  <Motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="flex flex-col items-center gap-2 relative shrink-0"
                  >
                    <div className="w-6 h-6 shrink-0 rounded-full bg-white border-2 border-blue-500 z-10" />
                    <div className="absolute top-full mt-2 text-center whitespace-nowrap">
                      <div className="text-[10px] text-zinc-500 font-mono">ONBOARDING</div>
                    </div>
                  </Motion.div>
                  
                  {/* Adoption */}
                  <Motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.5 }}
                    className="flex flex-col items-center gap-2 relative shrink-0"
                  >
                    <div className="w-6 h-6 shrink-0 rounded-full bg-white border-2 border-cyan-500 z-10" />
                    <div className="absolute top-full mt-2 text-center whitespace-nowrap">
                      <div className="text-[10px] text-zinc-500 font-mono">ADOPTION</div>
                    </div>
                  </Motion.div>
                  
                  {/* EBR */}
                  <Motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.8 }}
                    className="flex flex-col items-center gap-2 relative shrink-0"
                  >
                    <div className="w-6 h-6 shrink-0 rounded-full bg-white border-2 border-emerald-500 z-10" />
                    <div className="absolute top-full mt-2 text-center whitespace-nowrap">
                      <div className="text-[10px] text-zinc-500 font-mono">EBR</div>
                    </div>
                  </Motion.div>
                  
                  {/* Renewal/Upsell */}
                  <Motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 1.1 }}
                    className="flex flex-col items-center gap-2 relative shrink-0"
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-500 border-2 border-white z-10 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                      <div className="w-3 h-3 bg-white rounded-full relative z-10" />
                    </div>
                    <div className="absolute top-full mt-2 text-center whitespace-nowrap">
                      <div className="text-[10px] text-emerald-600 font-mono font-bold">RENEWAL</div>
                    </div>
                  </Motion.div>
                </div>
              </div>
            </div>
          </div>
        )
      }}
      content={{
        heroTitle: "Currículo de Customer Success para alta Conversão no ATS",
        heroSubtitle: "Destaque seu valor estratégico com métricas de NRR, renovação e expansão. Faça o ATS entender que você não é apenas suporte.",
        problemCards: [
          { title: "Confundido com Suporte", desc: "Escrever bullet points focados em responder e-mails ou fechar tickets (Zendesk) no lugar do gerenciamento pró-ativo de carteiras de clientes e revisões de negócios (EBRs)." },
          { title: "Ausência do Livro de Contas", desc: "Não esclarecer quantos clientes B2B (ou o valor da sua carteira ARR/MRR) você gerenciou simultaneamente, o que torna difícil avaliar sua capacidade." },
          { title: "Zero Expansão Financeira", desc: "Deixar de fora o quanto você gerou de upsell, cross-sell ou sua capacidade de prevenir churn (cancelamentos) nas empresas SaaS em que atuou." }
        ],
        filterChecklist: [
          { item: "Termos de Expansão (Upsell, Cross-sell, NRR, GRR) incluídos com números", checked: true },
          { item: "Valor da carteira de clientes (ARR Book of Business) especificado", checked: true },
          { item: "Metodologias de CS explícitas (EBR, QBR, Onboarding estratégico)", checked: true },
          { item: "Linguagem puramente reativa e passiva (Ex: 'atendi dúvidas')", checked: false },
          { item: "Não diferenciar entre B2B Enterprise e B2C transacional", checked: false }
        ],
        keywords: [
          { category: "Retenção & Receita", term: "NRR / GRR (Net/Gross Retention)" },
          { category: "Retenção & Receita", term: "Upsell / Cross-sell / Renewals" },
          { category: "Retenção & Receita", term: "Churn Reduction" },
          { category: "Estratégia & Processo", term: "QBR / EBR (Business Reviews)" },
          { category: "Estratégia & Processo", term: "Onboarding / Implementation" },
          { category: "Estratégia & Processo", term: "Customer Health Score / NPS" },
          { category: "Métricas de Experiência", term: "CSAT / CES" },
          { category: "Métricas de Experiência", term: "Time-to-Value (TTV)" },
          { category: "Métricas de Experiência", term: "Product Adoption" },
          { category: "Plataformas", term: "Gainsight / Totango / ChurnZero" },
          { category: "Plataformas", term: "Salesforce / HubSpot" }
        ],
        goodVsBad: {
          bad: "Gerenciei uma grande carteira de clientes da plataforma, resolvendo problemas, fazendo treinamentos de usabilidade e evitando que eles cancelassem.",
          good: "Gerenciou um 'Book of Business' de US$ 2.5M em ARR (B2B SaaS), conduzindo revisões executivas de negócios (EBRs) que resultaram em uma retenção líquida (NRR) de 112% e redução do churn para menos de 3% YoY."
        },
        specializations: [
          { title: "Enterprise CSM", desc: "Foco profundo no relacionamento estratégico (C-Level), projetos complexos de implementação e contas multimilionárias (High Touch).", tags: ["High Touch", "EBRs", "Enterprise B2B", "C-Level Alignment"] },
          { title: "Scale / Digital CSM", desc: "Destaque em táticas 'Tech Touch' ou 'Low Touch', gerenciando centenas de contas através de automação de marketing e fluxos 1-to-Many.", tags: ["Tech Touch", "Scale CS", "Automação", "1-to-Many"] },
          { title: "Onboarding / Implementação", desc: "Ênfase nas primeiras semanas do cliente, garantindo adoção, Time-to-Value (TTV) rápido e sucesso técnico do software.", tags: ["Time-to-Value", "Onboarding", "Gestão de Projetos"] },
          { title: "Suporte Técnico / Sucesso do Cliente", desc: "Foque em resolução rápida de problemas técnicos, SLAs rígidos e documentação da base de conhecimento.", tags: ["Suporte Nível 2/3", "SLAs de Atendimento", "Help Desk", "Zendesk/Jira"] }
        ],
        seniority: [
          { level: "Analista de CS / CSM Júnior", tips: ["Destaque a forte comunicação, treinamentos conduzidos e documentação de casos de uso e playbooks.", "Mostre capacidade de lidar rapidamente com implementações técnicas simples (Onboarding)."] },
          { level: "CSM Pleno / Sênior", tips: ["Foque no domínio de carteiras de milhões de dólares e mitigação de risco antecipada (Health Scores).", "Destaque colaborações profundas com Produto (coletar feedback) e Vendas (expansão)."] },
          { level: "Head de CS / Diretor", tips: ["Discuta o design da jornada do cliente, segmentação (High Touch vs Tech Touch) e implementação do Gainsight/Salesforce.", "Apresente as métricas globais da empresa: 'Escalou a retenção NRR de 90% para 120%'."] }
        ],
        roadmap: [
          { step: "Declare sua Carteira", detail: "Logo no início de cada experiência, escreva o número de clientes e o ARR gerenciado (Ex: 'Book of Business: 40 contas, US$ 2.5M')." },
          { step: "Venda a Retenção", detail: "O dinheiro do CS está em não perder receita. O ATS quer ver palavras como 'NRR' e 'Churn Mitigation' nas suas descrições." },
          { step: "Distancie-se do Suporte", detail: "Limite (ou elimine) referências a 'tickets' e 'SLA de resposta'. Troque por 'planejamento estratégico', 'Mapeamento de Sucesso' e 'Adoção'." },
          { step: "Formatado para Leitura Limpa", detail: "Evite colunas duplas e caixas de texto com o seu 'perfil empático'. Use uma estrutura tradicional com resultados concretos." }
        ],
        faq: [
          { q: "E se a minha empresa não usava o termo 'ARR' ou NRR?", a: "Adapte para o contexto comercial da sua empresa (Ticket Médio, Volume de Contratos Renovados, Valor de Carteira), mas certifique-se de mostrar uma métrica de Retenção Financeira clara." },
          { q: "Devo colocar as ferramentas de Suporte Técnico (Ex: Zendesk, Intercom)?", a: "Apenas como secundárias. É mais importante listar as ferramentas de CRM e Sucesso do Cliente (Salesforce, HubSpot, Gainsight) que validam que você faz um trabalho pró-ativo, não reativo." },
          { q: "CSM B2C vs B2B: Faz diferença?", a: "Total diferença. O processo B2B envolve contas muito mais caras e engajamento executivo, o que recruta as vagas mais altas. Se foi B2B, declare o B2B explicitamente." }
        ]
      }}
    />
  );
}



