import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex h-screen w-full bg-[#05080A] text-slate-200 overflow-hidden font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(0,210,255,0.08)_0%,rgba(5,8,10,1)_100%)] pointer-events-none z-0" />
      <div className="bg-grid opacity-30 z-0 relative" />
      <div className="bg-noise opacity-40 z-0 relative" />
      <DashboardSidebar />
      {children}
    </main>
  );
}
