import { HistoryDetailShell } from "@/components/history-detail-shell";

interface HistoryDetailPageProps {
  params: Promise<{
    imageId: string;
  }>;
}

export async function generateMetadata({ params }: HistoryDetailPageProps) {
  const { imageId } = await params;
  return {
    title: `${imageId} - History Detail - BDI Infrastructure Scan`,
  };
}

export default async function DashboardHistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { imageId } = await params;
  return <HistoryDetailShell imageId={decodeURIComponent(imageId)} />;
}
