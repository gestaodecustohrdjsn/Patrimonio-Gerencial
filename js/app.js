import { supabase, hasSupabaseConfig, hasSupabaseLibrary } from "./lib/supabase.js";
import { money, normalizeMoney, typeName, escapeHtml, debounce } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getSession, signOut, onAuthChange } from "./services/auth.js";
import { listCenters } from "./services/centros.js";
import { searchSigem, createHospitalCatalogItem } from "./services/sigem.js";
import { listAssets, createAsset, updateAsset, listAssetHistory } from "./services/patrimonios.js";
import { renderLogin } from "./pages/login.js";

const state = {
  currentView: "dashboard",
  centers: [],
  assets: [],
  search: "",
  session: null,
  selectedSigem: null,
  selectedAssetId: null,
  history: [],
  showDashboardValue: false,
  assetFormMode: "create"
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
      <div class="dialog-header"><button type="button" class="back-button" id="closeDialogButton">← Voltar</button><h2 id="assetDialogTitle">Novo patrimônio</h2><p id="assetDialogSubtitle">A ID interna será gerada automaticamente pelo banco.</p></div>

      <fieldset class="form-section"><legend>Identificação</legend><div class="form-grid">
        <label>Tipo *<select id="tipo" required><option value="">Selecione</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select></label>
        <label>ID SES<input id="idSes" maxlength="50"></label>
        <label class="full">Descrição do bem *<input id="descricao" required maxlength="180" placeholder="Ex.: Cadeira fixa azul"></label>
        <label class="full sigem-field">Item de referência *<div class="input-action-row"><input id="sigemSearch" required autocomplete="off" placeholder="Pesquise no SIGEM ou no catálogo HRPP"><button type="button" class="square-add-button" id="openCatalogButton" title="Cadastrar item HRPP">+</button></div><input id="descricaoPadraoId" type="hidden"><div id="sigemResults" class="search-results" hidden></div><small>A busca consulta a mesma tabela de descrições padrão. Itens internos recebem “- HRPP”.</small></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Aquisição e valores</legend><div class="form-grid">
        <label>Data de aquisição<input id="dataAquisicao" type="date"><small>Se ficar vazia, será usada a data atual.</small></label>
        <label>Aquisição *<select id="aquisicao" required><option value="">Selecione</option><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option></select></label>
        <label>Valor de aquisição<input id="valor" inputmode="decimal" placeholder="Deixe vazio para usar o valor de referência"></label>
        <label>Valor de referência<input id="valorSigem" readonly tabindex="-1"></label>
        <label>Nº Nota Fiscal<input id="notaFiscal" maxlength="60"></label>
        <label>Marca/Modelo<input id="marcaModelo" maxlength="120"></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Localização e condição</legend><div class="form-grid">
        <label>Centro de custo *<select id="centroCusto" required></select></label>
        <label>Estado de conservação<select id="estado"><option value="">Bem Conservado (padrão)</option><option value="PRODUTO_NOVO">Produto Novo</option><option value="BEM_CONSERVADO">Bem Conservado</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>
        <label id="statusField" hidden>Status<select id="status"><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
      </div></fieldset>

      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelButton">Cancelar</button><button type="submit" class="primary-button" id="saveAssetButton">Salvar patrimônio</button></div>
    </form>
  </dialog>

  <dialog id="catalogDialog" class="small-dialog">
    <form method="dialog" id="catalogForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeCatalogButton">← Voltar</button><h2>Novo item HRPP</h2><p>Informe apenas o nome e o valor. O sistema adicionará “- HRPP” automaticamente.</p></div>
      <div class="form-grid">
        <label class="full">Nome do item *<input id="catalogDescription" required maxlength="180" placeholder="Ex.: Cadeira específica para coleta"></label>
        <label class="full">Valor de referência *<input id="catalogValue" required inputmode="decimal" placeholder="0,00"></label>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelCatalogButton">Cancelar</button><button type="submit" class="primary-button" id="saveCatalogButton">Adicionar e selecionar</button></div>
    </form>
  </dialog>

  <dialog id="moveDialog" class="small-dialog">
    <form method="dialog" id="moveForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeMoveButton">← Voltar</button><h2>Movimentar patrimônio</h2><p id="moveCurrentCenter"></p></div>
      <label>Novo centro de custo *<select id="moveCenter" required></select></label>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelMoveButton">Cancelar</button><button type="submit" class="primary-button" id="saveMoveButton">Confirmar movimentação</button></div>
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

function selectedAsset() {
  return state.assets.find((asset) => asset.id === state.selectedAssetId) || null;
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.currentView));
  switch (state.currentView) {
    case "dashboard": renderDashboard(); break;
    case "patrimonios": renderAssets(); break;
    case "ficha": renderAssetDetail(); break;
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
      <article class="card"><span class="muted">Número de patrimônios</span><div class="metric">${state.assets.length}</div></article>
      <article class="card"><span class="muted">Patrimônios ativos</span><div class="metric">${active}</div></article>
      <article class="card value-card"><div><span class="muted">Valor cadastrado</span><div class="metric metric-money">${valueContent}</div></div><button class="ghost-button compact-button" data-action="toggle-value">${visibilityLabel}</button></article>
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
  return `<section class="panel"><div class="panel-header"><h2>${title}</h2><button class="ghost-button" data-action="export">Exportar CSV</button></div><div class="table-wrap"><table><thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th><th>ID SES</th></tr></thead><tbody>${assets.map((asset) => `<tr class="asset-row" data-asset-id="${asset.id}" tabindex="0"><td><strong>${escapeHtml(asset.id_interna)}</strong></td><td>${escapeHtml(asset.descricao)}</td><td>${typeName(asset.tipo_id)}</td><td>${escapeHtml(asset.centros_custo?.nome || "—")}</td><td>${money(asset.valor_aquisicao)}</td><td class="${asset.status === "ATIVO" ? "status-active" : "status-inactive"}">${asset.status === "ATIVO" ? "Ativo" : "Inativo"}</td><td>${escapeHtml(asset.id_ses || "—")}</td></tr>`).join("")}</tbody></table></div></section>`;
}

