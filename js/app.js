import { supabase, hasSupabaseConfig, hasSupabaseLibrary } from "./lib/supabase.js";
import { money, normalizeMoney, typeName, escapeHtml, debounce } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getSession, signOut, onAuthChange } from "./services/auth.js";
import { listCenters } from "./services/centros.js";
import { searchSigem, createHospitalCatalogItem } from "./services/sigem.js";
import { listAssets, createAsset } from "./services/patrimonios.js";
import { renderLogin } from "./pages/login.js";

const state = {
  currentView: "dashboard",
  centers: [],
  assets: [],
  search: "",
  session: null,
  selectedSigem: null,
  showDashboardValue: false
};

const appRoot = document.querySelector("#appRoot");

function renderFatal(title, message) {
  appRoot.innerHTML = `<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Diagnóstico</small></div></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></section></main>`;
}

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
        <label class="full sigem-field">Item de referência *<input id="sigemSearch" required autocomplete="off" placeholder="Pesquise no SIGEM ou no catálogo HRPP"><input id="descricaoPadraoId" type="hidden"><div id="sigemResults" class="search-results" hidden></div><small id="sigemHint">A busca consulta SIGEM e itens próprios do hospital somente quando você digita.</small></label>
        <label>Valor de aquisição<input id="valor" inputmode="decimal" placeholder="Deixe vazio para usar o valor de referência"><small>Se não informado, será usado o valor do item selecionado.</small></label>
        <label>Valor de referência<input id="valorSigem" readonly tabindex="-1"></label>
        <label>Centro de custo *<select id="centroCusto" required></select></label>
        <label>Aquisição *<select id="aquisicao" required><option value="">Selecione</option><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option></select></label>
        <label>Estado de conservação<select id="estado"><option value="">Bem Conservado (padrão)</option><option value="PRODUTO_NOVO">Produto Novo</option><option value="BEM_CONSERVADO">Bem Conservado</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>
        <label>ID SES<input id="idSes" maxlength="50"></label>
        <label>Marca/Modelo<input id="marcaModelo" maxlength="120"></label>
        <label>Nº Nota Fiscal<input id="notaFiscal" maxlength="60"></label>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelButton">Cancelar</button><button type="submit" class="primary-button" id="saveAssetButton">Salvar patrimônio</button></div>
    </form>
  </dialog>

  <dialog id="catalogDialog">
    <form method="dialog" id="catalogForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeCatalogButton">← Voltar</button><h2>Novo item do hospital</h2><p>Será salvo no catálogo interno com a identificação “- HRPP” e poderá ser reutilizado.</p></div>
      <div class="form-grid">
        <label class="full">Descrição *<input id="catalogDescription" required maxlength="180" placeholder="Ex.: Cadeira específica para coleta"></label>
        <label>Valor de referência *<input id="catalogValue" required inputmode="decimal" placeholder="0,00"></label>
        <label>Tipo *<select id="catalogType" required><option value="">Selecione</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select></label>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelCatalogButton">Cancelar</button><button type="submit" class="primary-button" id="saveCatalogButton">Salvar e selecionar</button></div>
    </form>
  </dialog>`;
  bindStaticActions();
}

async function loadData() {
  try {
    [state.centers, state.assets] = await Promise.all([listCenters(), listAssets()]);
    render();
  } catch (error) {
    toast(`Erro ao carregar dados: ${error.message}`, "error");
  }
}

function filteredAssets() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.assets;
  return state.assets.filter((asset) => [asset.id_interna, asset.id_ses, asset.descricao, asset.marca_modelo, asset.centros_custo?.nome, typeName(asset.tipo_id)].some((value) => String(value || "").toLowerCase().includes(q)));
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.currentView));
  switch (state.currentView) {
    case "dashboard": renderDashboard(); break;
    case "patrimonios": renderAssets(); break;
    case "centros": renderCenters(); break;
    case "importacao": placeholder("Importação", "Receberá CSV, validação e de-para antes da confirmação."); break;
    case "etiquetas": placeholder("Etiquetas", "Será conectado ao layout de QR Code e PDF em lote."); break;
    case "relatorios": placeholder("Relatórios", "Exportações por filtros e seleção de colunas."); break;
    case "configuracoes": placeholder("Configurações", `Usuário conectado: ${escapeHtml(state.session?.user?.email || "")}.`); break;
    default: renderDashboard();
  }
}

function renderDashboard() {
  const active = state.assets.filter((asset) => asset.status === "ATIVO").length;
  const total = state.assets.reduce((sum, asset) => sum + Number(asset.valor_aquisicao || 0), 0);
  const valueContent = state.showDashboardValue ? money(total) : "R$ ••••••";
  const visibilityLabel = state.showDashboardValue ? "Ocultar valor" : "Mostrar valor";

  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header"><div><h1>Visão geral</h1><p>Dados reais do Supabase.</p></div><button class="primary-button" data-action="new">+ Cadastrar patrimônio</button></div>
    <div class="cards cards-three">
      <article class="card"><span class="muted">Patrimônios</span><div class="metric">${state.assets.length}</div></article>
      <article class="card"><span class="muted">Ativos</span><div class="metric">${active}</div></article>
      <article class="card"><span class="muted">Centros de custo</span><div class="metric">${state.centers.length}</div></article>
    </div>
    <div class="cards cards-secondary">
      <article class="card value-card"><div><span class="muted">Valor cadastrado</span><div class="metric metric-money">${valueContent}</div></div><button class="ghost-button" data-action="toggle-value" aria-pressed="${state.showDashboardValue}">${visibilityLabel}</button></article>
    </div>
    ${assetsTable(state.assets.slice(0, 8), "Últimos patrimônios")}`;
  bindDynamicActions();
}

