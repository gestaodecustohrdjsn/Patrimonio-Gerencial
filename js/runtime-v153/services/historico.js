import { apiRequest } from "../lib/api.js";

export async function listRecentHistory(limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const params = new URLSearchParams({ limit: String(safeLimit) });
  const data = await apiRequest(`/api/historico?${params.toString()}`);
  return data.eventos || [];
}
