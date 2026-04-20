import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import { BeforeAfterComparison } from "@/components/shared/before-after-comparison"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background py-20 md:py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Passe no ATS. Consiga mais {" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                entrevistas.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty md:text-xl lg:mx-0">
              <BrandText text="CurrIA CurrIA reescreve seu currículo com base no que recrutadores realmente buscam — usando dados reais de vagas." />
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="gap-2 text-base font-semibold">
                <Link href="/what-is-ats">
                  Analisar meu currículo grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base font-semibold text-foreground">
                <a href="#pricing">Ver planos</a>
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <BeforeAfterComparison />
          </div>
        </div>
      </div>
    </section>
  )
}