async function openAssetDetail(id) {
  state.selectedAssetId = id;
  state.currentView = "ficha";
  state.history = [];
  renderAssetDetail(true);
  try {
    state.history = await listAssetHistory(id);
    renderAssetDetail(false);
  } catch (error) {
    toast(`Não foi possível carregar o histórico: ${error.message}`, "error");
    renderAssetDetail(false);
  }
}

function renderAssetDetail(loadingHistory = false) {
  const asset = selectedAsset();
  if (!asset) { state.currentView = "patrimonios"; renderAssets(); return; }
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header detail-header"><div><button class="back-link" data-action="back-assets">← Voltar para patrimônios</button><h1>${escapeHtml(asset.descricao)}</h1><p>${escapeHtml(asset.id_interna)}${asset.id_ses ? ` · SES ${escapeHtml(asset.id_ses)}` : ""}</p></div><div class="header-actions"><button class="ghost-button" data-action="move">Movimentar</button><button class="primary-button" data-action="edit">Editar patrimônio</button></div></div>
    <section class="detail-grid">
      ${detailCard("Identificação", [["ID interna", asset.id_interna], ["ID SES", asset.id_ses || "—"], ["Tipo", typeName(asset.tipo_id)], ["Descrição padrão", asset.descricoes_padrao?.descricao || "—"], ["Marca/Modelo", asset.marca_modelo || "—"]])}
      ${detailCard("Aquisição e valores", [["Data de aquisição", formatDate(asset.data_aquisicao)], ["Tipo de aquisição", acquisitionName(asset.tipo_aquisicao)], ["Valor de aquisição", money(asset.valor_aquisicao)], ["Nota fiscal", asset.nota_fiscal_numero || "—"]])}
      ${detailCard("Localização e condição", [["Centro de custo", asset.centros_custo?.nome || "—"], ["Estado de conservação", conservationName(asset.estado_conservacao)], ["Status", asset.status === "ATIVO" ? "Ativo" : "Inativo"], ["Criado em", formatDateTime(asset.criado_em)]])}
    </section>
    <section class="panel"><div class="panel-header"><h2>Histórico</h2></div>${loadingHistory ? '<div class="loading">Carregando histórico…</div>' : historyHtml(asset, state.history)}</section>`;
  bindDynamicActions();
}

function detailCard(title, rows) {
  return `<article class="detail-card"><h2>${title}</h2><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`).join("")}</dl></article>`;
}

