"use client";

import SEOPageTemplate from "@/components/landing/seo-pages/seo-page-template";
import { Building2, PieChart, TrendingDown } from "lucide-react";
import { motion as Motion } from "motion/react";

export default function FinancePage() {
  return (
    <SEOPageTemplate
      slug="curriculo-financeiro-ats"
      role="FinanÃ§as"
      theme={{
        accent: "bg-slate-700",
        bgAccent: "bg-slate-500/10",
        textAccent: "text-slate-600",
        badgeLabel: "Guia de currículo Financeiro",
        icon: <Building2 className="w-6 h-6 text-slate-600" />,
        heroVisual: (
          <div className="w-full h-full flex flex-col justify-end bg-white p-8 rounded-b-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-slate-500/10 blur-[100px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />
            
            <div className="w-full relative z-10 flex flex-col gap-8 h-full justify-center mt-4">
              <div className="flex justify-between items-end px-2">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">EBITDA Margin</div>
                  <div className="text-4xl font-mono font-bold text-[#0a0a0a] tracking-tighter">24.5%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-600 font-mono uppercase mb-1">OpEx Savings</div>
                  <div className="text-2xl font-mono text-emerald-600 font-bold">-$2.4M</div>
                </div>
              </div>

              {/* Glowing Bar Chart Area */}
              <div className="w-full h-[120px] relative flex items-end justify-between px-2 z-10">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between opacity-30 pointer-events-none pb-0 pt-4 -z-10">
                  <div className="w-full h-[1px] bg-slate-200" />
                  <div className="w-full h-[1px] bg-slate-200" />
                  <div className="w-full h-[1px] bg-slate-200" />
                  <div className="w-full h-[1px] bg-slate-200" />
                </div>

                {/* Bars */}
                <Motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '24px', opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.1, type: "spring", bounce: 0.4 }}
                  className="w-8 sm:w-10 shrink-0 bg-gradient-to-t from-slate-200 to-slate-300 rounded-t-sm origin-bottom" 
                />
                <Motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '42px', opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
                  className="w-8 sm:w-10 shrink-0 bg-gradient-to-t from-slate-200 to-slate-300 rounded-t-sm origin-bottom" 
                />
                <Motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '30px', opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3, type: "spring", bounce: 0.4 }}
                  className="w-8 sm:w-10 shrink-0 bg-gradient-to-t from-slate-200 to-slate-300 rounded-t-sm origin-bottom" 
                />
                <Motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '78px', opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.4, type: "spring", bounce: 0.4 }}
                  className="w-8 sm:w-10 shrink-0 bg-gradient-to-t from-slate-300 to-slate-400 rounded-t-sm origin-bottom" 
                />
                <Motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '108px', opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5, type: "spring", bounce: 0.4 }}
                  className="w-8 sm:w-10 shrink-0 bg-gradient-to-t from-emerald-100 to-emerald-400 rounded-t-sm shadow-[0_0_12px_rgba(52,211,153,0.2)] border-t border-emerald-400 relative origin-bottom"
                >
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-t-sm animate-pulse" />
                </Motion.div>
              </div>
              
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono px-2 border-t border-zinc-200 pt-3 mt-1 relative z-10">
                <span className="w-8 sm:w-10 shrink-0 text-center">Q1</span>
                <span className="w-8 sm:w-10 shrink-0 text-center">Q2</span>
                <span className="w-8 sm:w-10 shrink-0 text-center">Q3</span>
                <span className="w-8 sm:w-10 shrink-0 text-center">Q4</span>
                <span className="w-8 sm:w-10 shrink-0 text-center text-emerald-600 font-bold">FY25</span>
              </div>
            </div>
          </div>
        )
      }}
      content={{
        heroTitle: "O Currículo Financeiro perfeito para o ATS",
        heroSubtitle: "Traduza suas planilhas em impacto real. Destaque suas habilidades de FP&A, modelagem e reduÃ§Ã£o de custos no formato que os recrutadores buscam.",
        problemCards: [
          { title: "Planilhas NÃ£o Lidas", desc: "Listar 'Excel AvanÃ§ado' repetidamente sem mencionar modelagem de 3-statements, macros ou automaÃ§Ã£o que salvaram dias de trabalho." },
          { title: "Foco Operacional", desc: "Descrever o fechamento contÃ¡bil mensal de forma robÃ³tica sem focar em como sua anÃ¡lise evitou riscos ou gerou oportunidades financeiras." },
          { title: "ERP e Sistemas Ocultos", desc: "Omitir sistemas cruciais como SAP, Oracle ou NetSuite, que os recrutadores configuram o ATS para classificar como eliminatÃ³rios se ausentes." }
        ],
        filterChecklist: [
          { item: "DomÃ­nio de ERPs listados com o mÃ³dulo especÃ­fico (ex: SAP FICO)", checked: true },
          { item: "Economias geradas (Cost Savings) quantificadas em dÃ³lares/reais", checked: true },
          { item: "Tipos de relatÃ³rios gerados explicitamente (DRE, Fluxo de Caixa, BalanÃ§o)", checked: true },
          { item: "Ocultar a escala/faturamento da empresa em que vocÃª trabalhou", checked: false },
          { item: "Layouts complexos e tabelas de habilidades financeiras (quebram o parser)", checked: false }
        ],
        keywords: [
          { category: "Modelagem & AnÃ¡lise", term: "FP&A / Financial Modeling" },
          { category: "Modelagem & AnÃ¡lise", term: "Variance Analysis / Forecasting" },
          { category: "Modelagem & AnÃ¡lise", term: "Valuation / M&A / Due Diligence" },
          { category: "Contabilidade & Report", term: "US GAAP / IFRS / CPC" },
          { category: "Contabilidade & Report", term: "Month-End Close / Reconciliation" },
          { category: "Contabilidade & Report", term: "Audit / Compliance / SOX" },
          { category: "OperaÃ§Ãµes & Caixa", term: "Cash Flow Management" },
          { category: "OperaÃ§Ãµes & Caixa", term: "Working Capital" },
          { category: "OperaÃ§Ãµes & Caixa", term: "Risk Management" },
          { category: "Ferramentas & ERP", term: "Excel (VBA, Power Query)" },
          { category: "Ferramentas & ERP", term: "SAP / Oracle / NetSuite" }
        ],
        goodVsBad: {
          bad: "ResponsÃ¡vel pelo orÃ§amento, planilhas financeiras e por analisar onde a empresa gastava muito dinheiro.",
          good: "Desenvolveu um modelo de forecasting (FP&A) para despesas operacionais (OpEx) com 98% de precisÃ£o, suportando a tomada de decisÃ£o da diretoria (C-Level) e reduzindo o desvio orÃ§amentÃ¡rio em 15% YoY."
        },
        specializations: [
          { title: "FP&A (Planejamento)", desc: "Foco profundo em orÃ§amentaÃ§Ã£o (Budgeting), forecasting, modelagem financeira complexa e anÃ¡lise de P&L.", tags: ["Forecasting", "Modelagem", "P&L", "Power BI"] },
          { title: "Controladoria Corporativa", desc: "Destaque em reconciliaÃ§Ã£o, relatÃ³rios estatutÃ¡rios, auditorias externas, compliance (SOX) e impostos.", tags: ["US GAAP", "IFRS", "Month-End Close", "Auditoria"] },
          { title: "Corporate Finance / M&A", desc: "ÃŠnfase em valuation, due diligence, levantamento de capital, alocaÃ§Ã£o de recursos e estratÃ©gia de investimentos.", tags: ["Valuation", "Due Diligence", "FusÃµes e AquisiÃ§Ãµes"] },
          { title: "Tesouraria (Treasury)", desc: "Concentre-se em gestÃ£o de caixa e liquidez, relaÃ§Ãµes bancÃ¡rias, gestÃ£o de riscos cambiais e polÃ­ticas de crÃ©dito.", tags: ["Fluxo de Caixa", "CÃ¢mbio/FX", "Capital de Giro", "Risco de CrÃ©dito"] }
        ],
        seniority: [
          { level: "Analista Financeiro", tips: ["Destaque a proficiÃªncia avanÃ§ada em Excel (Ãndice-Corresp, Power Pivot, Macros) e na operaÃ§Ã£o do ERP.", "Mostre capacidade de lidar com altos volumes de dados de forma independente e sem erros."] },
          { level: "Coordenador / Controller", tips: ["Foque na automaÃ§Ã£o de processos, melhorias no controle interno e reduÃ§Ã£o do tempo de fechamento.", "Destaque a colaboraÃ§Ã£o interfuncional com lÃ­deres nÃ£o financeiros para ajustar orÃ§amentos."] },
          { level: "Diretor / CFO", tips: ["Discuta relacionamento com investidores, fusÃµes e aquisiÃ§Ãµes (M&A) e gestÃ£o de capital.", "Apresente o impacto de suas estratÃ©gias de alocaÃ§Ã£o de recursos no EBITDA corporativo."] }
        ],
        roadmap: [
          { step: "Declare seus Sistemas", detail: "O ATS recusa candidatos seniores sem os ERPs corretos. Certifique-se de listar as ferramentas contÃ¡beis exatas." },
          { step: "Exiba os MilhÃµes", detail: "A linguagem financeira sÃ£o os nÃºmeros. Se vocÃª ajudou em uma rodada de SÃ©rie B, informe o valor (US$ 30M)." },
          { step: "Remova JargÃµes Vazios", detail: "LÃ­deres de finanÃ§as nÃ£o gostam de excesso criativo. Seja conciso e use marcadores orientados a resultados." },
          { step: "Garanta a FormataÃ§Ã£o Linear", detail: "Muitos analistas tentam colocar o currÃ­culo em tabelas de Excel. Converta para um PDF limpo, de coluna Ãºnica, em A4." }
        ],
        faq: [
          { q: "Devo incluir certificaÃ§Ãµes como CFA, CPA ou CGA?", a: "Absolutamente, sim. Adicione a certificaÃ§Ã£o no topo (logo ao lado do seu nome ou abaixo do tÃ­tulo) e em uma seÃ§Ã£o de EducaÃ§Ã£o dedicada, pois o ATS buscarÃ¡ essas siglas." },
          { q: "O nÃ­vel de detalhe contÃ¡bil importa?", a: "Sim, especialmente para Controladoria. O recrutador pode nÃ£o entender de 'US GAAP' vs 'IFRS', mas o sistema estÃ¡ programado para verificar a conformidade regulatÃ³ria especÃ­fica." },
          { q: "Como colocar projetos confidenciais?", a: "Especifique a indÃºstria e o valor sem o nome: 'Conduziu a due diligence financeira para uma aquisiÃ§Ã£o de US$ 25M de uma startup de logÃ­stica SaaS (Confidencial).'" }
        ]
      }}
    />
  );
}



