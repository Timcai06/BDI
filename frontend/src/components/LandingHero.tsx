import Link from "next/link";
import Image from "next/image";

export function LandingHero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center text-center">
      {/* Floating Cinematic Rounded Video Cards ( simulated via CSS ) */}
      {/* Container is full-width, uses mask-image to smoothly fade into black at the top and bottom edges */}
      <div 
        className="absolute inset-x-0 top-0 h-[800px] -z-10 overflow-hidden pointer-events-none flex justify-center"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)"
        }}
      >
        {/* Left fluid shape */}
        <div className="absolute top-[10%] left-[-15%] w-[60vw] max-w-[900px] h-[50%] rounded-[100px] overflow-hidden rotate-[-8deg] opacity-80 mix-blend-screen filter blur-[8px] animate-pulse-slow">
          <div className="w-full h-full bg-gradient-to-br from-[#101528] via-[#1a233a] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(66,133,244,0.4),transparent_60%)]" />
        </div>
        
        {/* Right fluid shape */}
        <div className="absolute top-[25%] right-[-15%] w-[65vw] max-w-[1000px] h-[45%] rounded-[120px] overflow-hidden rotate-[12deg] opacity-70 mix-blend-screen filter blur-[12px] animate-pulse-slow" style={{ animationDelay: "1s" }}>
          <div className="w-full h-full bg-gradient-to-tl from-[#120e1e] via-[#1e1533] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(160,110,225,0.4),transparent_60%)]" />
        </div>
        
        {/* Bottom grounding shape */}
        <div className="absolute bottom-[5%] left-[10%] w-[70vw] max-w-[1200px] h-[40%] rounded-[150px] overflow-hidden rotate-[-4deg] opacity-60 mix-blend-screen filter blur-[16px] animate-pulse-slow" style={{ animationDelay: "2s" }}>
          <div className="w-full h-full bg-gradient-to-t from-[#0b1f28] via-[#113142] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,210,255,0.3),transparent_70%)]" />
        </div>
      </div>

      {/* Background radial gradient specifically for the hero text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 space-y-6 max-w-4xl mx-auto mt-20">
        {/* Flow-style Animated Gradient Headline */}
        <h1 
          className="text-[12rem] sm:text-[18rem] md:text-[22rem] font-bold tracking-tighter leading-none select-none animate-text-flow"
          style={{
            backgroundImage: "linear-gradient(110deg, #FFFFFF 0%, #A06EE1 25%, #4285F4 50%, #FFFFFF 75%, #A06EE1 100%)",
            backgroundSize: "200% auto",
            color: "transparent",
            WebkitBackgroundClip: "text",
            backgroundClip: "text"
          }}
        >
          BDI
        </h1>
        
        {/* Subtle Subtitle */}
        <p className="text-sm md:text-base font-medium tracking-[0.4em] text-white/40 uppercase mt-[-2rem] mb-12 mix-blend-screen">
          Infrastructure Scan Intelligence
        </p>

        {/* Premium CTA Button */}
        <div className="mt-16 flex justify-center">
          <Link
            href="/dashboard"
            className="group relative inline-flex h-12 items-center justify-center gap-3 rounded-full bg-white/[0.03] border border-white/10 px-8 text-xs font-semibold tracking-widest uppercase text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black focus:outline-none focus:ring-4 focus:ring-white/20 focus:bg-white focus:text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
          >
            {/* The span forces text color to inherit parent state reliably */}
            <span className="transition-colors duration-300">Launch Console</span>
            <svg
              className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
