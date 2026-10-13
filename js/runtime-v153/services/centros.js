import { apiRequest } from "../lib/api.js";

export async function listCenters() {
  const data = await apiRequest("/api/centros");
  return data.centros || [];
}

export async function createCenter(payload) {
  const data = await apiRequest("/api/centros", { method: "POST", body: payload });
  return data.centro;
}

export async function updateCenter(id, payload) {
  const data = await apiRequest(`/api/centros/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
  return data.centro;
}

export async function deleteCenter(id, confirmation) {
  await apiRequest(`/api/centros/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: { confirmation }
  });
}
