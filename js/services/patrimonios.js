import { supabase } from "../lib/supabase.js";

const SELECT_FIELDS = `
  id,id_interna,id_ses,descricao,data_aquisicao,valor_aquisicao,
  nota_fiscal_numero,tipo_id,marca_modelo,status,tipo_aquisicao,
  estado_conservacao,criado_em,
  centros_custo:centro_custo_id(id,codigo,nome),
  descricoes_padrao:descricao_padrao_id(id,descricao,valor_padrao)
`;

export async function listAssets() {
  const { data, error } = await supabase
    .from("patrimonios")
    .select(SELECT_FIELDS)
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

export async function createAsset(payload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await supabase
    .from("patrimonios")
    .insert({ ...payload, id_interna: null, criado_por: userData.user.id, atualizado_por: userData.user.id })
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return data;
}
