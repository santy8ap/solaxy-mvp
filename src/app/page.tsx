import { ClockSection } from "@/components/landing/clock-section";
import { PlansSection } from "@/components/landing/plans-section";
import { Faq, FinalCta, Footer, Hero, HowItWorks, LandingNav } from "@/components/landing/sections";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main className="space-y-24 pb-8 sm:space-y-32">
        <div>
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
