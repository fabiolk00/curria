"use client";

import SEOPageTemplate from "@/components/landing/seo-pages/seo-page-template";
import { Code2 } from "lucide-react";

export default function DeveloperPage() {
  return (
    <SEOPageTemplate
      slug="curriculo-desenvolvedor-ats"
      role="Desenvolvedor de Software"
      theme={{
        accent: "bg-blue-600",
        bgAccent: "bg-blue-500/10",
        textAccent: "text-blue-600",
        badgeLabel: "Guia de Currículo para Devs",
        icon: <Code2 className="w-6 h-6 text-blue-600" />,
        heroVisual: (
          <div className="w-full h-full p-8 font-mono text-[13px] leading-relaxed flex flex-col justify-center bg-white text-zinc-700 rounded-b-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex gap-4 mb-6 opacity-80">
              <div className="flex flex-col items-end text-zinc-400 select-none border-r border-zinc-200 pr-4">
                <span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span><span>07</span><span>08</span>
              </div>
              <div className="flex-1 relative">
                <div className="absolute right-0 top-0 w-32 h-24 bg-blue-50 border border-blue-200 rounded flex flex-col p-2 shadow-sm">
                  <span className="text-[9px] text-blue-600/80 mb-1 font-bold">ATS PARSE TREE</span>
                  <div className="flex-1 border-l border-b border-blue-200 ml-2 mb-2 relative">
                    <div className="absolute right-2 top-2 w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="absolute right-6 bottom-1 w-2 h-2 bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <div className="text-zinc-500 mb-2">{'/* Otimiza��o de Score ATS */'}</div>
                <div><span className="text-pink-600">import</span> {'{ '}<span className="text-blue-600">Scanner</span>{' }'} <span className="text-pink-600">from</span> <span className="text-emerald-600">&apos;@curria/ats&apos;</span>;</div>
                <br/>
                <div><span className="text-pink-600">const</span> <span className="text-[#0a0a0a]">resume</span> <span className="text-pink-600">=</span> <span className="text-pink-600">await</span> <span className="text-blue-600">Scanner</span>.<span className="text-blue-500">analyze</span>();</div>
                <br/>
                <div><span className="text-pink-600">if</span> (<span className="text-[#0a0a0a]">resume</span>.<span className="text-blue-500">score</span> <span className="text-pink-600">&gt;</span> <span className="text-orange-500">95</span>) {'{'}</div>
                <div className="pl-4"><span className="text-blue-600">console</span>.<span className="text-blue-500">log</span>(<span className="text-emerald-600">&apos;? Entrevista Garantida&apos;</span>);</div>
                <div>{'}'}</div>
              </div>
            </div>
            
            <div className="mt-auto border-t border-zinc-200 pt-4 bg-zinc-50 -mx-8 -mb-8 px-8 pb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-emerald-600 font-bold tracking-wide">STATUS: APROVADO</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                   <div className="w-[98%] h-full bg-emerald-500" />
                </div>
                <div className="text-zinc-600 font-bold text-xs">98/100</div>
              </div>
            </div>
          </div>
        )
      }}
      content={{
        heroTitle: "Currículo de Desenvolvedor otimizado para ATS",
        heroSubtitle: "Pare de ser rejeitado por algoritmos. Formate sua stack e impacto da maneira exata que os parsers e recrutadores buscam.",
        problemCards: [
          { title: "Stack Tecnológica Oculta", desc: "Se você esconder sua stack em parágrafos densos, o parser falha em associar a habilidade aos seus anos de experiência." },
          { title: "Impacto de Engenharia Vago", desc: "'Escrevi código para o backend' não traduz para uma vaga sênior. Você precisa de métricas exatas de latência, escala e performance." },
          { title: "Links do GitHub Ignorados", desc: "Muitos sistemas ATS não conseguem seguir URLs. Se suas conquistas vivem apenas nos seus repositórios, elas não existem para o ATS." }
        ],
        filterChecklist: [
          { item: "Fontes padrão sem kerning customizado", checked: true },
          { item: "Experiência cronológica lida com sucesso", checked: true },
          { item: "Match exato para linguagens requeridas (ex: 'Node.js' vs 'Node')", checked: true },
          { item: "Layouts complexos de tabelas para habilidades", checked: false },
          { item: "Gráficos SVG de progresso ou pizza", checked: false }
        ],
        keywords: [
          { category: "Linguagens", term: "JavaScript / TypeScript" },
          { category: "Linguagens", term: "Python / Go / Rust" },
          { category: "Linguagens", term: "Java / C#" },
          { category: "Frameworks", term: "React / Next.js" },
          { category: "Frameworks", term: "Spring Boot" },
          { category: "Frameworks", term: "Node.js / NestJS" },
          { category: "Infraestrutura", term: "Docker / Kubernetes" },
          { category: "Infraestrutura", term: "AWS / GCP / Azure" },
          { category: "Infraestrutura", term: "CI/CD (Actions/GitLab)" },
          { category: "Arquitetura & BD", term: "Microserviços / APIs REST" },
          { category: "Arquitetura & BD", term: "PostgreSQL / MongoDB" },
          { category: "Arquitetura & BD", term: "Redis / Kafka" },
        ],
        goodVsBad: {
          bad: "Responsável por melhorar o banco de dados e deixar a aplicação mais rápida.",
          good: "Arquitetou uma camada de cache distribuída em Redis, reduzindo a carga no banco de dados em 40% e melhorando o tempo de resposta da API de 800ms para 120ms em mais de 2 milhões de requisições diárias."
        },
        specializations: [
          { title: "Engenharia Frontend", desc: "Foque fortemente em performance de renderização, gerenciamento de estado e arquitetura moderna de componentes.", tags: ["React", "Gerenciamento de Estado", "Web Vitals", "Acessibilidade (A11y)"] },
          { title: "Arquitetura Backend", desc: "Enfatize design de sistemas, otimização de banco de dados, cache e microsserviços.", tags: ["Microsserviços", "System Design", "SQL/NoSQL", "APIs GraphQL/REST"] },
          { title: "DevOps / SRE", desc: "Destaque automação, eficiência de pipelines, infraestrutura em nuvem e uptime.", tags: ["Terraform", "Kubernetes", "Pipelines CI/CD", "Monitoramento"] },
          { title: "Mobile / iOS & Android", desc: "Concentre-se em design responsivo, gerenciamento de estado nativo, publicação em lojas de apps e performance mobile.", tags: ["React Native", "Swift/Kotlin", "App Store/Play Store", "Performance Mobile"] }
        ],
        seniority: [
          { level: "Desenvolvedor Júnior", tips: ["Destaque projetos pessoais e as stacks de tecnologia exatas utilizadas.", "Foque na agilidade de aprendizado, trabalho em equipe e code reviews.", "Não exagere nas suas habilidades; seja honesto sobre seus fundamentos."] },
          { level: "Desenvolvedor Pleno", tips: ["Mostre propriedade sobre features inteiras, do design ao deploy.", "Quantifique as melhorias de performance e redução de bugs.", "Mencione a mentoria de juniores ou a liderança de pequenas sprints ágeis."] },
          { level: "Engenheiro Sênior / Staff", tips: ["Foque em arquitetura de sistemas, escalabilidade e padrões de engenharia.", "Mostre impacto de negócios (ex: reduziu os custos de nuvem em 30%).", "Destaque a liderança interfuncional e o planejamento de roadmap."] }
        ],
        roadmap: [
          { step: "Audite Sua Stack", detail: "Extraia cada linguagem, framework e ferramenta que você conhece. Categorize-os claramente no topo." },
          { step: "Alinhe com a Vaga", detail: "Modifique seus bullet points para apresentar proeminentemente as palavras-chave exatas que o empregador busca." },
          { step: "Quantifique o Código", detail: "Adicione números reais: linhas de código refatoradas, latência reduzida, usuários suportados ou custos economizados." },
          { step: "Formate para a Máquina", detail: "Remova colunas, tabelas complexas e gráficos. Atenha-se a uma coluna única e parsing padrão de PDF." }
        ],
        faq: [
          { q: "Devo incluir um link para o meu GitHub?", a: "Sim, sempre inclua seu GitHub e LinkedIn na seção de contato. Embora o ATS possa não ler seus repositórios, os recrutadores humanos que aprovarem você certamente o farão." },
          { q: "O ATS lê trechos de código se eu os colocar?", a: "Não coloque trechos de código no seu currículo. Isso confundirá o parser e parecerá bagunçado. Atenha-se a explicar a arquitetura e o impacto nos negócios em texto simples." },
          { q: "E se eu conhecer um framework mas ele não estiver listado na vaga?", a: "Liste-o na sua seção dedicada de 'Habilidades', mas priorize a stack de tecnologia exigida nos bullet points reais de experiência para garantir uma alta taxa de correspondência." }
        ]
      }}
    />
  );
}





