import { apiRequest } from "../lib/api.js";

export async function listAssets() {
  const data = await apiRequest("/api/patrimonios");
  return data.patrimonios || [];
}

export async function createAsset(payload) {
  const data = await apiRequest("/api/patrimonios", { method: "POST", body: payload });
  return data.patrimonio;
}

export async function updateAsset(id, payload) {
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
  return data.patrimonio;
}

export async function moveAsset(id, destinoCentroCustoId, observacao = null) {
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(id)}/movimentar`, {
    method: "POST",
    body: { destinoCentroCustoId, observacao }
  });
  return data.patrimonio;
}

export async function setAssetRemoved(id, removed) {
  const action = removed ? "remover" : "restaurar";
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(id)}/${action}`, { method: "POST" });
  return data.patrimonio;
}

export async function permanentlyDeleteTestAsset(id, confirmation) {
  await apiRequest(`/api/patrimonios/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: { confirmation }
  });
}

export async function listAssetHistory(id) {
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(id)}/historico`);
  return data.historico || [];
}

export async function getPublicAsset(token) {
  const data = await apiRequest(`/api/public/patrimonio/${encodeURIComponent(token)}`, { auth: false });
  return data.patrimonio || null;
}
