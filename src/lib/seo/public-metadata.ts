import type { Metadata } from "next"

import { getSiteUrl } from "@/lib/seo/site-config"

type PublicMetadataInput = {
  title: string
  description: string
  canonicalPath: string
}

export function buildPublicPageMetadata({
  title,
  description,
  canonicalPath,
}: PublicMetadataInput): Metadata {
  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}${canonicalPath}`

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: canonical,
      title,
      description,
      siteName: "Trampofy",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}
