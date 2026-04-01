import Header from "@/components/landing/header"
import HeroSection from "@/components/landing/hero-section"
import AtsExplainer from "@/components/landing/ats-explainer"
import PricingSection from "@/components/landing/pricing-section"
import FinalCta from "@/components/landing/final-cta"
import Footer from "@/components/landing/footer"
import FaqSection from "@/components/landing/faq-section"
import SocialProof from "@/components/landing/social-proof"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <AtsExplainer />
        <SocialProof />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}