import type { MetadataRoute } from "next"

import { getAppOrigin } from "@/lib/config/app-url"
import { PUBLIC_ROUTES } from "@/lib/routes/public"
import { allRoleLandingConfigs } from "@/lib/seo/role-landing-config"

const staticRouteEntries = [
  {
    path: PUBLIC_ROUTES.home,
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    path: PUBLIC_ROUTES.atsGuide,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  },
  {
    path: PUBLIC_ROUTES.pricing,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  },
  {
    path: PUBLIC_ROUTES.login,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  },
  {
    path: PUBLIC_ROUTES.signup,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  },
  {
    path: PUBLIC_ROUTES.privacy,
    changeFrequency: "yearly" as const,
    priority: 0.2,
  },
  {
    path: PUBLIC_ROUTES.terms,
    changeFrequency: "yearly" as const,
    priority: 0.2,
  },
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppOrigin()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = staticRouteEntries.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const seoRoutes: MetadataRoute.Sitemap = allRoleLandingConfigs.map((config) => ({
    url: `${baseUrl}${config.meta.canonical}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }))

  return [...staticRoutes, ...seoRoutes]
}
