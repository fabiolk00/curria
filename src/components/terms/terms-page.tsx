"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"

import Header from "@/components/landing/header"

type TermsSection = {
  id: string
  label: string
  content: ReactNode
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "aceitacao",
    label: "Aceitação dos Termos",
    content: (
      <>
        <p>
          Ao acessar ou utilizar a plataforma <strong>Trampofy</strong>, incluindo o site, a
          aplicação web e qualquer API associada, você declara ter lido, compreendido e
          concordado com estes Termos de Uso em sua totalidade. Se você estiver utilizando
          a plataforma em nome de uma empresa ou organização, declara ter autoridade para
          vincular tal entidade a estes termos.
        </p>
        <p>
          Caso não concorde com qualquer parte destes termos, você não está autorizado a
          utilizar os serviços da Trampofy. O uso continuado da plataforma após a publicação
          de alterações constitui aceitação das versões revisadas.
        </p>
      </>
    ),
  },
  {
    id: "servicos",
    label: "Descrição dos Serviços",
    content: (
      <>
        <p>
          A Trampofy é uma plataforma de inteligência artificial especializada na geração,
          otimização e adaptação de currículos profissionais. Os serviços incluem, mas não
          se limitam a:
        </p>
        <ul>
          <li>
            <strong>Geração de currículo por IA:</strong> criação de um currículo adaptado
            com base nas informações fornecidas pelo usuário e na descrição da vaga-alvo.
          </li>
          <li>
            <strong>Otimização ATS:</strong> ajuste automático do conteúdo para melhorar a
            compatibilidade com sistemas de triagem automatizada (Applicant Tracking Systems).
          </li>
          <li>
            <strong>Análise de aderência:</strong> pontuação e diagnóstico de lacunas entre
            o perfil do usuário e os requisitos da vaga.
          </li>
          <li>
            <strong>Exportação em PDF:</strong> geração de arquivo PDF formatado e pronto
            para envio a recrutadores.
          </li>
        </ul>
        <p>
          A Trampofy se reserva o direito de modificar, suspender ou descontinuar qualquer
          funcionalidade a qualquer momento, com ou sem aviso prévio, sem incorrer em
          responsabilidade perante o usuário.
        </p>
      </>
    ),
  },
  {
    id: "conta",
    label: "Conta e Acesso",
    content: (
      <>
        <p>
          Para utilizar determinados recursos da plataforma é necessário criar uma conta.
          Você é responsável por manter a confidencialidade de suas credenciais de acesso e
          por todas as atividades realizadas sob sua conta.
        </p>
        <p>
          Você concorda em: (i) fornecer informações verdadeiras, precisas e atualizadas no
          momento do cadastro; (ii) notificar imediatamente a Trampofy sobre qualquer uso
          não autorizado de sua conta; (iii) não compartilhar suas credenciais com terceiros.
        </p>
        <p>
          A Trampofy se reserva o direito de suspender ou encerrar contas que violem estes
          termos, apresentem atividade suspeita ou fraudulenta, ou que permaneçam inativas
          por período superior a 24 meses.
        </p>
      </>
    ),
  },
  {
    id: "creditos",
    label: "Créditos e Planos",
    content: (
      <>
        <p>
          A utilização dos serviços de geração e otimização de currículo consome créditos
          associados ao plano contratado pelo usuário. Cada operação de geração ou
          otimização consome um número específico de créditos, conforme indicado na
          interface da plataforma no momento da ação.
        </p>
        <p>
          Créditos adquiridos não são reembolsáveis, exceto nos casos previstos na Política
          de Reembolso vigente. Créditos não utilizados dentro do ciclo de faturamento do
          plano não são acumulados para o período seguinte, salvo previsão expressa no plano
          contratado.
        </p>
        <p>
          A Trampofy se reserva o direito de alterar preços, estrutura de planos e a
          quantidade de créditos associada a cada operação mediante notificação prévia de
          pelo menos 30 (trinta) dias.
        </p>
      </>
    ),
  },
  {
    id: "conteudo",
    label: "Conteúdo do Usuário",
    content: (
      <>
        <p>
          Ao utilizar a Trampofy, você poderá fornecer informações pessoais e profissionais
          (&quot;Conteúdo do Usuário&quot;) como dados de experiência, formação, habilidades e
          descrições de vagas. Você mantém a titularidade de todo o Conteúdo do Usuário que
          submeter à plataforma.
        </p>
        <p>
          Ao submeter seu conteúdo, você concede à Trampofy uma licença limitada, não
          exclusiva, isenta de royalties e revogável para processar, armazenar e utilizar
          esse conteúdo exclusivamente para a prestação dos serviços contratados, incluindo
          o treinamento e aprimoramento dos modelos de IA, sempre de forma anonimizada e
          agregada.
        </p>
        <p>
          Você declara e garante que possui todos os direitos necessários sobre o Conteúdo
          do Usuário e que seu uso pela Trampofy não violará direitos de terceiros nem
          legislação aplicável.
        </p>
      </>
    ),
  },
  {
    id: "privacidade",
    label: "Privacidade e Dados",
    content: (
      <>
        <p>
          O tratamento de dados pessoais pela Trampofy é regido pela nossa{" "}
          <Link href="/privacidade" className="font-medium text-link hover:underline">
            Política de Privacidade
          </Link>
          , incorporada a estes Termos por referência. Ao utilizar os serviços, você
          consente com a coleta, o uso e o tratamento de seus dados conforme descrito nessa
          política.
        </p>
        <p>
          A Trampofy adota medidas técnicas e organizacionais adequadas para proteger seus
          dados contra acesso não autorizado, alteração, divulgação ou destruição. Seus
          dados de currículo são criptografados em trânsito e em repouso.
        </p>
        <p>
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018),
          você pode a qualquer momento solicitar acesso, correção, portabilidade ou exclusão
          dos seus dados pessoais pelo canal{" "}
          <a href="mailto:privacidade@trampofy.com.br" className="font-medium text-link hover:underline">
            privacidade@trampofy.com.br
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "ia",
    label: "Uso da Inteligência Artificial",
    content: (
      <>
        <p>
          Os currículos e conteúdos gerados pela plataforma são produzidos por modelos de
          linguagem de grande escala (LLMs). A Trampofy não garante que o conteúdo gerado
          seja 100% preciso, livre de erros ou adequado para todas as finalidades. O usuário
          é o único responsável por revisar, validar e aprovar o conteúdo antes de utilizá-lo
          em processos seletivos.
        </p>
        <p>
          A Trampofy não se responsabiliza por decisões de contratação, resultados de
          processos seletivos ou quaisquer consequências decorrentes do uso do conteúdo
          gerado pela plataforma. A IA é uma ferramenta de apoio e não substitui o julgamento
          humano na avaliação de adequação profissional.
        </p>
        <p>
          É vedada a utilização da plataforma para gerar conteúdo falso, enganoso ou que
          atribua ao usuário qualificações, experiências ou credenciais que não possua.
        </p>
      </>
    ),
  },
  {
    id: "proibicoes",
    label: "Uso Aceitável",
    content: (
      <>
        <p>Você concorda em não utilizar a plataforma Trampofy para:</p>
        <ul>
          <li>Criar currículos com informações falsas, fraudulentas ou enganosas sobre qualificações, experiências ou identidade.</li>
          <li>Contornar, desativar ou interferir em mecanismos de segurança ou controle de acesso da plataforma.</li>
          <li>Realizar engenharia reversa, descompilar ou extrair o código-fonte de qualquer parte do serviço.</li>
          <li>Utilizar scripts automatizados, bots ou qualquer meio não humano para acessar ou interagir com a plataforma em escala.</li>
          <li>Revender, sublicenciar ou redistribuir o acesso à plataforma ou ao conteúdo gerado sem autorização prévia e expressa da Trampofy.</li>
          <li>Submeter conteúdo que viole direitos autorais, marcas registradas ou outros direitos de propriedade intelectual de terceiros.</li>
        </ul>
        <p>
          A violação destas regras pode resultar na suspensão ou encerramento imediato da
          conta, sem direito a reembolso de créditos remanescentes.
        </p>
      </>
    ),
  },
  {
    id: "propriedade",
    label: "Propriedade Intelectual",
    content: (
      <>
        <p>
          A plataforma Trampofy, incluindo seu código-fonte, design, marca, logotipos,
          modelos de IA, algoritmos e toda a documentação associada, é de propriedade
          exclusiva da Trampofy e está protegida pelas leis brasileiras e internacionais de
          propriedade intelectual.
        </p>
        <p>
          Estes termos não transferem ao usuário nenhum direito de propriedade sobre a
          plataforma ou seus componentes. É concedida apenas uma licença limitada, não
          exclusiva e intransferível para utilizar os serviços conforme descrito nestes
          termos.
        </p>
        <p>
          O conteúdo final do currículo gerado e aprovado pelo usuário é de sua propriedade,
          sujeito às restrições de uso descritas na seção &quot;Conteúdo do Usuário&quot;.
        </p>
      </>
    ),
  },
  {
    id: "limitacao",
    label: "Limitação de Responsabilidade",
    content: (
      <>
        <p>
          Na máxima extensão permitida pela legislação aplicável, a Trampofy não será
          responsável por quaisquer danos indiretos, incidentais, especiais, consequenciais
          ou punitivos, incluindo, sem limitação, perda de lucros, dados, oportunidades de
          emprego ou boa vontade, decorrentes do uso ou da incapacidade de usar os serviços.
        </p>
        <p>
          A responsabilidade total da Trampofy perante o usuário, decorrente de qualquer
          reclamação relacionada a estes termos ou ao uso da plataforma, não excederá o valor
          pago pelo usuário à Trampofy nos 3 (três) meses anteriores ao evento que deu origem
          à reclamação.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes",
    label: "Alterações nos Termos",
    content: (
      <>
        <p>
          A Trampofy pode revisar estes Termos de Uso periodicamente. Quando alterações
          relevantes forem feitas, o usuário será notificado por e-mail ou por aviso
          destacado na plataforma com antecedência mínima de 15 (quinze) dias antes da
          entrada em vigor das mudanças.
        </p>
        <p>
          A continuidade do uso da plataforma após a data de vigência das alterações
          constitui aceitação dos novos termos. Caso não concorde com as alterações, você
          deverá encerrar sua conta antes da data de vigência.
        </p>
      </>
    ),
  },
  {
    id: "lei",
    label: "Lei Aplicável e Foro",
    content: (
      <>
        <p>
          Estes Termos de Uso são regidos e interpretados de acordo com as leis da República
          Federativa do Brasil. Qualquer disputa decorrente ou relacionada a estes termos
          será submetida à jurisdição exclusiva do Foro da Comarca de São Paulo, Estado de
          São Paulo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
        </p>
        <p>
          Para questões relacionadas a estes termos ou aos serviços da Trampofy, entre em
          contato pelo e-mail{" "}
          <a href="mailto:juridico@trampofy.com.br" className="font-medium text-link hover:underline">
            juridico@trampofy.com.br
          </a>
          .
        </p>
      </>
    ),
  },
]

function formatCurrentMonthYear() {
  return new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })
}

export function TermsPage() {
  const [activeId, setActiveId] = useState(TERMS_SECTIONS[0].id)
  const lastUpdated = formatCurrentMonthYear()

  useEffect(() => {
    const visibilityMap = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap.set(entry.target.id, entry.intersectionRatio)
        })

        let mostVisibleId = TERMS_SECTIONS[0].id
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

    TERMS_SECTIONS.forEach((section) => {
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
            <nav aria-label="Seções dos Termos">
              <ul className="space-y-1">
                {TERMS_SECTIONS.map((section) => (
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
              Termos de Uso
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Ao criar uma conta na Trampofy você concorda em estar vinculado aos nossos
              Termos de Uso.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Última atualização: {lastUpdated}
            </p>

            <div className="mt-12 space-y-14">
              {TERMS_SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">{section.label}</h2>
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
