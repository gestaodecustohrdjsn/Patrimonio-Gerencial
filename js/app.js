import { supabase, hasSupabaseConfig, hasSupabaseLibrary } from "./lib/supabase.js";
import { money, normalizeMoney, typeName, escapeHtml, debounce } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getSession, signOut, onAuthChange } from "./services/auth.js";
import { listCenters } from "./services/centros.js";
import { searchSigem } from "./services/sigem.js";
import { listAssets, createAsset, updateAsset, setAssetRemoved, permanentlyDeleteTestAsset, listAssetHistory, getPublicAsset } from "./services/patrimonios.js";
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
  assetFormMode: "create",
  showRemoved: false
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
        <label class="full sigem-field">Item de referência SIGEM <span class="optional-tag">opcional</span><input id="sigemSearch" autocomplete="off" placeholder="Pesquise um item de referência, se houver"><input id="descricaoPadraoId" type="hidden"><div id="sigemResults" class="search-results" hidden></div><small>O patrimônio pode ser cadastrado sem vínculo com o catálogo SIGEM.</small></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Aquisição e valores</legend><div class="form-grid">
        <label>Data de aquisição<input id="dataAquisicao" type="date"><small>Preenchida automaticamente com a data atual.</small></label>
        <label>Aquisição *<select id="aquisicao" required><option value="">Selecione</option><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option></select></label>
        <label>Valor de aquisição <span class="optional-tag">opcional</span><input id="valor" inputmode="decimal" placeholder="Pode ficar vazio"></label>
        <label>Valor de referência SIGEM<input id="valorSigem" readonly tabindex="-1" placeholder="—"></label>
        <label>Nº Nota Fiscal<input id="notaFiscal" maxlength="60"></label>
        <label>Marca/Modelo<input id="marcaModelo" maxlength="120"></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Localização e condição</legend><div class="form-grid">
        <label>Centro de custo *<select id="centroCusto" required></select></label>
        <label>Estado de conservação<select id="estado"><option value="PRODUTO_NOVO">Produto Novo</option><option value="BEM_CONSERVADO" selected>Bem Conservado</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>
        <label id="statusField" hidden>Status<select id="status"><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
      </div></fieldset>

      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelButton">Cancelar</button><button type="submit" class="primary-button" id="saveAssetButton">Salvar patrimônio</button></div>
    </form>
  </dialog>


  <dialog id="moveDialog" class="small-dialog">
    <form method="dialog" id="moveForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeMoveButton">← Voltar</button><h2>Movimentar patrimônio</h2><p id="moveCurrentCenter"></p></div>
      <label>Novo centro de custo *<select id="moveCenter" required></select></label>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelMoveButton">Cancelar</button><button type="submit" class="primary-button" id="saveMoveButton">Confirmar movimentação</button></div>
    </form>
  </dialog>

  <dialog id="labelDialog" class="label-dialog">
    <div class="dialog-header"><button type="button" class="back-button" id="closeLabelButton">← Voltar</button><h2>Etiqueta do patrimônio</h2><p>QR Code público e ID interna sobre o layout oficial.</p></div>
    <div id="labelPreview" class="label-preview"><img src="./assets/layout-etiqueta-patrimonio.png" alt="Layout da etiqueta"><div id="labelQr" class="label-qr"></div><div id="labelId" class="label-id"></div></div>
    <div class="dialog-actions"><button type="button" class="ghost-button" id="downloadLabelButton">Baixar PNG</button><button type="button" class="primary-button" id="printLabelButton">Imprimir / Salvar PDF</button></div>
  </dialog>`;
  bindStaticActions();
}

async function loadData() {
  try {
    [state.centers, state.assets] = await Promise.all([listCenters(), listAssets()]);
    render();
    openAssetFromHash();
  } catch (error) {
    toast(`Erro ao carregar dados: ${error.message}`, "error");
  }
}

function filteredAssets() {
  const q = state.search.trim().toLowerCase();
  const source = state.assets.filter((asset) => state.showRemoved ? asset.removido : !asset.removido);
  if (!q) return source;
  return source.filter((asset) => [asset.id_interna, asset.id_ses, asset.descricao, asset.descricoes_padrao?.descricao, asset.marca_modelo, asset.centros_custo?.nome, typeName(asset.tipo_id)].some((value) => String(value || "").toLowerCase().includes(q)));
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
  const visibleAssets = state.assets.filter((asset) => !asset.removido);
  const active = visibleAssets.filter((asset) => asset.status === "ATIVO").length;
  const total = visibleAssets.reduce((sum, asset) => sum + Number(asset.valor_aquisicao || 0), 0);
  const valueContent = state.showDashboardValue ? money(total) : "R$ ••••••";
  const visibilityLabel = state.showDashboardValue ? "Ocultar valor" : "Mostrar valor";
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header"><div><h1>Visão geral</h1><p>Dados reais do Supabase.</p></div><button class="primary-button" data-action="new">+ Cadastrar patrimônio</button></div>
    <div class="cards cards-three">
      <article class="card"><span class="muted">Número de patrimônios</span><div class="metric">${visibleAssets.length}</div></article>
      <article class="card"><span class="muted">Patrimônios ativos</span><div class="metric">${active}</div></article>
      <article class="card value-card"><div><span class="muted">Valor total informado</span><div class="metric metric-money">${valueContent}</div></div><button class="ghost-button compact-button" data-action="toggle-value">${visibilityLabel}</button></article>
    </div>
    ${assetsTable(visibleAssets.slice(0, 8), "Últimos patrimônios")}`;
  bindDynamicActions();
}

