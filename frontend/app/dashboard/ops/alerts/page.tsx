import { Suspense } from "react";

import { OpsAlertsShell } from "@/components/ops/ops-alerts-shell";

export const metadata = {
  title: "Ops Alerts - BDI Infrastructure Scan",
};

export default function DashboardOpsAlertsPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <OpsAlertsShell />
    </Suspense>
  );
}
