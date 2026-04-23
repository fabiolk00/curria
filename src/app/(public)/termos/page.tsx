import type { Metadata } from "next"

import { BrandText } from "@/components/brand-wordmark"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Termos de Serviço - CurrIA",
  description: "Termos de serviço e condições de uso da plataforma CurrIA.",
  canonicalPath: "/termos",
})

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background py-16 md:py-24">
      <div className="container mx-auto max-w-3xl px-4 md:px-6">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Termos de ServiÃ§o</h1>
            <p className="text-lg text-muted-foreground">
              Ãšltima atualizaÃ§Ã£o: {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">1. AceitaÃ§Ã£o dos Termos</h2>
              <p className="text-muted-foreground">
                <BrandText
                  text="Ao acessar e usar a plataforma CurrIA, vocÃª concorda em aceitar estes termos de serviÃ§o e todas as leis e regulamentaÃ§Ãµes aplicÃ¡veis. Se vocÃª nÃ£o concordar com qualquer um destes termos, estÃ¡ proibido de usar ou acessar este site."
                  className="font-medium text-foreground"
                />
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">2. Uso Apropriado da LicenÃ§a</h2>
              <p className="text-muted-foreground">
                <BrandText
                  text="Ã‰ concedida a vocÃª uma licenÃ§a limitada para acessar a plataforma CurrIA apenas para fins legÃ­timos. VocÃª nÃ£o pode:"
                  className="font-medium text-foreground"
                />
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Tentar obter acesso nÃ£o autorizado aos sistemas</li>
                <li>Transmitir qualquer cÃ³digo malicioso ou prejudicial</li>
                <li>Violar qualquer lei ou regulamentaÃ§Ã£o aplicÃ¡vel</li>
                <li>Incorporar ou vincular a qualquer conteÃºdo de propriedade intelectual de terceiros</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">3. IsenÃ§Ã£o de Responsabilidade</h2>
              <p className="text-muted-foreground">
                <BrandText
                  text='A plataforma CurrIA Ã© fornecida "no estado em que se encontra". CurrIA nÃ£o oferece garantias de qualquer tipo, expressas ou implÃ­citas. CurrIA renuncia a todas as garantias, expressas ou implÃ­citas, incluindo, mas nÃ£o limitado a, garantias de comercializaÃ§Ã£o, adequaÃ§Ã£o a um fim especÃ­fico e nÃ£o-violaÃ§Ã£o.'
                  className="font-medium text-foreground"
                />
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">4. LimitaÃ§Ã£o de Responsabilidade</h2>
              <p className="text-muted-foreground">
                <BrandText
                  text="Em nenhum caso CurrIA serÃ¡ responsÃ¡vel por qualquer dano direto, indireto, incidental, especial ou consequencial resultante de seu acesso ou uso da plataforma, mesmo que CurrIA tenha sido informado da possibilidade de tais danos."
                  className="font-medium text-foreground"
                />
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">5. AlteraÃ§Ãµes aos Termos</h2>
              <p className="text-muted-foreground">
                <BrandText
                  text="CurrIA se reserva o direito de modificar estes termos de serviÃ§o a qualquer momento. As alteraÃ§Ãµes entram em vigor imediatamente apÃ³s a publicaÃ§Ã£o na plataforma. Seu uso contÃ­nuo da plataforma apÃ³s tais alteraÃ§Ãµes constitui sua aceitaÃ§Ã£o dos novos termos."
                  className="font-medium text-foreground"
                />
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">6. Lei AplicÃ¡vel</h2>
              <p className="text-muted-foreground">
                Estes termos e todas as questÃµes relacionadas sÃ£o regidas pelas leis da RepÃºblica Federativa do Brasil.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">7. Entre em Contato</h2>
              <p className="text-muted-foreground">
                Se vocÃª tiver dÃºvidas sobre estes termos de serviÃ§o, entre em contato conosco em{" "}
                <a href="mailto:support@curria.com.br" className="text-primary hover:underline">
                  support@curria.com.br
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
