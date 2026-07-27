import { supabase } from "../lib/supabase.js";

const SELECT_FIELDS = `
  id,id_interna,id_ses,descricao,data_aquisicao,valor_aquisicao,
  nota_fiscal_numero,tipo_id,marca_modelo,status,tipo_aquisicao,
  estado_conservacao,criado_em,atualizado_em,removido,removido_em,
  centros_custo:centro_custo_id(id,codigo,nome),
  descricoes_padrao:descricao_padrao_id(id,descricao,valor_padrao)
`;

export async function listAssets() {
  const { data, error } = await supabase
    .from("patrimonios")
    .select(SELECT_FIELDS)
    .order("criado_em", { ascending: false })
    .limit(1000);
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

export async function updateAsset(id, payload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await supabase
    .from("patrimonios")
    .update({ ...payload, atualizado_por: userData.user.id, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function setAssetRemoved(id, removed) {
  const functionName = removed ? "remover_patrimonio_logicamente" : "restaurar_patrimonio_removido";
  const { data, error } = await supabase.rpc(functionName, { p_patrimonio_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const { data: hydrated, error: readError } = await supabase
    .from("patrimonios")
    .select(SELECT_FIELDS)
    .eq("id", row.id)
    .single();
  if (readError) throw readError;
  return hydrated;
}

export async function permanentlyDeleteTestAsset(id, confirmation) {
  const { error } = await supabase.rpc("excluir_patrimonio_teste", {
    p_patrimonio_id: id,
    p_confirmacao: confirmation
  });
  if (error) throw error;
}

export async function listAssetHistory(id) {
  const { data, error } = await supabase
    .from("historico_alteracoes")
    .select("id,operacao,dados_anteriores,dados_novos,usuario_id,criado_em")
    .eq("tabela", "patrimonios")
    .eq("registro_id", id)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}
