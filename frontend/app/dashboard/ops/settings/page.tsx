import { Suspense } from "react";

import { OpsSettingsShell } from "@/components/ops/ops-settings-shell";

export const metadata = {
  title: "Ops Settings - BDI Infrastructure Scan",
};

export default function DashboardOpsSettingsPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <OpsSettingsShell />
    </Suspense>
  );
}
