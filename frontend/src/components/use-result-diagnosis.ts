import { useEffect, useState } from "react";

import { getDiagnosisRecord, getDiagnosisText } from "@/lib/predict-client";

export function useResultDiagnosis(params: {
  diagnosisMode: "auto" | "cached";
  imageId: string;
}) {
  const { diagnosisMode, imageId } = params;
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);
  const [hasStoredDiagnosis, setHasStoredDiagnosis] = useState<boolean | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const thinkingSteps = [
    "正在解析病害分布与严重程度…",
    "正在交叉核对模型结果与历史经验…",
    "正在生成结构化诊断建议…",
  ];

  useEffect(() => {
    if (!isDiagnosisLoading) {
      setThinkingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingIndex((current) => (current + 1) % thinkingSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [isDiagnosisLoading]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDiagnosis() {
      if (!imageId) {
        return;
      }

      setDiagnosis("");
      setHasStoredDiagnosis(null);
      setIsDiagnosisLoading(true);

      try {
        if (diagnosisMode === "cached") {
          const record = await getDiagnosisRecord(imageId);
          if (!cancelled) {
            setDiagnosis(record.content ?? "");
            setHasStoredDiagnosis(record.exists);
          }
        } else {
          const content = await getDiagnosisText(imageId);
          if (!cancelled) {
            setDiagnosis(content);
            setHasStoredDiagnosis(true);
          }
        }
      } catch {
        if (!cancelled) {
          setDiagnosis("无法加载 AI 专家评估建议。");
          setHasStoredDiagnosis(true);
        }
      } finally {
        if (!cancelled) {
          setIsDiagnosisLoading(false);
        }
      }
    }

    void fetchDiagnosis();

    return () => {
      cancelled = true;
    };
  }, [diagnosisMode, imageId]);

  async function generateDiagnosis() {
    if (!imageId || isDiagnosisLoading) {
      return;
    }

    setIsDiagnosisLoading(true);
    setDiagnosis("");

    try {
      const content = await getDiagnosisText(imageId);
      setDiagnosis(content);
      setHasStoredDiagnosis(true);
    } catch {
      setDiagnosis("无法生成 AI 专家评估建议。");
      setHasStoredDiagnosis(true);
    } finally {
      setIsDiagnosisLoading(false);
    }
  }

  return {
    diagnosis,
    generateDiagnosis,
    hasStoredDiagnosis,
    isDiagnosisLoading,
    thinkingIndex,
    thinkingSteps
  };
}
