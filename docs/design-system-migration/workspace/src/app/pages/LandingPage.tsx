import Header from "../components/header"
import HeroSection from "../components/hero-section"
import AtsExplainer from "../components/ats-explainer"
import PricingSection from "../components/pricing-section"
import FinalCta from "../components/final-cta"
import Footer from "../components/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <AtsExplainer />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}