import type { BridgeDeleteV1Response, BridgeListV1Response } from "@/lib/types";
import { API_BASE_URL, fetchWithTimeout, readErrorMessage } from "@/lib/predict-client-base";

export async function listV1Bridges(limit: number = 50, offset: number = 0): Promise<BridgeListV1Response> {
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁列表加载失败。"));
  }
  return (await response.json()) as BridgeListV1Response;
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
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法创建桥梁。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bridge_code: payload.bridgeCode,
      bridge_name: payload.bridgeName,
      bridge_type: payload.bridgeType ?? null,
      region: payload.region ?? null,
      manager_org: payload.managerOrg ?? null,
      longitude: payload.longitude ?? null,
      latitude: payload.latitude ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁创建失败。"));
  }
  return (await response.json()) as BridgeListV1Response["items"][number];
}

export async function deleteV1Bridge(bridgeId: string): Promise<BridgeDeleteV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法删除桥梁。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges/${encodeURIComponent(bridgeId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁删除失败。"));
  }
  return (await response.json()) as BridgeDeleteV1Response;
}
