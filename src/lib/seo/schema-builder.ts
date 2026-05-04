import { PLANS } from "@/lib/plans"
import {
  buildFaqPageJsonLd,
  type FaqPageJsonLd,
  type SeoFaqItem,
} from "@/lib/seo/json-ld"

type SchemaContactPoint = {
  "@type": "ContactPoint"
  contactType: string
  email: string
}

interface SchemaOrganization {
  "@context": string
  "@type": "Organization"
  name: string
  url: string
  description: string
  contactPoint?: SchemaContactPoint
}

interface SchemaSoftwareApplication {
  "@context": string
  "@type": "SoftwareApplication"
  name: string
  description: string
  applicationCategory: string
  url: string
  offers: Array<{
    "@type": "Offer"
    price: string
    priceCurrency: string
    availability: string
    description: string
  }>
}

function formatPriceForSchema(priceInCents: number): string {
  return (priceInCents / 100).toFixed(2)
}

export function buildOrganizationSchema(baseUrl: string): SchemaOrganization {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Trampofy",
    url: baseUrl,
    description: "Plataforma de otimização de currículos com IA para profissionais brasileiros.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@trampofy.com.br",
    },
  }
}

export function buildSoftwareApplicationSchema(baseUrl: string): SchemaSoftwareApplication {
  const offers = Object.values(PLANS).map((plan) => ({
    "@type": "Offer" as const,
    price: formatPriceForSchema(plan.price),
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    description: plan.description,
  }))

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Trampofy",
    description: "Otimizador de currículo com inteligência artificial para sistemas ATS.",
    applicationCategory: "BusinessApplication",
    url: baseUrl,
    offers,
  }
}

export function buildFAQSchema(
  faqs: ReadonlyArray<SeoFaqItem>,
): FaqPageJsonLd {
  return buildFaqPageJsonLd(faqs)
}

