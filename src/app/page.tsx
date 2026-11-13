import { ClockSection } from "@/components/landing/clock-section";
import { PlansSection } from "@/components/landing/plans-section";
import { Faq, FinalCta, Footer, Hero, HowItWorks, LandingNav } from "@/components/landing/sections";
import "@/components/landing/landing.css";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main className="landing-main space-y-24 pb-8 sm:space-y-32">
        <div className="landing-opening">
          <Hero />
          <ClockSection />
        </div>
        <PlansSection />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
