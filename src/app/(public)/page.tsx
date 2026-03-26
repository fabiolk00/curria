import Header from "@/components/landing/header"
import HeroSection from "@/components/landing/hero-section"
import AtsExplainer from "@/components/landing/ats-explainer"
import FeaturesSection from "@/components/landing/features-section"
import TestimonialCarousel from "@/components/landing/testimonial-carousel"
import PricingSection from "@/components/landing/pricing-section"
import FinalCta from "@/components/landing/final-cta"
import Footer from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <AtsExplainer />
        <FeaturesSection />
        <TestimonialCarousel />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
