import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { FloatingDecorations } from "@/components/landing/floating-decorations"
import { BeforeAfterComparison } from "@/components/shared/before-after-comparison"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-12 pt-28 sm:pb-16 sm:pt-32 md:py-24 lg:py-28">
      <FloatingDecorations />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-8 sm:gap-10 md:gap-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="flex flex-col gap-6 sm:gap-8 lg:self-end">
            <div className="space-y-4 sm:space-y-6">
              <h1 className="text-center text-[clamp(1.875rem,7vw,4.5rem)] font-extrabold leading-[1.1] tracking-tight lg:text-left">
                <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Consiga mais
                </span>
                <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  entrevistas.
                </span>
                <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Passe no ATS.
                </span>
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg md:text-lg">
                Descubra por que seu currículo está sendo ignorado e o que corrigir para passar no ATS.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-8 lg:row-span-2">
            <BeforeAfterComparison />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 lg:self-start">
            <Button asChild size="lg" className="gap-2 text-base font-semibold">
              <Link href="/criar-conta">
                Analisar meu currículo grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base font-semibold text-foreground">
              <a href="#pricing">Ver como melhorar</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
