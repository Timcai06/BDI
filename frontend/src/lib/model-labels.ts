import type {
  ModelCatalogItem,
  PredictionHistoryItem,
  PredictionResult
} from "@/lib/types";

type ModelLike =
  | Pick<PredictionResult, "model_name" | "model_version">
  | Pick<PredictionHistoryItem, "model_name" | "model_version">
  | Pick<ModelCatalogItem, "model_name" | "model_version">;

export function formatModelLabel(model: ModelLike): string {
  return `${model.model_name} / ${model.model_version}`;
}
