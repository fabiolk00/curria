import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import { BeforeAfterComparison } from "@/components/shared/before-after-comparison"
import { FloatingDecorations } from "@/components/landing/floating-decorations"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background py-12 sm:py-16 md:py-24 lg:py-28">
      <FloatingDecorations />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-8 sm:gap-10 md:gap-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Text Content */}
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6">
              <h1 className="text-[clamp(1.875rem,7vw,4.5rem)] font-extrabold leading-[1.1] tracking-tight">
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  <span className="block">Consiga mais</span>
                  <span className="block">entrevistas.</span>
                  <span className="block">Passe no ATS.</span>
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-lg text-muted-foreground text-pretty leading-relaxed">
                <BrandText text="Descubra por que seu currículo está sendo ignorado e o que corrigir para passar no ATS." />
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button asChild size="lg" className="gap-2 text-base font-semibold">
                <Link href="/o-que-e-ats">
                  Ver meu score ATS grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base font-semibold text-foreground">
                <a href="#pricing">Ver como melhorar</a>
              </Button>
            </div>
          </div>

          {/* Visual: Before/After Comparison */}
          <div className="flex flex-col items-center justify-center gap-8">
            <BeforeAfterComparison />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="pointer-events-none absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-xs font-medium text-muted-foreground/60">Scroll para explorar</span>
        <ChevronDown className="h-5 w-5 text-muted-foreground/40" />
      </div>
    </section>
  )
}
