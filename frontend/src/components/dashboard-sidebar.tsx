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
  const isOverview = pathname.startsWith("/dashboard/ops/overview");
  const isBridges = pathname.startsWith("/dashboard/bridges");
  const isBatches =
    pathname === "/dashboard/ops" ||
    pathname.startsWith("/dashboard/ops/items");
  const isSearch = pathname.startsWith("/dashboard/ops/search");
  const isHistory = pathname.startsWith("/dashboard/history");
  const isReviews = pathname.startsWith("/dashboard/ops/reviews");
  const isAlerts = pathname.startsWith("/dashboard/ops/alerts");
  const isSettings = pathname.startsWith("/dashboard/ops/settings");
  const isLabSingle = pathname.startsWith("/dashboard/lab-single");

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

      <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
        <Link href="/dashboard/ops/overview" className={navButtonClass(isOverview)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isOverview ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">运营总览</span>
        </Link>

        <Link href="/dashboard/bridges" className={navButtonClass(isBridges)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isBridges ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 19h16M6 17V9l6-4 6 4v8M9 17v-4h6v4" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">桥梁资产</span>
        </Link>

        <Link href="/dashboard/ops" className={navButtonClass(isBatches)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isBatches ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h13M8 12h13M8 17h13M3 7h.01M3 12h.01M3 17h.01" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">批次工作台</span>
        </Link>

        <Link href="/dashboard/ops/search" className={navButtonClass(isSearch)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isSearch ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">病害检索</span>
        </Link>

        <Link href="/dashboard/history" className={navButtonClass(isHistory)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isHistory ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">历史档案</span>
        </Link>

        <Link href="/dashboard/ops/reviews" className={navButtonClass(isReviews)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isReviews ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">复核中心</span>
        </Link>

        <Link href="/dashboard/ops/alerts" className={navButtonClass(isAlerts)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isAlerts ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">告警中心</span>
        </Link>

        <Link href="/dashboard/ops/settings" className={navButtonClass(isSettings)}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isSettings ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.3 2.5h1.4l.4 2a7.8 7.8 0 012 .8l1.7-1 1 1 1 1.7-1 1.7c.3.6.6 1.3.8 2l2 .4v1.4l-2 .4a7.8 7.8 0 01-.8 2l1 1.7-1 1-1.7 1-1.7-1c-.6.3-1.3.6-2 .8l-.4 2h-1.4l-.4-2a7.8 7.8 0 01-2-.8l-1.7 1-1-1-1-1.7 1-1.7a7.8 7.8 0 01-.8-2l-2-.4v-1.4l2-.4a7.8 7.8 0 01.8-2l-1-1.7 1-1 1.7-1 1.7 1c.6-.3 1.3-.6 2-.8l.4-2zM12 16a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">系统设置</span>
        </Link>

        <Link href="/dashboard/lab-single" className={`${navButtonClass(isLabSingle)} mt-4 border-t border-white/5 pt-4 text-white/35`}>
          <svg
            className={`shrink-0 w-5 h-5 transition-colors ${isLabSingle ? "text-white" : "text-white/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3v3.75L5.5 14.5a3 3 0 002.76 4.25h7.48a3 3 0 002.76-4.25L14.25 6.75V3m-4.5 0h4.5" />
          </svg>
          <span className="hidden lg:block text-[11px] uppercase tracking-widest">单图实验</span>
        </Link>
      </nav>
    </aside>
  );
}