function renderAssets() {
  const rows = filteredAssets();
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>Patrimônios</h1><p>Consulte e cadastre bens no banco real.</p></div><button class="primary-button" data-action="new">+ Novo patrimônio</button></div>${assetsTable(rows, `${rows.length} patrimônio(s)`)}`;
  bindDynamicActions();
}

function assetsTable(assets, title) {
  if (!assets.length) return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div><div class="empty">Nenhum patrimônio encontrado.</div></section>`;
  return `<section class="panel"><div class="panel-header"><h2>${title}</h2><button class="ghost-button" data-action="export">Exportar CSV</button></div><div class="table-wrap"><table><thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th></tr></thead><tbody>${assets.map((asset) => `<tr><td><strong>${escapeHtml(asset.id_interna)}</strong></td><td>${escapeHtml(asset.descricao)}</td><td>${typeName(asset.tipo_id)}</td><td>${escapeHtml(asset.centros_custo?.nome || "—")}</td><td>${money(asset.valor_aquisicao)}</td><td class="${asset.status === "ATIVO" ? "status-active" : "status-inactive"}">${asset.status === "ATIVO" ? "Ativo" : "Inativo"}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderCenters() {
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>Centros de custo</h1><p>Dados carregados diretamente do banco.</p></div></div><section class="panel"><div class="panel-header"><h2>${state.centers.length} centro(s)</h2></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Centro de custo</th><th>Status</th></tr></thead><tbody>${state.centers.map((center) => `<tr><td>${escapeHtml(center.codigo)}</td><td><strong>${escapeHtml(center.nome)}</strong></td><td class="${center.ativo ? "status-active" : "status-inactive"}">${center.ativo ? "Ativo" : "Inativo"}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function placeholder(title, description) {
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>${title}</h1><p>${description}</p></div></div><div class="placeholder">Módulo reservado para a próxima etapa.</div>`;
}

function bindStaticActions() {
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => { state.currentView = button.dataset.view; document.querySelector("#sidebar").classList.remove("open"); render(); }));
  document.querySelector("#quickAddButton").addEventListener("click", openNewAsset);
  document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#logoutButton").addEventListener("click", async () => { try { await signOut(); } catch (error) { toast(error.message, "error"); } });
  document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
  document.querySelector("#cancelButton").addEventListener("click", closeDialog);
  document.querySelector("#assetForm").addEventListener("submit", submitAsset);
  document.querySelector("#globalSearch").addEventListener("input", (event) => { state.search = event.target.value; state.currentView = "patrimonios"; render(); });
  document.querySelector("#sigemSearch").addEventListener("input", debounce(handleSigemSearch));
  document.querySelector("#closeCatalogButton").addEventListener("click", closeCatalogDialog);
  document.querySelector("#cancelCatalogButton").addEventListener("click", closeCatalogDialog);
  document.querySelector("#catalogForm").addEventListener("submit", submitCatalogItem);
}

function bindDynamicActions() {
  document.querySelectorAll('[data-action="new"]').forEach((button) => button.addEventListener("click", openNewAsset));
  document.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener("click", exportCsv));
  document.querySelectorAll('[data-action="toggle-value"]').forEach((button) => button.addEventListener("click", () => { state.showDashboardValue = !state.showDashboardValue; renderDashboard(); }));
}

