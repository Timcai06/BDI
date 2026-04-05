import { Suspense } from "react";

import { OpsReviewsShell } from "@/components/ops/ops-reviews-shell";

export const metadata = {
  title: "Ops Reviews - BDI Infrastructure Scan",
};

export default function DashboardOpsReviewsPage() {
  return (
    <Suspense fallback={<div className="relative z-10 flex-1 p-8 text-sm text-white/60">加载中...</div>}>
      <OpsReviewsShell />
    </Suspense>
  );
}
