import { supabase } from "../lib/supabase.js";

export async function listCenters() {
  const { data, error } = await supabase
    .from("centros_custo")
    .select("id,codigo,nome,ativo")
    .order("ativo", { ascending: false })
    .order("nome");
  if (error) throw error;
  return data;
}
