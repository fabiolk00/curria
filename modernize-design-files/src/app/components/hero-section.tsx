import { Link } from "react-router"
import { Button } from "./ui"
import { BeforeAfterComparison } from "./shared/before-after-comparison"
import { ArrowRight } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-tight">
              Seu currículo merece ser{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                visto.
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 text-pretty">
              CurrIA usa IA para decodificar exatamente o que recrutadores e softwares de triagem procuram — e reescreve seu currículo para corresponder.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-base gap-2 font-semibold">
                <Link to="/signup">
                  Analisar meu currículo grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base text-foreground font-semibold">
                <a href="#pricing">Ver planos</a>
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