function renderAssets() {
  const rows = filteredAssets();
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>${state.showRemoved ? "Patrimônios removidos" : "Patrimônios"}</h1><p>${state.showRemoved ? "Registros ocultados das listas operacionais." : "Consulte e cadastre bens no banco real."}</p></div><div class="header-actions"><button class="ghost-button" data-action="toggle-removed">${state.showRemoved ? "Ver patrimônios" : "Ver removidos"}</button><button class="primary-button" data-action="new">+ Novo patrimônio</button></div></div>${assetsTable(rows, `${rows.length} patrimônio(s)`)}`;
  bindDynamicActions();
}

function assetsTable(assets, title) {
  if (!assets.length) return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div><div class="empty">Nenhum patrimônio encontrado.</div></section>`;
  return `<section class="panel"><div class="panel-header"><h2>${title}</h2><button class="ghost-button" data-action="export">Exportar CSV</button></div><div class="table-wrap"><table><thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th><th>ID SES</th></tr></thead><tbody>${assets.map((asset) => `<tr class="asset-row ${asset.removido ? "removed-row" : ""}" data-asset-id="${asset.id}" tabindex="0"><td><strong>${escapeHtml(asset.id_interna)}</strong></td><td>${escapeHtml(asset.descricao)}</td><td>${typeName(asset.tipo_id)}</td><td>${escapeHtml(asset.centros_custo?.nome || "—")}</td><td>${money(asset.valor_aquisicao)}</td><td class="${asset.status === "ATIVO" ? "status-active" : "status-inactive"}">${asset.removido ? "Removido" : (asset.status === "ATIVO" ? "Ativo" : "Inativo")}</td><td>${escapeHtml(asset.id_ses || "—")}</td></tr>`).join("")}</tbody></table></div></section>`;
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
    <div class="page-header detail-header"><div><button class="back-link" data-action="back-assets">← Voltar para patrimônios</button><h1>${escapeHtml(asset.descricao)}</h1><p>${escapeHtml(asset.id_interna)}${asset.id_ses ? ` · SES ${escapeHtml(asset.id_ses)}` : ""}${asset.removido ? " · REMOVIDO" : ""}</p></div><div class="header-actions"><button class="ghost-button" data-action="label">Etiqueta / QR</button>${asset.removido ? `<button class="ghost-button" data-action="restore">Restaurar</button><button class="danger-button" data-action="delete-permanent">Excluir definitivamente</button>` : `<button class="ghost-button" data-action="move">Movimentar</button><button class="ghost-button" data-action="toggle-status">${asset.status === "ATIVO" ? "Inativar" : "Ativar"}</button><button class="danger-button" data-action="remove">Remover</button><button class="primary-button" data-action="edit">Editar patrimônio</button>`}</div></div>
    <section class="detail-grid">
      ${detailCard("Identificação", [["ID interna", asset.id_interna], ["ID SES", asset.id_ses || "—"], ["Tipo", typeName(asset.tipo_id)], ["Item de referência SIGEM", asset.descricoes_padrao?.descricao || "—"], ["Marca/Modelo", asset.marca_modelo || "—"]])}
      ${detailCard("Aquisição e valores", [["Data de aquisição", formatDate(asset.data_aquisicao)], ["Tipo de aquisição", acquisitionName(asset.tipo_aquisicao)], ["Valor de aquisição", money(asset.valor_aquisicao)], ["Nota fiscal", asset.nota_fiscal_numero || "—"]])}
      ${detailCard("Localização e condição", [["Centro de custo", asset.centros_custo?.nome || "—"], ["Estado de conservação", conservationName(asset.estado_conservacao)], ["Status", asset.removido ? "Removido" : (asset.status === "ATIVO" ? "Ativo" : "Inativo")], ["Criado em", formatDateTime(asset.criado_em)]])}
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
    const removed = entry.operacao === "UPDATE" && !entry.dados_anteriores?.removido && entry.dados_novos?.removido;
    const restored = entry.operacao === "UPDATE" && entry.dados_anteriores?.removido && !entry.dados_novos?.removido;
    let title = entry.operacao === "INSERT" ? "Patrimônio cadastrado" : entry.operacao === "INATIVACAO" ? "Patrimônio inativado" : entry.operacao === "REATIVACAO" ? "Patrimônio reativado" : removed ? "Patrimônio removido" : restored ? "Patrimônio restaurado" : "Dados atualizados";
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
  document.querySelector("#closeMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#cancelMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#moveForm").addEventListener("submit", submitMovement);
  document.querySelector("#closeLabelButton").addEventListener("click", () => document.querySelector("#labelDialog").close());
  document.querySelector("#downloadLabelButton").addEventListener("click", downloadLabelPng);
  document.querySelector("#printLabelButton").addEventListener("click", printLabel);
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
  document.querySelectorAll('[data-action="toggle-status"]').forEach((button) => button.addEventListener("click", toggleAssetStatus));
  document.querySelectorAll('[data-action="remove"]').forEach((button) => button.addEventListener("click", removeAsset));
  document.querySelectorAll('[data-action="restore"]').forEach((button) => button.addEventListener("click", restoreAsset));
  document.querySelectorAll('[data-action="delete-permanent"]').forEach((button) => button.addEventListener("click", deletePermanentAsset));
  document.querySelectorAll('[data-action="label"]').forEach((button) => button.addEventListener("click", openLabelDialog));
  document.querySelectorAll('[data-action="toggle-removed"]').forEach((button) => button.addEventListener("click", () => { state.showRemoved = !state.showRemoved; renderAssets(); }));
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
  document.querySelector("#dataAquisicao").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#estado").value = "BEM_CONSERVADO";
  document.querySelector("#status").value = "ATIVO";
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
  document.querySelector("#valor").value = asset.valor_aquisicao == null ? "" : Number(asset.valor_aquisicao).toFixed(2).replace(".", ",");
  document.querySelector("#notaFiscal").value = asset.nota_fiscal_numero || "";
  document.querySelector("#marcaModelo").value = asset.marca_modelo || "";
  document.querySelector("#estado").value = asset.estado_conservacao || "BEM_CONSERVADO";
  document.querySelector("#status").value = asset.status || "ATIVO";
  populateCenters("centroCusto", asset.centros_custo?.id || "");
  if (asset.descricoes_padrao?.id) {
    selectSigem({ id: asset.descricoes_padrao.id, descricao: asset.descricoes_padrao.descricao, valor_padrao: asset.descricoes_padrao.valor_padrao });
  }
  document.querySelector("#assetDialog").showModal();
}

