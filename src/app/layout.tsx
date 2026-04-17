import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"

import { embeddedClerkLocalizationPtBr } from "@/components/auth/clerk-localization"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getAppOrigin } from "@/lib/config/app-url"
import "./globals.css"

const baseUrl = getAppOrigin()
const imageUrl = `${baseUrl}/og-image.svg`

export const metadata: Metadata = {
  title: "CurrIA - Otimizador de Curr\u00EDculo com IA",
  description: "Otimize seu curr\u00EDculo para sistemas ATS com intelig\u00EAncia artificial.",
  applicationName: "CurrIA",
  authors: [{ name: "CurrIA", url: baseUrl }],
  creator: "CurrIA",
  publisher: "CurrIA",
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
    title: "CurrIA - Otimizador de Curr\u00EDculo com IA",
    description: "Otimize seu curr\u00EDculo para sistemas ATS com intelig\u00EAncia artificial.",
    siteName: "CurrIA",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: "CurrIA - Otimizador de Curr\u00EDculo com IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CurrIA - Otimizador de Curr\u00EDculo com IA",
    description: "Otimize seu curr\u00EDculo para sistemas ATS com intelig\u00EAncia artificial.",
    images: [imageUrl],
  },
  alternates: {
    canonical: baseUrl,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={embeddedClerkLocalizationPtBr}>
      <html lang="pt-BR" suppressHydrationWarning className={`${GeistSans.variable}`}>
        <head />
        <body className="font-sans">
          <ThemeProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
