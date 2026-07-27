import { supabase } from "../lib/supabase.js";

export async function countSigem() {
  const { count, error } = await supabase
    .from("descricoes_padrao")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);
  if (error) throw error;
  return count ?? 0;
}

// Carregamento sob demanda: somente quando o usuário pesquisa no cadastro.
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
