import type { Metadata } from "next"
import SeoRoleLandingPage from "@/components/landing/seo-role-landing-page"
import { desenvolvedorConfig } from "@/lib/seo/role-landing-config"
import { getAppOrigin } from "@/lib/config/app-url"

const config = desenvolvedorConfig
const baseUrl = getAppOrigin()

export const metadata: Metadata = {
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

export default function CurriculoDesenvolvedorAtsPage() {
  return <SeoRoleLandingPage config={config} />
}