function historyHtml(asset, history) {
  if (!history.length) return '<div class="empty">Nenhuma alteração registrada.</div>';
  return `<div class="timeline">${history.map((entry) => {
    const beforeCenterId = entry.dados_anteriores?.centro_custo_id;
    const afterCenterId = entry.dados_novos?.centro_custo_id;
    const moved = entry.operacao === "UPDATE" && beforeCenterId && afterCenterId && beforeCenterId !== afterCenterId;
    let title = entry.operacao === "INSERT" ? "Patrimônio cadastrado" : entry.operacao === "INATIVACAO" ? "Patrimônio inativado" : entry.operacao === "REATIVACAO" ? "Patrimônio reativado" : "Dados atualizados";
    let description = "Alteração registrada automaticamente pelo sistema.";
    if (moved) {
      title = "Movimentação de centro de custo";
      const from = state.centers.find((center) => center.id === beforeCenterId)?.nome || "Centro anterior";
      const to = state.centers.find((center) => center.id === afterCenterId)?.nome || "Novo centro";
      description = `${from} → ${to}`;
    }
    return `<div class="timeline-item"><div class="timeline-dot"></div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p><small>${formatDateTime(entry.criado_em)}</small></div></div>`;
  }).join("")}</div>`;
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
  document.querySelector("#openCatalogButton").addEventListener("click", openCatalogDialog);
  document.querySelector("#closeCatalogButton").addEventListener("click", closeCatalogDialog);
  document.querySelector("#cancelCatalogButton").addEventListener("click", closeCatalogDialog);
  document.querySelector("#catalogForm").addEventListener("submit", submitCatalogItem);
  document.querySelector("#closeMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#cancelMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#moveForm").addEventListener("submit", submitMovement);
}

function bindDynamicActions() {
  document.querySelectorAll('[data-action="new"]').forEach((button) => button.addEventListener("click", openNewAsset));
  document.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener("click", exportCsv));
  document.querySelectorAll('[data-action="toggle-value"]').forEach((button) => button.addEventListener("click", () => { state.showDashboardValue = !state.showDashboardValue; renderDashboard(); }));
  document.querySelectorAll(".asset-row").forEach((row) => {
    row.addEventListener("click", () => openAssetDetail(row.dataset.assetId));
    row.addEventListener("keydown", (event) => { if (event.key === "Enter") openAssetDetail(row.dataset.assetId); });
  });
  document.querySelectorAll('[data-action="back-assets"]').forEach((button) => button.addEventListener("click", () => { state.currentView = "patrimonios"; renderAssets(); }));
  document.querySelectorAll('[data-action="edit"]').forEach((button) => button.addEventListener("click", openEditAsset));
  document.querySelectorAll('[data-action="move"]').forEach((button) => button.addEventListener("click", openMoveDialog));
}

function populateCenters(selectId = "centroCusto", selected = "") {
  document.querySelector(`#${selectId}`).innerHTML = `<option value="">Selecione</option>${state.centers.filter((center) => center.ativo).map((center) => `<option value="${center.id}" ${center.id === selected ? "selected" : ""}>${escapeHtml(center.nome)}</option>`).join("")}`;
}

function resetAssetForm() {
  document.querySelector("#assetForm").reset();
  state.selectedSigem = null;
  document.querySelector("#descricaoPadraoId").value = "";
  document.querySelector("#valorSigem").value = "";
  document.querySelector("#sigemResults").hidden = true;
}

function openNewAsset() {
  state.assetFormMode = "create";
  resetAssetForm();
  document.querySelector("#assetDialogTitle").textContent = "Novo patrimônio";
  document.querySelector("#assetDialogSubtitle").textContent = "A ID interna será gerada automaticamente pelo banco.";
  document.querySelector("#statusField").hidden = true;
  document.querySelector("#saveAssetButton").textContent = "Salvar patrimônio";
  populateCenters();
  document.querySelector("#assetDialog").showModal();
  document.querySelector("#tipo").focus();
}

