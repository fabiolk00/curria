import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import GoogleAnalytics from "@/components/analytics/google-analytics"
import { embeddedClerkLocalizationPtBr } from "@/components/auth/clerk-localization"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getAppOrigin } from "@/lib/config/app-url"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const baseUrl = getAppOrigin()
const imageUrl = `${baseUrl}/og-image.svg`

export const metadata: Metadata = {
  title: "CurrIA - Consiga mais entrevistas",
  description: "Consiga mais entrevistas.",
  applicationName: "CurrIA",
  authors: [{ name: "CurrIA", url: baseUrl }],
  creator: "CurrIA",
  publisher: "CurrIA",
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
    title: "CurrIA - Consiga mais entrevistas.",
    description: "Consiga mais entrevistas.",
    siteName: "CurrIA",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: "CurrIA - Consiga mais entrevistas.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CurrIA - Consiga mais entrevistas.",
    description: "Consiga mais entrevistas.",
    images: [imageUrl],
  },
  alternates: {
    canonical: baseUrl,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={embeddedClerkLocalizationPtBr}>
      <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable}`}>
        <head />
        <body className="font-sans">
          <GoogleAnalytics />
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
