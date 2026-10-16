import { apiRequest } from "../lib/api.js";

export async function searchCatalog(term, limit = 20) {
  const text = term.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({ q: text, limit: String(limit) });
  const data = await apiRequest(`/api/catalogo?${params.toString()}`);
  return data.itens || [];
}

export async function listCatalogAdmin() {
  const data = await apiRequest("/api/catalogo/admin");
  return data.itens || [];
}

export async function updateCatalogType(id, tipoId) {
  const data = await apiRequest(`/api/catalogo/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { tipo_id: Number(tipoId) }
  });
  return data;
}

export async function createCatalogItem(payload) {
  const data = await apiRequest("/api/catalogo", { method: "POST", body: payload });
  return data.item;
}

export async function updateCatalogItem(id, payload) {
  const data = await apiRequest(`/api/catalogo/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
  return data;
}

export async function deleteCatalogItem(id, confirmation) {
  return apiRequest(`/api/catalogo/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: { confirmation }
  });
}


export async function listCatalogUpdateContext() {
  const data = await apiRequest("/api/catalogo/atualizacoes/contexto");
  return {
    aliases: data.aliases || [],
    atualizacoes: data.atualizacoes || []
  };
}

export async function applyCatalogUpdate(payload) {
  const data = await apiRequest("/api/catalogo/atualizacoes/aplicar", {
    method: "POST",
    body: payload
  });
  return data.resultado;
}

export async function getCatalogUpdateDetail(id) {
  return apiRequest(`/api/catalogo/atualizacoes/${encodeURIComponent(id)}`);
}
