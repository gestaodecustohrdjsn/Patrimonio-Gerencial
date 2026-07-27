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
