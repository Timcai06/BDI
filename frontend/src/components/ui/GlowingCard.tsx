import type { ReactNode } from "react";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
}

export function GlowingCard({ children, className = "" }: GlowingCardProps) {
  return (
    <div
      className={`relative group overflow-hidden rounded-[24px] bg-black/40 backdrop-blur-2xl border border-white/5 transition-colors duration-500 hover:border-white/20 hover:bg-white/[0.02] ${className}`}
    >
      {/* Edge Lit Highlight Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
      
      {/* Content wrapper */}
      <div className="relative z-10 p-8 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
