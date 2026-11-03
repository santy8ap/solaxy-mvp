import { Hero } from "@/components/landing/hero";
import { Ownership } from "@/components/landing/ownership";
import { PlantToday } from "@/components/landing/plant-today";
import { Faq, FinalCta, Footer, HowItWorks, LandingNav, Payments } from "@/components/landing/sections";
import { Simulator } from "@/components/landing/simulator";
import { PresenterControl } from "@/components/live/presenter";

export default function Home() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <Ownership />
        <HowItWorks />
        <PlantToday />
        <Simulator />
        <Payments />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <PresenterControl />
    </>
  );
}
