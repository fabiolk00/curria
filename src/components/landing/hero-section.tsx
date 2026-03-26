"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BeforeAfterComparison } from "@/components/shared/before-after-comparison"
import { ArrowRight } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
              Seu currículo merece ser{" "}
              <span className="text-primary">visto.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 text-pretty">
              CurrIA usa IA para decodificar exatamente o que recrutadores e softwares de triagem procuram — e reescreve seu currículo para corresponder.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-base gap-2">
                <Link href="/signup">
                  Analisar meu currículo grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-base text-muted-foreground">
                <Link href="#how-it-works">Veja como funciona</Link>
              </Button>
            </div>
          </div>

          {/* Right side - Before/After comparison */}
          <div className="flex justify-center lg:justify-end">
            <BeforeAfterComparison />
          </div>
        </div>
      </div>
    </section>
  )
}
