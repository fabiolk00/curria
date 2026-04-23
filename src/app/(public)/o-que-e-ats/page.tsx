import type { Metadata } from "next"

import OQueEAtsPageClient from "@/components/landing/o-que-e-ats-page"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "O que é ATS - CurrIA",
  description:
    "Entenda como funcionam os sistemas automatizados que filtram currículos antes de chegarem ao recrutador.",
  canonicalPath: "/o-que-e-ats",
})

export default function OQueEAtsPage() {
  return <OQueEAtsPageClient />
}
