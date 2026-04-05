import { Suspense } from "react";

import { OpsSearchShell } from "@/components/ops/ops-search-shell";

export const metadata = {
  title: "Ops Search - BDI Infrastructure Scan",
};

export default function DashboardOpsSearchPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <OpsSearchShell />
    </Suspense>
  );
}
