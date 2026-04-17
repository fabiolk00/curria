import type { Metadata } from "next"
import { notFound } from "next/navigation"

import SeoRoleLandingPage from "@/components/landing/seo-role-landing-page"
import { getAppOrigin } from "@/lib/config/app-url"
import {
  allRoleLandingConfigs,
  getRoleLandingConfigBySlug,
} from "@/lib/seo/role-landing-config"

type PageProps = {
  params: {
    variant: string
  }
}

function getConfigOrNotFound(variant: string) {
  const config = getRoleLandingConfigBySlug(variant)

  if (!config) {
    notFound()
  }

  return config
}

export function generateStaticParams() {
  return allRoleLandingConfigs.map((config) => ({
    variant: config.slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { variant } = params
  const config = getConfigOrNotFound(variant)
  const baseUrl = getAppOrigin()

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
      siteName: "CurrIA",
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

export default async function SeoRoleVariantPage({ params }: PageProps) {
  const { variant } = params
  const config = getConfigOrNotFound(variant)

  return <SeoRoleLandingPage config={config} />
}
