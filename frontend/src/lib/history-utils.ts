import type { PredictionHistoryItem } from "@/lib/types";

export type HistorySortMode = "newest" | "detections" | "fastest";

interface FilterHistoryItemsOptions {
  category: string;
  query: string;
}

export function filterHistoryItems(
  items: PredictionHistoryItem[],
  options: FilterHistoryItemsOptions
): PredictionHistoryItem[] {
  const query = options.query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesQuery =
      query.length === 0 ||
      item.image_id.toLowerCase().includes(query) ||
      item.model_version.toLowerCase().includes(query) ||
      item.backend.toLowerCase().includes(query);

    const matchesCategory =
      options.category === "全部" || item.categories.includes(options.category);

    return matchesQuery && matchesCategory;
  });
}

export function sortHistoryItems(
  items: PredictionHistoryItem[],
  mode: HistorySortMode
): PredictionHistoryItem[] {
  return [...items].sort((left, right) => {
    if (mode === "detections") {
      return right.detection_count - left.detection_count;
    }

    if (mode === "fastest") {
      return left.inference_ms - right.inference_ms;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}