function closeDialog() { document.querySelector("#assetDialog").close(); }
function closeMoveDialog() { document.querySelector("#moveDialog").close(); }

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
    box.innerHTML = options || '<div class="search-message">Nenhum item SIGEM encontrado. Você pode deixar este campo vazio.</div>';
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

function assetPayload() {
  const rawValue = document.querySelector("#valor").value.trim();
  const value = rawValue ? normalizeMoney(rawValue) : null;
  return {
    id_ses: document.querySelector("#idSes").value.trim() || null,
    descricao: document.querySelector("#descricao").value.trim(),
    descricao_padrao_id: state.selectedSigem?.id || null,
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
  const payload = assetPayload();
  if (payload.valor_aquisicao !== null && (!Number.isFinite(payload.valor_aquisicao) || payload.valor_aquisicao < 0)) { toast("Informe um valor de aquisição válido ou deixe o campo vazio.", "error"); return; }
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


async function toggleAssetStatus() {
  const asset = selectedAsset();
  if (!asset || asset.removido) return;
  const nextStatus = asset.status === "ATIVO" ? "INATIVO" : "ATIVO";
  if (!window.confirm(`${nextStatus === "ATIVO" ? "Ativar" : "Inativar"} o patrimônio ${asset.id_interna}?`)) return;
  try {
    const updated = await updateAsset(asset.id, { status: nextStatus, inativado_em: nextStatus === "INATIVO" ? new Date().toISOString() : null });
    state.assets = state.assets.map((item) => item.id === updated.id ? updated : item);
    toast(`Patrimônio ${nextStatus === "ATIVO" ? "ativado" : "inativado"}.`, "success");
    await openAssetDetail(updated.id);
  } catch (error) { toast(error.message, "error"); }
}

async function removeAsset() {
  const asset = selectedAsset();
  if (!asset || !window.confirm(`Remover ${asset.id_interna} das listas operacionais? O registro poderá ser restaurado.`)) return;
  try {
    const updated = await setAssetRemoved(asset.id, true);
    state.assets = state.assets.map((item) => item.id === updated.id ? updated : item);
    toast("Patrimônio removido com segurança.", "success");
    state.showRemoved = true;
    await openAssetDetail(updated.id);
  } catch (error) { toast(error.message, "error"); }
}

async function restoreAsset() {
  const asset = selectedAsset();
  if (!asset || !window.confirm(`Restaurar o patrimônio ${asset.id_interna}?`)) return;
  try {
    const updated = await setAssetRemoved(asset.id, false);
    state.assets = state.assets.map((item) => item.id === updated.id ? updated : item);
    toast("Patrimônio restaurado.", "success");
    state.showRemoved = false;
    await openAssetDetail(updated.id);
  } catch (error) { toast(error.message, "error"); }
}

async function deletePermanentAsset() {
  const asset = selectedAsset();
  if (!asset) return;
  const confirmation = window.prompt(`Exclusão definitiva de ${asset.id_interna}. Digite EXCLUIR para apagar o patrimônio e o histórico. Use apenas para registros de teste.`);
  if (confirmation !== "EXCLUIR") { if (confirmation !== null) toast("Confirmação inválida.", "error"); return; }
  try {
    await permanentlyDeleteTestAsset(asset.id, confirmation);
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    state.selectedAssetId = null;
    state.currentView = "patrimonios";
    toast("Patrimônio de teste excluído definitivamente.", "success");
    renderAssets();
  } catch (error) { toast(error.message, "error"); }
}

function assetPublicUrl(asset) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/consulta/${encodeURIComponent(asset.public_token)}`;
}

function openLabelDialog() {
  const asset = selectedAsset();
  if (!asset) return;
  if (!window.QRCode) { toast("Biblioteca de QR Code não carregada. Atualize a página.", "error"); return; }
  const qrRoot = document.querySelector("#labelQr");
  qrRoot.innerHTML = "";
  document.querySelector("#labelId").textContent = asset.id_interna;
  new window.QRCode(qrRoot, { text: assetPublicUrl(asset), width: 176, height: 176, correctLevel: window.QRCode.CorrectLevel.M });
  document.querySelector("#labelDialog").showModal();
}

async function composeLabelCanvas() {
  const asset = selectedAsset();
  if (!asset) throw new Error("Patrimônio não selecionado");

  // Base visual: 583 × 227. Exportação em 3× para impressão nítida.
  const baseWidth = 583;
  const baseHeight = 227;
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");

  const image = new Image();
  image.src = "./assets/layout-etiqueta-patrimonio.png";
  await image.decode();
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const qrCanvas = document.querySelector("#labelQr canvas");
  const qrImage = document.querySelector("#labelQr img");
  const qrSource = qrCanvas || qrImage;
  if (!qrSource) throw new Error("QR Code ainda não foi gerado.");

  // 5% menor que a versão anterior e novamente centralizado no quadrado.
  const qrSize = 181.45;
  const qrX = 30.28;
  const qrY = 26.28;
  ctx.drawImage(qrSource, qrX * scale, qrY * scale, qrSize * scale, qrSize * scale);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${31 * scale}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(asset.id_interna, 399 * scale, 189 * scale);
  return canvas;
}

async function downloadLabelPng() {
  try {
    const canvas = await composeLabelCanvas();
    const anchor = document.createElement("a");
    anchor.download = `etiqueta-${selectedAsset().id_interna}.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  } catch (error) { toast(error.message, "error"); }
}

