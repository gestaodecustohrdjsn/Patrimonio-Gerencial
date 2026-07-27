import { supabase, hasSupabaseConfig } from "./lib/supabase.js";
import { money, normalizeMoney, typeName, escapeHtml, debounce } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getSession, signOut, onAuthChange } from "./services/auth.js";
import { listCenters } from "./services/centros.js";
import { countSigem, searchSigem } from "./services/sigem.js";
import { listAssets, createAsset } from "./services/patrimonios.js";
import { renderLogin } from "./pages/login.js";

const state = { currentView: "dashboard", centers: [], assets: [], sigemCount: 0, search: "", session: null, selectedSigem: null };
const appRoot = document.querySelector("#appRoot");

function renderConfigError() {
  appRoot.innerHTML = `<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Configuração inicial</small></div></div><h1>Conexão pendente</h1><p>Preencha <code>js/config.js</code> com a Project URL e a Publishable Key do Supabase.</p></section></main>`;
}

function shell() {
  appRoot.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Gestão patrimonial</small></div></div>
      <nav class="nav">
        <button class="nav-item active" data-view="dashboard">Visão geral</button>
        <button class="nav-item" data-view="patrimonios">Patrimônios</button>
        <button class="nav-item" data-view="centros">Centros de custo</button>
        <button class="nav-item" data-view="importacao">Importação</button>
        <button class="nav-item" data-view="etiquetas">Etiquetas</button>
        <button class="nav-item" data-view="relatorios">Relatórios</button>
        <button class="nav-item" data-view="configuracoes">Configurações</button>
      </nav>
      <div class="sidebar-footer"><span class="badge">Supabase conectado</span><button class="logout-button" id="logoutButton">Sair</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><button class="icon-button" id="menuButton">☰</button><div class="search-wrap"><input id="globalSearch" type="search" placeholder="Pesquisar ID, descrição, centro ou marca…"></div><button class="secondary-button" id="quickAddButton">+ Novo patrimônio</button></header>
      <section id="viewRoot" class="content"><div class="loading">Carregando dados…</div></section>
    </main>
  </div>
  <dialog id="assetDialog">
    <form method="dialog" id="assetForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeDialogButton">← Voltar</button><h2>Novo patrimônio</h2><p>A ID interna será gerada automaticamente pelo banco.</p></div>
      <div class="form-grid">
        <label>Tipo *<select id="tipo" required><option value="">Selecione</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select></label>
        <label>Data de aquisição<input id="dataAquisicao" type="date"><small>Se ficar vazia, será usada a data atual.</small></label>
        <label class="full">Descrição do bem *<input id="descricao" required maxlength="180" placeholder="Ex.: Cadeira fixa azul"></label>
        <label class="full sigem-field">Item SIGEM *<input id="sigemSearch" required autocomplete="off" placeholder="Digite pelo menos 2 letras para pesquisar"><input id="descricaoPadraoId" type="hidden"><div id="sigemResults" class="search-results" hidden></div><small id="sigemHint">Os itens são consultados apenas durante esta pesquisa.</small></label>
        <label>Valor de aquisição *<input id="valor" required inputmode="decimal" placeholder="0,00"></label>
        <label>Valor padrão SIGEM<input id="valorSigem" readonly tabindex="-1"></label>
        <label>Centro de custo *<select id="centroCusto" required></select></label>
        <label>Aquisição *<select id="aquisicao" required><option value="">Selecione</option><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option></select></label>
        <label>Estado de conservação *<select id="estado" required><option value="">Selecione</option><option value="PRODUTO_NOVO">Produto Novo</option><option value="BEM_CONSERVADO">Bem Conservado</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>
        <label>ID SES<input id="idSes" maxlength="50"></label>
        <label>Marca/Modelo<input id="marcaModelo" maxlength="120"></label>
        <label>Nº Nota Fiscal<input id="notaFiscal" maxlength="60"></label>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelButton">Cancelar</button><button type="submit" class="primary-button" id="saveAssetButton">Salvar patrimônio</button></div>
    </form>
  </dialog>`;
  bindStaticActions();
}

async function loadData() {
  try {
    [state.centers, state.assets, state.sigemCount] = await Promise.all([listCenters(), listAssets(), countSigem()]);
    render();
  } catch (error) { toast(`Erro ao carregar dados: ${error.message}`, "error"); }
}

function filteredAssets() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.assets;
  return state.assets.filter(a => [a.id_interna,a.id_ses,a.descricao,a.marca_modelo,a.centros_custo?.nome,typeName(a.tipo_id)].some(v => String(v || "").toLowerCase().includes(q)));
}

function render() {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === state.currentView));
  ({ dashboard: renderDashboard, patrimonios: renderAssets, centros: renderCenters,
    importacao: () => placeholder("Importação", "Receberá CSV, validação e de-para antes da confirmação."),
    etiquetas: () => placeholder("Etiquetas", "Será conectado ao layout de QR Code e PDF em lote."),
    relatorios: () => placeholder("Relatórios", "Exportações por filtros e seleção de colunas."),
    configuracoes: () => placeholder("Configurações", `Usuário conectado: ${escapeHtml(state.session?.user?.email || "")}.`) }[state.currentView]();
}

function renderDashboard() {
  const active = state.assets.filter(a => a.status === "ATIVO").length;
  const total = state.assets.reduce((s,a) => s + Number(a.valor_aquisicao || 0), 0);
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>Visão geral</h1><p>Dados reais do Supabase.</p></div><button class="primary-button" data-action="new">+ Cadastrar patrimônio</button></div><div class="cards"><article class="card"><span class="muted">Patrimônios</span><div class="metric">${state.assets.length}</div></article><article class="card"><span class="muted">Ativos</span><div class="metric">${active}</div></article><article class="card"><span class="muted">Centros de custo</span><div class="metric">${state.centers.length}</div></article><article class="card"><span class="muted">Itens SIGEM</span><div class="metric">${state.sigemCount}</div></article></div><div class="cards cards-secondary"><article class="card"><span class="muted">Valor cadastrado</span><div class="metric metric-money">${money(total)}</div></article></div>${assetsTable(state.assets.slice(0,8), "Últimos patrimônios")}`;
  bindDynamicActions();
}

