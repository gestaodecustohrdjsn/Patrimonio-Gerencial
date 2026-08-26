
import { apiRequest } from "../lib/api.js";

export async function listMaintenances(assetId) {
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(assetId)}/manutencoes`);
  return data.manutencoes || [];
}
export async function createMaintenance(assetId, payload) {
  const data = await apiRequest(`/api/patrimonios/${encodeURIComponent(assetId)}/manutencoes`, {method:"POST", body:payload});
  return data.manutencao;
}
export async function finishMaintenance(id) {
  const data = await apiRequest(`/api/manutencoes/${encodeURIComponent(id)}/concluir`, {method:"POST"});
  return data.manutencao;
}
