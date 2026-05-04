import type { Metadata } from "next"

import { PrivacyPage } from "@/components/privacy/privacy-page"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Política de Privacidade - Trampofy",
  description: "Política de privacidade e proteção de dados pessoais da plataforma Trampofy.",
  canonicalPath: "/privacidade",
})

export default function PrivacidadePage() {
  return <PrivacyPage />
}