async function printLabel() {
  try {
    const canvas = await composeLabelCanvas();
    const popup = window.open("", "_blank", "width=900,height=600");
    if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");
    popup.document.write(`<html><head><title>Etiqueta ${escapeHtml(selectedAsset().id_interna)}</title><style>@page{margin:0}body{margin:0;display:grid;place-items:center;min-height:100vh}img{width:100%;max-width:1166px}</style></head><body><img src="${canvas.toDataURL("image/png")}" onload="window.print();window.close()"></body></html>`);
    popup.document.close();
  } catch (error) { toast(error.message, "error"); }
}

function openAssetFromHash() {
  const match = window.location.hash.match(/^#\/p\/(.+)$/);
  if (!match || !state.assets.length) return;
  const idInterna = decodeURIComponent(match[1]);
  const asset = state.assets.find((item) => item.id_interna === idInterna);
  if (asset) openAssetDetail(asset.id);
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


function publicTokenFromHash() {
  const match = window.location.hash.match(/^#\/consulta\/([0-9a-f-]{36})$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function publicField(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="public-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderPublicAsset(asset) {
  const statusText = asset.status === "ATIVO" ? "Ativo" : "Inativo";
  const valueText = asset.valor_aquisicao == null ? null : money(asset.valor_aquisicao);
  appRoot.innerHTML = `
    <main class="public-page">
      <section class="public-shell">
        <header class="public-brand">
          <div class="brand-mark">P+</div>
          <div><strong>Patrimônio+</strong><small>Consulta pública de patrimônio</small></div>
        </header>
        <section class="public-hero">
          <div>
            <span class="public-eyebrow">Consulta pública · somente visualização</span>
            <h1>${escapeHtml(asset.descricao)}</h1>
            <div class="public-id-block"><span>ID interna</span><p class="public-id">${escapeHtml(asset.id_interna)}</p></div>
          </div>
          <span class="public-status ${asset.status === "ATIVO" ? "is-active" : "is-inactive"}">${statusText}</span>
        </section>
        <section class="public-card-grid">
          <article class="public-card">
            <h2>Identificação</h2>
            ${publicField("ID interna", asset.id_interna)}
            ${publicField("ID SES", asset.id_ses)}
            ${publicField("Tipo", typeName(asset.tipo_id))}
            ${publicField("Item de referência SIGEM", asset.descricao_padrao)}
            ${publicField("Marca/Modelo", asset.marca_modelo)}
          </article>
          <article class="public-card">
            <h2>Localização e condição</h2>
            ${publicField("Centro de custo", asset.centro_custo)}
            ${publicField("Estado de conservação", conservationName(asset.estado_conservacao))}
            ${publicField("Status", statusText)}
          </article>
          <article class="public-card">
            <h2>Aquisição</h2>
            ${publicField("Forma de aquisição", acquisitionName(asset.tipo_aquisicao))}
            ${publicField("Data de aquisição", formatDate(asset.data_aquisicao))}
            ${publicField("Valor informado", valueText)}
            ${publicField("Nota fiscal", asset.nota_fiscal_numero)}
            ${publicField("Fornecedor", asset.fornecedor)}
            ${publicField("Observações", asset.observacoes)}
            ${publicField("Cadastrado em", formatDateTime(asset.criado_em))}
          </article>
        </section>
        <footer class="public-footer">
          <span>Consulta somente para visualização</span>
          <small>Última atualização: ${escapeHtml(formatDateTime(asset.atualizado_em))}</small>
        </footer>
      </section>
    </main>`;
}

async function openPublicAsset(token) {
  appRoot.innerHTML = `<main class="public-page"><section class="public-loading"><div class="brand-mark">P+</div><h1>Consultando patrimônio</h1><p>Aguarde um instante…</p></section></main>`;
  try {
    const asset = await getPublicAsset(token);
    if (!asset) {
      appRoot.innerHTML = `<main class="public-page"><section class="public-loading"><div class="brand-mark">P+</div><h1>Patrimônio não encontrado</h1><p>O código pode ser inválido ou o patrimônio não está disponível para consulta.</p></section></main>`;
      return;
    }
    renderPublicAsset(asset);
  } catch (error) {
    appRoot.innerHTML = `<main class="public-page"><section class="public-loading"><div class="brand-mark">P+</div><h1>Não foi possível consultar</h1><p>${escapeHtml(error.message)}</p></section></main>`;
  }
}

async function start() {
  if (!hasSupabaseConfig()) { renderConfigError(); return; }
  if (!hasSupabaseLibrary()) { renderFatal("Biblioteca não carregada", "O navegador não conseguiu carregar a biblioteca do Supabase. Faça Ctrl+F5 e verifique se a rede ou o bloqueador de conteúdo está impedindo cdn.jsdelivr.net."); return; }

  const publicToken = publicTokenFromHash();
  if (publicToken) {
    await openPublicAsset(publicToken);
    return;
  }

  state.session = await getSession();
  if (!state.session) renderLogin(appRoot); else { shell(); await loadData(); }
  onAuthChange(async (session) => {
    if (publicTokenFromHash()) return;
    state.session = session;
    if (!session) renderLogin(appRoot); else { shell(); await loadData(); }
  });
}

window.addEventListener("hashchange", async () => {
  const token = publicTokenFromHash();
  if (token) await openPublicAsset(token);
  else openAssetFromHash();
});

start().catch((error) => {
  console.error(error);
  renderFatal("Erro ao iniciar", error?.message || "Erro desconhecido ao iniciar o sistema.");
});