function populateCenters() {
  document.querySelector("#centroCusto").innerHTML = `<option value="">Selecione</option>${state.centers.filter((center) => center.ativo).map((center) => `<option value="${center.id}">${escapeHtml(center.nome)}</option>`).join("")}`;
}

function openNewAsset() {
  document.querySelector("#assetForm").reset();
  state.selectedSigem = null;
  document.querySelector("#descricaoPadraoId").value = "";
  document.querySelector("#valorSigem").value = "";
  document.querySelector("#sigemResults").hidden = true;
  populateCenters();
  document.querySelector("#assetDialog").showModal();
  document.querySelector("#tipo").focus();
}

function closeDialog() { document.querySelector("#assetDialog").close(); }
function closeCatalogDialog() { document.querySelector("#catalogDialog").close(); }

function openCatalogDialog() {
  const currentSearch = document.querySelector("#sigemSearch").value.trim();
  const currentType = document.querySelector("#tipo").value;
  document.querySelector("#catalogForm").reset();
  document.querySelector("#catalogDescription").value = currentSearch;
  document.querySelector("#catalogType").value = currentType;
  document.querySelector("#catalogDialog").showModal();
  document.querySelector("#catalogDescription").focus();
}

async function handleSigemSearch(event) {
  const input = event.target;
  state.selectedSigem = null;
  document.querySelector("#descricaoPadraoId").value = "";
  document.querySelector("#valorSigem").value = "";
  const box = document.querySelector("#sigemResults");
  if (input.value.trim().length < 2) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<div class="search-message">Pesquisando…</div>';
  try {
    const items = await searchSigem(input.value);
    const options = items.map((item) => `<button type="button" class="sigem-option" data-id="${item.id}" data-description="${escapeHtml(item.descricao)}" data-value="${item.valor_padrao}" data-origin="${/\s-\sHRPP$/i.test(item.descricao) ? "HRPP" : "SIGEM"}"><span>${escapeHtml(item.descricao)}<small>${/\s-\sHRPP$/i.test(item.descricao) ? "Catálogo HRPP" : "SIGEM"}</small></span><strong>${money(item.valor_padrao)}</strong></button>`).join("");
    box.innerHTML = `${options || '<div class="search-message">Nenhum item encontrado.</div>'}<button type="button" class="catalog-create-option" id="createCatalogItemButton">+ Cadastrar novo item do hospital</button>`;
    box.querySelectorAll(".sigem-option").forEach((button) => button.addEventListener("click", () => selectSigem(button)));
    document.querySelector("#createCatalogItemButton").addEventListener("click", openCatalogDialog);
  } catch (error) {
    box.innerHTML = `<div class="search-message">Erro: ${escapeHtml(error.message)}</div>`;
  }
}

function selectSigem(buttonOrItem) {
  const item = buttonOrItem.dataset ? {
    id: buttonOrItem.dataset.id,
    descricao: buttonOrItem.dataset.description,
    valor: Number(buttonOrItem.dataset.value),
    origem: buttonOrItem.dataset.origin
  } : {
    id: buttonOrItem.id,
    descricao: buttonOrItem.descricao,
    valor: Number(buttonOrItem.valor_padrao),
    origem: buttonOrItem.origem
  };

  state.selectedSigem = item;
  document.querySelector("#sigemSearch").value = item.descricao;
  document.querySelector("#descricaoPadraoId").value = item.id;
  document.querySelector("#valorSigem").value = money(item.valor);
  document.querySelector("#sigemResults").hidden = true;
}