function openEditAsset() {
  const asset = selectedAsset();
  if (!asset) return;
  state.assetFormMode = "edit";
  resetAssetForm();
  document.querySelector("#assetDialogTitle").textContent = `Editar ${asset.id_interna}`;
  document.querySelector("#assetDialogSubtitle").textContent = "A ID interna permanece bloqueada e não será alterada.";
  document.querySelector("#statusField").hidden = false;
  document.querySelector("#saveAssetButton").textContent = "Salvar alterações";
  document.querySelector("#tipo").value = String(asset.tipo_id);
  document.querySelector("#idSes").value = asset.id_ses || "";
  document.querySelector("#descricao").value = asset.descricao || "";
  document.querySelector("#dataAquisicao").value = asset.data_aquisicao || "";
  document.querySelector("#aquisicao").value = asset.tipo_aquisicao || "";
  document.querySelector("#valor").value = Number(asset.valor_aquisicao || 0).toFixed(2).replace(".", ",");
  document.querySelector("#notaFiscal").value = asset.nota_fiscal_numero || "";
  document.querySelector("#marcaModelo").value = asset.marca_modelo || "";
  document.querySelector("#estado").value = asset.estado_conservacao || "BEM_CONSERVADO";
  document.querySelector("#status").value = asset.status || "ATIVO";
  populateCenters("centroCusto", asset.centros_custo?.id || "");
  selectSigem({ id: asset.descricoes_padrao?.id, descricao: asset.descricoes_padrao?.descricao, valor_padrao: asset.descricoes_padrao?.valor_padrao, origem: /\s-\sHRPP$/i.test(asset.descricoes_padrao?.descricao || "") ? "HRPP" : "SIGEM" });
  document.querySelector("#assetDialog").showModal();
}

function closeDialog() { document.querySelector("#assetDialog").close(); }
function closeCatalogDialog() { document.querySelector("#catalogDialog").close(); }
function closeMoveDialog() { document.querySelector("#moveDialog").close(); }

function openCatalogDialog() {
  const currentType = document.querySelector("#tipo").value;
  if (!currentType) { toast("Selecione primeiro o tipo do patrimônio.", "error"); return; }
  document.querySelector("#catalogForm").reset();
  document.querySelector("#catalogDescription").value = document.querySelector("#sigemSearch").value.trim();
  document.querySelector("#catalogDialog").showModal();
  document.querySelector("#catalogDescription").focus();
}

function openMoveDialog() {
  const asset = selectedAsset();
  if (!asset) return;
  document.querySelector("#moveCurrentCenter").textContent = `Centro atual: ${asset.centros_custo?.nome || "Não informado"}`;
  populateCenters("moveCenter");
  document.querySelector("#moveCenter").value = "";
  document.querySelector("#moveDialog").showModal();
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
    box.innerHTML = options || '<div class="search-message">Nenhum item encontrado. Use o botão + ao lado do campo para cadastrar um item HRPP.</div>';
    box.querySelectorAll(".sigem-option").forEach((button) => button.addEventListener("click", () => selectSigem(button)));
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
  document.querySelector("#sigemSearch").value = item.descricao || "";
  document.querySelector("#descricaoPadraoId").value = item.id || "";
  document.querySelector("#valorSigem").value = Number.isFinite(item.valor) ? money(item.valor) : "";
  document.querySelector("#sigemResults").hidden = true;
}

async function submitCatalogItem(event) {
  event.preventDefault();
  const description = document.querySelector("#catalogDescription").value.trim();
  const value = normalizeMoney(document.querySelector("#catalogValue").value);
  const typeId = Number(document.querySelector("#tipo").value);
  if (!description) { toast("Informe o nome do item.", "error"); return; }
  if (!Number.isFinite(value) || value < 0) { toast("Informe um valor de referência válido.", "error"); return; }
  const button = document.querySelector("#saveCatalogButton");
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    const item = await createHospitalCatalogItem({ descricao: description, valorPadrao: value, tipoId });
    selectSigem(item);
    closeCatalogDialog();
    toast("Item HRPP adicionado à tabela de descrições padrão.", "success");
  } catch (error) {
    toast(error.code === "23505" ? "Já existe um item com essa descrição." : error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar e selecionar";
  }
}