function renderAssets() { const rows = filteredAssets(); document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>Patrimônios</h1><p>Consulte e cadastre bens no banco real.</p></div><button class="primary-button" data-action="new">+ Novo patrimônio</button></div>${assetsTable(rows, `${rows.length} patrimônio(s)`)}`; bindDynamicActions(); }

function assetsTable(assets,title) {
  if (!assets.length) return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div><div class="empty">Nenhum patrimônio encontrado.</div></section>`;
  return `<section class="panel"><div class="panel-header"><h2>${title}</h2><button class="ghost-button" data-action="export">Exportar CSV</button></div><div class="table-wrap"><table><thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th></tr></thead><tbody>${assets.map(a => `<tr><td><strong>${escapeHtml(a.id_interna)}</strong></td><td>${escapeHtml(a.descricao)}</td><td>${typeName(a.tipo_id)}</td><td>${escapeHtml(a.centros_custo?.nome || "—")}</td><td>${money(a.valor_aquisicao)}</td><td class="${a.status === "ATIVO" ? "status-active" : "status-inactive"}">${a.status === "ATIVO" ? "Ativo" : "Inativo"}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderCenters() { document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>Centros de custo</h1><p>Dados carregados diretamente do banco.</p></div></div><section class="panel"><div class="panel-header"><h2>${state.centers.length} centro(s)</h2></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Centro de custo</th><th>Status</th></tr></thead><tbody>${state.centers.map(c => `<tr><td>${escapeHtml(c.codigo)}</td><td><strong>${escapeHtml(c.nome)}</strong></td><td class="${c.ativo ? "status-active" : "status-inactive"}">${c.ativo ? "Ativo" : "Inativo"}</td></tr>`).join("")}</tbody></table></div></section>`; }
function placeholder(t,d) { document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>${t}</h1><p>${d}</p></div></div><div class="placeholder">Módulo reservado para a próxima etapa.</div>`; }

function bindStaticActions() {
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => { state.currentView = btn.dataset.view; document.querySelector("#sidebar").classList.remove("open"); render(); }));
  document.querySelector("#quickAddButton").addEventListener("click", openNewAsset);
  document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#logoutButton").addEventListener("click", async () => { try { await signOut(); } catch (e) { toast(e.message,"error"); } });
  document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
  document.querySelector("#cancelButton").addEventListener("click", closeDialog);
  document.querySelector("#assetForm").addEventListener("submit", submitAsset);
  document.querySelector("#globalSearch").addEventListener("input", e => { state.search = e.target.value; state.currentView = "patrimonios"; render(); });
  document.querySelector("#sigemSearch").addEventListener("input", debounce(handleSigemSearch));
}
function bindDynamicActions() { document.querySelectorAll('[data-action="new"]').forEach(b => b.addEventListener("click",openNewAsset)); document.querySelectorAll('[data-action="export"]').forEach(b => b.addEventListener("click",exportCsv)); }
function populateCenters() { document.querySelector("#centroCusto").innerHTML = `<option value="">Selecione</option>${state.centers.filter(c=>c.ativo).map(c=>`<option value="${c.id}">${escapeHtml(c.codigo)} — ${escapeHtml(c.nome)}</option>`).join("")}`; }
function openNewAsset() { document.querySelector("#assetForm").reset(); state.selectedSigem = null; document.querySelector("#descricaoPadraoId").value=""; document.querySelector("#sigemResults").hidden=true; populateCenters(); document.querySelector("#assetDialog").showModal(); document.querySelector("#tipo").focus(); }
function closeDialog() { document.querySelector("#assetDialog").close(); }