async function submitCatalogItem(event) {
  event.preventDefault();
  const description = document.querySelector("#catalogDescription").value.trim();
  const value = normalizeMoney(document.querySelector("#catalogValue").value);
  if (!description) { toast("Informe a descrição do item.", "error"); return; }
  if (!Number.isFinite(value) || value < 0) { toast("Informe um valor de referência válido.", "error"); return; }

  const button = document.querySelector("#saveCatalogButton");
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    const item = await createHospitalCatalogItem({
      descricao: description,
      valorPadrao: value,
      tipoId: Number(document.querySelector("#catalogType").value)
    });
    selectSigem(item);
    closeCatalogDialog();
    toast("Item HRPP cadastrado e selecionado.", "success");
  } catch (error) {
    toast(error.code === "23505" ? "Já existe um item com essa descrição." : error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Salvar e selecionar";
  }
}

async function submitAsset(event) {
  event.preventDefault();
  if (!state.selectedSigem || !document.querySelector("#descricaoPadraoId").value) {
    toast("Selecione um item na lista de resultados.", "error");
    return;
  }

  const rawValue = document.querySelector("#valor").value.trim();
  const value = rawValue ? normalizeMoney(rawValue) : Number(state.selectedSigem.valor);
  if (rawValue && (!Number.isFinite(value) || value < 0)) {
    toast("Informe um valor de aquisição válido ou deixe o campo vazio.", "error");
    return;
  }

  const button = document.querySelector("#saveAssetButton");
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    const asset = await createAsset({
      id_ses: document.querySelector("#idSes").value.trim() || null,
      descricao: document.querySelector("#descricao").value.trim(),
      descricao_padrao_id: state.selectedSigem.id,
      data_aquisicao: document.querySelector("#dataAquisicao").value || new Date().toISOString().slice(0, 10),
      valor_aquisicao: value,
      nota_fiscal_numero: document.querySelector("#notaFiscal").value.trim() || null,
      centro_custo_id: document.querySelector("#centroCusto").value,
      tipo_id: Number(document.querySelector("#tipo").value),
      marca_modelo: document.querySelector("#marcaModelo").value.trim() || null,
      status: "ATIVO",
      tipo_aquisicao: document.querySelector("#aquisicao").value,
      estado_conservacao: document.querySelector("#estado").value || "BEM_CONSERVADO"
    });
    state.assets.unshift(asset);
    closeDialog();
    state.currentView = "patrimonios";
    render();
    toast(`Patrimônio ${asset.id_interna} cadastrado.`, "success");
  } catch (error) {
    toast(error.code === "23505" ? "ID SES ou ID interna já cadastrado." : error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Salvar patrimônio";
  }
}

function exportCsv() {
  const rows = filteredAssets();
  const data = [["ID Interna", "ID SES", "Descrição", "Item de referência", "Tipo", "Centro de Custo", "Valor", "Status"], ...rows.map((asset) => [asset.id_interna, asset.id_ses || "", asset.descricao, asset.descricoes_padrao?.descricao || "", typeName(asset.tipo_id), asset.centros_custo?.nome || "", asset.valor_aquisicao, asset.status])];
  const csv = data.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `patrimonios-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function start() {
  if (!hasSupabaseConfig()) { renderConfigError(); return; }
  if (!hasSupabaseLibrary()) {
    renderFatal("Biblioteca não carregada", "O navegador não conseguiu carregar a biblioteca do Supabase. Faça Ctrl+F5 e verifique se a rede ou o bloqueador de conteúdo está impedindo cdn.jsdelivr.net.");
    return;
  }
  state.session = await getSession();
  if (!state.session) renderLogin(appRoot); else { shell(); await loadData(); }
  onAuthChange(async (session) => {
    state.session = session;
    if (!session) renderLogin(appRoot); else { shell(); await loadData(); }
  });
}

start().catch((error) => {
  console.error(error);
  renderFatal("Erro ao iniciar", error?.message || "Erro desconhecido ao iniciar o sistema.");
});
