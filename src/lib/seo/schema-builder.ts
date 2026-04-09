import { PLANS } from "@/lib/plans"

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

interface SchemaFAQPage {
  "@context": string
  "@type": "FAQPage"
  mainEntity: Array<{
    "@type": "Question"
    name: string
    acceptedAnswer: {
      "@type": "Answer"
      text: string
    }
  }>
}

function formatPriceForSchema(priceInCents: number): string {
  return (priceInCents / 100).toFixed(2)
}

export function buildOrganizationSchema(baseUrl: string): SchemaOrganization {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CurrIA",
    url: baseUrl,
    description: "Plataforma de otimização de currículos com IA para profissionais brasileiros.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@curria.com.br",
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
    name: "CurrIA",
    description: "Otimizador de currículo com inteligência artificial para sistemas ATS.",
    applicationCategory: "BusinessApplication",
    url: baseUrl,
    offers,
  }
}

export function buildFAQSchema(
  faqs: ReadonlyArray<{ question: string; answer: string }>,
): SchemaFAQPage {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}
