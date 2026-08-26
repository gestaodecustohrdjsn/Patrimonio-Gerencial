import { apiRequest } from "../lib/api.js";

export async function searchSigem(term, limit = 20) {
  const text = term.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({ q: text, limit: String(limit) });
  const data = await apiRequest(`/api/catalogo?${params.toString()}`);
  return data.itens || [];
}
