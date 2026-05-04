import type { Metadata } from "next"

import { TermsPage } from "@/components/terms/terms-page"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Termos de Uso - Trampofy",
  description:
    "Leia os Termos de Uso da plataforma Trampofy antes de utilizar nossos serviços de geração e otimização de currículos com inteligência artificial.",
  canonicalPath: "/termos",
})

export default function TermosPage() {
  return <TermsPage />
}

