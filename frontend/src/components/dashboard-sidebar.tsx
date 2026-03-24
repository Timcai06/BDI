"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navButtonClass(active: boolean) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
    active
      ? "bg-white/[0.06] text-white font-medium shadow-[inset_2px_0_0_0_#fff]"
      : "text-white/50 hover:text-white hover:bg-white/[0.03]"
  }`;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";
  const isHistory = pathname.startsWith("/dashboard/history");

  return (
    <aside className="w-20 lg:w-64 shrink-0 border-r border-white/5 bg-transparent flex flex-col relative z-20">
      <div className="flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="h-8 w-8 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/20 flex items-center justify-center shadow-[0_0_15px_rgba(0,210,255,0.2)]">
            <span className="text-[#00D2FF] font-black font-mono tracking-tighter">BDI</span>
          </div>
          <span className="hidden lg:block font-bold tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            INFRA-SCAN
          </span>
        </Link>
      </div>

      <div className="px-3 pt-6">
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white transition-colors hover:bg-white/10 lg:justify-start"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
            +
          </span>
          <span className="hidden text-sm uppercase tracking-widest font-medium lg:block">新建分析</span>
        </Link>
      </div>

      <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
        <Link href="/dashboard" className={navButtonClass(isHome)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isHome ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">主页</span>
        </Link>

        <Link href="/dashboard/history" className={navButtonClass(isHistory)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isHistory ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">历史记录</span>
        </Link>
      </nav>
    </aside>
  );
}
