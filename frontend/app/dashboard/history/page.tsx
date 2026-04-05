import { Suspense } from "react";

import { HistoryRouteShell } from "@/components/history-route-shell";

export const metadata = {
  title: "History - BDI Infrastructure Scan",
};

export default function DashboardHistoryPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <HistoryRouteShell />
    </Suspense>
  );
}
