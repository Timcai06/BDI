import { BridgeDetailShell } from "@/components/bridges/bridge-detail-shell";

interface Props {
  params: Promise<{ bridgeId: string }>;
}

export default async function BridgeDetailPage({ params }: Props) {
  const resolved = await params;
  return <BridgeDetailShell bridgeId={decodeURIComponent(resolved.bridgeId)} />;
}
