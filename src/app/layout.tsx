import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import GoogleAnalytics from "@/components/analytics/google-analytics"
import { embeddedClerkLocalizationPtBr } from "@/components/auth/clerk-localization"
import { RouteLoadingIndicator } from "@/components/navigation/route-loading-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { PROFILE_SETUP_PATH } from "@/lib/routes/app"
import { getSiteUrl } from "@/lib/seo/site-config"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const baseUrl = getSiteUrl()
const imageUrl = `${baseUrl}/og-image.svg`
const siteTitle = "Trampofy - Currículo guiado por IA para cada vaga"
const siteDescription =
  "Analise vagas, ajuste seu currículo para ATS e gere versões mais alinhadas com cada oportunidade usando IA."

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: "Trampofy",
  authors: [{ name: "Trampofy", url: baseUrl }],
  creator: "Trampofy",
  publisher: "Trampofy",
  icons: {
    icon: [{ url: "/trampofy-icon.png", type: "image/png" }],
    apple: [{ url: "/trampofy-icon.png", type: "image/png" }],
  },
  verification: {
    google: "PPOK95ojSMP50nd8OtAHu6nEvLzJFhzNcMU6ApjPII0",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: baseUrl,
    title: siteTitle,
    description: siteDescription,
    siteName: "Trampofy",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [imageUrl],
  },
  alternates: {
    canonical: baseUrl,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={embeddedClerkLocalizationPtBr}
      signInFallbackRedirectUrl={PROFILE_SETUP_PATH}
      signUpFallbackRedirectUrl={PROFILE_SETUP_PATH}
    >
      <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable}`}>
        <head />
        <body className="font-sans">
          <GoogleAnalytics />
          <ThemeProvider>
            <TooltipProvider delayDuration={300}>
              <RouteLoadingIndicator />
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
