import { apiRequest } from "../lib/api.js";

export async function listRecentHistory(limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const params = new URLSearchParams({ limit: String(safeLimit) });
  const data = await apiRequest(`/api/historico?${params.toString()}`);
  return data.eventos || [];
}

export async function listHistory(filters = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(200, Math.max(1, Number(filters.limit) || 100))));
  params.set("offset", String(Math.max(0, Number(filters.offset) || 0)));
  for (const key of ["tabela","operacao","usuario_id","q","inicio","fim"]) {
    const value=String(filters[key] ?? "").trim();
    if(value) params.set(key,value);
  }
  const data = await apiRequest(`/api/historico?${params.toString()}`);
  return {
    eventos:data.eventos || [],
    total:Number(data.total || 0),
    limit:Number(data.limit || 100),
    offset:Number(data.offset || 0),
    usuarios:data.usuarios || []
  };
}
