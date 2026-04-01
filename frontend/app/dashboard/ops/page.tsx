import { Suspense } from "react";

import { OpsWorkbenchShell } from "@/components/ops/ops-workbench-shell";

export const metadata = {
  title: "Ops Workbench - BDI Infrastructure Scan",
};

export default function DashboardOpsPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <OpsWorkbenchShell />
    </Suspense>
  );
}
