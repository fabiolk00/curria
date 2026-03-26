import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function FinalCta() {
  return (
    <section className="py-20 bg-card border-y border-border">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-balance max-w-2xl mx-auto">
          Pare de ser rejeitado por robôs.{" "}
          <span className="text-primary">Comece a conseguir entrevistas.</span>
        </h2>
        <div className="mt-10">
          <Button asChild size="lg" className="text-base gap-2">
            <Link href="/signup">
              Começar gratuitamente
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Sem cartão de crédito. 1 análise grátis incluída.
        </p>
      </div>
    </section>
  )
}
