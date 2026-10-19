import { apiRequest } from "../lib/api.js";

export async function getReportTemplate() {
  const data=await apiRequest("/api/configuracoes/relacao-patrimonial");
  return {
    configuracao:data.configuracao,
    atualizado_em:data.atualizado_em || null,
    atualizado_por:data.atualizado_por || null
  };
}

export async function saveReportTemplate(configuracao) {
  const data=await apiRequest("/api/configuracoes/relacao-patrimonial",{
    method:"PUT",
    body:{configuracao}
  });
  return {
    configuracao:data.configuracao,
    atualizado_em:data.atualizado_em || null
  };
}
