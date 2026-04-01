import { OpsItemDetailShell } from "@/components/ops/ops-item-detail-shell";

export const metadata = {
  title: "Ops Item Detail - BDI Infrastructure Scan",
};

export default async function DashboardOpsItemPage({
  params,
}: {
  params: Promise<{ batchItemId: string }>;
}) {
  const resolved = await params;
  return <OpsItemDetailShell batchItemId={decodeURIComponent(resolved.batchItemId)} />;
}
