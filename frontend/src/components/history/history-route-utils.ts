"use client";

import type { PredictState } from "@/lib/types";

export const initialHistoryRouteStatus: PredictState = {
  phase: "idle",
  message: "选择桥梁与批次查看记录。",
};

export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toProcessingStatusLabel(status: string): string {
  switch (status) {
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "running":
      return "处理中";
    case "queued":
      return "排队中";
    case "received":
      return "已接收";
    default:
      return status;
  }
}

export function toBatchStatusLabel(status: string): string {
  switch (status) {
    case "created":
      return "已创建";
    case "ingesting":
      return "入库中";
    case "running":
      return "处理中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "partial_failed":
      return "部分失败";
    default:
      return status;
  }
}
