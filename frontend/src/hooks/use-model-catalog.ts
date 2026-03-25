import { useEffect, useState } from "react";

import { listModels } from "@/lib/predict-client";
import type { ModelCatalogItem } from "@/lib/types";

export function useModelCatalog() {
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [selectedModelVersion, setSelectedModelVersion] = useState<string | null>(null);
  const [compareModelVersion, setCompareModelVersion] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoading(true);
      setModelsError(null);

      try {
        const catalog = await listModels();
        if (cancelled) {
          return;
        }

        setAvailableModels(catalog.items);
        setSelectedModelVersion((current) => {
          if (current) {
            return current;
          }

          const preferred =
            catalog.items.find(
              (item) => item.model_version === catalog.active_version && item.is_available,
            ) ?? catalog.items.find((item) => item.is_available);

          return preferred?.model_version ?? null;
        });
        setCompareModelVersion((current) => {
          if (current) {
            return current;
          }

          const fallback = catalog.items.find(
            (item) => item.model_version !== catalog.active_version && item.is_available,
          );

          return fallback?.model_version ?? null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "模型列表加载失败，请稍后重试。";
        setModelsError(message);
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    availableModels,
    compareModelVersion,
    modelsError,
    modelsLoading,
    selectedModelVersion,
    setCompareModelVersion,
    setSelectedModelVersion,
  };
}
