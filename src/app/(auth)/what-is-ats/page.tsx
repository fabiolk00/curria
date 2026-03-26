import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  FileText,
  Upload,
  Search,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Target,
  Shield,
  Sparkles,
} from "lucide-react"

export default function WhatIsAtsPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">O que é ATS?</h1>
        <p className="text-lg text-muted-foreground">
          Entenda como funcionam os sistemas que filtram currículos antes de chegarem ao recrutador
        </p>
      </div>

      <Separator />

      {/* Section 1 — O que é ATS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            O que é um ATS e por que ele importa?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            <strong>ATS (Applicant Tracking System)</strong> é um software usado por mais de 95% das grandes empresas
            para automaticamente filtrar e classificar currículos antes que um recrutador humano os veja.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            O problema? A maioria dos candidatos não sabe que seu currículo está sendo avaliado por um robô.
            Currículos perfeitamente qualificados são eliminados todos os dias simplesmente porque não foram
            otimizados para passar pelo ATS.
          </p>
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Cerca de 75% dos currículos são rejeitados automaticamente pelo ATS antes de chegarem a um recrutador.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Como funciona */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Como o ATS funciona — Passo a Passo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">1. Empresa configura critérios</h3>
                <p className="text-sm text-muted-foreground">
                  A empresa cria a vaga e define palavras-chave, habilidades obrigatórias e critérios de filtro no ATS.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">2. Candidato envia currículo</h3>
                <p className="text-sm text-muted-foreground">
                  Você envia seu currículo através do portal de vagas da empresa.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Search className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">3. ATS faz parsing do currículo</h3>
                <p className="text-sm text-muted-foreground">
                  O sistema extrai o texto, identifica seções (Experiência, Formação, Habilidades) e estrutura os dados.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">4. Sistema calcula compatibilidade</h3>
                <p className="text-sm text-muted-foreground">
                  O ATS compara as palavras-chave do seu currículo com os requisitos da vaga e calcula um score.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">5. Currículos são ranqueados</h3>
                <p className="text-sm text-muted-foreground">
                  Scores altos vão para o recrutador. Scores baixos são arquivados automaticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">6. Decisão automática</h3>
                <p className="text-sm text-muted-foreground">
                  Apenas os candidatos no topo da lista recebem entrevistas. Os demais nunca são vistos.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — O que o ATS procura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            O que o ATS procura no seu currículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <strong>Palavras-chave e habilidades:</strong> O sistema busca palavras e frases exatas da descrição da vaga.
                Se a vaga pede &quot;React&quot; e você escreveu &quot;ReactJS&quot;, pode não contar.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <strong>Formatação simples:</strong> Layouts complexos, tabelas e colunas múltiplas confundem o parser.
                Currículos simples têm parsing mais preciso.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <strong>Formato de arquivo:</strong> .docx e .pdf são os mais seguros. PDFs escaneados ou imagens são
                problemáticos porque o ATS não consegue extrair o texto.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <strong>Títulos de seção padrão:</strong> Use &quot;Experiência Profissional&quot;, &quot;Formação Acadêmica&quot;, &quot;Habilidades&quot;.
                Nomes criativos como &quot;Minha Jornada&quot; confundem o sistema.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <strong>Score de relevância:</strong> O ATS calcula a porcentagem de match entre seu currículo e a vaga.
                Quanto maior o match, maior a chance de ser visto por um humano.
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 4 — Erros comuns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            Erros comuns que eliminam currículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Usar títulos de seção criativos ou não-padronizados (&quot;Sobre Mim&quot;, &quot;Minhas Skills&quot;, &quot;Histórico&quot;)
              </div>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Colocar informações importantes em imagens, gráficos ou elementos visuais que o ATS não consegue ler
              </div>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Usar layouts com tabelas ou múltiplas colunas que confundem o parser
              </div>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Não incluir palavras-chave da descrição da vaga — se a vaga menciona &quot;Python&quot;, seu currículo deve mencionar também
              </div>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Enviar o mesmo currículo genérico para todas as vagas sem adaptá-lo para cada oportunidade
              </div>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Usar formatos de arquivo incompatíveis (.pages, .odt) ou PDFs escaneados onde o texto não é selecionável
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 5 — Como o ATS Expert ajuda */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Como o ATS Expert te ajuda a vencer
          </CardTitle>
          <CardDescription>
            Nossa IA analisa e otimiza seu currículo especificamente para a vaga que você quer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                1
              </div>
              <div>
                <strong>Análise da descrição da vaga:</strong> Cole a descrição e identificamos automaticamente todas as
                palavras-chave, habilidades obrigatórias e requisitos que o ATS vai buscar.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                2
              </div>
              <div>
                <strong>Score ATS em tempo real:</strong> Calculamos seu score de compatibilidade atual e mostramos exatamente
                quais palavras-chave estão faltando.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                3
              </div>
              <div>
                <strong>Otimização inteligente:</strong> Sugerimos como incluir naturalmente as palavras-chave que faltam,
                sem soar forçado ou genérico.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                4
              </div>
              <div>
                <strong>Comparação antes/depois:</strong> Veja a diferença entre seu currículo original e a versão otimizada,
                com o aumento no score ATS.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                5
              </div>
              <div>
                <strong>Arquivo pronto para enviar:</strong> Geramos um .docx e .pdf otimizados, formatados de forma simples
                para garantir parsing perfeito pelo ATS.
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 6 — CTA */}
      <Card className="border-primary">
        <CardContent className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Pronto para vencer o ATS?</h2>
            <p className="text-muted-foreground max-w-2xl">
              Deixe nossa IA analisar e otimizar seu currículo para a vaga dos seus sonhos.
              Aumente suas chances de ser chamado para a entrevista.
            </p>
          </div>
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/dashboard">
              Começar agora
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
