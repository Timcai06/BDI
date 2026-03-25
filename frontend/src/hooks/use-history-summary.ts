import { useCallback, useState } from "react";

import { listAllResults } from "@/lib/predict-client";
import type { PredictionHistoryResponse } from "@/lib/types";

interface LoadHistoryOptions {
  forceFresh?: boolean;
  silent?: boolean;
}

interface UseHistorySummaryOptions {
  onLoadError?: (message: string) => void;
  onLoadSuccess?: (history: PredictionHistoryResponse, options: LoadHistoryOptions) => void;
}

export function useHistorySummary(options: UseHistorySummaryOptions = {}) {
  const { onLoadError, onLoadSuccess } = options;
  const [historyTotal, setHistoryTotal] = useState(0);

  const loadHistory = useCallback(
    async ({ forceFresh = false, silent = false }: LoadHistoryOptions = {}) => {
      try {
        const history = await listAllResults(forceFresh);
        setHistoryTotal(history.total);
        onLoadSuccess?.(history, { forceFresh, silent });
        return history;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
        onLoadError?.(message);
        return null;
      }
    },
    [onLoadError, onLoadSuccess],
  );

  return {
    historyTotal,
    loadHistory,
  };
}
