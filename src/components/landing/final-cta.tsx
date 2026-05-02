import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function FinalCta() {
  return (
    <section className="py-24 bg-card border-y border-border/50 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, black 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="dark:absolute dark:inset-0 dark:opacity-[0.03] dark:pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-extrabold text-balance max-w-3xl mx-auto leading-tight">
          Descubra o que está travando seu currículo agora.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 block mt-2">
            E comece a conseguir mais entrevistas.
          </span>
        </h2>
        <div className="mt-12">
          <Button
            asChild
            size="lg"
            className="text-lg gap-3 h-14 px-8 font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            <Link href="/criar-conta">
              Analisar meu currículo grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          Sem cartão de crédito. 1 análise grátis incluída.
        </p>
      </div>
    </section>
  )
}
