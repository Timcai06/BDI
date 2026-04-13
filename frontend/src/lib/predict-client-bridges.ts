import type { BridgeDeleteV1Response, BridgeListV1Response } from "@/lib/types";
import { apiDelete, apiGet, apiPost, buildQuery } from "@/lib/predict-client-base";

export async function listV1Bridges(limit: number = 50, offset: number = 0): Promise<BridgeListV1Response> {
  const query = buildQuery({ limit, offset });
  return apiGet(`/api/v1/bridges${query}`, { items: [], total: 0, limit, offset }, "桥梁列表加载失败。");
}

export async function createV1Bridge(payload: {
  bridgeCode: string;
  bridgeName: string;
  bridgeType?: string;
  region?: string;
  managerOrg?: string;
  longitude?: number;
  latitude?: number;
}): Promise<BridgeListV1Response["items"][number]> {
  return apiPost(
    "/api/v1/bridges",
    {
      bridge_code: payload.bridgeCode,
      bridge_name: payload.bridgeName,
      bridge_type: payload.bridgeType ?? null,
      region: payload.region ?? null,
      manager_org: payload.managerOrg ?? null,
      longitude: payload.longitude ?? null,
      latitude: payload.latitude ?? null,
    },
    "桥梁创建失败。",
    "演示模式下无法创建桥梁。",
  );
}

export async function deleteV1Bridge(bridgeId: string): Promise<BridgeDeleteV1Response> {
  return apiDelete(`/api/v1/bridges/${encodeURIComponent(bridgeId)}`, "桥梁删除失败。", "演示模式下无法删除桥梁。");
}