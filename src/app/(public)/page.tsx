import Header from "@/components/landing/header"
import HeroSection from "@/components/landing/hero-section"
import AtsExplainer from "@/components/landing/ats-explainer"
import TrackerShowcase from "@/components/landing/tracker-showcase"
import PricingSection from "@/components/landing/pricing-section"
import FinalCta from "@/components/landing/final-cta"
import Footer from "@/components/landing/footer"
import FaqSection from "@/components/landing/faq-section"
import SocialProof from "@/components/landing/social-proof"
import ExploreResumesCarousel from "@/components/landing/explore-resumes-carousel"
import { Schema } from "@/components/schema"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Schema />
      <Header />
      <main className="flex-1">
        <HeroSection />
        <ExploreResumesCarousel />
        <AtsExplainer />
        <TrackerShowcase />
        <SocialProof />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
