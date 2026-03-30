import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Search,
  Shield,
  Sparkles,
  Target,
  Upload,
  XCircle,
  Zap,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const workflow = [
  {
    icon: FileText,
    title: "1. A empresa define o filtro",
    description:
      "A vaga e carregada no ATS com palavras-chave, senioridade, habilidades obrigatorias e requisitos minimos.",
  },
  {
    icon: Upload,
    title: "2. O curriculo entra na fila",
    description:
      "Seu PDF ou DOCX e enviado pelo portal da empresa e vira a primeira camada de triagem automatica.",
  },
  {
    icon: Search,
    title: "3. O sistema faz parsing",
    description:
      "O ATS tenta entender secoes, cargos, datas, tecnologias e experiencias. Layout confuso reduz a leitura.",
  },
  {
    icon: BarChart3,
    title: "4. O score e calculado",
    description:
      "O sistema compara seu conteudo com a vaga e prioriza os perfis que parecem ter melhor aderencia.",
  },
]

const signals = [
  "Palavras-chave iguais ou muito proximas da descricao da vaga.",
  "Titulos de secao claros como Experiencia, Educacao e Skills.",
  "Formato simples, texto selecionavel e sem grafismos que atrapalham o parsing.",
  "Historico profissional com contexto, impacto e tecnologias nomeadas com clareza.",
]

const risks = [
  "Enviar o mesmo curriculo generico para toda vaga.",
  "Usar tabelas, colunas demais ou elementos visuais que escondem o texto.",
  "Trocar nomes padrao de secoes por titulos criativos que o ATS nao reconhece.",
  "Ignorar requisitos obrigatorios e deixar palavras-chave importantes de fora.",
]

export const metadata = {
  title: "O que e ATS - CurrIA",
  description: "Aprenda como funciona a triagem automatica de curriculos e como melhorar seu match",
}

export default function WhatIsAtsPage() {
  return (
    <div className="relative overflow-hidden px-4 py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.16),transparent_62%)]" />
      <div className="pointer-events-none absolute left-0 top-32 h-64 w-64 bg-[radial-gradient(circle,oklch(var(--chart-2)/0.1),transparent_65%)] blur-3xl" />

      <div className="relative space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/90 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.15fr)_380px] lg:px-8">
            <div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
                Guia rapido ATS
              </Badge>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight lg:text-5xl">
                Entenda o filtro que decide se seu curriculo sera lido por alguem.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                ATS significa Applicant Tracking System. Na pratica, e o software que recebe curriculos, extrai o texto, compara com a vaga e prioriza quem parece mais aderente antes do olhar humano.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link href="/dashboard">
                    Testar no meu curriculo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/pricing">Ver planos</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[1.75rem] border border-border/60 bg-background/75 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold">Triagem automatica</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Empresas grandes usam ATS para organizar milhares de candidaturas e acelerar a selecao.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/60 bg-background/75 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <XCircle className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold">Eliminacao silenciosa</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Um curriculo forte pode ser descartado cedo se o parser nao entender a estrutura ou o vocabulario.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/60 bg-background/75 p-5 sm:col-span-2 lg:col-span-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold">Ajuste com intencao</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  O melhor caminho nao e encher o curriculo de buzzwords, e alinhar linguagem, clareza e relevancia com a vaga certa.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
            <CardHeader className="pt-8">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Como o ATS funciona
              </CardTitle>
              <CardDescription>
                O processo e menos misterioso quando voce enxerga cada etapa da triagem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              {workflow.map((step) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-[1.5rem] border border-border/60 bg-background/75 p-4"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
              <CardHeader className="pt-8">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  O que aumenta seu match
                </CardTitle>
                <CardDescription>
                  Os sinais abaixo ajudam o ATS a entender rapido que seu perfil conversa com a vaga.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-8">
                {signals.map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.25rem] border border-border/60 bg-background/75 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
              <CardHeader className="pt-8">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  O que derruba curriculos
                </CardTitle>
                <CardDescription>
                  Nao e so sobre experiencia. Estrutura e linguagem fazem muita diferenca.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-8">
                {risks.map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.25rem] border border-border/60 bg-background/75 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,oklch(var(--primary)/0.08),oklch(var(--chart-2)/0.08))] shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
            <div>
              <h2 className="text-2xl font-black tracking-tight lg:text-3xl">
                Como o CurrIA transforma essa leitura em vantagem pratica
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                Em vez de tentar adivinhar o que falta, voce compara seu curriculo com a vaga, identifica gaps, recebe sugestoes acionaveis e gera uma versao mais competitiva sem perder autenticidade.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-4">
                  <p className="text-sm font-semibold">Analise orientada por vaga</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A IA procura termos, lacunas e pontos fracos que reduzem seu score.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-4">
                  <p className="text-sm font-semibold">Reescrita com contexto</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O texto fica mais alinhado ao mercado sem soar generico ou artificial.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[1.75rem] border border-border/60 bg-background/80 p-5">
              <div>
                <p className="text-sm font-semibold">Proximo passo recomendado</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Abra o workspace, cole a vaga desejada e envie seu curriculo para descobrir onde o ATS esta travando sua candidatura.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <Button asChild className="w-full rounded-full">
                  <Link href="/dashboard">Analisar meu curriculo</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link href="/resumes">Ver minhas sessoes</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
