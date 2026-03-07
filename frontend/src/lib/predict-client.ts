import { demoResult } from "@/lib/mock-data";
import type { ApiError, PredictOptions, PredictionResult } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

function cloneDemoResult(file: File, options: PredictOptions): PredictionResult {
  return {
    ...demoResult,
    image_id: file.name,
    artifacts: {
      ...demoResult.artifacts,
      upload_path: `uploads/${file.name}`,
      overlay_path: options.exportOverlay ? demoResult.artifacts.overlay_path : null
    }
  };
}

export async function predictImage(
  file: File,
  options: PredictOptions
): Promise<PredictionResult> {
  if (!API_BASE_URL) {
    return cloneDemoResult(file, options);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("confidence", String(options.confidence));
  formData.append("return_overlay", String(options.exportOverlay));

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(payload.error.message);
    }

    return (await response.json()) as PredictionResult;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法连接后端推理服务。");
  }
}