async function handleSigemSearch(event) {
  const input = event.target; state.selectedSigem = null; document.querySelector("#descricaoPadraoId").value=""; document.querySelector("#valorSigem").value="";
  const box = document.querySelector("#sigemResults");
  if (input.value.trim().length < 2) { box.hidden=true; return; }
  box.hidden=false; box.innerHTML='<div class="search-message">Pesquisando…</div>';
  try {
    const items = await searchSigem(input.value);
    box.innerHTML = items.length ? items.map(item => `<button type="button" class="sigem-option" data-id="${item.id}" data-description="${escapeHtml(item.descricao)}" data-value="${item.valor_padrao}"><span>${escapeHtml(item.descricao)}</span><strong>${money(item.valor_padrao)}</strong></button>`).join("") : '<div class="search-message">Nenhum item encontrado.</div>';
    box.querySelectorAll(".sigem-option").forEach(button => button.addEventListener("click", () => selectSigem(button)));
  } catch (e) { box.innerHTML=`<div class="search-message">Erro: ${escapeHtml(e.message)}</div>`; }
}
function selectSigem(button) { state.selectedSigem={id:button.dataset.id,descricao:button.dataset.description,valor:Number(button.dataset.value)}; document.querySelector("#sigemSearch").value=state.selectedSigem.descricao; document.querySelector("#descricaoPadraoId").value=state.selectedSigem.id; document.querySelector("#valorSigem").value=money(state.selectedSigem.valor); document.querySelector("#sigemResults").hidden=true; }

async function submitAsset(event) {
  event.preventDefault();
  if (!state.selectedSigem || !document.querySelector("#descricaoPadraoId").value) { toast("Selecione um item SIGEM na lista de resultados.","error"); return; }
  const valor = normalizeMoney(document.querySelector("#valor").value);
  if (!Number.isFinite(valor) || valor < 0) { toast("Informe um valor de aquisição válido.","error"); return; }
  const button=document.querySelector("#saveAssetButton"); button.disabled=true; button.textContent="Salvando…";
  try {
    const asset = await createAsset({
      id_ses: document.querySelector("#idSes").value.trim() || null,
      descricao: document.querySelector("#descricao").value.trim(),
      descricao_padrao_id: state.selectedSigem.id,
      data_aquisicao: document.querySelector("#dataAquisicao").value || new Date().toISOString().slice(0,10),
      valor_aquisicao: valor,
      nota_fiscal_numero: document.querySelector("#notaFiscal").value.trim() || null,
      centro_custo_id: document.querySelector("#centroCusto").value,
      tipo_id: Number(document.querySelector("#tipo").value),
      marca_modelo: document.querySelector("#marcaModelo").value.trim() || null,
      status: "ATIVO",
      tipo_aquisicao: document.querySelector("#aquisicao").value,
      estado_conservacao: document.querySelector("#estado").value
    });
    state.assets.unshift(asset); closeDialog(); state.currentView="patrimonios"; render(); toast(`Patrimônio ${asset.id_interna} cadastrado.`,"success");
  } catch (e) { toast(e.code === "23505" ? "ID SES ou ID interna já cadastrado." : e.message,"error"); }
  finally { button.disabled=false; button.textContent="Salvar patrimônio"; }
}

function exportCsv() { const rows=filteredAssets(); const data=[["ID Interna","ID SES","Descrição","Item SIGEM","Tipo","Centro de Custo","Valor","Status"],...rows.map(a=>[a.id_interna,a.id_ses||"",a.descricao,a.descricoes_padrao?.descricao||"",typeName(a.tipo_id),a.centros_custo?.nome||"",a.valor_aquisicao,a.status])]; const csv=data.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n"); const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=url;a.download=`patrimonios-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url); }

async function start() {
  if (!hasSupabaseConfig()) { renderConfigError(); return; }
  state.session = await getSession();
  if (!state.session) renderLogin(appRoot); else { shell(); await loadData(); }
  onAuthChange(async session => { state.session=session; if (!session) renderLogin(appRoot); else { shell(); await loadData(); } });
}
start().catch(e => { console.error(e); toast(e.message,"error"); });
