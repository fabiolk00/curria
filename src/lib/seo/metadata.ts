import type { Metadata } from "next"

import { getRoleLandingConfigBySlug } from "@/lib/seo/role-landing-config"
import { getSiteUrl } from "@/lib/seo/site-config"

export function buildRoleLandingMetadata(slug: string): Metadata {
  const config = getRoleLandingConfigBySlug(slug)

  if (!config) {
    throw new Error(`Missing SEO config for slug: ${slug}`)
  }

  const baseUrl = getSiteUrl()

  return {
    title: config.meta.title,
    description: config.meta.description,
    alternates: {
      canonical: `${baseUrl}${config.meta.canonical}`,
    },
    openGraph: {
      type: "article",
      locale: "pt_BR",
      url: `${baseUrl}${config.meta.canonical}`,
      title: config.meta.title,
      description: config.meta.description,
      siteName: "Trampofy",
    },
    twitter: {
      card: "summary_large_image",
      title: config.meta.title,
      description: config.meta.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}
