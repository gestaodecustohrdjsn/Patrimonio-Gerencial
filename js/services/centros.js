import { apiRequest } from "../lib/api.js";

export async function listCenters() {
  const data = await apiRequest("/api/centros");
  return data.centros || [];
}
