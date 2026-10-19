import { apiRequest } from "../lib/api.js";

export async function simulateAssetImport(payload) {
  const data = await apiRequest("/api/importacoes/patrimonios/simular", {
    method: "POST",
    body: payload
  });
  return data.simulacao;
}

export async function applyAssetImport(payload) {
  const data = await apiRequest("/api/importacoes/patrimonios/aplicar", {
    method: "POST",
    body: payload
  });
  return data.resultado;
}

export async function listAssetImportHistory(limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await apiRequest(`/api/importacoes/patrimonios/historico?${params.toString()}`);
  return data.importacoes || [];
}
