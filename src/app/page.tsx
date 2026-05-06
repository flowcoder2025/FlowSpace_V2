import {
  Hero,
  TrustStrip,
  Features,
  HowItWorks,
  UseCases,
  Pricing,
  FinalCta,
  Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <main className="bg-cream text-ink antialiased">
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}
