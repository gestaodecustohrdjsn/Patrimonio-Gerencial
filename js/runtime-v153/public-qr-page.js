import { money, typeName, escapeHtml } from "./lib/utils.js";

function formatDate(value) {
  if(!value) return "—";
  const d=new Date(value+"T12:00:00");
  if(Number.isNaN(d.getTime())) return "—";
  try{return new Intl.DateTimeFormat("pt-BR").format(d);}catch{return "—";}
}
function formatDateTime(value) {
  if(!value) return "—";
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "—";
  try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(d);}catch{return "—";}
}
function acquisitionName(value) {
  return ({COMPRA:"Compra",DOACAO:"Doação",LOCACAO:"Locação",CONTRATO_GESTAO:"Contrato de Gestão"})[value] || value || "—";
}
function conservationName(value) {
  return ({PRODUTO_NOVO:"Produto Novo",BEM_CONSERVADO:"Bem Conservado",DESGASTADO:"Desgastado",INUTILIZAVEL:"Inutilizável"})[value] || value || "—";
}
function field(label,value) {
  if(value===null || value===undefined || value==="") return "";
  return \`<div class="public-field"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(String(value))}</strong></div>\`;
}
function card(title,content) {
  if(!content || !content.trim()) return "";
  return \`<article class="public-card"><h2>\${escapeHtml(title)}</h2>\${content}</article>\`;
}

export function renderPublicQrAssetHtml(asset) {
  const c=asset.public_configuracao || {};
  const fields=c.campos || {};
  const statusText=asset.status==="ATIVO" ? "Ativo" : asset.status==="INATIVO" ? "Inativo" : null;
  const centerName=asset.centros_custo?.nome || null;
  const sigemName=asset.descricoes_padrao?.descricao || null;
  const displayName=sigemName || asset.descricao || asset.id_interna || "Patrimônio";
  const allowed=(asset.centros_permitidos||[]).map(row=>row.nome).filter(Boolean).join(", ");
  const logo=c.logo_data_url
    ? \`<img class="public-brand-logo" src="\${escapeHtml(c.logo_data_url)}" alt="Logo institucional">\`
    : '<div class="brand-mark">P+</div>';

  const identification=[
    fields.id_interna!==false ? field("ID interna",asset.id_interna) : "",
    field("ID SES",asset.id_ses),
    field("Item do Catálogo",sigemName),
    field("Descrição complementar",asset.descricao),
    field("Tipo",asset.tipo_id ? typeName(asset.tipo_id) : null),
    field("Marca / Modelo",asset.marca_modelo)
  ].join("");

  const condition=[
    field("Centro de custo",centerName),
    asset.mobilidade ? field("Mobilidade",asset.mobilidade==="MOVEL" ? "Móvel" : "Fixo") : "",
    field("Estado de conservação",asset.estado_conservacao ? conservationName(asset.estado_conservacao) : null),
    field("Status",statusText),
    asset.em_manutencao ? field("Condição operacional","Em manutenção") : "",
    allowed ? field("Centros permitidos",allowed) : ""
  ].join("");

  const acquisition=[
    field("Forma de aquisição",asset.tipo_aquisicao ? acquisitionName(asset.tipo_aquisicao) : null),
    field("Data de aquisição",asset.data_aquisicao ? formatDate(asset.data_aquisicao) : null),
    field("Valor informado",asset.valor_aquisicao!==null && asset.valor_aquisicao!==undefined ? money(asset.valor_aquisicao) : null),
    field("Nota fiscal",asset.nota_fiscal_numero)
  ].join("");

  const notices=[
    statusText==="Inativo" && c.mensagem_inativo ? \`<div class="public-notice is-inactive">\${escapeHtml(c.mensagem_inativo)}</div>\` : "",
    asset.em_manutencao && c.mensagem_manutencao ? \`<div class="public-notice is-maintenance">\${escapeHtml(c.mensagem_manutencao)}</div>\` : ""
  ].join("");

  return \`
    <main class="public-page">
      <section class="public-shell">
        <header class="public-brand">
          \${logo}
          <div><strong>\${escapeHtml(c.instituicao || "Patrimônio+")}</strong><small>\${escapeHtml(c.titulo || "Consulta pública de patrimônio")}</small></div>
        </header>

        <section class="public-hero">
          <div>
            <span class="public-eyebrow">Consulta pública · somente visualização</span>
            <h1>\${escapeHtml(displayName)}</h1>
            \${c.subtitulo ? \`<p class="public-subtitle">\${escapeHtml(c.subtitulo)}</p>\` : ""}
            <div class="public-id-block"><span>ID interna</span><p class="public-id">\${escapeHtml(asset.id_interna||"—")}</p></div>
          </div>
          <div class="public-hero-status">
            \${statusText ? \`<span class="public-status \${statusText==="Ativo"?"is-active":"is-inactive"}">\${statusText}</span>\` : ""}
            \${asset.em_manutencao ? '<span class="public-context-tag is-maintenance">[Em manutenção]</span>' : ""}
          </div>
        </section>

        \${c.texto_orientacao ? \`<p class="public-guidance">\${escapeHtml(c.texto_orientacao)}</p>\` : ""}
        \${notices}
        <section class="public-card-grid">
          \${card("Identificação",identification)}
          \${card("Localização e condição",condition)}
          \${card("Aquisição",acquisition)}
        </section>

        <footer class="public-footer">
          <span>\${escapeHtml(c.rodape || "Consulta somente para visualização")}</span>
          \${asset.atualizado_em ? \`<small>Última atualização: \${escapeHtml(formatDateTime(asset.atualizado_em))}</small>\` : ""}
        </footer>
      </section>
    </main>\`;
}
