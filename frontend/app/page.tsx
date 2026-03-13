import { LandingHero } from "@/components/LandingHero";
import { FeatureMasonry } from "@/components/FeatureMasonry";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "BDI Nexus | 智联未来的数字基石",
  description: "The Digital Foundation for Future Connectivity",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full relative overflow-x-hidden selection:bg-accent/30 selection:text-white">
      <SiteHeader />
      
      {/* 
        This is the main structural container for the landing page.
        Background glow is already in globals.css body, but we can add more specific cinematic blur spots here if needed.
      */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4285F4] opacity-[0.08] blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#A06EE1] opacity-[0.08] blur-[150px] pointer-events-none rounded-full" />
      
      {/* Full bleed Hero Section */}
      <div className="relative z-10 w-full">
        <LandingHero />
      </div>

      {/* Constrained Masonry Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
        <FeatureMasonry />
      </div>
      
      <SiteFooter />
    </main>
  );
}
