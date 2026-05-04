"use client"

import { useEffect, useState, type ReactNode } from "react"

import Header from "@/components/landing/header"

type PrivacySection = {
  id: string
  label: string
  content: ReactNode
}

const lastUpdated = "04/05/2026"

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: "introducao",
    label: "Introdução",
    content: (
      <p>
        A Trampofy (&quot;nós&quot;, &quot;nosso&quot; ou &quot;empresa&quot;) opera a plataforma
        Trampofy (o &quot;Serviço&quot;). Esta página informa nossas políticas em relação
        à coleta, uso e divulgação de dados pessoais quando você usa nosso Serviço,
        bem como as opções associadas a esses dados.
      </p>
    ),
  },
  {
    id: "coleta",
    label: "Coleta e Uso",
    content: (
      <>
        <p>
          Coletamos diferentes tipos de informações para fornecer, operar, proteger e
          melhorar nosso Serviço.
        </p>
        <p className="font-semibold text-foreground">Tipos de dados coletados</p>
        <ul>
          <li>Dados pessoais, como nome, endereço de e-mail e número de telefone.</li>
          <li>Informações de perfil profissional e currículo.</li>
          <li>Dados de uso, navegação e análise.</li>
          <li>Informações de cookies e tecnologias similares.</li>
        </ul>
      </>
    ),
  },
  {
    id: "seguranca",
    label: "Segurança da Informação",
    content: (
      <p>
        A segurança dos seus dados pessoais é importante para nós. Ainda assim, nenhum
        método de transmissão pela Internet ou armazenamento eletrônico é 100% seguro.
        Embora adotemos meios comercialmente aceitáveis para proteger seus dados pessoais,
        não podemos garantir segurança absoluta.
      </p>
    ),
  },
  {
    id: "cookies",
    label: "Cookies",
    content: (
      <p>
        Usamos cookies e tecnologias similares para acompanhar atividades em nosso
        Serviço e manter determinadas informações. Você pode instruir seu navegador a
        recusar cookies ou indicar quando um cookie está sendo enviado. No entanto, se
        você não aceitar cookies, talvez não consiga usar algumas partes do Serviço.
      </p>
    ),
  },
  {
    id: "compartilhamento",
    label: "Compartilhamento de Dados",
    content: (
      <p>
        Não vendemos seus dados pessoais. Podemos compartilhar informações com terceiros
        confiáveis que nos ajudam a operar o site, prestar o Serviço, processar pagamentos,
        manter infraestrutura, analisar uso ou cumprir obrigações legais, desde que essas
        partes tratem as informações de forma confidencial e compatível com a legislação
        aplicável.
      </p>
    ),
  },
  {
    id: "direitos",
    label: "Seus Direitos",
    content: (
      <p>
        Você pode solicitar acesso, correção, atualização, portabilidade ou exclusão de
        seus dados pessoais, conforme aplicável. Para exercer esses direitos, entre em
        contato conosco pelos canais indicados abaixo.
      </p>
    ),
  },
  {
    id: "alteracoes",
    label: "Alterações da Política",
    content: (
      <p>
        Podemos atualizar esta Política de Privacidade periodicamente. Quando isso
        acontecer, publicaremos a nova versão nesta página e atualizaremos a data de
        &quot;Última atualização&quot; no topo do documento.
      </p>
    ),
  },
  {
    id: "contato",
    label: "Entre em Contato",
    content: (
      <p>
        Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato em{" "}
        <a href="mailto:support@trampofy.com.br" className="font-medium text-link hover:underline">
          support@trampofy.com.br
        </a>
        .
      </p>
    ),
  },
]

export function PrivacyPage() {
  const [activeId, setActiveId] = useState(PRIVACY_SECTIONS[0].id)

  useEffect(() => {
    const visibilityMap = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap.set(entry.target.id, entry.intersectionRatio)
        })

        let mostVisibleId = PRIVACY_SECTIONS[0].id
        let mostVisibleRatio = -1

        visibilityMap.forEach((ratio, id) => {
          if (ratio > mostVisibleRatio) {
            mostVisibleRatio = ratio
            mostVisibleId = id
          }
        })

        if (mostVisibleRatio > 0) {
          setActiveId(mostVisibleId)
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )

    PRIVACY_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id)

      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="flex pt-24 sm:pt-28">
        <aside className="hidden w-56 shrink-0 md:block lg:w-64">
          <div className="sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto border-r border-border px-5 py-10">
            <nav aria-label="Seções da Política de Privacidade">
              <ul className="space-y-1">
                {PRIVACY_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={() => setActiveId(section.id)}
                      className={
                        activeId === section.id
                          ? "block rounded-sm bg-muted px-2 py-1.5 text-sm font-semibold text-foreground transition-colors"
                          : "block rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      }
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-2xl px-4 py-10 sm:px-10 sm:py-16">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Política de Privacidade
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Entenda como a Trampofy coleta, usa, protege e compartilha dados pessoais na
              prestação dos nossos serviços.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Última atualização: {lastUpdated}
            </p>

            <div className="mt-12 space-y-14">
              {PRIVACY_SECTIONS.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {index + 1}. {section.label}
                  </h2>
                  <div className="space-y-4 text-sm leading-relaxed text-foreground/80 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-16 border-t border-border pt-8">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} Trampofy. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
