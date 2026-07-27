import { supabase } from "../lib/supabase.js";

// Consulta sob demanda: o catálogo só é acessado quando o usuário pesquisa.
export async function searchSigem(term, limit = 20) {
  const text = term.trim();
  if (text.length < 2) return [];

  const { data, error } = await supabase
    .from("descricoes_padrao")
    .select("id,descricao,valor_padrao,tipo_id")
    .eq("ativo", true)
    .ilike("descricao", `%${text}%`)
    .order("descricao")
    .limit(limit);

  if (error) throw error;
  return data;
}

// O cadastro HRPP usa uma função segura do banco, sem liberar INSERT direto na tabela.
export async function createHospitalCatalogItem({ descricao, valorPadrao, tipoId }) {
  const { data, error } = await supabase.rpc("cadastrar_item_catalogo_hrpp", {
    p_descricao: descricao,
    p_valor_padrao: valorPadrao,
    p_tipo_id: tipoId
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
