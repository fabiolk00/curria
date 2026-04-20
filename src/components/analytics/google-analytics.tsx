import Script from "next/script"

import GoogleAnalyticsPageViews from "@/components/analytics/google-analytics-pageviews"

const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim()

export default function GoogleAnalytics() {
  if (!measurementId) {
    return null
  }

  return (
    <>
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <GoogleAnalyticsPageViews measurementId={measurementId} />
    </>
  )
}