function assetPayload() {
  const rawValue = document.querySelector("#valor").value.trim();
  const value = rawValue ? normalizeMoney(rawValue) : Number(state.selectedSigem?.valor);
  return {
    id_ses: document.querySelector("#idSes").value.trim() || null,
    descricao: document.querySelector("#descricao").value.trim(),
    descricao_padrao_id: state.selectedSigem.id,
    data_aquisicao: document.querySelector("#dataAquisicao").value || new Date().toISOString().slice(0, 10),
    valor_aquisicao: value,
    nota_fiscal_numero: document.querySelector("#notaFiscal").value.trim() || null,
    centro_custo_id: document.querySelector("#centroCusto").value,
    tipo_id: Number(document.querySelector("#tipo").value),
    marca_modelo: document.querySelector("#marcaModelo").value.trim() || null,
    tipo_aquisicao: document.querySelector("#aquisicao").value,
    estado_conservacao: document.querySelector("#estado").value || "BEM_CONSERVADO",
    status: state.assetFormMode === "edit" ? document.querySelector("#status").value : "ATIVO"
  };
}

async function submitAsset(event) {
  event.preventDefault();
  if (!state.selectedSigem || !document.querySelector("#descricaoPadraoId").value) { toast("Selecione um item na lista de resultados.", "error"); return; }
  const payload = assetPayload();
  if (!Number.isFinite(payload.valor_aquisicao) || payload.valor_aquisicao < 0) { toast("Informe um valor de aquisição válido ou deixe o campo vazio.", "error"); return; }
  const button = document.querySelector("#saveAssetButton");
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    if (state.assetFormMode === "create") {
      const asset = await createAsset(payload);
      state.assets.unshift(asset);
      state.selectedAssetId = asset.id;
      closeDialog();
      toast(`Patrimônio ${asset.id_interna} cadastrado.`, "success");
    } else {
      const current = selectedAsset();
      const updated = await updateAsset(current.id, payload);
      state.assets = state.assets.map((asset) => asset.id === updated.id ? updated : asset);
      closeDialog();
      toast("Patrimônio atualizado.", "success");
    }
    await openAssetDetail(state.selectedAssetId);
  } catch (error) {
    toast(error.code === "23505" ? "ID SES ou ID interna já cadastrado." : error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = state.assetFormMode === "create" ? "Salvar patrimônio" : "Salvar alterações";
  }
}

async function submitMovement(event) {
  event.preventDefault();
  const asset = selectedAsset();
  const newCenterId = document.querySelector("#moveCenter").value;
  if (!newCenterId) { toast("Selecione o novo centro de custo.", "error"); return; }
  if (newCenterId === asset.centros_custo?.id) { toast("O patrimônio já está neste centro de custo.", "error"); return; }
  const button = document.querySelector("#saveMoveButton");
  button.disabled = true;
  button.textContent = "Movimentando…";
  try {
    const updated = await updateAsset(asset.id, { centro_custo_id: newCenterId });
    state.assets = state.assets.map((item) => item.id === updated.id ? updated : item);
    closeMoveDialog();
    toast("Movimentação registrada no histórico.", "success");
    await openAssetDetail(updated.id);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Confirmar movimentação";
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

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function acquisitionName(value) { return ({ COMPRA: "Compra", DOACAO: "Doação", LOCACAO: "Locação" })[value] || value || "—"; }
function conservationName(value) { return ({ PRODUTO_NOVO: "Produto Novo", BEM_CONSERVADO: "Bem Conservado", DESGASTADO: "Desgastado", INUTILIZAVEL: "Inutilizável" })[value] || value || "—"; }

async function start() {
  if (!hasSupabaseConfig()) { renderConfigError(); return; }
  if (!hasSupabaseLibrary()) { renderFatal("Biblioteca não carregada", "O navegador não conseguiu carregar a biblioteca do Supabase. Faça Ctrl+F5 e verifique se a rede ou o bloqueador de conteúdo está impedindo cdn.jsdelivr.net."); return; }
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
