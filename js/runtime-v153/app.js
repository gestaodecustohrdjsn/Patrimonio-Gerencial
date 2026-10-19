import { hasApiConfig } from "./lib/api.js";
import { money, normalizeMoney, typeName, escapeHtml, debounce } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getSession, signOut, onAuthChange } from "./services/auth.js";
import { listCenters, createCenter, updateCenter, deleteCenter } from "./services/centros.js?v=1.6.0";
import { searchCatalog, listCatalogAdmin, updateCatalogType, createCatalogItem, updateCatalogItem, deleteCatalogItem, listCatalogUpdateContext, applyCatalogUpdate, getCatalogUpdateDetail } from "./services/catalogo.js?v=1.6.0";
import { listAssets, createAsset, updateAsset, moveAsset, setAssetRemoved, permanentlyDeleteTestAsset, listAssetHistory, getPublicAsset } from "./services/patrimonios.js";
import { renderLogin } from "./pages/login.js";
import { listMaintenances, createMaintenance, finishMaintenance } from "./services/manutencoes.js";
import { listRecentHistory } from "./services/historico.js?v=1.6.0";
import { simulateAssetImport, applyAssetImport, listAssetImportHistory } from "./services/importacoes.js?v=1.7.0";

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
  showRemoved: false,
  importFileName: "",
  importHeaders: [],
  importRows: [],
  importMapping: {},
  importValidated: [],
  importBusy: false,
  importSimulation: null,
  importDuplicateChoices: {},
  importHistory: [],
  importHistoryLoaded: false,
  importLastResult: null,
  assetFilters: {},
  labelFilters: {},
  labelSelected: new Set(),
  reportFilters: { centro: "", q: "", tipo: "", status: "", aquisicao: "", conservacao: "", mobilidade: "", manutencao: "", ordenacao: "id" },
  detailEditMode: false,
  maintenance: [],
  maintenanceAssetId: null,
  maintenanceCompletingId: null,
  formMobility: "FIXO",
  formAllowedCenters: new Set(),
  moveMobility: "FIXO",
  moveAllowedCenters: new Set(),
  selectedCenterId: null,
  catalogAdminItems: [],
  catalogAdminLoaded: false,
  catalogAdminLoading: false,
  catalogAdminQuery: "",
  catalogAdminType: "",
  catalogAdminOrigin: "",
  selectedCatalogItemId: null,
  recentHistory: [],
  dashboardHistoryExpanded: false,
  settingsOpenCard: null,
  catalogAliases: [],
  catalogUpdates: [],
  catalogUpdateContextLoaded: false,
  catalogUpdateBusy: false,
  catalogUpdateFileName: "",
  catalogUpdateHeaders: [],
  catalogUpdateRows: [],
  catalogUpdateMapping: { nome: "", tipo: "", valor: "" },
  catalogUpdateComplete: false,
  catalogUpdateAnalysis: [],
  catalogUpdateMissing: [],
  catalogUpdateStage: "file",
  catalogUpdateLastResult: null,
  catalogUpdateDetail: null
};

const appRoot = document.querySelector("#appRoot");

function renderFatal(title, message) {
  appRoot.innerHTML = `<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Diagnóstico</small></div></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></section></main>`;
}

function renderConfigError() {
  appRoot.innerHTML = `<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Configuração inicial</small></div></div><h1>Conexão pendente</h1><p>Preencha <code>js/config.js</code> com a URL pública da API do Patrimônio+.</p></section></main>`;
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
        <button class="nav-item" data-view="catalogo">Catálogo</button>
        ${canEditAssets() ? '<button class="nav-item" data-view="importacao">Importação</button>' : ""}
        <button class="nav-item" data-view="etiquetas">Etiquetas</button>
        <button class="nav-item" data-view="relatorios">Relatórios</button>
        <button class="nav-item" data-view="configuracoes">Configurações</button>
      </nav>
      <div class="sidebar-footer"><span class="badge">API conectada</span><button class="logout-button" id="logoutButton">Sair</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><button class="icon-button" id="menuButton">☰</button><div class="search-wrap"><input id="globalSearch" type="search" placeholder="Pesquisar ID, descrição, centro ou marca…"></div>${canEditAssets() ? '<button class="secondary-button" id="quickAddButton">+ Novo patrimônio</button>' : ""}</header>
      <section id="viewRoot" class="content"><div class="loading">Carregando dados…</div></section>
    </main>
  </div>

  <dialog id="assetDialog">
    <form method="dialog" id="assetForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeDialogButton">← Voltar</button><h2 id="assetDialogTitle">Novo patrimônio</h2><p id="assetDialogSubtitle">A ID interna será gerada automaticamente pelo banco.</p></div>

      <fieldset class="form-section"><legend>Identificação</legend><div class="form-grid">
        <label class="full sigem-field"><span class="field-title">Item do Catálogo <span class="optional-note">(Opcional)</span></span><input id="sigemSearch" autocomplete="off" placeholder="Pesquise e selecione o item do Catálogo"><input id="descricaoPadraoId" type="hidden"><div id="sigemResults" class="search-results" hidden></div><small>Esta é a descrição principal exibida nas listagens quando houver vínculo com o catálogo.</small></label>
        <label class="full">Descrição complementar *<input id="descricao" required maxlength="180" placeholder="Ex.: preta com rodinhas"></label>
        <label>Tipo *<select id="tipo" required><option value="">Selecione</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select><small id="tipoSigemHint" class="sigem-type-hint">Sem item do Catálogo, o Tipo é definido manualmente.</small></label>
        <label>ID SES<input id="idSes" maxlength="50"></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Aquisição e valores</legend><div class="form-grid">
        <label>Data de aquisição *<input id="dataAquisicao" type="date" required><small>Preenchida automaticamente com a data atual.</small></label>
        <label>Aquisição *<select id="aquisicao" required><option value="">Selecione</option><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option><option value="CONTRATO_GESTAO">Contrato de Gestão</option></select></label>
        <label><span class="field-title">Valor de aquisição <span class="optional-note">(Opcional)</span></span><input id="valor" inputmode="decimal" placeholder="R$ 0,00"></label>
        <label>Valor de referência do Catálogo<input id="valorSigem" readonly tabindex="-1" placeholder="—"></label>
        <label>Nº Nota Fiscal<input id="notaFiscal" maxlength="60"></label>
        <label>Marca/Modelo<input id="marcaModelo" maxlength="120"></label>
      </div></fieldset>

      <fieldset class="form-section"><legend>Localização e condição</legend><div class="form-grid">
        <label>Centro de custo *<select id="centroCusto" required></select></label>
        <label>Estado de conservação<select id="estado"><option value="PRODUTO_NOVO">Produto Novo</option><option value="BEM_CONSERVADO" selected>Bem Conservado</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>
        <label id="statusField" hidden>Status<select id="status"><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
        <label class="full mobility-toggle"><span>Mobilidade</span><div class="segmented-control"><button type="button" data-mobility-value="FIXO" class="active">Fixo</button><button type="button" data-mobility-value="MOVEL">Móvel</button></div><small>Todo patrimônio nasce como fixo. Marque como móvel apenas quando puder circular entre centros previamente definidos.</small></label>
        <div class="full mobility-centers" id="mobilityCentersBox" hidden>
          <label>Centros de custo permitidos</label>
          <div class="chip-picker">
            <input id="allowedCenterSearch" type="search" autocomplete="off" placeholder="Pesquise e selecione um centro de custo">
            <div id="allowedCenterResults" class="chip-results" hidden></div>
            <div id="allowedCenterChips" class="chip-list"></div>
          </div>
          <small>O centro atual não precisa entrar aqui. Cadastre apenas os centros para onde o bem móvel pode ser movimentado.</small>
        </div>
      </div></fieldset>

      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelButton">Cancelar</button><button type="submit" class="primary-button" id="saveAssetButton">Salvar patrimônio</button></div>
    </form>
  </dialog>


  <dialog id="moveDialog" class="operation-dialog">
    <form method="dialog" id="moveForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeMoveButton">← Voltar</button><h2>Movimentar patrimônio</h2><p id="moveCurrentCenter"></p></div>
      <div class="operation-layout">
        <section class="operation-section">
          <div class="operation-section-title"><span>1</span><div><strong>Destino</strong><small>Defina para onde o patrimônio será movimentado.</small></div></div>
          <label class="full">Novo centro de custo *<select id="moveCenter" required></select></label>
        </section>

        <section class="operation-section">
          <div class="operation-section-title"><span>2</span><div><strong>Pessoas envolvidas</strong><small>Identifique quem solicitou, executou e recebeu.</small></div></div>
          <div class="stacked-fields">
            <label>Solicitante<input id="moveRequester" required maxlength="120" placeholder="Quem solicitou"></label>
            <label>Movimentado por<input id="moveBy" required maxlength="120" placeholder="Quem realizou"></label>
            <label>Recebido por<input id="moveReceivedBy" required maxlength="120" placeholder="Quem recebeu no destino"></label>
          </div>
        </section>

        <section class="operation-section">
          <div class="operation-section-title"><span>3</span><div><strong>Observações</strong><small>Campo opcional para complementar o registro.</small></div></div>
          <label class="full">Observação<textarea id="moveObservation" rows="3" placeholder="Observações da movimentação"></textarea></label>
        </section>
      </div>
      <section id="moveMobilitySection" class="operation-section">
        <div class="operation-section-title"><span>4</span><div><strong>Mobilidade</strong><small>Defina como o patrimônio ficará após a movimentação.</small></div></div>
        <div class="segmented-control move-mobility-control">
          <button type="button" data-move-mobility="FIXO">Fixo</button>
          <button type="button" data-move-mobility="MOVEL">Móvel</button>
        </div>
        <div id="moveMobilityAlert" class="mobility-alert" hidden></div>
        <div id="moveMobileOptions" hidden>
          <div class="chip-picker">
            <label>Centros de custo permitidos</label>
            <input id="moveAllowedCenterSearch" type="search" autocomplete="off" placeholder="Pesquisar centro de custo">
            <div id="moveAllowedCenterResults" class="chip-results" hidden></div>
            <div id="moveAllowedCenterChips" class="chip-list"></div>
          </div>
        </div>
      </section>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelMoveButton">Cancelar</button><button type="submit" class="primary-button" id="saveMoveButton">Confirmar movimentação</button></div>
    </form>
  </dialog>

  <dialog id="labelDialog" class="label-dialog">
    <div class="dialog-header"><button type="button" class="back-button" id="closeLabelButton">← Voltar</button><h2>Etiqueta do patrimônio</h2><p>QR Code público e ID interna sobre o layout oficial.</p></div>
    <div id="labelPreview" class="label-preview"><img src="./assets/layout-etiqueta-patrimonio.png" alt="Layout da etiqueta"><div id="labelQr" class="label-qr"></div><div id="labelId" class="label-id"></div></div>
    <div class="dialog-actions"><button type="button" class="ghost-button" id="testQrButton">Testar QR</button><button type="button" class="ghost-button" id="downloadLabelButton">Baixar PNG</button><button type="button" class="primary-button" id="printLabelButton">Imprimir / Salvar PDF</button></div>
  </dialog>

  <dialog id="maintenanceDialog" class="maintenance-dialog">
    <div class="dialog-header"><button type="button" class="back-button" id="closeMaintenanceButton">← Voltar</button><h2>Manutenção do patrimônio</h2><p id="maintenanceAssetTitle"></p></div>
    <div id="maintenanceContent"></div>
  </dialog>

  <dialog id="centerDialog" class="operation-dialog">
    <form method="dialog" id="centerForm">
      <div class="dialog-header"><button type="button" class="back-button" id="closeCenterButton">← Voltar</button><h2 id="centerDialogTitle">Novo centro de custo</h2><p>Cadastre ou edite os dados do centro de custo.</p></div>
      <div class="operation-layout">
        <section class="operation-section">
          <div class="form-grid">
            <label>Código *<input id="centerCode" required maxlength="40" autocomplete="off"></label>
            <label>Centro de custo *<input id="centerName" required maxlength="160" autocomplete="off"></label>
          </div>
        </section>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelCenterButton">Cancelar</button><button type="submit" class="primary-button" id="saveCenterButton">Salvar centro</button></div>
    </form>
  </dialog>

  <dialog id="catalogUpdateDialog" class="catalog-update-dialog">
    <div class="catalog-update-shell">
      <div class="dialog-header catalog-update-header">
        <button type="button" class="back-button" id="closeCatalogUpdateButton">← Fechar</button>
        <h2>Atualizar base SIGEM</h2>
        <p>Compare a nova lista SIGEM com os itens de origem SIGEM do Catálogo. Itens próprios do HRPP não são alterados por este fluxo.</p>
      </div>
      <div id="catalogUpdateContent"></div>
    </div>
  </dialog>

  <dialog id="catalogItemDialog" class="operation-dialog">
    <form method="dialog" id="catalogItemForm">
      <div class="dialog-header">
        <button type="button" class="back-button" id="closeCatalogItemButton">← Voltar</button>
        <h2 id="catalogItemDialogTitle">Novo item do Catálogo</h2>
        <p>Itens cadastrados aqui recebem origem Catálogo Próprio — HRPP.</p>
      </div>
      <div class="operation-layout">
        <section class="operation-section">
          <div class="form-grid">
            <label class="full">Descrição do item *<input id="catalogItemDescription" required maxlength="500" autocomplete="off" placeholder="Ex.: Bisturi elétrico modelo X"></label>
            <label>Tipo *<select id="catalogItemType" required><option value="">Selecione</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select></label>
            <label>Valor de referência<input id="catalogItemValue" inputmode="decimal" placeholder="R$ 0,00"></label>
            <label>Fonte do valor<select id="catalogItemValueSource"><option value="COTACAO_PROPRIA">Cotação própria</option><option value="NOTA_FISCAL">Nota Fiscal</option><option value="OUTRA">Outra</option></select></label>
            <label>Origem<input value="Catálogo Próprio — HRPP" readonly tabindex="-1"></label>
          </div>
        </section>
      </div>
      <div class="dialog-actions"><button type="button" class="ghost-button" id="cancelCatalogItemButton">Cancelar</button><button type="submit" class="primary-button" id="saveCatalogItemButton">Salvar item</button></div>
    </form>
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

function assetDisplayName(asset) {
  return asset?.descricoes_padrao?.descricao || asset?.descricao || "—";
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.currentView));
  switch (state.currentView) {
    case "dashboard": renderDashboard(); break;
    case "patrimonios": renderAssets(); break;
    case "ficha": renderAssetDetail(); break;
    case "centros": renderCenters(); break;
    case "catalogo": renderCatalog(); break;
    case "pesquisa": renderGlobalSearch(); break;
    case "importacao": renderImport(); break;
    case "etiquetas": renderLabels(); break;
    case "relatorios": renderReports(); break;
    case "configuracoes": renderSettings(); break;
    default: renderDashboard();
  }
}

function historyActionLabel(event) {
  const key = `${event.tabela || ""}:${event.operacao || ""}`;
  if (key === "centros_custo:EDICAO_CADASTRAL") {
    const before = String(event.detalhes?.ativo_antes || "");
    const after = String(event.detalhes?.ativo_depois || "");
    if (before === "true" && after === "false") return "Inativou centro de custo";
    if (before === "false" && after === "true") return "Ativou centro de custo";
  }
  const labels = {
    "patrimonios:CADASTRO": "Cadastrou patrimônio",
    "patrimonios:EDICAO_CADASTRAL": "Editou patrimônio",
    "patrimonios:MOVIMENTACAO": "Movimentou patrimônio",
    "patrimonios:INATIVACAO": "Inativou patrimônio",
    "patrimonios:REATIVACAO": "Reativou patrimônio",
    "patrimonios:REMOCAO_LOGICA": "Removeu patrimônio",
    "patrimonios:RESTAURACAO": "Restaurou patrimônio",
    "patrimonios:MOBILIDADE_ALTERADA": "Alterou mobilidade",
    "patrimonios:CENTRO_PERMITIDO_ADICIONADO": "Adicionou centro permitido",
    "patrimonios:CENTRO_PERMITIDO_REMOVIDO": "Removeu centro permitido",
    "patrimonios:MANUTENCAO_ABERTA": "Abriu manutenção",
    "patrimonios:MANUTENCAO_CONCLUIDA": "Concluiu manutenção",
    "centros_custo:CADASTRO": "Cadastrou centro de custo",
    "centros_custo:EDICAO_CADASTRAL": "Editou centro de custo",
    "centros_custo:EXCLUSAO_DEFINITIVA": "Excluiu centro de custo",
    "descricoes_padrao:CLASSIFICACAO_SIGEM_ALTERADA": "Alterou classificação do Catálogo",
    "descricoes_padrao:ITEM_CATALOGO_CADASTRADO": "Adicionou item ao Catálogo",
    "descricoes_padrao:ITEM_CATALOGO_EDITADO": "Editou item do Catálogo",
    "descricoes_padrao:ITEM_CATALOGO_EXCLUIDO": "Excluiu item do Catálogo",
    "catalogo_sigem_atualizacoes:CATALOGO_SIGEM_ATUALIZADO": "Atualizou base SIGEM"
  };
  return labels[key] || String(event.operacao || "Evento").replaceAll("_", " ").toLowerCase();
}

function historyEntityLabel(event) {
  const entity = event.entidade || {};
  if (entity.tipo === "patrimonio") {
    const id = entity.id_interna ? `#${entity.id_interna}` : "Patrimônio";
    return entity.nome ? `${id} · ${entity.nome}` : id;
  }
  if (entity.tipo === "centro") {
    return [entity.codigo, entity.nome].filter(Boolean).join(" · ") || "Centro de custo";
  }
  if (entity.tipo === "catalog_item") return entity.nome || "Item do Catálogo";
  if (entity.tipo === "catalog_update") return entity.nome || "Atualização do catálogo";
  return "";
}

function historyDetailText(event) {
  const d = event.detalhes || {};
  if (event.operacao === "MOVIMENTACAO" && (d.origem_nome || d.destino_nome)) {
    return `${d.origem_nome || "Origem"} → ${d.destino_nome || "Destino"}`;
  }
  if (event.operacao === "CLASSIFICACAO_SIGEM_ALTERADA" && (d.tipo_antes || d.tipo_depois)) {
    const before = d.tipo_antes ? typeName(Number(d.tipo_antes)) : "Sem tipo";
    const after = d.tipo_depois ? typeName(Number(d.tipo_depois)) : "Sem tipo";
    return `${before} → ${after}`;
  }
  if (event.tabela === "centros_custo" && event.operacao === "EDICAO_CADASTRAL") {
    const before = [d.codigo_antes, d.nome_antes].filter(Boolean).join(" · ");
    const after = [d.codigo_depois, d.nome_depois].filter(Boolean).join(" · ");
    if (before && after && before !== after) return `${before} → ${after}`;
  }
  if (event.operacao === "MANUTENCAO_ABERTA" && d.descricao) return d.descricao;
  if (event.operacao === "CATALOGO_SIGEM_ATUALIZADO") {
    const parts = [];
    if (Number(d.novos_itens || 0)) parts.push(`${d.novos_itens} novo(s)`);
    if (Number(d.correspondencias_confirmadas || 0)) parts.push(`${d.correspondencias_confirmadas} de-para confirmado(s)`);
    if (Number(d.inativados || 0)) parts.push(`${d.inativados} inativado(s)`);
    if (Number(d.reativados || 0)) parts.push(`${d.reativados} reativado(s)`);
    return parts.length ? parts.join(" · ") : `${d.quantidade_arquivo || 0} item(ns) analisado(s)`;
  }
  return "";
}

function historyDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function dashboardHistoryHtml() {
  const source = state.recentHistory || [];
  const limit = state.dashboardHistoryExpanded ? 30 : 10;
  const events = source.slice(0, limit);
  if (!events.length) return '<div class="empty">Nenhum evento registrado ainda.</div>';
  return `
    <div class="event-log">
      ${events.map(event => {
        const entity = historyEntityLabel(event);
        const detail = historyDetailText(event);
        return `<article class="event-row">
          <div class="event-marker"></div>
          <div class="event-content">
            <div class="event-main"><strong>${escapeHtml(historyActionLabel(event))}</strong>${entity ? ` <span>· ${escapeHtml(entity)}</span>` : ""}</div>
            ${detail ? `<div class="event-detail">${escapeHtml(detail)}</div>` : ""}
            <div class="event-meta">${escapeHtml(historyDateTime(event.criado_em))} · ${escapeHtml(event.usuario?.nome || "Sistema")}</div>
          </div>
        </article>`;
      }).join("")}
    </div>
    ${source.length > 10 ? `<div class="event-log-footer"><button class="ghost-button compact-button" data-action="toggle-history">${state.dashboardHistoryExpanded ? "Mostrar menos" : "Ver mais eventos"}</button></div>` : ""}
  `;
}

function bindDashboardHistoryActions() {
  document.querySelector('[data-action="toggle-history"]')?.addEventListener("click", () => {
    state.dashboardHistoryExpanded = !state.dashboardHistoryExpanded;
    const box = document.querySelector("#dashboardHistory");
    if (box) {
      box.innerHTML = dashboardHistoryHtml();
      bindDashboardHistoryActions();
    }
  });
}

async function refreshDashboardHistory() {
  try {
    state.recentHistory = await listRecentHistory(30);
    if (state.currentView !== "dashboard") return;
    const box = document.querySelector("#dashboardHistory");
    if (!box) return;
    box.innerHTML = dashboardHistoryHtml();
    bindDashboardHistoryActions();
  } catch (error) {
    const box = document.querySelector("#dashboardHistory");
    if (box) box.innerHTML = `<div class="empty">Não foi possível carregar o histórico recente: ${escapeHtml(error.message)}</div>`;
  }
}

function renderDashboard() {
  const visibleAssets = state.assets.filter((asset) => !asset.removido);
  const active = visibleAssets.filter((asset) => asset.status === "ATIVO").length;
  const total = visibleAssets.reduce((sum, asset) => sum + Number(asset.valor_aquisicao || 0), 0);
  const valueContent = state.showDashboardValue ? money(total) : "R$ ••••••";
  const visibilityLabel = state.showDashboardValue ? "Ocultar valor" : "Mostrar valor";
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header"><div><h1>Visão geral</h1><p>Dados do banco patrimonial.</p></div>${canEditAssets() ? '<button class="primary-button" data-action="new">+ Cadastrar patrimônio</button>' : ""}</div>
    <div class="cards cards-three">
      <article class="card"><span class="muted">Número de patrimônios</span><div class="metric">${visibleAssets.length}</div></article>
      <article class="card"><span class="muted">Patrimônios ativos</span><div class="metric">${active}</div></article>
      <article class="card value-card"><div><span class="muted">Valor total informado</span><div class="metric metric-money">${valueContent}</div></div><button class="ghost-button compact-button" data-action="toggle-value">${visibilityLabel}</button></article>
    </div>
    ${assetsTable(visibleAssets.slice(0, 8), "Últimos patrimônios")}
    <section class="panel dashboard-history-panel">
      <div class="panel-header"><div><h2>Histórico recente do sistema</h2><small>Últimos eventos registrados no Patrimônio+.</small></div></div>
      <div id="dashboardHistory">${state.recentHistory.length ? dashboardHistoryHtml() : '<div class="loading">Carregando histórico recente…</div>'}</div>
    </section>`;
  bindDynamicActions();
  bindDashboardHistoryActions();
  refreshDashboardHistory();
}


function userProfile() {
  return String(state.session?.user?.perfil || "").toUpperCase();
}
function canEditAssets() { return ["ADMIN", "AUXILIAR"].includes(userProfile()); }
function canMoveAssets() { return ["ADMIN", "AUXILIAR"].includes(userProfile()); }
function canMaintainAssets() { return ["ADMIN", "AUXILIAR"].includes(userProfile()); }
function canDeleteAssets() { return userProfile() === "ADMIN"; }

function iconSvg(name) {
  const icons = {
    view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
    move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M15 8l4 4-4 4M9 5 5 9l4 4"/></svg>',
    maintenance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5h7v7"/><path d="M20.5 3.5 11 13"/><path d="m9.5 11.5 3 3-6.8 6.8a2.1 2.1 0 0 1-3-3l6.8-6.8Z"/></svg>',
    label: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.3"/></svg>',
    delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>'
  };
  return icons[name] || "";
}

function actionIcon(action, asset, title, icon, disabled = false) {
  return `<button class="table-action ${action === "delete-permanent" ? "danger-icon" : ""}" data-action="${action}" data-asset-id="${asset.id}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${disabled ? "disabled" : ""}>${iconSvg(icon)}</button>`;
}

function defaultFilters() {
  return {
    q: "", centro: "", tipo: "", status: "", aquisicao: "", conservacao: "",
    sigem: "", valor: "", idSes: "", dataDe: "", dataAte: "", ordenacao: "id"
  };
}

function ensureFilters(key) {
  if (!state[key] || !Object.keys(state[key]).length) state[key] = defaultFilters();
  return state[key];
}

function assetMatchesFilters(asset, f) {
  const q = String(f.q || "").trim().toLowerCase();
  if (q && ![asset.id_interna, asset.id_ses, asset.descricao, asset.descricoes_padrao?.descricao, asset.marca_modelo, asset.centros_custo?.nome]
    .some(v => String(v || "").toLowerCase().includes(q))) return false;
  if (f.centro && asset.centros_custo?.id !== f.centro) return false;
  if (f.tipo && String(asset.tipo_id) !== String(f.tipo)) return false;
  if (f.status && asset.status !== f.status) return false;
  if (f.aquisicao && asset.tipo_aquisicao !== f.aquisicao) return false;
  if (f.conservacao && asset.estado_conservacao !== f.conservacao) return false;
  if (f.sigem === "sim" && !asset.descricoes_padrao?.id) return false;
  if (f.sigem === "nao" && asset.descricoes_padrao?.id) return false;
  if (f.valor === "sim" && (asset.valor_aquisicao === null || asset.valor_aquisicao === undefined || asset.valor_aquisicao === "")) return false;
  if (f.valor === "nao" && !(asset.valor_aquisicao === null || asset.valor_aquisicao === undefined || asset.valor_aquisicao === "")) return false;
  if (f.idSes === "sim" && !asset.id_ses) return false;
  if (f.idSes === "nao" && asset.id_ses) return false;
  const date = normalizeDateOnly(asset.data_aquisicao);
  if (f.dataDe && date && date < f.dataDe) return false;
  if (f.dataAte && date && date > f.dataAte) return false;
  return true;
}

function sortAssets(items, order) {
  const rows = [...items];
  const cmpText = (a,b) => String(a||"").localeCompare(String(b||""), "pt-BR", {numeric:true,sensitivity:"base"});
  if (order === "descricao") rows.sort((a,b)=>cmpText(assetDisplayName(a),assetDisplayName(b)));
  else if (order === "centro") rows.sort((a,b)=>cmpText(a.centros_custo?.nome,b.centros_custo?.nome));
  else if (order === "data") rows.sort((a,b)=>cmpText(normalizeDateOnly(b.data_aquisicao),normalizeDateOnly(a.data_aquisicao)));
  else if (order === "valor") rows.sort((a,b)=>Number(b.valor_aquisicao||0)-Number(a.valor_aquisicao||0));
  else rows.sort((a,b)=>cmpText(a.id_interna,b.id_interna));
  return rows;
}

function filteredByPanel(key, includeRemoved = false) {
  const f = ensureFilters(key);
  return sortAssets(
    state.assets.filter(a => includeRemoved ? true : !a.removido).filter(a => assetMatchesFilters(a, f)),
    f.ordenacao
  );
}

function filterPanelHtml(key, title = "Filtros") {
  const f = ensureFilters(key);
  const centerOptions = state.centers.filter(c=>c.ativo).map(c=>`<option value="${c.id}" ${f.centro===c.id?"selected":""}>${escapeHtml(c.nome)}</option>`).join("");
  return `<section class="filter-panel">
    <div class="filter-panel-head"><div><strong>${title}</strong><small>Combine quantos filtros quiser.</small></div><button class="ghost-button compact-button" data-action="clear-filters" data-filter-key="${key}">Limpar filtros</button></div>
    <div class="filter-grid">
      <label class="filter-wide">Pesquisa<input type="search" data-filter-key="${key}" data-filter-field="q" value="${escapeHtml(f.q)}" placeholder="ID, descrição, SES, marca ou Catálogo"></label>
      <label>Centro de custo<select data-filter-key="${key}" data-filter-field="centro"><option value="">Todos</option>${centerOptions}</select></label>
      <label>Tipo<select data-filter-key="${key}" data-filter-field="tipo"><option value="">Todos</option><option value="1" ${f.tipo==="1"?"selected":""}>Equipamento Médico</option><option value="2" ${f.tipo==="2"?"selected":""}>Mobiliário</option><option value="3" ${f.tipo==="3"?"selected":""}>Informática</option></select></label>
      <label>Status<select data-filter-key="${key}" data-filter-field="status"><option value="">Todos</option><option value="ATIVO" ${f.status==="ATIVO"?"selected":""}>Ativo</option><option value="INATIVO" ${f.status==="INATIVO"?"selected":""}>Inativo</option></select></label>
      <label>Aquisição<select data-filter-key="${key}" data-filter-field="aquisicao"><option value="">Todas</option><option value="COMPRA" ${f.aquisicao==="COMPRA"?"selected":""}>Compra</option><option value="DOACAO" ${f.aquisicao==="DOACAO"?"selected":""}>Doação</option><option value="LOCACAO" ${f.aquisicao==="LOCACAO"?"selected":""}>Locação</option><option value="CONTRATO_GESTAO" ${f.aquisicao==="CONTRATO_GESTAO"?"selected":""}>Contrato de Gestão</option></select></label>
      <label>Conservação<select data-filter-key="${key}" data-filter-field="conservacao"><option value="">Todos</option><option value="PRODUTO_NOVO" ${f.conservacao==="PRODUTO_NOVO"?"selected":""}>Produto Novo</option><option value="BEM_CONSERVADO" ${f.conservacao==="BEM_CONSERVADO"?"selected":""}>Bem Conservado</option><option value="DESGASTADO" ${f.conservacao==="DESGASTADO"?"selected":""}>Desgastado</option><option value="INUTILIZAVEL" ${f.conservacao==="INUTILIZAVEL"?"selected":""}>Inutilizável</option></select></label>
      <label>Vínculo com Catálogo<select data-filter-key="${key}" data-filter-field="sigem"><option value="">Todos</option><option value="sim" ${f.sigem==="sim"?"selected":""}>Com Catálogo</option><option value="nao" ${f.sigem==="nao"?"selected":""}>Sem Catálogo</option></select></label>
      <label>Valor<select data-filter-key="${key}" data-filter-field="valor"><option value="">Todos</option><option value="sim" ${f.valor==="sim"?"selected":""}>Com valor</option><option value="nao" ${f.valor==="nao"?"selected":""}>Sem valor</option></select></label>
      <label>ID SES<select data-filter-key="${key}" data-filter-field="idSes"><option value="">Todos</option><option value="sim" ${f.idSes==="sim"?"selected":""}>Com ID SES</option><option value="nao" ${f.idSes==="nao"?"selected":""}>Sem ID SES</option></select></label>
      <label>Aquisição de<div class="date-shell"><input type="date" data-filter-key="${key}" data-filter-field="dataDe" value="${escapeHtml(f.dataDe)}"></div></label>
      <label>Aquisição até<div class="date-shell"><input type="date" data-filter-key="${key}" data-filter-field="dataAte" value="${escapeHtml(f.dataAte)}"></div></label>
      <label>Ordenar por<select data-filter-key="${key}" data-filter-field="ordenacao"><option value="id" ${f.ordenacao==="id"?"selected":""}>ID interna</option><option value="descricao" ${f.ordenacao==="descricao"?"selected":""}>Descrição</option><option value="centro" ${f.ordenacao==="centro"?"selected":""}>Centro de custo</option><option value="data" ${f.ordenacao==="data"?"selected":""}>Data de aquisição</option><option value="valor" ${f.ordenacao==="valor"?"selected":""}>Maior valor</option></select></label>
    </div>
  </section>`;
}

function normalizeDateOnly(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text = String(value).trim();
  const m = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}


function mobilityBadge(asset) {
  return asset.mobilidade === "MOVEL" ? '<span class="context-tag">[Móvel]</span>' : "";
}

function maintenanceBadge(asset) {
  return asset.em_manutencao ? '<span class="context-tag context-tag-maintenance">[Em manutenção]</span>' : "";
}

function centerChipHtml(center, removeAction, removeId) {
  return `<span class="selection-chip">${escapeHtml(center.nome)}<button type="button" data-action="${removeAction}" data-center-id="${removeId}" aria-label="Remover ${escapeHtml(center.nome)}">×</button></span>`;
}

function availableCentersForPicker(query, selectedIds, excludedIds = []) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 1) return [];
  const selected = new Set(selectedIds || []);
  const excluded = new Set(excludedIds.filter(Boolean));
  return state.centers
    .filter(c => c.ativo && !selected.has(c.id) && !excluded.has(c.id))
    .filter(c => [c.nome, c.codigo].some(v => String(v || "").toLowerCase().includes(q)))
    .slice(0, 12);
}

function renderFormAllowedCenters() {
  const box = document.querySelector("#mobilityCentersBox");
  if (!box) return;
  box.hidden = state.formMobility !== "MOVEL";
  if (state.formMobility !== "MOVEL") {
    const results = document.querySelector("#allowedCenterResults");
    if (results) results.hidden = true;
  }
  document.querySelectorAll("[data-mobility-value]").forEach(btn => btn.classList.toggle("active", btn.dataset.mobilityValue === state.formMobility));
  const chips = document.querySelector("#allowedCenterChips");
  if (chips) {
    chips.innerHTML = [...state.formAllowedCenters].map(id => {
      const c = state.centers.find(x => x.id === id);
      return c ? centerChipHtml(c, "remove-form-allowed-center", id) : "";
    }).join("");
  }
  bindMobilityChipActions();
}

function renderFormAllowedCenterResults() {
  const input = document.querySelector("#allowedCenterSearch");
  const box = document.querySelector("#allowedCenterResults");
  if (!input || !box) return;
  const current = document.querySelector("#centroCusto")?.value || "";
  const matches = availableCentersForPicker(input.value, state.formAllowedCenters, [current]);
  box.hidden = !matches.length;
  box.innerHTML = matches.map(c => `<button type="button" data-action="add-form-allowed-center" data-center-id="${c.id}">${escapeHtml(c.nome)}</button>`).join("");
  bindMobilityChipActions();
}

function bindMobilityChipActions() {
  document.querySelectorAll('[data-action="remove-form-allowed-center"]').forEach(b => b.addEventListener("click", () => {
    state.formAllowedCenters.delete(b.dataset.centerId);
    renderFormAllowedCenters();
  }));
  document.querySelectorAll('[data-action="add-form-allowed-center"]').forEach(b => b.addEventListener("click", () => {
    state.formAllowedCenters.add(b.dataset.centerId);
    const input = document.querySelector("#allowedCenterSearch");
    if (input) input.value = "";
    const results = document.querySelector("#allowedCenterResults");
    if (results) results.hidden = true;
    renderFormAllowedCenters();
  }));
}

function currentAllowedCenterIds(asset) {
  return new Set((asset.centros_permitidos || []).map(c => c.id));
}

function renderMoveAllowedCenters() {
  const asset = selectedAsset();
  if (!asset) return;

  const destination = document.querySelector("#moveCenter")?.value || "";
  const options = document.querySelector("#moveMobileOptions");
  const alert = document.querySelector("#moveMobilityAlert");

  document.querySelectorAll("[data-move-mobility]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.moveMobility === state.moveMobility);
  });

  if (options) options.hidden = state.moveMobility !== "MOVEL";

  if (state.moveMobility === "FIXO") {
    state.moveAllowedCenters.clear();
    if (alert) {
      alert.hidden = false;
      alert.className = "mobility-alert is-neutral";
      alert.textContent = "O patrimônio ficará fixo no centro de custo de destino.";
    }
  } else {
    let removedDestination = false;
    if (destination && state.moveAllowedCenters.has(destination)) {
      state.moveAllowedCenters.delete(destination);
      removedDestination = true;
    }

    if (alert) {
      if (removedDestination) {
        const centerName = state.centers.find(c => c.id === destination)?.nome || "Centro de destino";
        alert.hidden = false;
        alert.className = "mobility-alert is-warning";
        alert.textContent = `${centerName} foi removido dos centros de custo permitidos porque passará a ser o centro atual do patrimônio.`;
      } else {
        alert.hidden = true;
        alert.textContent = "";
      }
    }
  }

  const chips = document.querySelector("#moveAllowedCenterChips");
  if (chips) {
    chips.innerHTML = [...state.moveAllowedCenters].map(id => {
      const c = state.centers.find(x => x.id === id);
      return c ? centerChipHtml(c, "remove-move-allowed-center", id) : "";
    }).join("");
  }
  bindMoveMobilityActions();
}

function renderMoveAllowedCenterResults() {
  const input = document.querySelector("#moveAllowedCenterSearch");
  const box = document.querySelector("#moveAllowedCenterResults");
  if (!input || !box) return;
  const asset = selectedAsset();
  const destination = document.querySelector("#moveCenter")?.value || "";
  const matches = availableCentersForPicker(input.value, state.moveAllowedCenters, [destination, asset?.centros_custo?.id]);
  box.hidden = !matches.length;
  box.innerHTML = matches.map(c => `<button type="button" data-action="add-move-allowed-center" data-center-id="${c.id}">${escapeHtml(c.nome)}</button>`).join("");
  bindMoveMobilityActions();
}

function bindMoveMobilityActions() {
  document.querySelectorAll('[data-action="remove-move-allowed-center"]').forEach(b => b.addEventListener("click", () => {
    state.moveAllowedCenters.delete(b.dataset.centerId);
    renderMoveAllowedCenters();
  }));
  document.querySelectorAll('[data-action="add-move-allowed-center"]').forEach(b => b.addEventListener("click", () => {
    state.moveAllowedCenters.add(b.dataset.centerId);
    const input = document.querySelector("#moveAllowedCenterSearch");
    if (input) input.value = "";
    const results = document.querySelector("#moveAllowedCenterResults");
    if (results) results.hidden = true;
    renderMoveAllowedCenters();
  }));
}

function allowedCentersDisplay(asset) {
  if (asset.mobilidade !== "MOVEL") return "—";
  const centers = asset.centros_permitidos || [];
  return centers.length ? centers.map(c => c.nome).join(", ") : "Nenhum centro adicional definido";
}

function renderAssets() {
  const rows = filteredByPanel("assetFilters", state.showRemoved);
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>${state.showRemoved ? "Patrimônios removidos" : "Patrimônios"}</h1><p>Painel operacional para consulta e gestão rápida do acervo.</p></div>
      <div class="header-actions"><button class="ghost-button" data-action="toggle-removed">${state.showRemoved ? "Ver ativos" : "Ver removidos"}</button>${canEditAssets() ? '<button class="primary-button" data-action="new">+ Novo patrimônio</button>' : ""}</div>
    </div>
    ${filterPanelHtml("assetFilters", "Pesquisa e filtros")}
    <section class="panel">
      <div class="panel-header"><div><h2>${rows.length} patrimônio(s)</h2><small>As ações ficam disponíveis em cada linha.</small></div><button class="ghost-button" data-action="export-panel">Exportar filtrados</button></div>
      ${assetsTable(rows, "", true)}
    </section>`;
  bindDynamicActions();
}

function assetsTable(assets, title = "", withActions = false) {
  if (!assets.length) return `${title ? `<section class="panel"><div class="panel-header"><h2>${title}</h2></div>` : ""}<div class="empty">Nenhum patrimônio encontrado.</div>${title ? "</section>" : ""}`;
  const table = `<div class="table-wrap"><table><thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th><th>ID SES</th>${withActions ? '<th class="actions-head">Ações</th>' : ""}</tr></thead><tbody>${assets.map((asset) => {
    const actions = withActions ? `<td><div class="row-actions">
      ${actionIcon("view-asset", asset, "Visualizar ficha", "view")}
      ${actionIcon("move-asset", asset, "Movimentar", "move", !canMoveAssets() || asset.removido)}
      ${actionIcon("maintenance-asset", asset, "Manutenção", "maintenance", !canMaintainAssets() || asset.removido)}
      ${actionIcon("label-asset", asset, "Gerar etiqueta", "label")}
    </div></td>` : "";
    const statusText = asset.removido ? "Removido" : (asset.status === "ATIVO" ? "Ativo" : "Inativo");
    return `<tr class="${asset.removido ? "removed-row" : ""}">
      <td><strong>${escapeHtml(asset.id_interna)}</strong></td>
      <td>${escapeHtml(assetDisplayName(asset))}</td>
      <td><div class="value-with-badges"><span>${escapeHtml(typeName(asset.tipo_id))}</span>${mobilityBadge(asset)}</div></td>
      <td>${escapeHtml(asset.centros_custo?.nome || "—")}</td>
      <td>${money(asset.valor_aquisicao)}</td>
      <td class="${asset.status === "ATIVO" ? "status-active" : "status-inactive"}"><div class="value-with-badges"><span>${escapeHtml(statusText)}</span>${maintenanceBadge(asset)}</div></td>
      <td>${escapeHtml(asset.id_ses || "—")}</td>${actions}
    </tr>`;
  }).join("")}</tbody></table></div>`;
  return title ? `<section class="panel"><div class="panel-header"><h2>${title}</h2></div>${table}</section>` : table;
}

async function openAssetDetail(id) {
  if (state.selectedAssetId !== id) state.detailEditMode = false;
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
  const editAllowed = canEditAssets() && !asset.removido;
  const actionButtons = asset.removido
    ? `<button class="ghost-button" data-action="restore">Restaurar</button>${canDeleteAssets() ? `<button class="danger-button" data-action="delete-permanent">Excluir definitivamente</button>` : ""}`
    : `<button class="ghost-button" data-action="move" ${canMoveAssets() ? "" : "disabled"}>${iconSvg("move")} Movimentar</button>
       <button class="ghost-button" data-action="maintenance" ${canMaintainAssets() ? "" : "disabled"}>${iconSvg("maintenance")} Manutenção</button>
       <button class="ghost-button" data-action="label">${iconSvg("label")} Gerar etiqueta</button>
       ${canEditAssets() ? `<button class="edit-action-button ${state.detailEditMode ? "active" : ""}" data-action="toggle-detail-edit-button">${state.detailEditMode ? "Concluir edição" : "Editar"}</button>` : ""}
       <button class="ghost-button" data-action="toggle-status">${asset.status === "ATIVO" ? "Inativar" : "Ativar"}</button>`;

  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header detail-header">
      <div><button class="back-link" data-action="back-assets">← Voltar para patrimônios</button><h1>${escapeHtml(assetDisplayName(asset))}</h1><p>${escapeHtml(asset.id_interna)}${asset.id_ses ? ` · SES ${escapeHtml(asset.id_ses)}` : ""}${asset.removido ? " · REMOVIDO" : ""}</p></div>
      <div class="header-actions">${actionButtons}</div>
    </div>

    ${state.detailEditMode && editAllowed ? detailEditFormHtml(asset) : `
      <section class="detail-grid">
        ${detailCard("Identificação", [["ID interna", asset.id_interna], ["ID SES", asset.id_ses || "—"], ["Item do Catálogo", asset.descricoes_padrao?.descricao || "—"], ["Descrição complementar", asset.descricao || "—"], ["Tipo", typeName(asset.tipo_id)], ["Marca/Modelo", asset.marca_modelo || "—"]])}
        ${detailCard("Aquisição e valores", [["Data de aquisição", formatDate(asset.data_aquisicao)], ["Tipo de aquisição", acquisitionName(asset.tipo_aquisicao)], ["Valor de aquisição", money(asset.valor_aquisicao)], ["Nota fiscal", asset.nota_fiscal_numero || "—"]])}
        ${detailCard("Localização e condição", [["Centro de custo", asset.centros_custo?.nome || "—"], ...(asset.mobilidade === "MOVEL" ? [["Mobilidade", "Móvel"]] : []), ["Estado de conservação", conservationName(asset.estado_conservacao)], ["Status", asset.removido ? "Removido" : (asset.status === "ATIVO" ? "Ativo" : "Inativo")], ...(asset.em_manutencao ? [["Condição operacional", "Em manutenção"]] : []), ...(asset.mobilidade === "MOVEL" ? [["Centros permitidos", allowedCentersDisplay(asset)]] : [])])}
      </section>`}

    <section class="panel"><div class="panel-header"><h2>Histórico</h2></div>${loadingHistory ? '<div class="loading">Carregando histórico…</div>' : historyHtml(asset, state.history)}</section>

    ${!asset.removido ? `<section class="danger-zone"><div><strong>Remover patrimônio</strong><p>Oculta o bem das listas operacionais, preservando histórico e possibilidade de restauração.</p></div><button class="danger-button" data-action="remove">Remover patrimônio</button></section>` : ""}
  `;
  bindDynamicActions();
}


function detailEditFormHtml(asset) {
  const centerOptions = state.centers.filter(c=>c.ativo || c.id===asset.centros_custo?.id).map(c=>`<option value="${c.id}" ${c.id===asset.centros_custo?.id?"selected":""}>${escapeHtml(c.nome)}${c.ativo ? "" : " (inativo)"}</option>`).join("");
  state.formMobility = asset.mobilidade || "FIXO";
  state.formAllowedCenters = currentAllowedCenterIds(asset);
  setTimeout(() => renderFormAllowedCenters(), 0);
  return `<form id="detailEditForm" class="inline-edit-form">
    <section class="detail-grid">
      <article class="detail-card"><h2>Identificação</h2>
        <div class="inline-form-grid">
          <label>ID interna<input value="${escapeHtml(asset.id_interna)}" disabled></label>
          <label>ID SES<input name="id_ses" value="${escapeHtml(asset.id_ses || "")}"></label>
          <label class="full">Descrição complementar *<input name="descricao" required value="${escapeHtml(asset.descricao)}"></label>
          <label>Tipo *<select name="tipo_id" required><option value="1" ${asset.tipo_id==1?"selected":""}>Equipamento Médico</option><option value="2" ${asset.tipo_id==2?"selected":""}>Mobiliário</option><option value="3" ${asset.tipo_id==3?"selected":""}>Informática</option></select>${asset.descricoes_padrao?.tipo_id ? `<small class="sigem-type-hint ${Number(asset.tipo_id)!==Number(asset.descricoes_padrao.tipo_id)?"is-warning":""}">Catálogo: ${escapeHtml(typeName(asset.descricoes_padrao.tipo_id))}${Number(asset.tipo_id)!==Number(asset.descricoes_padrao.tipo_id)?" · Tipo atual diferente":""}</small>` : '<small class="sigem-type-hint">Sem Tipo do Catálogo disponível para conferência.</small>'}</label>
          <label>Marca/Modelo<input name="marca_modelo" value="${escapeHtml(asset.marca_modelo || "")}"></label>
        </div>
      </article>
      <article class="detail-card"><h2>Aquisição e valores</h2>
        <div class="inline-form-grid">
          <label>Data de aquisição *<div class="date-shell"><input type="date" name="data_aquisicao" required value="${escapeHtml(normalizeDateOnly(asset.data_aquisicao))}"></div></label>
          <label>Aquisição *<select name="tipo_aquisicao" required><option value="COMPRA" ${asset.tipo_aquisicao==="COMPRA"?"selected":""}>Compra</option><option value="DOACAO" ${asset.tipo_aquisicao==="DOACAO"?"selected":""}>Doação</option><option value="LOCACAO" ${asset.tipo_aquisicao==="LOCACAO"?"selected":""}>Locação</option><option value="CONTRATO_GESTAO" ${asset.tipo_aquisicao==="CONTRATO_GESTAO"?"selected":""}>Contrato de Gestão</option></select></label>
          <label>Valor de aquisição<input name="valor_aquisicao" value="${asset.valor_aquisicao == null ? "" : escapeHtml(String(asset.valor_aquisicao).replace(".", ","))}" placeholder="R$ 0,00"></label>
          <label>Nota fiscal<input name="nota_fiscal_numero" value="${escapeHtml(asset.nota_fiscal_numero || "")}"></label>
        </div>
      </article>
      <article class="detail-card"><h2>Localização e condição</h2>
        <div class="inline-form-grid">
          <label class="full">Centro de custo atual<select name="centro_custo_id" disabled>${centerOptions}</select><small>Para alterar o centro de custo, use a ação Movimentar para manter o registro operacional.</small></label>
          <label>Estado<select name="estado_conservacao"><option value="PRODUTO_NOVO" ${asset.estado_conservacao==="PRODUTO_NOVO"?"selected":""}>Produto Novo</option><option value="BEM_CONSERVADO" ${asset.estado_conservacao==="BEM_CONSERVADO"?"selected":""}>Bem Conservado</option><option value="DESGASTADO" ${asset.estado_conservacao==="DESGASTADO"?"selected":""}>Desgastado</option><option value="INUTILIZAVEL" ${asset.estado_conservacao==="INUTILIZAVEL"?"selected":""}>Inutilizável</option></select></label>
          <label>Status<select name="status"><option value="ATIVO" ${asset.status==="ATIVO"?"selected":""}>Ativo</option><option value="INATIVO" ${asset.status==="INATIVO"?"selected":""}>Inativo</option></select></label>
          <label class="full mobility-toggle"><span>Mobilidade</span><div class="segmented-control"><button type="button" data-mobility-value="FIXO" class="${asset.mobilidade !== "MOVEL" ? "active" : ""}">Fixo</button><button type="button" data-mobility-value="MOVEL" class="${asset.mobilidade === "MOVEL" ? "active" : ""}">Móvel</button></div></label>
          <div class="full mobility-centers" id="mobilityCentersBox" ${asset.mobilidade === "MOVEL" ? "" : "hidden"}>
            <label>Centros de custo permitidos</label>
            <div class="chip-picker">
              <input id="allowedCenterSearch" type="search" autocomplete="off" placeholder="Pesquise e selecione um centro de custo">
              <div id="allowedCenterResults" class="chip-results" hidden></div>
              <div id="allowedCenterChips" class="chip-list"></div>
            </div>
          </div>
        </div>
      </article>
    </section>
    <div class="inline-edit-actions"><button type="button" class="ghost-button" data-action="cancel-detail-edit">Cancelar</button><button type="submit" class="primary-button">Salvar alterações</button></div>
  </form>`;
}

async function submitDetailEdit(event) {
  event.preventDefault();
  const asset = selectedAsset();
  if (!asset || !canEditAssets()) return;
  const fd = new FormData(event.currentTarget);
  const rawValue = String(fd.get("valor_aquisicao") || "").trim();
  const payload = {
    id_ses: String(fd.get("id_ses") || "").trim() || null,
    descricao: String(fd.get("descricao") || "").trim(),
    descricao_padrao_id: asset.descricoes_padrao?.id || null,
    data_aquisicao: String(fd.get("data_aquisicao") || ""),
    valor_aquisicao: rawValue ? normalizeMoney(rawValue) : null,
    nota_fiscal_numero: String(fd.get("nota_fiscal_numero") || "").trim() || null,
    centro_custo_id: asset.centros_custo?.id,
    tipo_id: Number(fd.get("tipo_id")),
    marca_modelo: String(fd.get("marca_modelo") || "").trim() || null,
    status: String(fd.get("status") || asset.status),
    tipo_aquisicao: String(fd.get("tipo_aquisicao") || asset.tipo_aquisicao),
    estado_conservacao: String(fd.get("estado_conservacao") || asset.estado_conservacao),
    mobilidade: state.formMobility,
    centros_permitidos_ids: state.formMobility === "MOVEL" ? [...state.formAllowedCenters] : []
  };
  const sigemType = Number(asset.descricoes_padrao?.tipo_id || 0);
  if (validTypeId(sigemType) && payload.tipo_id !== sigemType) {
    if (!confirmSigemTypeOverride(payload.tipo_id, sigemType, asset.descricoes_padrao?.descricao || "")) return;
    payload.confirmar_tipo_divergente = true;
  }
  try {
    const updated = await updateAsset(asset.id, payload);
    state.assets = state.assets.map(a=>a.id===updated.id?updated:a);
    state.detailEditMode = false;
    toast("Patrimônio atualizado.", "success");
    await openAssetDetail(updated.id);
  } catch (error) { toast(error.message, "error"); }
}

function detailCard(title, rows) {
  return `<article class="detail-card"><h2>${title}</h2><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`).join("")}</dl></article>`;
}

function historyHtml(asset, history) {
  if (!history.length) return '<div class="empty">Nenhum evento registrado.</div>';
  const labels = {
    CADASTRO: "Patrimônio cadastrado",
    INSERT: "Patrimônio cadastrado",
    EDICAO_CADASTRAL: "Edição cadastral",
    UPDATE: "Edição cadastral",
    MOVIMENTACAO: "Movimentação realizada",
    INATIVACAO: "Patrimônio inativado",
    REATIVACAO: "Patrimônio reativado",
    REMOCAO_LOGICA: "Patrimônio removido",
    RESTAURACAO: "Patrimônio restaurado",
    MOBILIDADE_ALTERADA: "Mobilidade alterada",
    CENTRO_PERMITIDO_ADICIONADO: "Centro permitido adicionado",
    CENTRO_PERMITIDO_REMOVIDO: "Centro permitido removido",
    MANUTENCAO_ABERTA: "Manutenção aberta",
    MANUTENCAO_CONCLUIDA: "Manutenção concluída"
  };
  const fieldLabels = {
    id_ses: "ID SES", descricao: "Descrição", data_aquisicao: "Data de aquisição",
    valor_aquisicao: "Valor", nota_fiscal_numero: "Nota fiscal", tipo_id: "Tipo",
    marca_modelo: "Marca/Modelo", status: "Status", tipo_aquisicao: "Aquisição",
    estado_conservacao: "Estado de conservação", mobilidade: "Mobilidade"
  };
  const centerName = id => state.centers.find(c=>c.id===id)?.nome || "Centro de custo";
  const detail = entry => {
    const op = entry.operacao;
    const n = entry.dados_novos || {};
    const a = entry.dados_anteriores || {};
    if (op === "MOVIMENTACAO") {
      const mov = n.movimentacao || {};
      const from = mov.origem_nome || centerName(a.centro_custo_id);
      const to = mov.destino_nome || centerName(n.centro_custo_id);
      const people = [
        mov.solicitante ? `Solicitante: ${mov.solicitante}` : "",
        mov.movimentado_por ? `Movimentado por: ${mov.movimentado_por}` : "",
        mov.recebido_por ? `Recebido por: ${mov.recebido_por}` : ""
      ].filter(Boolean);
      return [`${from} → ${to}`, ...people].join(" · ");
    }
    if (op === "CENTRO_PERMITIDO_ADICIONADO" || op === "CENTRO_PERMITIDO_REMOVIDO") return n.centro_nome || "Centro de custo";
    if (op === "MOBILIDADE_ALTERADA") return `${a.mobilidade || "FIXO"} → ${n.mobilidade || "FIXO"}`;
    if (op === "MANUTENCAO_ABERTA") {
      const parts = [n.tipo === "PREVENTIVA" ? "Preventiva" : "Corretiva", n.descricao];
      if (n.solicitante) parts.push(`Solicitante: ${n.solicitante}`);
      if (n.encaminhado_por) parts.push(`Levado por: ${n.encaminhado_por}`);
      if (n.recebido_manutencao_por) parts.push(`Recebido na manutenção por: ${n.recebido_manutencao_por}`);
      return parts.filter(Boolean).join(" · ");
    }
    if (op === "MANUTENCAO_CONCLUIDA") {
      return [
        n.responsavel_manutencao ? `Responsável pela manutenção: ${n.responsavel_manutencao}` : "",
        n.entregue_centro_por ? `Entregue ao centro por: ${n.entregue_centro_por}` : "",
        n.recebido_centro_por ? `Recebido no centro por: ${n.recebido_centro_por}` : ""
      ].filter(Boolean).join(" · ") || "Manutenção concluída.";
    }
    if (op === "EDICAO_CADASTRAL" || op === "UPDATE") {
      const changes = Object.keys(fieldLabels).filter(k => String(a[k] ?? "") !== String(n[k] ?? ""));
      if (!changes.length) return "Dados cadastrais atualizados.";
      return changes.slice(0,5).map(k => `${fieldLabels[k]}: ${String(a[k] ?? "—")} → ${String(n[k] ?? "—")}`).join(" · ");
    }
    return "Evento registrado automaticamente pelo sistema.";
  };
  return `<div class="timeline">${history.map(entry => {
    const title = labels[entry.operacao] || entry.operacao.replaceAll("_"," ");
    const who = entry.usuario?.nome || entry.usuario?.email || "";
    return `<div class="timeline-item"><div class="timeline-dot"></div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail(entry))}</p><small>${formatDateTime(entry.criado_em)}${who ? ` · Registrado por ${escapeHtml(who)}` : ""}</small></div></div>`;
  }).join("")}</div>`;
}


function centerMatchesSearch(center, query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return [center.nome, center.codigo].some((value) => String(value || "").toLowerCase().includes(q));
}

function renderGlobalSearch() {
  const q = state.search.trim();
  const assets = filteredAssets();
  const centers = state.centers.filter((center) => centerMatchesSearch(center, q));
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header"><div><h1>Pesquisa</h1><p>Resultados para “${escapeHtml(q)}”.</p></div></div>
    ${assetsTable(assets, `Patrimônios · ${assets.length}`)}
    <section class="panel"><div class="panel-header"><h2>Centros de custo · ${centers.length}</h2></div>
      ${centers.length ? `<div class="table-wrap"><table><thead><tr><th>Centro de custo</th><th>Código</th><th>Status</th><th>Patrimônios</th></tr></thead><tbody>${centers.map((center) => {
        const count = state.assets.filter((asset) => !asset.removido && asset.centros_custo?.id === center.id).length;
        return `<tr class="center-search-row" data-center-id="${center.id}" data-center-name="${escapeHtml(center.nome)}" tabindex="0"><td><strong>${escapeHtml(center.nome)}</strong></td><td>${escapeHtml(center.codigo || "—")}</td><td class="${center.ativo ? "status-active" : "status-inactive"}">${center.ativo ? "Ativo" : "Inativo"}</td><td>${count}</td></tr>`;
      }).join("")}</tbody></table></div>` : '<div class="empty">Nenhum centro de custo encontrado.</div>'}
    </section>`;
  bindDynamicActions();
}

function renderLabels() {
  const rows = filteredByPanel("labelFilters", false);
  const selectedCount = state.labelSelected.size;
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header"><div><h1>Etiquetas</h1><p>Selecione livremente patrimônios de diferentes centros e tipos.</p></div></div>
    ${filterPanelHtml("labelFilters", "Filtros das etiquetas")}
    <section class="selection-toolbar">
      <div><strong>${selectedCount} selecionado(s)</strong><small>${rows.length} patrimônio(s) no filtro atual.</small></div>
      <div class="header-actions">
        <button class="ghost-button" data-action="select-filtered-labels">Selecionar todos filtrados</button>
        <button class="ghost-button" data-action="clear-label-selection">Limpar seleção</button>
        <button class="primary-button" data-action="generate-selected-labels" ${selectedCount ? "" : "disabled"}>Gerar ${selectedCount || ""} etiqueta${selectedCount===1?"":"s"}</button>
      </div>
    </section>
    <section class="panel">
      <div class="table-wrap"><table><thead><tr><th class="check-col"></th><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Status</th><th>Prévia</th></tr></thead>
      <tbody>${rows.map(asset=>`<tr>
        <td><input class="label-check" type="checkbox" data-label-id="${asset.id}" ${state.labelSelected.has(asset.id)?"checked":""} aria-label="Selecionar ${escapeHtml(asset.id_interna)}"></td>
        <td><strong>${escapeHtml(asset.id_interna)}</strong></td><td>${escapeHtml(assetDisplayName(asset))}</td><td><div class="value-with-badges"><span>${typeName(asset.tipo_id)}</span>${mobilityBadge(asset)}</div></td><td>${escapeHtml(asset.centros_custo?.nome||"—")}</td><td><div class="value-with-badges"><span>${asset.status==="ATIVO"?"Ativo":"Inativo"}</span>${maintenanceBadge(asset)}</div></td>
        <td><button class="table-action" data-action="label-asset" data-asset-id="${asset.id}" title="Pré-visualizar etiqueta" aria-label="Pré-visualizar etiqueta">${iconSvg("label")}</button></td>
      </tr>`).join("")}</tbody></table></div>
    </section>`;
  bindDynamicActions();
}


function reportRows() {
  const f = state.reportFilters;
  if (!f.centro) return [];
  const q = String(f.q || "").trim().toLowerCase();
  const rows = state.assets
    .filter(asset => !asset.removido && asset.centros_custo?.id === f.centro)
    .filter(asset => {
      if (q && ![asset.id_interna, asset.id_ses, asset.descricao, asset.marca_modelo, asset.descricoes_padrao?.descricao]
        .some(value => String(value || "").toLowerCase().includes(q))) return false;
      if (f.tipo && String(asset.tipo_id) !== String(f.tipo)) return false;
      if (f.status && asset.status !== f.status) return false;
      if (f.aquisicao && asset.tipo_aquisicao !== f.aquisicao) return false;
      if (f.conservacao && asset.estado_conservacao !== f.conservacao) return false;
      if (f.mobilidade && (asset.mobilidade || "FIXO") !== f.mobilidade) return false;
      if (f.manutencao === "sim" && !asset.em_manutencao) return false;
      if (f.manutencao === "nao" && asset.em_manutencao) return false;
      return true;
    });
  return sortAssets(rows, f.ordenacao || "id");
}

function reportCenter() {
  return state.centers.find(center => center.id === state.reportFilters.centro) || null;
}

function reportFilterSummary() {
  const f = state.reportFilters;
  const parts = [];
  if (f.tipo) parts.push(`Tipo: ${typeName(Number(f.tipo))}`);
  if (f.status) parts.push(`Status: ${f.status === "ATIVO" ? "Ativo" : "Inativo"}`);
  if (f.aquisicao) parts.push(`Aquisição: ${acquisitionName(f.aquisicao)}`);
  if (f.conservacao) parts.push(`Conservação: ${conservationName(f.conservacao)}`);
  if (f.mobilidade) parts.push(`Mobilidade: ${f.mobilidade === "MOVEL" ? "Móvel" : "Fixo"}`);
  if (f.manutencao) parts.push(`Manutenção: ${f.manutencao === "sim" ? "Em manutenção" : "Fora de manutenção"}`);
  if (String(f.q || "").trim()) parts.push(`Pesquisa: ${String(f.q).trim()}`);
  return parts.length ? parts.join(" · ") : "Sem filtros adicionais";
}

function renderReports() {
  const f = state.reportFilters;
  const centerOptions = state.centers.map(center =>
    `<option value="${center.id}" ${f.centro === center.id ? "selected" : ""}>${escapeHtml(center.nome)}${center.ativo ? "" : " (inativo)"}</option>`
  ).join("");
  const rows = reportRows();
  const center = reportCenter();
  const active = rows.filter(asset => asset.status === "ATIVO").length;
  const mobile = rows.filter(asset => asset.mobilidade === "MOVEL").length;
  const maintenance = rows.filter(asset => asset.em_manutencao).length;

  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div>
        <h1>Relação por Centro de Custo</h1>
        <p>Gere uma relação operacional considerando a localização atual do patrimônio.</p>
      </div>
      <div class="header-actions">
        <button class="ghost-button" data-action="export-report" ${rows.length ? "" : "disabled"}>Exportar CSV</button>
        <button class="primary-button" data-action="print-report" ${rows.length ? "" : "disabled"}>Imprimir / Salvar PDF</button>
      </div>
    </div>

    <section class="filter-panel report-filter-panel">
      <div class="filter-panel-head">
        <div><strong>Critérios da relação</strong><small>O Centro de Custo é obrigatório. Os demais filtros são opcionais e combináveis.</small></div>
        <button class="ghost-button compact-button" data-action="clear-report-filters">Limpar filtros</button>
      </div>
      <div class="filter-grid report-filter-grid">
        <label class="filter-wide">Centro de custo *
          <select data-report-filter="centro"><option value="">Selecione</option>${centerOptions}</select>
        </label>
        <label class="filter-wide">Pesquisa
          <input type="search" data-report-filter="q" value="${escapeHtml(f.q)}" placeholder="ID, SES, descrição, marca ou Catálogo">
        </label>
        <label>Tipo
          <select data-report-filter="tipo"><option value="">Todos</option><option value="1" ${f.tipo==="1"?"selected":""}>Equipamento Médico</option><option value="2" ${f.tipo==="2"?"selected":""}>Mobiliário</option><option value="3" ${f.tipo==="3"?"selected":""}>Informática</option></select>
        </label>
        <label>Status
          <select data-report-filter="status"><option value="">Todos</option><option value="ATIVO" ${f.status==="ATIVO"?"selected":""}>Ativo</option><option value="INATIVO" ${f.status==="INATIVO"?"selected":""}>Inativo</option></select>
        </label>
        <label>Mobilidade
          <select data-report-filter="mobilidade"><option value="">Todos</option><option value="FIXO" ${f.mobilidade==="FIXO"?"selected":""}>Fixo</option><option value="MOVEL" ${f.mobilidade==="MOVEL"?"selected":""}>Móvel</option></select>
        </label>
        <label>Manutenção
          <select data-report-filter="manutencao"><option value="">Todos</option><option value="sim" ${f.manutencao==="sim"?"selected":""}>Em manutenção</option><option value="nao" ${f.manutencao==="nao"?"selected":""}>Fora de manutenção</option></select>
        </label>
        <label>Aquisição
          <select data-report-filter="aquisicao"><option value="">Todas</option><option value="COMPRA" ${f.aquisicao==="COMPRA"?"selected":""}>Compra</option><option value="DOACAO" ${f.aquisicao==="DOACAO"?"selected":""}>Doação</option><option value="LOCACAO" ${f.aquisicao==="LOCACAO"?"selected":""}>Locação</option><option value="CONTRATO_GESTAO" ${f.aquisicao==="CONTRATO_GESTAO"?"selected":""}>Contrato de Gestão</option></select>
        </label>
        <label>Conservação
          <select data-report-filter="conservacao"><option value="">Todos</option><option value="PRODUTO_NOVO" ${f.conservacao==="PRODUTO_NOVO"?"selected":""}>Produto Novo</option><option value="BEM_CONSERVADO" ${f.conservacao==="BEM_CONSERVADO"?"selected":""}>Bem Conservado</option><option value="DESGASTADO" ${f.conservacao==="DESGASTADO"?"selected":""}>Desgastado</option><option value="INUTILIZAVEL" ${f.conservacao==="INUTILIZAVEL"?"selected":""}>Inutilizável</option></select>
        </label>
        <label>Ordenar por
          <select data-report-filter="ordenacao"><option value="id" ${f.ordenacao==="id"?"selected":""}>ID interna</option><option value="descricao" ${f.ordenacao==="descricao"?"selected":""}>Descrição</option><option value="data" ${f.ordenacao==="data"?"selected":""}>Data de aquisição</option><option value="valor" ${f.ordenacao==="valor"?"selected":""}>Maior valor</option></select>
        </label>
      </div>
    </section>

    ${center ? `
      <div class="cards report-summary-cards">
        <article class="card"><span class="muted">Patrimônios na relação</span><div class="metric">${rows.length}</div></article>
        <article class="card"><span class="muted">Ativos</span><div class="metric">${active}</div></article>
        <article class="card"><span class="muted">Móveis</span><div class="metric">${mobile}</div></article>
        <article class="card"><span class="muted">Em manutenção</span><div class="metric">${maintenance}</div></article>
      </div>

      <section class="panel report-preview-panel">
        <div class="panel-header">
          <div><h2>${escapeHtml(center.nome)}</h2><small>${escapeHtml(reportFilterSummary())}</small></div>
          <span class="badge">${rows.length} item(ns)</span>
        </div>
        ${rows.length ? `<div class="table-wrap"><table class="report-table">
          <thead><tr><th>ID interna</th><th>ID SES</th><th>Descrição</th><th>Tipo</th><th>Estado</th><th>Mobilidade</th><th>Status</th><th>Manutenção</th></tr></thead>
          <tbody>${rows.map(asset => `<tr>
            <td><strong>${escapeHtml(asset.id_interna)}</strong></td>
            <td>${escapeHtml(asset.id_ses || "—")}</td>
            <td>${escapeHtml(assetDisplayName(asset))}</td>
            <td>${escapeHtml(typeName(asset.tipo_id))}</td>
            <td>${escapeHtml(conservationName(asset.estado_conservacao))}</td>
            <td>${asset.mobilidade === "MOVEL" ? "Móvel" : "Fixo"}</td>
            <td class="${asset.status === "ATIVO" ? "status-active" : "status-inactive"}">${asset.status === "ATIVO" ? "Ativo" : "Inativo"}</td>
            <td>${asset.em_manutencao ? '<span class="context-tag context-tag-maintenance">Em manutenção</span>' : "—"}</td>
          </tr>`).join("")}</tbody>
        </table></div>` : '<div class="empty">Nenhum patrimônio corresponde aos filtros selecionados.</div>'}
      </section>
    ` : '<div class="placeholder report-empty-state">Selecione um Centro de Custo para gerar a relação.</div>'}
  `;

  document.querySelectorAll("[data-report-filter]").forEach(control => {
    const eventName = control.tagName === "INPUT" ? "input" : "change";
    control.addEventListener(eventName, debounce(() => {
      state.reportFilters[control.dataset.reportFilter] = control.value;
      renderReports();
    }, eventName === "input" ? 180 : 0));
  });
  document.querySelector('[data-action="clear-report-filters"]')?.addEventListener("click", () => {
    state.reportFilters = { centro: "", q: "", tipo: "", status: "", aquisicao: "", conservacao: "", mobilidade: "", manutencao: "", ordenacao: "id" };
    renderReports();
  });
  document.querySelector('[data-action="export-report"]')?.addEventListener("click", exportReportCsv);
  document.querySelector('[data-action="print-report"]')?.addEventListener("click", printReport);
}

function exportReportCsv() {
  const rows = reportRows();
  const center = reportCenter();
  if (!rows.length || !center) return;
  const data = [
    ["ID Interna","ID SES","Descrição","Tipo","Estado de Conservação","Mobilidade","Status","Manutenção"],
    ...rows.map(asset => [
      asset.id_interna,
      asset.id_ses || "",
      assetDisplayName(asset),
      typeName(asset.tipo_id),
      conservationName(asset.estado_conservacao),
      asset.mobilidade === "MOVEL" ? "Móvel" : "Fixo",
      asset.status === "ATIVO" ? "Ativo" : "Inativo",
      asset.em_manutencao ? "Em manutenção" : ""
    ])
  ];
  const csv = data.map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  const safeCenter = center.nome.replace(/[<>:"/\\|?*]+/g, "_").trim();
  a.href = url;
  const fileDate = new Intl.DateTimeFormat("pt-BR").format(new Date()).replaceAll("/", "-");
  a.download = `${safeCenter} - Relação Patrimonial - ${fileDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport() {
  const rows = reportRows();
  const center = reportCenter();
  if (!rows.length || !center) return;
  const popup = window.open("", "_blank", "width=1200,height=800");
  if (!popup) { toast("O navegador bloqueou a janela de impressão.", "error"); return; }
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const bodyRows = rows.map(asset => `<tr>
    <td><strong>${escapeHtml(asset.id_interna)}</strong></td>
    <td>${escapeHtml(asset.id_ses || "—")}</td>
    <td>${escapeHtml(assetDisplayName(asset))}</td>
    <td>${escapeHtml(typeName(asset.tipo_id))}</td>
    <td>${escapeHtml(conservationName(asset.estado_conservacao))}</td>
    <td>${asset.mobilidade === "MOVEL" ? "Móvel" : "Fixo"}</td>
    <td>${asset.status === "ATIVO" ? "Ativo" : "Inativo"}</td>
    <td>${asset.em_manutencao ? "Em manutenção" : "—"}</td>
  </tr>`).join("");

  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relação Patrimonial - ${escapeHtml(center.nome)}</title>
    <style>
      @page{size:A4 landscape;margin:10mm}
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17313d;margin:0;font-size:9pt}
      header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;border-bottom:2px solid #104861;padding-bottom:8px;margin-bottom:10px}
      h1{font-size:16pt;margin:0 0 3px;color:#104861}h2{font-size:11pt;margin:0}.meta{text-align:right;color:#526a75;font-size:8pt}
      .filters{margin:0 0 10px;color:#526a75;font-size:8pt}.count{font-weight:700;color:#104861}
      table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #cfdde3;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
      th{background:#edf5f8;font-size:7.5pt;text-transform:uppercase}tr{break-inside:avoid}
      th:nth-child(1),td:nth-child(1){width:11%}th:nth-child(2),td:nth-child(2){width:9%}th:nth-child(3),td:nth-child(3){width:24%}
      th:nth-child(4),td:nth-child(4){width:14%}th:nth-child(5),td:nth-child(5){width:14%}th:nth-child(6),td:nth-child(6){width:9%}
      th:nth-child(7),td:nth-child(7){width:8%}th:nth-child(8),td:nth-child(8){width:11%}
      footer{margin-top:10px;display:flex;justify-content:space-between;color:#6a7f88;font-size:8pt}
    </style></head><body>
      <header><div><h1>Relação Patrimonial por Centro de Custo</h1><h2>${escapeHtml(center.nome)}</h2></div><div class="meta">Gerado em ${escapeHtml(generatedAt)}<br><span class="count">${rows.length} patrimônio(s)</span></div></header>
      <p class="filters">${escapeHtml(reportFilterSummary())}</p>
      <table><thead><tr><th>ID interna</th><th>ID SES</th><th>Descrição</th><th>Tipo</th><th>Estado</th><th>Mobilidade</th><th>Status</th><th>Manutenção</th></tr></thead><tbody>${bodyRows}</tbody></table>
      <footer><span>Patrimônio+</span><span>Centro atual dos bens no momento da emissão.</span></footer>
      <script>window.addEventListener("load",()=>{window.print();});<\/script>
    </body></html>`);
  popup.document.close();
}


async function ensureCatalogUpdateContext(force = false) {
  if (state.catalogUpdateContextLoaded && !force) return;
  const context = await listCatalogUpdateContext();
  state.catalogAliases = context.aliases || [];
  state.catalogUpdates = context.atualizacoes || [];
  state.catalogUpdateContextLoaded = true;
}

function resetCatalogUpdate() {
  state.catalogUpdateBusy = false;
  state.catalogUpdateFileName = "";
  state.catalogUpdateHeaders = [];
  state.catalogUpdateRows = [];
  state.catalogUpdateMapping = { nome: "", tipo: "", valor: "" };
  state.catalogUpdateComplete = false;
  state.catalogUpdateAnalysis = [];
  state.catalogUpdateMissing = [];
  state.catalogUpdateStage = "file";
  state.catalogUpdateLastResult = null;
}

async function openCatalogUpdate() {
  try {
    await ensureCatalogUpdateContext();
  } catch (error) {
    toast(`Não foi possível carregar o contexto do catálogo: ${error.message}`, "error");
    return;
  }
  resetCatalogUpdate();
  const dialog = document.querySelector("#catalogUpdateDialog");
  dialog.showModal();
  renderCatalogUpdateDialog();
}

async function readCatalogCsvFile(file) {
  const buffer = await file.arrayBuffer();
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^\uFEFF/, "");
}

function guessCatalogUpdateMapping(headers) {
  const normalized = headers.map(header => ({ header, key: normalizeText(header) }));
  const find = aliases => normalized.find(item => aliases.some(alias => item.key === alias || item.key.includes(alias)))?.header || "";
  return {
    nome: find(["nome do item","descricao sigem","descricao","item","material","equipamento"]),
    tipo: find(["categoria","classificacao","tipo"]),
    valor: find(["valor padrao","valor sigem","valor","preco"])
  };
}

function catalogUpdateMappingOptions(selected) {
  return `<option value="">Não usar</option>${state.catalogUpdateHeaders.map(header =>
    `<option value="${escapeHtml(header)}" ${header===selected?"selected":""}>${escapeHtml(header)}</option>`
  ).join("")}`;
}

function parseCatalogType(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  if ([1,2,3].includes(number)) return number;
  const normalized = normalizeText(raw);
  if (/equipamento medico|medico|hospitalar|mmh/.test(normalized)) return 1;
  if (/mobiliario|moveis|movel/.test(normalized)) return 2;
  if (/informatica|computador|notebook|ti\b/.test(normalized)) return 3;
  return null;
}

function parseCatalogValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = normalizeMoney(raw);
  return Number.isFinite(number) ? number : null;
}

function catalogBigrams(value) {
  const text = ` ${normalizeText(value)} `;
  const out = [];
  for (let i=0;i<text.length-1;i++) out.push(text.slice(i,i+2));
  return out;
}

function catalogNameSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const aBigrams = catalogBigrams(left);
  const bBigrams = catalogBigrams(right);
  const counts = new Map();
  for (const gram of aBigrams) counts.set(gram,(counts.get(gram)||0)+1);
  let matches = 0;
  for (const gram of bBigrams) {
    const available = counts.get(gram)||0;
    if (available>0) {
      matches++;
      counts.set(gram,available-1);
    }
  }
  const dice = (2*matches)/(aBigrams.length+bBigrams.length || 1);
  const aTokens = new Set(left.split(" ").filter(Boolean));
  const bTokens = new Set(right.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter(token=>bTokens.has(token)).length;
  const union = new Set([...aTokens,...bTokens]).size || 1;
  const jaccard = intersection/union;
  let score = dice*0.68 + jaccard*0.32;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length,right.length)/Math.max(left.length,right.length);
    score = Math.max(score,0.72+ratio*0.22);
  }
  return Math.max(0,Math.min(1,score));
}

function catalogCandidateList(name, limit = 3) {
  return state.catalogAdminItems
    .filter(item => item.origem === "SIGEM")
    .map(item => ({ item, score: catalogNameSimilarity(name,item.descricao) }))
    .filter(entry => entry.score >= 0.68)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

function analyzeCatalogUpdate() {
  const nameHeader = state.catalogUpdateMapping.nome;
  if (!nameHeader) {
    toast("Selecione a coluna que contém o nome/descrição SIGEM.", "error");
    return;
  }

  const exactMap = new Map();
  for (const item of state.catalogAdminItems.filter(item => item.origem === "SIGEM")) {
    const key = normalizeText(item.descricao);
    if (!exactMap.has(key)) exactMap.set(key,[]);
    exactMap.get(key).push(item);
  }
  const aliasMap = new Map(state.catalogAliases.filter(alias => !alias.origem || alias.origem === "SIGEM").map(alias => [alias.alias_normalizado,alias]));
  const seenFile = new Map();

  state.catalogUpdateAnalysis = state.catalogUpdateRows.map((row,index)=>{
    const name = String(row[nameHeader] ?? "").trim();
    const normalized = normalizeText(name);
    const importedType = state.catalogUpdateMapping.tipo ? parseCatalogType(row[state.catalogUpdateMapping.tipo]) : null;
    const value = state.catalogUpdateMapping.valor ? parseCatalogValue(row[state.catalogUpdateMapping.valor]) : null;
    const base = {
      index,
      line:index+2,
      name,
      normalized,
      importedType,
      value,
      kind:"",
      action:"",
      finalType:importedType,
      selectedItemId:null,
      candidates:[],
      matchedItem:null,
      typeConflict:false
    };

    if (!normalized) {
      return { ...base, kind:"invalid", action:"ignore" };
    }

    if (seenFile.has(normalized)) {
      return {
        ...base,
        kind:"file_duplicate",
        action:"ignore",
        duplicateOfLine:seenFile.get(normalized)+2
      };
    }
    seenFile.set(normalized,index);

    const exact = exactMap.get(normalized) || [];
    if (exact.length === 1) {
      const item = exact[0];
      return {
        ...base,
        kind:"exact",
        action:"skip",
        matchedItem:item,
        selectedItemId:item.id,
        finalType:importedType || Number(item.tipo_id),
        typeConflict:Boolean(importedType && Number(item.tipo_id)!==importedType)
      };
    }
    if (exact.length > 1) {
      return {
        ...base,
        kind:"similar",
        action:"",
        candidates:exact.map(item=>({item,score:1})),
        selectedItemId:exact[0].id,
        finalType:importedType || Number(exact[0].tipo_id),
        ambiguousExact:true
      };
    }

    const alias = aliasMap.get(normalized);
    if (alias) {
      const item = state.catalogAdminItems.find(current=>current.id===alias.descricao_padrao_id);
      if (item) {
        return {
          ...base,
          kind:"alias",
          action:"skip",
          matchedItem:item,
          selectedItemId:item.id,
          finalType:importedType || Number(item.tipo_id),
          typeConflict:Boolean(importedType && Number(item.tipo_id)!==importedType)
        };
      }
    }

    const candidates = catalogCandidateList(name,3);
    if (candidates.length) {
      return {
        ...base,
        kind:"similar",
        action:"",
        candidates,
        selectedItemId:candidates[0].item.id,
        finalType:importedType || Number(candidates[0].item.tipo_id)
      };
    }

    return { ...base, kind:"new", action:"new", finalType:importedType };
  });

  state.catalogUpdateStage = "review";
  recalculateCatalogMissing();
  renderCatalogUpdateDialog();
}

function catalogMatchedIds() {
  const ids = new Set();
  for (const row of state.catalogUpdateAnalysis) {
    if ((row.kind==="exact" || row.kind==="alias") && row.matchedItem?.id) ids.add(row.matchedItem.id);
    if (row.kind==="similar" && row.action==="same" && row.selectedItemId) ids.add(row.selectedItemId);
  }
  return ids;
}

function recalculateCatalogMissing() {
  if (!state.catalogUpdateComplete) {
    state.catalogUpdateMissing = [];
    return;
  }
  const matched = catalogMatchedIds();
  const previousActions = new Map((state.catalogUpdateMissing||[]).map(item=>[item.id,item.action]));
  state.catalogUpdateMissing = state.catalogAdminItems
    .filter(item=>item.origem === "SIGEM" && item.ativo && !matched.has(item.id))
    .map(item=>({
      ...item,
      action:previousActions.get(item.id)||"keep"
    }));
}

function catalogUpdateReviewCounts() {
  const rows = state.catalogUpdateAnalysis;
  return {
    exact:rows.filter(row=>row.kind==="exact").length,
    alias:rows.filter(row=>row.kind==="alias").length,
    similar:rows.filter(row=>row.kind==="similar").length,
    new:rows.filter(row=>row.kind==="new").length,
    fileDuplicate:rows.filter(row=>row.kind==="file_duplicate").length,
    invalid:rows.filter(row=>row.kind==="invalid").length,
    unresolved:rows.filter(row=>row.kind==="similar"&&!row.action).length,
    typeWarnings:rows.filter(row=>row.typeConflict).length
  };
}

function catalogTypeSelect(value, rowIndex, disabled = false) {
  const current = Number(value||0);
  return `<select class="catalog-update-type" data-row-index="${rowIndex}" ${disabled?"disabled":""}>
    <option value="">Selecione</option>
    <option value="1" ${current===1?"selected":""}>Equipamento Médico</option>
    <option value="2" ${current===2?"selected":""}>Mobiliário</option>
    <option value="3" ${current===3?"selected":""}>Informática</option>
  </select>`;
}

function catalogCandidateSelect(row) {
  const candidates = row.candidates || [];
  return `<select class="catalog-update-candidate" data-row-index="${row.index}">
    ${candidates.map(candidate => {
      const item = candidate.item;
      const pct = Math.round(candidate.score*100);
      return `<option value="${item.id}" ${item.id===row.selectedItemId?"selected":""}>${escapeHtml(item.descricao)} · ${pct}%</option>`;
    }).join("")}
  </select>`;
}

function catalogReviewRowHtml(row) {
  const importedTypeLabel = row.importedType ? typeName(row.importedType) : "Não informado";

  if (row.kind==="similar") {
    return `<tr>
      <td>${row.line}</td>
      <td><strong>${escapeHtml(row.name)}</strong>${row.ambiguousExact?'<small class="row-note warning-text">Há mais de um item com este mesmo nome no catálogo.</small>':""}</td>
      <td>${catalogCandidateSelect(row)}</td>
      <td>
        <select class="catalog-update-action" data-row-index="${row.index}">
          <option value="" ${!row.action?"selected":""}>Revisar…</option>
          <option value="same" ${row.action==="same"?"selected":""}>É o mesmo item</option>
          <option value="new" ${row.action==="new"?"selected":""}>É um item novo</option>
          <option value="ignore" ${row.action==="ignore"?"selected":""}>Ignorar</option>
        </select>
      </td>
      <td>${catalogTypeSelect(row.finalType,row.index,row.action==="ignore")}</td>
      <td>${escapeHtml(importedTypeLabel)}</td>
    </tr>`;
  }

  if (row.kind==="new") {
    return `<tr>
      <td>${row.line}</td>
      <td><strong>${escapeHtml(row.name)}</strong><small class="row-note">Nenhuma correspondência semelhante encontrada.</small></td>
      <td>—</td>
      <td>
        <select class="catalog-update-action" data-row-index="${row.index}">
          <option value="new" ${row.action==="new"?"selected":""}>Adicionar item</option>
          <option value="ignore" ${row.action==="ignore"?"selected":""}>Ignorar</option>
        </select>
      </td>
      <td>${catalogTypeSelect(row.finalType,row.index,row.action==="ignore")}</td>
      <td>${escapeHtml(importedTypeLabel)}</td>
    </tr>`;
  }

  if (row.kind==="file_duplicate") {
    return `<tr>
      <td>${row.line}</td>
      <td><strong>${escapeHtml(row.name)}</strong><small class="row-note warning-text">Repetido no próprio arquivo (primeira ocorrência na linha ${row.duplicateOfLine}).</small></td>
      <td>—</td>
      <td>
        <select class="catalog-update-action" data-row-index="${row.index}">
          <option value="ignore" ${row.action==="ignore"?"selected":""}>Não adicionar</option>
          <option value="duplicate" ${row.action==="duplicate"?"selected":""}>Adicionar mesmo assim</option>
        </select>
      </td>
      <td>${catalogTypeSelect(row.finalType,row.index,row.action!=="duplicate")}</td>
      <td>${escapeHtml(importedTypeLabel)}</td>
    </tr>`;
  }

  if (row.kind==="invalid") {
    return `<tr><td>${row.line}</td><td colspan="5"><span class="validation-error">Linha sem descrição SIGEM. Será ignorada.</span></td></tr>`;
  }
  return "";
}

function catalogExistingRowHtml(row) {
  const item = row.matchedItem;
  const source = row.kind==="alias" ? "Alias conhecido" : "Correspondência exata";
  const inactive = item && !item.ativo;
  return `<tr>
    <td>${row.line}</td>
    <td><strong>${escapeHtml(row.name)}</strong></td>
    <td>${escapeHtml(item?.descricao || "—")}</td>
    <td>${source}${inactive?' · <span class="warning-text">item inativo será reativado</span>':""}${row.typeConflict?'<small class="row-note warning-text">O Tipo do arquivo difere do Tipo atual; o cadastro atual será preservado.</small>':""}</td>
    <td>
      <select class="catalog-update-action" data-row-index="${row.index}">
        <option value="skip" ${row.action==="skip"?"selected":""}>Não adicionar novamente</option>
        <option value="duplicate" ${row.action==="duplicate"?"selected":""}>Adicionar mesmo assim</option>
      </select>
    </td>
    <td>${catalogTypeSelect(row.finalType,row.index,row.action!=="duplicate")}</td>
  </tr>`;
}

function catalogMissingRowsHtml() {
  if (!state.catalogUpdateComplete) return "";
  if (!state.catalogUpdateMissing.length) {
    return `<section class="catalog-review-section">
      <div class="section-heading"><div><h3>Itens SIGEM ausentes do novo arquivo</h3><p>Todos os itens SIGEM ativos atuais foram reconhecidos no arquivo.</p></div><span class="badge">0</span></div>
    </section>`;
  }
  return `<section class="catalog-review-section">
    <div class="section-heading"><div><h3>Itens SIGEM ausentes do novo arquivo</h3><p>Nada é inativado automaticamente. Escolha explicitamente quando necessário.</p></div><span class="badge">${state.catalogUpdateMissing.length}</span></div>
    <div class="table-wrap catalog-review-table"><table>
      <thead><tr><th>Item atual</th><th>Tipo</th><th>Patrimônios</th><th>Ação</th></tr></thead>
      <tbody>${state.catalogUpdateMissing.map(item=>`<tr>
        <td><strong>${escapeHtml(item.descricao)}</strong></td>
        <td>${escapeHtml(typeName(item.tipo_id))}</td>
        <td>${Number(item.patrimonios_vinculados||0)}</td>
        <td><select class="catalog-missing-action" data-item-id="${item.id}">
          <option value="keep" ${item.action==="keep"?"selected":""}>Manter ativo</option>
          <option value="inactive" ${item.action==="inactive"?"selected":""}>Inativar</option>
        </select></td>
      </tr>`).join("")}</tbody>
    </table></div>
  </section>`;
}

function buildCatalogUpdatePlan() {
  const errors = [];
  const actions = [];

  for (const row of state.catalogUpdateAnalysis) {
    if (row.kind==="invalid") {
      actions.push({ acao:"IGNORAR", nome:row.name, tipo_id:row.finalType, valor_padrao:row.value });
      continue;
    }

    if (row.kind==="exact" || row.kind==="alias") {
      if (row.action==="duplicate") {
        const typeId = Number(row.finalType||row.importedType||row.matchedItem?.tipo_id);
        if (![1,2,3].includes(typeId)) errors.push(`Linha ${row.line}: defina o Tipo do item duplicado.`);
        else actions.push({ acao:"DUPLICADO", nome:row.name, tipo_id:typeId, valor_padrao:row.value });
      } else {
        actions.push({
          acao:row.kind==="alias"?"ALIAS":"EXATO",
          nome:row.name,
          item_id:row.matchedItem?.id,
          valor_padrao:row.value,
          reativar:Boolean(row.matchedItem && !row.matchedItem.ativo)
        });
      }
      continue;
    }

    if (row.kind==="file_duplicate") {
      if (row.action==="duplicate") {
        const typeId = Number(row.finalType||row.importedType);
        if (![1,2,3].includes(typeId)) errors.push(`Linha ${row.line}: defina o Tipo do item duplicado.`);
        else actions.push({ acao:"DUPLICADO", nome:row.name, tipo_id:typeId, valor_padrao:row.value });
      } else {
        actions.push({ acao:"IGNORAR", nome:row.name, tipo_id:row.importedType, valor_padrao:row.value });
      }
      continue;
    }

    if (row.kind==="new") {
      if (row.action==="ignore") {
        actions.push({ acao:"IGNORAR", nome:row.name, tipo_id:row.importedType, valor_padrao:row.value });
      } else {
        const typeId = Number(row.finalType||row.importedType);
        if (![1,2,3].includes(typeId)) errors.push(`Linha ${row.line}: defina o Tipo do novo item.`);
        else actions.push({ acao:"NOVO", nome:row.name, tipo_id:typeId, valor_padrao:row.value });
      }
      continue;
    }

    if (row.kind==="similar") {
      if (!row.action) {
        errors.push(`Linha ${row.line}: confirme se o item semelhante é o mesmo, novo ou deve ser ignorado.`);
        continue;
      }
      if (row.action==="ignore") {
        actions.push({
          acao:"IGNORAR",
          nome:row.name,
          item_id:row.selectedItemId,
          tipo_id:row.importedType,
          valor_padrao:row.value,
          similaridade:(row.candidates.find(candidate=>candidate.item.id===row.selectedItemId)?.score ?? null)
        });
        continue;
      }
      const candidate = row.candidates.find(entry=>entry.item.id===row.selectedItemId);
      if (row.action==="same") {
        if (!candidate) {
          errors.push(`Linha ${row.line}: selecione o item correspondente.`);
          continue;
        }
        const typeId = Number(row.finalType||row.importedType||candidate.item.tipo_id);
        if (![1,2,3].includes(typeId)) {
          errors.push(`Linha ${row.line}: defina o Tipo da correspondência.`);
          continue;
        }
        actions.push({
          acao:"MESMO_ITEM",
          nome:row.name,
          item_id:candidate.item.id,
          nome_anterior:candidate.item.descricao,
          tipo_id:typeId,
          valor_padrao:row.value,
          similaridade:candidate.score
        });
      } else if (row.action==="new") {
        const typeId = Number(row.finalType||row.importedType);
        if (![1,2,3].includes(typeId)) errors.push(`Linha ${row.line}: defina o Tipo do novo item.`);
        else actions.push({ acao:"NOVO", nome:row.name, tipo_id:typeId, valor_padrao:row.value });
      }
    }
  }

  if (state.catalogUpdateComplete) {
    for (const item of state.catalogUpdateMissing) {
      actions.push({
        acao:item.action==="inactive"?"INATIVAR":"MANTER",
        nome:item.descricao,
        item_id:item.id
      });
    }
  }

  return { errors, actions };
}

function catalogFinalSummary() {
  const { errors, actions } = buildCatalogUpdatePlan();
  const count = action => actions.filter(item=>item.acao===action).length;
  return {
    errors,
    actions,
    exact:count("EXATO"),
    alias:count("ALIAS"),
    same:count("MESMO_ITEM"),
    added:count("NOVO"),
    duplicates:count("DUPLICADO"),
    ignored:count("IGNORAR"),
    inactive:count("INATIVAR"),
    kept:count("MANTER")
  };
}

function renderCatalogUpdateDialog() {
  const root = document.querySelector("#catalogUpdateContent");
  if (!root) return;

  if (state.catalogUpdateStage==="file" || state.catalogUpdateStage==="mapping") {
    const hasFile = state.catalogUpdateRows.length>0;
    root.innerHTML = `
      <div class="catalog-wizard">
        <section class="catalog-step">
          <div class="step-title"><span>1</span><div><h3>Selecionar nova base SIGEM</h3><p>CSV em UTF-8 ou Windows-1252, separado por vírgula ou ponto e vírgula.</p></div></div>
          <label class="file-drop catalog-file-drop">
            <input id="catalogUpdateFile" type="file" accept=".csv,text/csv">
            <strong>${state.catalogUpdateFileName || "Escolher arquivo CSV"}</strong>
            <small>${hasFile ? `${state.catalogUpdateRows.length} linha(s) encontradas` : "Nenhum arquivo selecionado"}</small>
          </label>
        </section>

        ${hasFile ? `<section class="catalog-step">
          <div class="step-title"><span>2</span><div><h3>Mapear colunas</h3><p>Descrição é obrigatória. Tipo e valor são opcionais, mas ajudam na inclusão dos novos itens.</p></div></div>
          <div class="mapping-grid">
            <label>Descrição/Nome SIGEM *<select data-catalog-map="nome">${catalogUpdateMappingOptions(state.catalogUpdateMapping.nome)}</select></label>
            <label>Tipo/Classificação<select data-catalog-map="tipo">${catalogUpdateMappingOptions(state.catalogUpdateMapping.tipo)}</select></label>
            <label>Valor SIGEM<select data-catalog-map="valor">${catalogUpdateMappingOptions(state.catalogUpdateMapping.valor)}</select></label>
          </div>
          <label class="catalog-complete-check">
            <input id="catalogUpdateComplete" type="checkbox" ${state.catalogUpdateComplete?"checked":""}>
            <span><strong>Este arquivo representa o catálogo completo.</strong><small>Somente marque se itens ausentes realmente puderem ser revisados para inativação. Nada será inativado automaticamente.</small></span>
          </label>
          <div class="import-actions"><button class="primary-button" data-action="analyze-catalog-update">Comparar com catálogo atual</button></div>
        </section>` : ""}
      </div>`;

    document.querySelector("#catalogUpdateFile")?.addEventListener("change", handleCatalogUpdateFile);
    document.querySelectorAll("[data-catalog-map]").forEach(select=>select.addEventListener("change",()=>{
      state.catalogUpdateMapping[select.dataset.catalogMap]=select.value;
    }));
    document.querySelector("#catalogUpdateComplete")?.addEventListener("change",event=>{
      state.catalogUpdateComplete=event.target.checked;
    });
    document.querySelector('[data-action="analyze-catalog-update"]')?.addEventListener("click",analyzeCatalogUpdate);
    return;
  }

  if (state.catalogUpdateStage==="review") {
    const counts = catalogUpdateReviewCounts();
    const existing = state.catalogUpdateAnalysis.filter(row=>row.kind==="exact"||row.kind==="alias");
    const reviewRows = state.catalogUpdateAnalysis.filter(row=>["similar","new","file_duplicate","invalid"].includes(row.kind));
    const final = catalogFinalSummary();

    root.innerHTML = `
      <div class="catalog-wizard">
        <section class="catalog-step catalog-review-summary">
          <div class="step-title"><span>3</span><div><h3>Revisar comparação</h3><p>Nenhuma alteração foi gravada. Revise principalmente correspondências semelhantes e itens novos.</p></div></div>
          <div class="import-summary catalog-summary-grid">
            <article><strong>${counts.exact}</strong><span>Exatos</span></article>
            <article><strong>${counts.alias}</strong><span>Via de-para</span></article>
            <article><strong>${counts.similar}</strong><span>Semelhantes</span></article>
            <article><strong>${counts.new}</strong><span>Novos</span></article>
            <article><strong>${counts.fileDuplicate}</strong><span>Duplicados no arquivo</span></article>
            <article><strong>${counts.unresolved}</strong><span>Pendentes</span></article>
          </div>
          ${counts.typeWarnings? `<div class="catalog-alert warning"><strong>${counts.typeWarnings} divergência(s) de Tipo em itens já existentes.</strong><span>O Tipo atual do catálogo será preservado, a menos que você adicione uma cópia nova.</span></div>`:""}
        </section>

        ${reviewRows.length ? `<section class="catalog-review-section">
          <div class="section-heading"><div><h3>Itens que exigem revisão</h3><p>Escolha a ação e confirme o Tipo quando necessário.</p></div><span class="badge">${reviewRows.length}</span></div>
          <div class="table-wrap catalog-review-table"><table>
            <thead><tr><th>Linha</th><th>Arquivo</th><th>Possível correspondência</th><th>Ação</th><th>Tipo final</th><th>Tipo no arquivo</th></tr></thead>
            <tbody>${reviewRows.map(catalogReviewRowHtml).join("")}</tbody>
          </table></div>
        </section>` : ""}

        <details class="catalog-existing-details">
          <summary>Itens já encontrados no catálogo (${existing.length})</summary>
          <div class="table-wrap catalog-review-table"><table>
            <thead><tr><th>Linha</th><th>Arquivo</th><th>Catálogo atual</th><th>Correspondência</th><th>Ação</th><th>Tipo se duplicar</th></tr></thead>
            <tbody>${existing.map(catalogExistingRowHtml).join("")}</tbody>
          </table></div>
        </details>

        ${catalogMissingRowsHtml()}

        <section class="catalog-review-section catalog-final-preview">
          <div class="section-heading"><div><h3>Prévia final</h3><p>Este é o plano que será enviado ao banco.</p></div></div>
          <div class="catalog-final-grid">
            <span><strong>${final.exact}</strong> exatos</span>
            <span><strong>${final.alias}</strong> de-paras</span>
            <span><strong>${final.same}</strong> correspondências confirmadas</span>
            <span><strong>${final.added}</strong> novos</span>
            <span><strong>${final.duplicates}</strong> duplicados autorizados</span>
            <span><strong>${final.ignored}</strong> ignorados</span>
            <span><strong>${final.inactive}</strong> a inativar</span>
          </div>
          ${final.errors.length ? `<div class="catalog-alert error"><strong>Existem ${final.errors.length} pendência(s).</strong><ul>${final.errors.slice(0,12).map(error=>`<li>${escapeHtml(error)}</li>`).join("")}</ul>${final.errors.length>12?'<span>Revise as demais linhas pendentes acima.</span>':""}</div>` : '<div class="catalog-alert success"><strong>Plano pronto para confirmação.</strong><span>A aplicação final será transacional: se algo falhar, nada fica parcialmente gravado.</span></div>'}
          <div class="catalog-review-actions">
            <button class="ghost-button" data-action="restart-catalog-update">Trocar arquivo</button>
            <button class="primary-button" data-action="confirm-catalog-update" ${final.errors.length||state.catalogUpdateBusy?"disabled":""}>${state.catalogUpdateBusy?"Aplicando…":"Confirmar atualização"}</button>
          </div>
        </section>
      </div>`;

    bindCatalogReviewEvents();
  }
}

function bindCatalogReviewEvents() {
  document.querySelectorAll(".catalog-update-action").forEach(select=>select.addEventListener("change",()=>{
    const row=state.catalogUpdateAnalysis[Number(select.dataset.rowIndex)];
    if (!row) return;
    row.action=select.value;
    if (row.kind==="similar" && row.action==="same") {
      const candidate=row.candidates.find(entry=>entry.item.id===row.selectedItemId);
      if (!row.importedType && candidate) row.finalType=Number(candidate.item.tipo_id);
    }
    recalculateCatalogMissing();
    renderCatalogUpdateDialog();
  }));

  document.querySelectorAll(".catalog-update-candidate").forEach(select=>select.addEventListener("change",()=>{
    const row=state.catalogUpdateAnalysis[Number(select.dataset.rowIndex)];
    if (!row) return;
    row.selectedItemId=select.value;
    const candidate=row.candidates.find(entry=>entry.item.id===select.value);
    if (!row.importedType && candidate) row.finalType=Number(candidate.item.tipo_id);
    recalculateCatalogMissing();
    renderCatalogUpdateDialog();
  }));

  document.querySelectorAll(".catalog-update-type").forEach(select=>select.addEventListener("change",()=>{
    const row=state.catalogUpdateAnalysis[Number(select.dataset.rowIndex)];
    if (!row) return;
    row.finalType=select.value?Number(select.value):null;
    renderCatalogUpdateDialog();
  }));

  document.querySelectorAll(".catalog-missing-action").forEach(select=>select.addEventListener("change",()=>{
    const item=state.catalogUpdateMissing.find(entry=>entry.id===select.dataset.itemId);
    if (!item) return;
    item.action=select.value;
    renderCatalogUpdateDialog();
  }));

  document.querySelector('[data-action="restart-catalog-update"]')?.addEventListener("click",()=>{
    resetCatalogUpdate();
    renderCatalogUpdateDialog();
  });
  document.querySelector('[data-action="confirm-catalog-update"]')?.addEventListener("click",confirmCatalogUpdate);
}

async function handleCatalogUpdateFile(event) {
  const file=event.target.files?.[0];
  if (!file) return;
  try {
    const text=await readCatalogCsvFile(file);
    const parsed=parseCsv(text);
    state.catalogUpdateFileName=file.name;
    state.catalogUpdateHeaders=parsed.headers;
    state.catalogUpdateRows=parsed.rows;
    state.catalogUpdateMapping=guessCatalogUpdateMapping(parsed.headers);
    state.catalogUpdateAnalysis=[];
    state.catalogUpdateMissing=[];
    state.catalogUpdateStage="mapping";
    renderCatalogUpdateDialog();
  } catch (error) {
    toast(`Não foi possível ler o arquivo: ${error.message}`,"error");
  }
}

async function confirmCatalogUpdate() {
  const final=catalogFinalSummary();
  if (final.errors.length) {
    toast("Revise as pendências antes de confirmar.","error");
    return;
  }
  const message = [
    "Confirmar atualização da base SIGEM?",
    "",
    `Arquivo: ${state.catalogUpdateFileName}`,
    `Novos itens: ${final.added}`,
    `Correspondências confirmadas: ${final.same}`,
    `Duplicados autorizados: ${final.duplicates}`,
    `Itens a inativar: ${final.inactive}`,
    "",
    "A operação será gravada no histórico."
  ].join("\\n");
  if (!window.confirm(message)) return;

  state.catalogUpdateBusy=true;
  renderCatalogUpdateDialog();
  try {
    const result=await applyCatalogUpdate({
      nome_arquivo:state.catalogUpdateFileName,
      catalogo_completo:state.catalogUpdateComplete,
      quantidade_arquivo:state.catalogUpdateRows.length,
      acoes:final.actions
    });
    state.catalogUpdateLastResult=result;
    state.catalogAdminItems=await listCatalogAdmin();
    state.catalogAdminLoaded=true;
    await ensureCatalogUpdateContext(true);
    state.assets=await listAssets();
    state.recentHistory=[];
    document.querySelector("#catalogUpdateDialog").close();
    toast("Base SIGEM atualizada com sucesso.","success");
    renderCatalog();
  } catch (error) {
    toast(`Atualização não aplicada: ${error.message}`,"error");
    state.catalogUpdateBusy=false;
    renderCatalogUpdateDialog();
  }
}

async function openCatalogUpdateDetail(id) {
  try {
    state.catalogUpdateDetail=await getCatalogUpdateDetail(id);
    renderCatalog();
  } catch (error) {
    toast(`Não foi possível abrir os detalhes: ${error.message}`,"error");
  }
}

function catalogUpdateHistoryHtml() {
  const updates=state.catalogUpdates||[];
  if (!updates.length) return '<div class="empty">Nenhuma atualização de catálogo registrada ainda.</div>';
  return `<div class="table-wrap"><table class="catalog-history-table">
    <thead><tr><th>Data</th><th>Arquivo</th><th>Usuário</th><th>Itens</th><th>Novos</th><th>De-para</th><th>Inativados</th><th></th></tr></thead>
    <tbody>${updates.map(update=>`<tr>
      <td>${escapeHtml(historyDateTime(update.criado_em))}</td>
      <td><strong>${escapeHtml(update.nome_arquivo)}</strong></td>
      <td>${escapeHtml(update.usuario?.nome||"Sistema")}</td>
      <td>${Number(update.quantidade_arquivo||0)}</td>
      <td>${Number(update.novos_itens||0)}</td>
      <td>${Number(update.correspondencias_confirmadas||0)+Number(update.correspondencias_alias||0)}</td>
      <td>${Number(update.inativados||0)}</td>
      <td><button class="ghost-button compact-button" data-catalog-update-detail="${update.id}">Detalhes</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function catalogUpdateDetailHtml() {
  const detail=state.catalogUpdateDetail;
  if (!detail?.atualizacao) return "";
  const update=detail.atualizacao;
  const items=detail.itens||[];
  const counts=items.reduce((acc,item)=>{
    acc[item.acao]=(acc[item.acao]||0)+1;
    return acc;
  },{});
  return `<section class="panel catalog-update-detail-panel">
    <div class="panel-header">
      <div><h2>Detalhes da atualização</h2><small>${escapeHtml(update.nome_arquivo)} · ${escapeHtml(historyDateTime(update.criado_em))}</small></div>
      <button class="ghost-button compact-button" data-action="close-catalog-detail">Fechar</button>
    </div>
    <div class="catalog-detail-summary">
      ${Object.entries(counts).map(([key,value])=>`<span><strong>${value}</strong> ${escapeHtml(key.replaceAll("_"," ").toLowerCase())}</span>`).join("")}
    </div>
    <div class="table-wrap catalog-detail-items"><table>
      <thead><tr><th>Ação</th><th>Nome no arquivo</th><th>Item final</th><th>Tipo</th><th>Similaridade</th></tr></thead>
      <tbody>${items.map(item=>`<tr>
        <td>${escapeHtml(item.acao)}</td>
        <td>${escapeHtml(item.nome_arquivo)}</td>
        <td>${escapeHtml(item.item_catalogo_nome||"—")}</td>
        <td>${escapeHtml(item.tipo_id?typeName(item.tipo_id):"—")}</td>
        <td>${item.similaridade!=null?`${Math.round(Number(item.similaridade)*100)}%`:"—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>
  </section>`;
}

function catalogOriginName(value) {
  return value === "PROPRIO" ? "Catálogo Próprio — HRPP" : "SIGEM";
}

function catalogValueSourceName(value) {
  return ({
    SIGEM: "SIGEM",
    COTACAO_PROPRIA: "Cotação própria",
    NOTA_FISCAL: "Nota Fiscal",
    OUTRA: "Outra"
  })[String(value || "")] || "—";
}

async function renderCatalog() {
  const root = document.querySelector("#viewRoot");
  if (!canDeleteAssets()) {
    root.innerHTML = `
      <div class="page-header"><div><h1>Catálogo</h1><p>Itens de referência para o cadastro patrimonial.</p></div></div>
      <div class="placeholder">Somente administradores podem alterar o Catálogo.</div>`;
    return;
  }

  if (!state.catalogAdminLoaded && !state.catalogAdminLoading) {
    state.catalogAdminLoading = true;
    root.innerHTML = `
      <div class="page-header"><div><h1>Catálogo</h1><p>Itens de referência para o cadastro patrimonial.</p></div></div>
      <div class="loading">Carregando Catálogo…</div>`;
    try {
      state.catalogAdminItems = await listCatalogAdmin();
      state.catalogAdminLoaded = true;
    } catch (error) {
      toast(`Não foi possível carregar o Catálogo: ${error.message}`, "error");
    } finally {
      state.catalogAdminLoading = false;
    }
  }

  if (!state.catalogUpdateContextLoaded) {
    try {
      await ensureCatalogUpdateContext();
    } catch (error) {
      toast(`Não foi possível carregar o histórico de atualizações SIGEM: ${error.message}`, "error");
    }
  }

  const q = normalizeText(state.catalogAdminQuery);
  const typeFilter = String(state.catalogAdminType || "");
  const originFilter = String(state.catalogAdminOrigin || "");
  const items = state.catalogAdminItems.filter(item => {
    if (q && !normalizeText(item.descricao).includes(q)) return false;
    if (typeFilter && String(item.tipo_id) !== typeFilter) return false;
    if (originFilter && String(item.origem) !== originFilter) return false;
    return true;
  });
  const counts = {
    total: state.catalogAdminItems.length,
    sigem: state.catalogAdminItems.filter(item => item.origem === "SIGEM").length,
    proprio: state.catalogAdminItems.filter(item => item.origem === "PROPRIO").length,
    1: state.catalogAdminItems.filter(item => Number(item.tipo_id) === 1).length,
    2: state.catalogAdminItems.filter(item => Number(item.tipo_id) === 2).length,
    3: state.catalogAdminItems.filter(item => Number(item.tipo_id) === 3).length
  };

  root.innerHTML = `
    <div class="page-header">
      <div><h1>Catálogo</h1><p>Base única de itens de referência: SIGEM + itens próprios do HRPP.</p></div>
      <div class="header-actions">
        <button class="ghost-button" data-action="update-catalog">Atualizar base SIGEM</button>
        <button class="primary-button" data-action="new-catalog-item">+ Adicionar item</button>
      </div>
    </div>

    <div class="cards cards-three catalog-origin-cards">
      <article class="card"><span class="muted">Total do Catálogo</span><div class="metric">${counts.total}</div></article>
      <article class="card"><span class="muted">Origem SIGEM</span><div class="metric">${counts.sigem}</div></article>
      <article class="card"><span class="muted">Catálogo Próprio</span><div class="metric">${counts.proprio}</div></article>
    </div>

    <div class="cards cards-three catalog-summary-cards">
      <article class="card"><span class="muted">Equipamento Médico</span><div class="metric">${counts[1]}</div></article>
      <article class="card"><span class="muted">Mobiliário</span><div class="metric">${counts[2]}</div></article>
      <article class="card"><span class="muted">Informática</span><div class="metric">${counts[3]}</div></article>
    </div>

    <section class="panel catalog-admin-panel">
      <div class="panel-header config-panel-header">
        <div>
          <h2>Itens do Catálogo</h2>
          <small>O Tipo é herdado pelos novos patrimônios. Itens SIGEM têm nome e valor atualizados pela base SIGEM; itens próprios podem ser editados aqui.</small>
        </div>
        <span class="badge">${items.length} de ${state.catalogAdminItems.length}</span>
      </div>
      <div class="config-toolbar catalog-toolbar-three">
        <label class="config-search">Pesquisar item
          <input type="search" id="catalogAdminSearch" value="${escapeHtml(state.catalogAdminQuery)}" placeholder="Digite parte da descrição">
        </label>
        <label>Origem
          <select id="catalogAdminOrigin">
            <option value="">Todas</option>
            <option value="SIGEM" ${originFilter==="SIGEM"?"selected":""}>SIGEM</option>
            <option value="PROPRIO" ${originFilter==="PROPRIO"?"selected":""}>Catálogo Próprio</option>
          </select>
        </label>
        <label>Tipo
          <select id="catalogAdminType">
            <option value="">Todos</option>
            <option value="1" ${typeFilter==="1"?"selected":""}>Equipamento Médico</option>
            <option value="2" ${typeFilter==="2"?"selected":""}>Mobiliário</option>
            <option value="3" ${typeFilter==="3"?"selected":""}>Informática</option>
          </select>
        </label>
      </div>
      <div class="table-wrap config-table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Origem</th><th>Tipo</th><th>Valor de referência</th><th>Patrimônios</th><th>Status</th><th class="actions-head">Ações</th></tr></thead>
          <tbody>${items.map(item => `<tr>
            <td><strong>${escapeHtml(item.descricao)}</strong><small class="row-note">${escapeHtml(catalogValueSourceName(item.fonte_valor))}</small></td>
            <td><span class="badge catalog-origin-badge ${item.origem==="PROPRIO"?"is-own":""}">${escapeHtml(catalogOriginName(item.origem))}</span></td>
            <td>
              <select class="catalog-type-select" data-catalog-id="${item.id}" data-current-type="${item.tipo_id}">
                <option value="1" ${Number(item.tipo_id)===1?"selected":""}>Equipamento Médico</option>
                <option value="2" ${Number(item.tipo_id)===2?"selected":""}>Mobiliário</option>
                <option value="3" ${Number(item.tipo_id)===3?"selected":""}>Informática</option>
              </select>
            </td>
            <td>${money(item.valor_padrao)}</td>
            <td>${Number(item.patrimonios_vinculados || 0)}</td>
            <td class="${item.ativo ? "status-active" : "status-inactive"}">${item.ativo ? "Ativo" : "Inativo"}</td>
            <td><div class="center-actions">
              ${item.origem==="PROPRIO" ? `
                <button class="ghost-button compact-button" data-action="edit-catalog-item" data-catalog-id="${item.id}">Editar</button>
                <button class="ghost-button compact-button" data-action="toggle-catalog-item" data-catalog-id="${item.id}">${item.ativo ? "Inativar" : "Ativar"}</button>
                <button class="danger-button compact-button" data-action="delete-catalog-item" data-catalog-id="${item.id}">Excluir</button>
              ` : '<span class="muted">Gerido pela base SIGEM</span>'}
            </div></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      ${items.length ? "" : '<div class="empty">Nenhum item corresponde aos filtros.</div>'}
    </section>

    <section class="panel catalog-update-history-panel">
      <div class="panel-header">
        <div><h2>Histórico de atualizações SIGEM</h2><small>Somente atualizações da fonte SIGEM aparecem aqui. Itens próprios possuem histórico pelo log geral do sistema.</small></div>
        <span class="badge">${state.catalogUpdates.length} registro(s)</span>
      </div>
      ${catalogUpdateHistoryHtml()}
    </section>

    ${catalogUpdateDetailHtml()}
  `;

  document.querySelector('[data-action="update-catalog"]')?.addEventListener("click", openCatalogUpdate);
  document.querySelector('[data-action="new-catalog-item"]')?.addEventListener("click", () => openCatalogItemForm());
  document.querySelectorAll('[data-action="edit-catalog-item"]').forEach(button=>button.addEventListener("click",()=>openCatalogItemForm(button.dataset.catalogId)));
  document.querySelectorAll('[data-action="toggle-catalog-item"]').forEach(button=>button.addEventListener("click",()=>toggleCatalogItem(button.dataset.catalogId)));
  document.querySelectorAll('[data-action="delete-catalog-item"]').forEach(button=>button.addEventListener("click",()=>removeCatalogItem(button.dataset.catalogId)));
  document.querySelectorAll("[data-catalog-update-detail]").forEach(button=>button.addEventListener("click",()=>openCatalogUpdateDetail(button.dataset.catalogUpdateDetail)));
  document.querySelector('[data-action="close-catalog-detail"]')?.addEventListener("click",()=>{ state.catalogUpdateDetail=null; renderCatalog(); });
  document.querySelector("#catalogAdminSearch")?.addEventListener("input", debounce(event => {
    state.catalogAdminQuery = event.target.value;
    renderCatalog();
  }, 180));
  document.querySelector("#catalogAdminOrigin")?.addEventListener("change", event => {
    state.catalogAdminOrigin = event.target.value;
    renderCatalog();
  });
  document.querySelector("#catalogAdminType")?.addEventListener("change", event => {
    state.catalogAdminType = event.target.value;
    renderCatalog();
  });
  document.querySelectorAll(".catalog-type-select").forEach(select => {
    select.addEventListener("change", () => changeCatalogType(select));
  });
}

function openCatalogItemForm(itemId = null) {
  const item = itemId ? state.catalogAdminItems.find(row=>row.id===itemId) : null;
  if(item && item.origem!=="PROPRIO") {
    toast("Itens SIGEM são editados pelo fluxo da base SIGEM.", "error");
    return;
  }
  state.selectedCatalogItemId=item?.id || null;
  document.querySelector("#catalogItemDialogTitle").textContent=item?"Editar item próprio":"Novo item do Catálogo";
  document.querySelector("#catalogItemDescription").value=item?.descricao || "";
  document.querySelector("#catalogItemType").value=item?.tipo_id ? String(item.tipo_id) : "";
  document.querySelector("#catalogItemValue").value=item?.valor_padrao!=null ? Number(item.valor_padrao).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  document.querySelector("#catalogItemValueSource").value=item?.fonte_valor || "COTACAO_PROPRIA";
  document.querySelector("#saveCatalogItemButton").textContent=item?"Salvar alterações":"Adicionar ao Catálogo";
  document.querySelector("#catalogItemDialog").showModal();
  document.querySelector("#catalogItemDescription").focus();
}

async function submitCatalogItemForm(event) {
  event.preventDefault();
  const descricao=document.querySelector("#catalogItemDescription").value.trim();
  const tipoId=Number(document.querySelector("#catalogItemType").value);
  const rawValue=document.querySelector("#catalogItemValue").value.trim();
  const valor=rawValue ? normalizeMoney(rawValue) : null;
  const fonte=document.querySelector("#catalogItemValueSource").value;
  if(!descricao || ![1,2,3].includes(tipoId)) {
    toast("Informe descrição e Tipo do item.", "error");
    return;
  }
  if(valor!==null && (!Number.isFinite(valor)||valor<0)) {
    toast("Valor de referência inválido.", "error");
    return;
  }
  const button=document.querySelector("#saveCatalogItemButton");
  button.disabled=true;
  button.textContent="Salvando…";
  try {
    if(state.selectedCatalogItemId) {
      await updateCatalogItem(state.selectedCatalogItemId,{descricao,tipo_id:tipoId,valor_padrao:valor,fonte_valor:fonte});
    } else {
      await createCatalogItem({descricao,tipo_id:tipoId,valor_padrao:valor,fonte_valor:fonte});
    }
    state.catalogAdminItems=await listCatalogAdmin();
    state.catalogAdminLoaded=true;
    document.querySelector("#catalogItemDialog").close();
    toast(state.selectedCatalogItemId?"Item atualizado.":"Item adicionado ao Catálogo.","success");
    state.selectedCatalogItemId=null;
    renderCatalog();
  } catch(error) {
    toast(error.message,"error");
  } finally {
    button.disabled=false;
    button.textContent=state.selectedCatalogItemId?"Salvar alterações":"Adicionar ao Catálogo";
  }
}

async function toggleCatalogItem(itemId) {
  const item=state.catalogAdminItems.find(row=>row.id===itemId);
  if(!item || item.origem!=="PROPRIO") return;
  const next=!item.ativo;
  if(!window.confirm(`${next?"Ativar":"Inativar"} "${item.descricao}"?`)) return;
  try {
    await updateCatalogItem(item.id,{ativo:next});
    state.catalogAdminItems=await listCatalogAdmin();
    toast(`Item ${next?"ativado":"inativado"}.`,"success");
    renderCatalog();
  } catch(error) { toast(error.message,"error"); }
}

async function removeCatalogItem(itemId) {
  const item=state.catalogAdminItems.find(row=>row.id===itemId);
  if(!item || item.origem!=="PROPRIO") return;
  const confirmation=window.prompt(`Exclusão definitiva de item próprio.\n\nSó será permitida se ele nunca tiver sido usado.\nDigite exatamente a descrição:\n${item.descricao}`);
  if(confirmation===null) return;
  try {
    await deleteCatalogItem(item.id,confirmation.trim());
    state.catalogAdminItems=await listCatalogAdmin();
    toast("Item próprio excluído definitivamente.","success");
    renderCatalog();
  } catch(error) { toast(error.message,"error"); }
}

async function changeCatalogType(select) {
  const item = state.catalogAdminItems.find(row => row.id === select.dataset.catalogId);
  if (!item) return;
  const previous = Number(item.tipo_id);
  const next = Number(select.value);
  if (previous === next) return;
  const ok = window.confirm(
    `Alterar a classificação do item?\n\n${item.descricao}\n\n${typeName(previous)} → ${typeName(next)}\n\nPatrimônios vinculados que ainda usam a classificação anterior também serão atualizados.`
  );
  if (!ok) {
    select.value = String(previous);
    return;
  }
  select.disabled = true;
  try {
    const result = await updateCatalogType(item.id, next);
    item.tipo_id = Number(result.item?.tipo_id || next);
    if (Number(result.patrimonios_sincronizados || 0) > 0) {
      state.assets = await listAssets();
    }
    toast(
      Number(result.patrimonios_sincronizados || 0) > 0
        ? `Classificação atualizada. ${result.patrimonios_sincronizados} patrimônio(s) vinculado(s) também foram sincronizados.`
        : "Classificação do Catálogo atualizada.",
      "success"
    );
    renderCatalog();
  } catch (error) {
    select.value = String(previous);
    toast(error.message, "error");
    select.disabled = false;
  }
}

function renderSettings() {
  const root = document.querySelector("#viewRoot");
  if (!canDeleteAssets()) {
    root.innerHTML = `
      <div class="page-header"><div><h1>Configurações</h1><p>Parâmetros administrativos do Patrimônio+.</p></div></div>
      <div class="placeholder">Somente administradores podem alterar as configurações do sistema.</div>`;
    return;
  }

  const templateOpen = state.settingsOpenCard === "template";
  const qrTemplateOpen = state.settingsOpenCard === "qr-template";
  root.innerHTML = `
    <div class="page-header">
      <div><h1>Configurações</h1><p>Personalize parâmetros gerais do Patrimônio+.</p></div>
    </div>

    <div class="settings-card-list">
      <section class="settings-card ${templateOpen ? "is-open" : ""}">
        <button class="settings-card-toggle" type="button" data-setting-card="template" aria-expanded="${templateOpen}">
          <div class="settings-card-icon">RP</div>
          <div class="settings-card-title">
            <strong>Template da Relação Patrimonial</strong>
            <span>Logo, cabeçalho, textos, campos e estrutura da impressão.</span>
          </div>
          <span class="settings-card-chevron">${templateOpen ? "−" : "+"}</span>
        </button>
        <div class="settings-card-content" ${templateOpen ? "" : "hidden"}>
          <div class="settings-coming-soon">
            <strong>Estrutura preparada.</strong>
            <p>Quando você enviar o PDF ou imagem de referência, esta área receberá o editor visual do template com prévia da impressão.</p>
            <span class="badge">Em preparação</span>
          </div>
        </div>
      </section>

      <section class="settings-card ${qrTemplateOpen ? "is-open" : ""}">
        <button class="settings-card-toggle" type="button" data-setting-card="qr-template" aria-expanded="${qrTemplateOpen}">
          <div class="settings-card-icon">QR</div>
          <div class="settings-card-title">
            <strong>Template da Página Pública do QR Code</strong>
            <span>Defina futuramente quais informações do patrimônio serão exibidas na consulta pública.</span>
          </div>
          <span class="settings-card-chevron">${qrTemplateOpen ? "−" : "+"}</span>
        </button>
        <div class="settings-card-content" ${qrTemplateOpen ? "" : "hidden"}>
          <div class="settings-coming-soon">
            <strong>Ideia reservada para desenvolvimento.</strong>
            <p>Esta configuração poderá controlar campos visíveis, ordem das informações, cabeçalho, logo, textos e seções da página acessada pelo QR Code.</p>
            <span class="badge">Em preparação</span>
          </div>
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll("[data-setting-card]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.settingCard;
      state.settingsOpenCard = state.settingsOpenCard === key ? null : key;
      renderSettings();
    });
  });
}

function renderCenters() {
  const canManage = canDeleteAssets();
  const active = state.centers.filter(center => center.ativo).length;
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>Centros de custo</h1><p>Cadastre e mantenha a estrutura de localização patrimonial.</p></div>
      ${canManage ? '<button class="primary-button" data-action="new-center">+ Novo centro de custo</button>' : ""}
    </div>
    <div class="cards cards-three center-summary-cards">
      <article class="card"><span class="muted">Total</span><div class="metric">${state.centers.length}</div></article>
      <article class="card"><span class="muted">Ativos</span><div class="metric">${active}</div></article>
      <article class="card"><span class="muted">Inativos</span><div class="metric">${state.centers.length-active}</div></article>
    </div>
    <section class="panel">
      <div class="panel-header"><div><h2>Centros de custo</h2><small>Centros em uso podem ser inativados, mas a exclusão definitiva é bloqueada para preservar o histórico.</small></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Código</th><th>Centro de custo</th><th>Patrimônios atuais</th><th>Status</th>${canManage?'<th class="actions-head">Ações</th>':""}</tr></thead>
        <tbody>${state.centers.map(center => `<tr>
          <td><strong>${escapeHtml(center.codigo)}</strong></td>
          <td>${escapeHtml(center.nome)}</td>
          <td>${Number(center.patrimonios || 0)}</td>
          <td class="${center.ativo ? "status-active" : "status-inactive"}">${center.ativo ? "Ativo" : "Inativo"}</td>
          ${canManage ? `<td><div class="center-actions">
            <button class="ghost-button compact-button" data-action="edit-center" data-center-id="${center.id}">Editar</button>
            <button class="ghost-button compact-button" data-action="toggle-center" data-center-id="${center.id}">${center.ativo ? "Inativar" : "Ativar"}</button>
            <button class="danger-button compact-button" data-action="delete-center" data-center-id="${center.id}">Excluir</button>
          </div></td>` : ""}
        </tr>`).join("")}</tbody>
      </table></div>
    </section>
  `;

  document.querySelector('[data-action="new-center"]')?.addEventListener("click", () => openCenterForm());
  document.querySelectorAll('[data-action="edit-center"]').forEach(button => button.addEventListener("click", () => openCenterForm(button.dataset.centerId)));
  document.querySelectorAll('[data-action="toggle-center"]').forEach(button => button.addEventListener("click", () => toggleCenter(button.dataset.centerId)));
  document.querySelectorAll('[data-action="delete-center"]').forEach(button => button.addEventListener("click", () => removeCenter(button.dataset.centerId)));
}

function openCenterForm(centerId = null) {
  const center = centerId ? state.centers.find(row => row.id === centerId) : null;
  state.selectedCenterId = center?.id || null;
  document.querySelector("#centerDialogTitle").textContent = center ? "Editar centro de custo" : "Novo centro de custo";
  document.querySelector("#centerCode").value = center?.codigo || "";
  document.querySelector("#centerName").value = center?.nome || "";
  document.querySelector("#saveCenterButton").textContent = center ? "Salvar alterações" : "Cadastrar centro";
  document.querySelector("#centerDialog").showModal();
  document.querySelector("#centerCode").focus();
}

async function submitCenterForm(event) {
  event.preventDefault();
  if (!canDeleteAssets()) return;
  const payload = {
    codigo: document.querySelector("#centerCode").value.trim(),
    nome: document.querySelector("#centerName").value.trim()
  };
  if (!payload.codigo || !payload.nome) {
    toast("Informe código e nome do centro de custo.", "error");
    return;
  }
  const button = document.querySelector("#saveCenterButton");
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    if (state.selectedCenterId) await updateCenter(state.selectedCenterId, payload);
    else await createCenter(payload);
    [state.centers, state.assets] = await Promise.all([listCenters(), listAssets()]);
    document.querySelector("#centerDialog").close();
    toast(state.selectedCenterId ? "Centro de custo atualizado." : "Centro de custo cadastrado.", "success");
    state.selectedCenterId = null;
    renderCenters();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = state.selectedCenterId ? "Salvar alterações" : "Cadastrar centro";
  }
}

async function toggleCenter(centerId) {
  const center = state.centers.find(row => row.id === centerId);
  if (!center || !canDeleteAssets()) return;
  const next = !center.ativo;
  const detail = !next && Number(center.patrimonios || 0) > 0
    ? `\n\n${center.patrimonios} patrimônio(s) permanecem vinculados ao centro, mas ele deixará de aparecer para novos cadastros e movimentações.`
    : "";
  if (!window.confirm(`${next ? "Ativar" : "Inativar"} o centro de custo ${center.nome}?${detail}`)) return;
  try {
    await updateCenter(center.id, { ativo: next });
    [state.centers, state.assets] = await Promise.all([listCenters(), listAssets()]);
    toast(`Centro de custo ${next ? "ativado" : "inativado"}.`, "success");
    renderCenters();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function removeCenter(centerId) {
  const center = state.centers.find(row => row.id === centerId);
  if (!center || !canDeleteAssets()) return;
  const confirmation = window.prompt(
    `Exclusão definitiva de "${center.nome}".\n\nIsso só será permitido se o centro nunca tiver sido usado.\nDigite exatamente o código para confirmar: ${center.codigo}`
  );
  if (confirmation === null) return;
  if (confirmation.trim() !== String(center.codigo)) {
    toast("Confirmação inválida.", "error");
    return;
  }
  try {
    await deleteCenter(center.id, confirmation.trim());
    state.centers = await listCenters();
    toast("Centro de custo excluído definitivamente.", "success");
    renderCenters();
  } catch (error) {
    toast(error.message, "error");
  }
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsv(text) {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const delimiter = (sample.match(/;/g) || []).length >= (sample.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (ch === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => String(v).trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (row.some((v) => String(v).trim())) rows.push(row); }
  if (rows.length < 2) throw new Error("O arquivo não possui linhas suficientes.");
  const headers = rows[0].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
  return { headers, rows: rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))) };
}

const IMPORT_FIELDS = [
  ["descricao_catalogo", "Item do Catálogo *"],
  ["descricao_complementar", "Descrição complementar"],
  ["aquisicao", "Aquisição *"],
  ["centro", "Centro de custo"],
  ["centro_codigo", "Código do centro"],
  ["id_ses", "ID SES"],
  ["data", "Data de aquisição"],
  ["valor", "Valor do material / aquisição"],
  ["valor_referencia", "Valor de referência no arquivo"],
  ["marca", "Marca/Modelo"],
  ["nota", "Nota fiscal"],
  ["classificacao", "Classificação do arquivo"],
  ["status", "Status"],
  ["estado", "Estado de conservação"]
];

function findImportHeader(headers, aliases, exactOnly = false) {
  const normalized=headers.map(header=>({header,key:normalizeText(header)}));
  for (const alias of aliases) {
    const key=normalizeText(alias);
    const exact=normalized.find(item=>item.key===key);
    if (exact) return exact.header;
  }
  if (exactOnly) return "";
  for (const alias of aliases) {
    const key=normalizeText(alias);
    const partial=normalized.find(item=>item.key.includes(key));
    if (partial) return partial.header;
  }
  return "";
}

function guessMapping(headers) {
  return {
    descricao_catalogo: findImportHeader(headers,["descricao","nome do item","item do catalogo","item"],true),
    descricao_complementar: findImportHeader(headers,["descricao auxiliar","descricao complementar"],true),
    aquisicao: findImportHeader(headers,["tipo aquisicao","tipo de aquisicao","aquisicao","forma aquisicao"],false),
    centro: findImportHeader(headers,["centro de custo","centro custo","setor"],true),
    centro_codigo: findImportHeader(headers,["cod c.c.","cod c c","codigo centro","codigo cc","cod cc"],true),
    id_ses: findImportHeader(headers,["id ses","ses","patrimonio ses"],true),
    data: findImportHeader(headers,["data de aquisicao","data aquisicao"],true),
    valor: findImportHeader(headers,["valor do material","valor de aquisicao","valor aquisicao"],true),
    valor_referencia: findImportHeader(headers,["valor sigem","valor de referencia","valor referencia"],true),
    marca: findImportHeader(headers,["marca / modelo","marca/modelo","marca modelo","modelo"],true),
    nota: findImportHeader(headers,["nota fiscal","numero nf","nf"],true),
    classificacao: findImportHeader(headers,["classificacao","categoria","tipo"],true),
    status: findImportHeader(headers,["status"],true),
    estado: findImportHeader(headers,["estado de conservacao","conservacao"],true)
  };
}

function mappingOptions(selected) {
  return \`<option value="">Não importar</option>\${state.importHeaders.map((h) => \`<option value="\${escapeHtml(h)}" \${h === selected ? "selected" : ""}>\${escapeHtml(h)}</option>\`).join("")}\`;
}

async function readImportCsvFile(file) {
  const buffer=await file.arrayBuffer();
  let text="";
  try {
    text=new TextDecoder("utf-8",{fatal:true}).decode(buffer);
  } catch {
    text=new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^\uFEFF/,"");
}

function resetImportSimulation() {
  state.importValidated=[];
  state.importSimulation=null;
  state.importDuplicateChoices={};
}

function importSourceRows() {
  const val=(row,field)=>{
    const header=state.importMapping[field];
    return header ? String(row[header]??"").trim() : "";
  };
  return state.importRows.map((row,index)=>({
    linha:index+2,
    descricao_catalogo:val(row,"descricao_catalogo"),
    descricao_complementar:val(row,"descricao_complementar"),
    classificacao_origem:val(row,"classificacao"),
    tipo_aquisicao:val(row,"aquisicao"),
    centro_nome:val(row,"centro"),
    centro_codigo:val(row,"centro_codigo"),
    id_ses:val(row,"id_ses"),
    data_aquisicao:val(row,"data"),
    valor_aquisicao:val(row,"valor"),
    valor_referencia_arquivo:val(row,"valor_referencia"),
    marca_modelo:val(row,"marca"),
    nota_fiscal_numero:val(row,"nota"),
    status:val(row,"status"),
    estado_conservacao:val(row,"estado")
  }));
}

function duplicateChoiceOptions(group) {
  const current=state.importDuplicateChoices[group.key]||"";
  const keepOptions=group.existing_in_db ? "" : group.linhas.map(row =>
    \`<option value="KEEP:\${row.linha}" \${current===\`KEEP:\${row.linha}\`?"selected":""}>Manter ID na linha \${row.linha} — \${escapeHtml(row.descricao_catalogo)}</option>\`
  ).join("");
  return \`
    <option value="" \${!current?"selected":""}>Escolha como resolver…</option>
    \${keepOptions}
    <option value="CLEAR_ALL" \${current==="CLEAR_ALL"?"selected":""}>Importar todas estas linhas sem ID SES</option>
  \`;
}

function importDuplicateGroupsHtml() {
  const groups=state.importSimulation?.grupos_id_ses||[];
  if (!groups.length) return "";
  return \`
    <section class="import-step import-duplicates-step">
      <div class="step-title"><span>4</span><div><h2>Resolver ID SES duplicadas</h2><p>Nenhuma ID será removida automaticamente. Escolha explicitamente qual patrimônio mantém a identificação, ou importe o grupo sem ID SES.</p></div></div>
      <div class="duplicate-group-list">
        \${groups.map(group=>\`<article class="duplicate-group">
          <div class="duplicate-group-head">
            <div><strong>ID SES \${escapeHtml(group.id_ses)}</strong><small>\${group.existing_in_db?"Esta ID já existe no banco. Nenhuma linha deste lote pode mantê-la.":"Esta ID aparece em mais de uma linha do arquivo."}</small></div>
            <span class="badge">\${group.linhas.length} linha(s)</span>
          </div>
          <div class="duplicate-lines">
            \${group.linhas.map(row=>\`<div class="duplicate-line"><span>Linha \${row.linha}</span><strong>\${escapeHtml(row.descricao_catalogo)}</strong><small>\${escapeHtml(row.centro||"Centro não identificado")}</small></div>\`).join("")}
          </div>
          <label>Decisão
            <select class="duplicate-choice" data-duplicate-key="\${escapeHtml(group.key)}">\${duplicateChoiceOptions(group)}</select>
          </label>
        </article>\`).join("")}
      </div>
    </section>
  \`;
}

function importResolutionState() {
  const simulation=state.importSimulation;
  if(!simulation) return {ready:false,unresolved:0,hardErrors:0,rows:[]};
  const groups=simulation.grupos_id_ses||[];
  const unresolved=groups.filter(group=>!state.importDuplicateChoices[group.key]).length;
  const hardErrors=Number(simulation.resumo?.error||0);
  const resolvedRows=simulation.linhas.map(row=>{
    let idSes=row.id_ses_original||null;
    if(row.duplicate_key) {
      const choice=state.importDuplicateChoices[row.duplicate_key];
      if(choice==="CLEAR_ALL") idSes=null;
      else if(choice && choice.startsWith("KEEP:")) {
        const keepLine=Number(choice.slice(5));
        idSes=row.linha===keepLine ? row.id_ses_original : null;
      }
    }
    return {
      linha:row.linha,
      descricao_catalogo:row.item_catalogo?.descricao||row.descricao_catalogo,
      descricao_complementar:row.descricao_complementar,
      classificacao_origem:row.item_catalogo?.tipo_id||"",
      tipo_aquisicao:row.tipo_aquisicao,
      centro_nome:row.centro?.nome||"",
      centro_codigo:row.centro?.codigo||"",
      id_ses:idSes||"",
      data_aquisicao:row.data_aquisicao,
      valor_aquisicao:row.valor_aquisicao,
      valor_referencia_arquivo:row.item_catalogo?.valor_padrao??"",
      marca_modelo:row.marca_modelo||"",
      nota_fiscal_numero:row.nota_fiscal_numero||"",
      status:row.status,
      estado_conservacao:row.estado_conservacao
    };
  });
  return {ready:hardErrors===0&&unresolved===0,unresolved,hardErrors,rows:resolvedRows};
}

function importHistoryHtml() {
  if(!state.importHistoryLoaded) return '<div class="loading">Carregando histórico de importações…</div>';
  if(!state.importHistory.length) return '<div class="empty">Nenhuma importação patrimonial concluída ainda.</div>';
  return \`<div class="table-wrap"><table>
    <thead><tr><th>Data</th><th>Arquivo</th><th>Usuário</th><th>Importados</th></tr></thead>
    <tbody>\${state.importHistory.map(item=>\`<tr>
      <td>\${escapeHtml(historyDateTime(item.criado_em))}</td>
      <td><strong>\${escapeHtml(item.nome_arquivo)}</strong></td>
      <td>\${escapeHtml(item.usuario?.nome||"Sistema")}</td>
      <td>\${Number(item.total_importado||0)}</td>
    </tr>\`).join("")}</tbody>
  </table></div>\`;
}

async function refreshImportHistory() {
  try {
    state.importHistory=await listAssetImportHistory(20);
    state.importHistoryLoaded=true;
    if(state.currentView==="importacao") renderImport();
  } catch(error) {
    state.importHistoryLoaded=true;
    toast(\`Não foi possível carregar o histórico de importações: \${error.message}\`,"error");
  }
}

function renderImport() {
  if (!canEditAssets()) {
    document.querySelector("#viewRoot").innerHTML = '<div class="page-header"><div><h1>Importação</h1><p>Importação patrimonial em lote.</p></div></div><div class="placeholder">Seu perfil possui acesso somente para consulta.</div>';
    return;
  }

  const hasFile=state.importRows.length>0;
  const simulation=state.importSimulation;
  const resolution=importResolutionState();
  const summary=simulation?.resumo||{};
  const pendingGroups=resolution.unresolved;

  document.querySelector("#viewRoot").innerHTML = \`
    <div class="page-header"><div><h1>Importação patrimonial segura</h1><p>Simule, resolva pendências e só então grave o lote inteiro em uma única transação.</p></div></div>

    \${state.importLastResult ? \`<div class="catalog-alert success import-success-banner"><strong>Última importação concluída.</strong><span>\${Number(state.importLastResult.total_importado||0)} patrimônio(s) importado(s) do arquivo \${escapeHtml(state.importLastResult.nome_arquivo||"")}.</span></div>\` : ""}

    <section class="import-step">
      <div class="step-title"><span>1</span><div><h2>Selecionar arquivo</h2><p>CSV em UTF-8 ou Windows-1252, separado por vírgula ou ponto e vírgula.</p></div></div>
      <label class="file-drop"><input id="importFile" type="file" accept=".csv,text/csv"><strong>\${state.importFileName || "Escolher arquivo CSV"}</strong><small>\${hasFile ? \`\${state.importRows.length} linha(s) encontradas\` : "Nenhum arquivo selecionado"}</small></label>
    </section>

    \${hasFile ? \`<section class="import-step">
      <div class="step-title"><span>2</span><div><h2>Mapear colunas</h2><p>Item do Catálogo e Aquisição são obrigatórios. Informe Centro de custo por nome, código ou ambos.</p></div></div>
      <div class="mapping-grid">\${IMPORT_FIELDS.map(([f,l]) => \`<label>\${l}<select data-import-map="\${f}">\${mappingOptions(state.importMapping[f])}</select></label>\`).join("")}</div>
      <div class="import-note"><strong>Regra de classificação:</strong> o Tipo será sempre herdado do Catálogo. A classificação do arquivo é usada apenas para avisar divergências.</div>
      <div class="import-actions"><button class="primary-button" data-action="validate-import" \${state.importBusy?"disabled":""}>Simular importação</button></div>
    </section>\` : ""}

    \${simulation ? \`<section class="import-step">
      <div class="step-title"><span>3</span><div><h2>Resultado da simulação</h2><p>Nenhum patrimônio foi gravado. Esta etapa é somente leitura.</p></div></div>
      <div class="import-summary import-summary-wide">
        <article><strong>\${Number(summary.total||0)}</strong><span>Linhas</span></article>
        <article><strong>\${Number(summary.catalogo_encontrado||0)}</strong><span>Catálogo reconhecido</span></article>
        <article><strong>\${Number(summary.centros_encontrados||0)}</strong><span>Centros reconhecidos</span></article>
        <article><strong>\${Number(summary.warning||0)}</strong><span>Com avisos</span></article>
        <article><strong>\${Number(summary.error||0)}</strong><span>Com erros</span></article>
        <article><strong>\${Number(summary.grupos_id_ses||0)}</strong><span>Grupos ID SES</span></article>
      </div>

      <div class="table-wrap import-preview-table"><table class="import-table">
        <thead><tr><th>Linha</th><th>Item do Catálogo</th><th>Centro</th><th>ID SES</th><th>Valor final</th><th>Situação</th></tr></thead>
        <tbody>\${simulation.linhas.slice(0,250).map(row=>\`<tr>
          <td>\${row.linha}</td>
          <td><strong>\${escapeHtml(row.item_catalogo?.descricao||row.descricao_catalogo||"—")}</strong><small class="row-note">\${row.catalog_match==="ALIAS"?"Via de-para":row.catalog_match==="EXATO"?"Correspondência exata":"Não reconhecido"}</small></td>
          <td>\${escapeHtml(row.centro?.nome||"—")}</td>
          <td>\${escapeHtml(row.id_ses_original||"—")}</td>
          <td>\${row.valor_final!=null&&Number.isFinite(Number(row.valor_final))?money(Number(row.valor_final)):"—"}</td>
          <td><span class="validation-\${row.level}">\${escapeHtml([...row.errors,...row.warnings].join(" · ")||"Pronto")}</span></td>
        </tr>\`).join("")}</tbody>
      </table></div>
      \${simulation.linhas.length>250?'<p class="import-note">Mostrando as primeiras 250 linhas. Todas as linhas foram validadas.</p>':""}
    </section>\` : ""}

    \${importDuplicateGroupsHtml()}

    \${simulation ? \`<section class="import-step import-final-step">
      <div class="step-title"><span>\${(simulation.grupos_id_ses||[]).length?5:4}</span><div><h2>Confirmação final</h2><p>O servidor repetirá todas as validações. Se uma única linha falhar, o PostgreSQL desfaz o lote inteiro.</p></div></div>
      \${resolution.hardErrors>0 ? \`<div class="catalog-alert error"><strong>\${resolution.hardErrors} linha(s) ainda possuem erro.</strong><span>Corrija o arquivo ou o Catálogo/Centro de Custo e simule novamente.</span></div>\` : ""}
      \${pendingGroups>0 ? \`<div class="catalog-alert warning"><strong>\${pendingGroups} grupo(s) de ID SES aguardam decisão.</strong><span>Nenhuma identificação será removida sem sua escolha.</span></div>\` : ""}
      \${resolution.ready ? '<div class="catalog-alert success"><strong>Lote pronto para importação.</strong><span>A gravação será atômica: tudo ou nada.</span></div>' : ""}
      <div class="import-actions">
        <button class="ghost-button" data-action="clear-import-simulation">Limpar simulação</button>
        <button class="primary-button" data-action="run-import" \${!resolution.ready||state.importBusy?"disabled":""}>\${state.importBusy?"Importando…":\`Importar \${Number(summary.total||0)} patrimônio(s)\`}</button>
      </div>
    </section>\` : ""}

    <section class="panel import-history-panel">
      <div class="panel-header"><div><h2>Histórico de importações</h2><small>Lotes concluídos com sucesso.</small></div></div>
      \${importHistoryHtml()}
    </section>
  \`;

  document.querySelector("#importFile")?.addEventListener("change", handleImportFile);
  document.querySelectorAll("[data-import-map]").forEach(el=>el.addEventListener("change",()=>{
    state.importMapping[el.dataset.importMap]=el.value;
    resetImportSimulation();
    renderImport();
  }));
  document.querySelector('[data-action="validate-import"]')?.addEventListener("click",validateImport);
  document.querySelector('[data-action="run-import"]')?.addEventListener("click",runImport);
  document.querySelector('[data-action="clear-import-simulation"]')?.addEventListener("click",()=>{
    resetImportSimulation();
    renderImport();
  });
  document.querySelectorAll(".duplicate-choice").forEach(select=>select.addEventListener("change",()=>{
    state.importDuplicateChoices[select.dataset.duplicateKey]=select.value;
    renderImport();
  }));

  if(!state.importHistoryLoaded) refreshImportHistory();
}

async function handleImportFile(event) {
  const file=event.target.files?.[0];
  if(!file) return;
  try {
    const parsed=parseCsv(await readImportCsvFile(file));
    state.importFileName=file.name;
    state.importHeaders=parsed.headers;
    state.importRows=parsed.rows;
    state.importMapping=guessMapping(parsed.headers);
    state.importLastResult=null;
    resetImportSimulation();
    renderImport();
  } catch(error) {
    toast(\`Não foi possível ler o arquivo: \${error.message}\`,"error");
  }
}

async function validateImport() {
  if(state.importBusy) return;
  const missing=[];
  if(!state.importMapping.descricao_catalogo) missing.push("Item do Catálogo");
  if(!state.importMapping.aquisicao) missing.push("Aquisição");
  if(!state.importMapping.centro && !state.importMapping.centro_codigo) missing.push("Centro de custo ou Código do centro");
  if(missing.length) {
    toast(\`Mapeie os campos obrigatórios: \${missing.join(", ")}.\`,"error");
    return;
  }

  state.importBusy=true;
  renderImport();
  try {
    state.importSimulation=await simulateAssetImport({linhas:importSourceRows()});
    state.importValidated=state.importSimulation.linhas||[];
    state.importDuplicateChoices={};
    toast("Simulação concluída. Nenhum dado foi gravado.","success");
  } catch(error) {
    toast(\`Não foi possível simular a importação: \${error.message}\`,"error");
  } finally {
    state.importBusy=false;
    renderImport();
  }
}

async function runImport() {
  const resolution=importResolutionState();
  if(!resolution.ready || state.importBusy) return;

  const total=resolution.rows.length;
  const cleared=state.importSimulation.linhas.filter(row=>row.duplicate_key && !resolution.rows.find(final=>final.linha===row.linha)?.id_ses).length;
  const message=[
    \`Confirmar a importação de \${total} patrimônios?\`,
    "",
    "O lote será gravado em uma única transação.",
    "Se qualquer linha falhar, nenhum patrimônio será mantido.",
    cleared ? \`\${cleared} linha(s) serão importadas sem ID SES conforme suas decisões.\` : ""
  ].filter(Boolean).join("\\n");

  if(!window.confirm(message)) return;

  state.importBusy=true;
  renderImport();
  try {
    const result=await applyAssetImport({
      nome_arquivo:state.importFileName,
      linhas:resolution.rows
    });

    state.importLastResult=result;
    state.assets=await listAssets();
    state.recentHistory=[];
    state.importHistoryLoaded=false;
    state.importFileName="";
    state.importHeaders=[];
    state.importRows=[];
    state.importMapping={};
    resetImportSimulation();
    toast(\`\${result.total_importado} patrimônio(s) importado(s) com sucesso.\`,"success");
    renderImport();
  } catch(error) {
    toast(\`Importação não aplicada: \${error.message}\`,"error");
    state.importBusy=false;
    renderImport();
    return;
  }
  state.importBusy=false;
}

function placeholder(title, description) {
  document.querySelector("#viewRoot").innerHTML = `<div class="page-header"><div><h1>${title}</h1><p>${description}</p></div></div><div class="placeholder">Módulo reservado para a próxima etapa.</div>`;
}

function bindStaticActions() {
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => { state.currentView = button.dataset.view; document.querySelector("#sidebar").classList.remove("open"); render(); }));
  document.querySelector("#quickAddButton")?.addEventListener("click", openNewAsset);
  document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#logoutButton").addEventListener("click", async () => { try { await signOut(); } catch (error) { toast(error.message, "error"); } });
  document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
  document.querySelector("#cancelButton").addEventListener("click", closeDialog);
  document.querySelector("#assetForm").addEventListener("submit", submitAsset);
  document.querySelector("#globalSearch").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.currentView = state.search.trim() ? "pesquisa" : "dashboard";
    render();
  });
  document.querySelector("#sigemSearch").addEventListener("input", debounce(handleSigemSearch));
  document.querySelector("#tipo").addEventListener("change", updateTypeFieldState);
  document.querySelector("#closeMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#cancelMoveButton").addEventListener("click", closeMoveDialog);
  document.querySelector("#moveForm").addEventListener("submit", submitMovement);
  document.querySelector("#closeLabelButton").addEventListener("click", () => document.querySelector("#labelDialog").close());
  document.querySelector("#downloadLabelButton").addEventListener("click", downloadLabelPng);
  document.querySelector("#printLabelButton").addEventListener("click", printLabel);
  document.querySelector("#testQrButton").addEventListener("click", () => {
    const asset = selectedAsset();
    if (!asset) return;
    window.open(assetPublicUrl(asset), "_blank", "noopener,noreferrer");
  });
  document.querySelector("#closeMaintenanceButton").addEventListener("click", () => document.querySelector("#maintenanceDialog").close());
  document.querySelector("#closeCenterButton").addEventListener("click", () => document.querySelector("#centerDialog").close());
  document.querySelector("#cancelCenterButton").addEventListener("click", () => document.querySelector("#centerDialog").close());
  document.querySelector("#centerForm").addEventListener("submit", submitCenterForm);
  document.querySelector("#closeCatalogUpdateButton").addEventListener("click", () => document.querySelector("#catalogUpdateDialog").close());
  document.querySelector("#closeCatalogItemButton").addEventListener("click", () => document.querySelector("#catalogItemDialog").close());
  document.querySelector("#cancelCatalogItemButton").addEventListener("click", () => document.querySelector("#catalogItemDialog").close());
  document.querySelector("#catalogItemForm").addEventListener("submit", submitCatalogItemForm);
  document.querySelectorAll("[data-mobility-value]").forEach(btn => btn.addEventListener("click", () => {
    state.formMobility = btn.dataset.mobilityValue;
    if (state.formMobility === "FIXO") state.formAllowedCenters.clear();
    renderFormAllowedCenters();
  }));
  document.querySelector("#allowedCenterSearch")?.addEventListener("input", debounce(renderFormAllowedCenterResults, 120));
  document.querySelector("#centroCusto")?.addEventListener("change", () => {
    const current = document.querySelector("#centroCusto").value;
    if (current) state.formAllowedCenters.delete(current);
    renderFormAllowedCenters();
  });
  document.querySelector("#moveAllowedCenterSearch")?.addEventListener("input", debounce(renderMoveAllowedCenterResults, 120));
  document.querySelectorAll("[data-move-mobility]").forEach(btn => btn.addEventListener("click", () => {
    const asset = selectedAsset();
    if (!asset) return;
    const next = btn.dataset.moveMobility;

    if (state.moveMobility === "MOVEL" && next === "FIXO") {
      const ok = window.confirm("Ao alterar para Fixo, todos os centros de custo permitidos serão removidos. Deseja continuar?");
      if (!ok) return;
      state.moveAllowedCenters.clear();
    }

    state.moveMobility = next;
    renderMoveAllowedCenters();
  }));
  document.querySelector("#moveCenter")?.addEventListener("change", () => {
    renderMoveAllowedCenters();
  });
}

function bindDynamicActions() {
  document.querySelectorAll("[data-mobility-value]").forEach(btn => btn.addEventListener("click", () => {
    state.formMobility = btn.dataset.mobilityValue;
    if (state.formMobility === "FIXO") state.formAllowedCenters.clear();
    renderFormAllowedCenters();
  }));
  document.querySelector("#allowedCenterSearch")?.addEventListener("input", debounce(renderFormAllowedCenterResults, 120));
  document.querySelectorAll('[data-action="new"]').forEach(b=>b.addEventListener("click", openNewAsset));
  document.querySelectorAll('[data-action="export"]').forEach(b=>b.addEventListener("click", exportCsv));
  document.querySelectorAll('[data-action="export-panel"]').forEach(b=>b.addEventListener("click", () => exportCsv(filteredByPanel("assetFilters", state.showRemoved))));
  document.querySelectorAll('[data-action="toggle-value"]').forEach(b=>b.addEventListener("click",()=>{state.showDashboardValue=!state.showDashboardValue;renderDashboard();}));
  document.querySelectorAll('[data-action="back-assets"]').forEach(b=>b.addEventListener("click",()=>{state.detailEditMode=false;state.currentView="patrimonios";renderAssets();}));
  document.querySelectorAll('[data-action="move"]').forEach(b=>b.addEventListener("click",openMoveDialog));
  document.querySelectorAll('[data-action="maintenance"]').forEach(b=>b.addEventListener("click",()=>openMaintenanceDialog()));
  document.querySelectorAll('[data-action="toggle-status"]').forEach(b=>b.addEventListener("click",toggleAssetStatus));
  document.querySelectorAll('[data-action="remove"]').forEach(b=>b.addEventListener("click",removeAsset));
  document.querySelectorAll('[data-action="restore"]').forEach(b=>b.addEventListener("click",restoreAsset));
  document.querySelectorAll('[data-action="delete-permanent"]').forEach(b=>b.addEventListener("click",deletePermanentAsset));
  document.querySelectorAll('[data-action="label"]').forEach(b=>b.addEventListener("click",openLabelDialog));

  document.querySelectorAll('[data-action="view-asset"]').forEach(b=>b.addEventListener("click",()=>openAssetDetail(b.dataset.assetId)));
  document.querySelectorAll('[data-action="move-asset"]').forEach(b=>b.addEventListener("click",()=>{state.selectedAssetId=b.dataset.assetId;openMoveDialog();}));
  document.querySelectorAll('[data-action="maintenance-asset"]').forEach(b=>b.addEventListener("click",()=>openMaintenanceDialog(b.dataset.assetId)));
  document.querySelectorAll('[data-action="label-asset"]').forEach(b=>b.addEventListener("click",()=>{state.selectedAssetId=b.dataset.assetId;openLabelDialog();}));

  document.querySelectorAll('[data-action="toggle-detail-edit-button"]').forEach(button=>button.addEventListener("click",()=>{
    state.detailEditMode = !state.detailEditMode;
    renderAssetDetail(false);
  }));
  document.querySelectorAll('[data-action="cancel-detail-edit"]').forEach(b=>b.addEventListener("click",()=>{state.detailEditMode=false;renderAssetDetail(false);}));
  document.querySelector("#detailEditForm")?.addEventListener("submit", submitDetailEdit);

  document.querySelectorAll('[data-filter-key][data-filter-field]').forEach(control=>{
    const eventName = control.tagName === "INPUT" && ["search","text"].includes(control.type) ? "input" : "change";
    control.addEventListener(eventName, debounce(()=>{
      const key=control.dataset.filterKey, field=control.dataset.filterField;
      ensureFilters(key)[field]=control.value;
      if(key==="assetFilters") renderAssets(); else renderLabels();
    }, eventName==="input"?180:0));
  });
  document.querySelectorAll('[data-action="clear-filters"]').forEach(b=>b.addEventListener("click",()=>{state[b.dataset.filterKey]=defaultFilters(); b.dataset.filterKey==="assetFilters"?renderAssets():renderLabels();}));
  document.querySelectorAll('[data-action="toggle-removed"]').forEach(b=>b.addEventListener("click",()=>{state.showRemoved=!state.showRemoved;renderAssets();}));

  document.querySelectorAll(".label-check").forEach(c=>c.addEventListener("change",()=>{c.checked?state.labelSelected.add(c.dataset.labelId):state.labelSelected.delete(c.dataset.labelId);renderLabels();}));
  document.querySelectorAll('[data-action="select-filtered-labels"]').forEach(b=>b.addEventListener("click",()=>{filteredByPanel("labelFilters",false).forEach(a=>state.labelSelected.add(a.id));renderLabels();}));
  document.querySelectorAll('[data-action="clear-label-selection"]').forEach(b=>b.addEventListener("click",()=>{state.labelSelected.clear();renderLabels();}));
  document.querySelectorAll('[data-action="generate-selected-labels"]').forEach(b=>b.addEventListener("click",generateSelectedLabels));

  document.querySelectorAll(".center-search-row").forEach((row)=>{
    const open=()=>{state.assetFilters=defaultFilters();state.assetFilters.centro=row.dataset.centerId;state.currentView="patrimonios";renderAssets();};
    row.addEventListener("click",open);row.addEventListener("keydown",e=>{if(e.key==="Enter")open();});
  });
}

function populateCenters(selectId = "centroCusto", selected = "") {
  document.querySelector(`#${selectId}`).innerHTML = `<option value="">Selecione</option>${state.centers.filter((center) => center.ativo || center.id === selected).map((center) => `<option value="${center.id}" ${center.id === selected ? "selected" : ""}>${escapeHtml(center.nome)}${center.ativo ? "" : " (inativo)"}</option>`).join("")}`;
}

function resetAssetForm() {
  document.querySelector("#assetForm").reset();
  state.selectedSigem = null;
  state.formMobility = "FIXO";
  state.formAllowedCenters = new Set();
  document.querySelector("#descricaoPadraoId").value = "";
  document.querySelector("#valorSigem").value = "";
  document.querySelector("#sigemResults").hidden = true;
  document.querySelector("#tipo").disabled = false;
  updateTypeFieldState();
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
  renderFormAllowedCenters();
  document.querySelector("#assetDialog").showModal();
  document.querySelector("#sigemSearch").focus();
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
  state.formMobility = asset.mobilidade || "FIXO";
  state.formAllowedCenters = currentAllowedCenterIds(asset);
  populateCenters("centroCusto", asset.centros_custo?.id || "");
  renderFormAllowedCenters();
  if (asset.descricoes_padrao?.id) {
    selectSigem({
      id: asset.descricoes_padrao.id,
      descricao: asset.descricoes_padrao.descricao,
      valor_padrao: asset.descricoes_padrao.valor_padrao,
      tipo_id: asset.descricoes_padrao.tipo_id
    }, { preserveType: true });
  }
  document.querySelector("#assetDialog").showModal();
}

function closeDialog() { document.querySelector("#assetDialog").close(); }
function closeMoveDialog() { document.querySelector("#moveDialog").close(); }

function openMoveDialog() {
  const asset = selectedAsset();
  if (!asset) return;
  document.querySelector("#moveForm").reset();
  document.querySelector("#moveCurrentCenter").textContent = `Centro atual: ${asset.centros_custo?.nome || "Não informado"}`;
  populateCenters("moveCenter");
  document.querySelector("#moveCenter").value = "";
  state.moveMobility = asset.mobilidade || "FIXO";
  state.moveAllowedCenters = currentAllowedCenterIds(asset);
  renderMoveAllowedCenters();
  document.querySelector("#moveDialog").showModal();
}

async function handleSigemSearch(event) {
  const input = event.target;
  state.selectedSigem = null;
  document.querySelector("#descricaoPadraoId").value = "";
  document.querySelector("#valorSigem").value = "";
  updateTypeFieldState();
  const box = document.querySelector("#sigemResults");
  if (input.value.trim().length < 2) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<div class="search-message">Pesquisando…</div>';
  try {
    const items = await searchCatalog(input.value);
    const options = items.map((item) => `<button type="button" class="sigem-option" data-id="${item.id}" data-description="${escapeHtml(item.descricao)}" data-value="${item.valor_padrao}" data-type-id="${item.tipo_id || ""}" data-origin="${item.origem || "SIGEM"}"><span>${escapeHtml(item.descricao)}<small>${item.origem === "PROPRIO" ? "Catálogo Próprio — HRPP" : "SIGEM"}</small></span><strong>${money(item.valor_padrao)}</strong></button>`).join("");
    box.innerHTML = options || '<div class="search-message">Nenhum item do Catálogo encontrado. Você pode deixar este campo vazio.</div>';
    box.querySelectorAll(".sigem-option").forEach((button) => button.addEventListener("click", () => selectSigem(button)));
  } catch (error) {
    box.innerHTML = `<div class="search-message">Erro: ${escapeHtml(error.message)}</div>`;
  }
}

function validTypeId(value) {
  return [1, 2, 3].includes(Number(value));
}

function updateTypeFieldState() {
  const select = document.querySelector("#tipo");
  const hint = document.querySelector("#tipoSigemHint");
  if (!select || !hint) return;
  const sigemType = Number(state.selectedSigem?.tipoId || 0);
  const linked = Boolean(state.selectedSigem?.id);

  hint.classList.remove("is-warning", "is-locked");
  if (!linked) {
    select.disabled = false;
    hint.textContent = "Sem item do Catálogo, o Tipo é definido manualmente.";
    return;
  }

  if (!validTypeId(sigemType)) {
    select.disabled = false;
    hint.textContent = "Este item do Catálogo ainda não possui Tipo definido. Revise o Tipo antes de salvar.";
    hint.classList.add("is-warning");
    return;
  }

  if (state.assetFormMode === "create") {
    select.value = String(sigemType);
    select.disabled = true;
    hint.textContent = `Definido automaticamente pelo Catálogo: ${typeName(sigemType)}.`;
    hint.classList.add("is-locked");
    return;
  }

  select.disabled = false;
  if (Number(select.value) !== sigemType) {
    hint.textContent = `Catálogo: ${typeName(sigemType)}. O Tipo atual está diferente e exigirá confirmação ao salvar.`;
    hint.classList.add("is-warning");
  } else {
    hint.textContent = `Tipo conferido com o Catálogo: ${typeName(sigemType)}.`;
  }
}

function confirmSigemTypeOverride(selectedType, sigemType, sigemDescription = "") {
  if (!validTypeId(sigemType) || Number(selectedType) === Number(sigemType)) return true;
  const item = sigemDescription ? `\nItem do Catálogo: ${sigemDescription}` : "";
  return window.confirm(
    `Tipo diferente do Catálogo.${item}\n\nCatálogo: ${typeName(sigemType)}\nSelecionado: ${typeName(selectedType)}\n\nDeseja manter essa alteração?`
  );
}

function selectSigem(buttonOrItem, options = {}) {
  const item = buttonOrItem.dataset ? {
    id: buttonOrItem.dataset.id,
    descricao: buttonOrItem.dataset.description,
    valor: Number(buttonOrItem.dataset.value),
    origem: buttonOrItem.dataset.origin,
    tipoId: buttonOrItem.dataset.typeId ? Number(buttonOrItem.dataset.typeId) : null
  } : {
    id: buttonOrItem.id,
    descricao: buttonOrItem.descricao,
    valor: Number(buttonOrItem.valor_padrao),
    origem: buttonOrItem.origem,
    tipoId: buttonOrItem.tipo_id ? Number(buttonOrItem.tipo_id) : (buttonOrItem.tipoId || null)
  };
  state.selectedSigem = item;
  document.querySelector("#sigemSearch").value = item.descricao || "";
  document.querySelector("#descricaoPadraoId").value = item.id || "";
  document.querySelector("#valorSigem").value = Number.isFinite(item.valor) ? money(item.valor) : "";
  if (!options.preserveType && validTypeId(item.tipoId)) {
    document.querySelector("#tipo").value = String(item.tipoId);
  }
  updateTypeFieldState();
  document.querySelector("#sigemResults").hidden = true;
}

function assetPayload() {
  const rawValue = document.querySelector("#valor").value.trim();
  const value = rawValue ? normalizeMoney(rawValue) : (Number.isFinite(state.selectedSigem?.valor) ? state.selectedSigem.valor : null);
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
  const button = document.querySelector("#saveAssetButton");
  const rawValue = document.querySelector("#valor").value.trim();
  const payload = {
    tipo_id: Number(document.querySelector("#tipo").value),
    id_ses: document.querySelector("#idSes").value.trim() || null,
    descricao: document.querySelector("#descricao").value.trim(),
    descricao_padrao_id: document.querySelector("#descricaoPadraoId").value || null,
    data_aquisicao: document.querySelector("#dataAquisicao").value,
    valor_aquisicao: rawValue ? normalizeMoney(rawValue) : null,
    nota_fiscal_numero: document.querySelector("#notaFiscal").value.trim() || null,
    marca_modelo: document.querySelector("#marcaModelo").value.trim() || null,
    centro_custo_id: document.querySelector("#centroCusto").value,
    estado_conservacao: document.querySelector("#estado").value || "BEM_CONSERVADO",
    status: state.assetFormMode === "edit" ? document.querySelector("#status").value : "ATIVO",
    tipo_aquisicao: document.querySelector("#aquisicao").value,
    mobilidade: state.formMobility,
    centros_permitidos_ids: state.formMobility === "MOVEL" ? [...state.formAllowedCenters] : []
  };
  if (!payload.tipo_id || !payload.descricao || !payload.data_aquisicao || !payload.tipo_aquisicao || !payload.centro_custo_id) {
    toast("Preencha Tipo, Descrição, Data de aquisição, Aquisição e Centro de custo.", "error"); return;
  }
  const sigemType = Number(state.selectedSigem?.tipoId || 0);
  if (state.assetFormMode === "create" && validTypeId(sigemType)) {
    payload.tipo_id = sigemType;
  }
  if (state.assetFormMode === "edit" && validTypeId(sigemType) && payload.tipo_id !== sigemType) {
    if (!confirmSigemTypeOverride(payload.tipo_id, sigemType, state.selectedSigem?.descricao || "")) return;
    payload.confirmar_tipo_divergente = true;
  }
  button.disabled = true; button.textContent = "Salvando…";
  try {
    let saved;
    if (state.assetFormMode === "edit" && state.selectedAssetId) saved = await updateAsset(state.selectedAssetId, payload);
    else saved = await createAsset(payload);
    closeDialog();
    state.assets = await listAssets();
    state.selectedAssetId = saved.id;
    toast(state.assetFormMode === "edit" ? "Patrimônio atualizado." : `Patrimônio cadastrado: ${saved.id_interna}`, "success");
    await openAssetDetail(saved.id);
  } catch (error) { toast(error.message, "error"); }
  finally { button.disabled = false; button.textContent = state.assetFormMode === "edit" ? "Salvar alterações" : "Salvar patrimônio"; }
}

async function submitMovement(event) {
  event.preventDefault();
  const asset = selectedAsset();
  const destination = document.querySelector("#moveCenter").value;
  if (!asset || !destination) return;
  const payload = {
    destinoCentroCustoId: destination,
    observacao: document.querySelector("#moveObservation").value.trim() || null,
    solicitante: document.querySelector("#moveRequester").value.trim(),
    movimentadoPor: document.querySelector("#moveBy").value.trim(),
    recebidoPor: document.querySelector("#moveReceivedBy").value.trim(),
    mobilidade: state.moveMobility,
    centrosPermitidosIds: state.moveMobility === "MOVEL" ? [...state.moveAllowedCenters].filter(id => id !== destination) : []
  };
  if (!payload.solicitante || !payload.movimentadoPor || !payload.recebidoPor) {
    toast("Informe solicitante, movimentado por e recebido por.", "error"); return;
  }
  const button = document.querySelector("#saveMoveButton");
  button.disabled = true; button.textContent = "Movimentando…";
  try {
    const updated = await moveAsset(asset.id, payload);
    state.assets = state.assets.map(a => a.id === updated.id ? updated : a);
    closeMoveDialog();
    toast("Movimentação registrada.", "success");
    await openAssetDetail(updated.id);
  } catch (error) { toast(error.message, "error"); }
  finally { button.disabled = false; button.textContent = "Confirmar movimentação"; }
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
  if (!asset || !canDeleteAssets()) return;
  const confirmation = window.prompt(`Exclusão definitiva de ${asset.id_interna}. Para confirmar, digite exatamente a ID interna: ${asset.id_interna}`);
  if (confirmation !== asset.id_interna) { if (confirmation !== null) toast("Confirmação inválida.", "error"); return; }
  try {
    await permanentlyDeleteTestAsset(asset.id, confirmation);
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    state.selectedAssetId = null; state.currentView = "patrimonios";
    toast("Patrimônio excluído definitivamente.", "success"); renderAssets();
  } catch (error) { toast(error.message, "error"); }
}


async function openMaintenanceDialog(assetId = state.selectedAssetId) {
  const asset = state.assets.find(a=>a.id===assetId);
  if (!asset) return;
  state.selectedAssetId = asset.id;
  state.maintenanceAssetId = asset.id;
  document.querySelector("#maintenanceAssetTitle").textContent = `${asset.id_interna} · ${assetDisplayName(asset)}`;
  document.querySelector("#maintenanceContent").innerHTML = '<div class="loading">Carregando manutenções…</div>';
  document.querySelector("#maintenanceDialog").showModal();
  try {
    state.maintenance = await listMaintenances(asset.id);
    renderMaintenanceContent(asset);
  } catch (error) {
    document.querySelector("#maintenanceContent").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderMaintenanceContent(asset) {
  const canCreate = canMaintainAssets();

  const form = canCreate ? `<form id="maintenanceForm" class="maintenance-form">
    <div class="operation-layout">
      <section class="operation-section">
        <div class="operation-section-title"><span>1</span><div><strong>Dados da manutenção *</strong><small>Classifique o atendimento e informe o início.</small></div></div>
        <div class="form-grid">
          <label>Tipo<select name="tipo" required><option value="CORRETIVA">Corretiva</option><option value="PREVENTIVA">Preventiva</option></select></label>
          <label>Data de início<div class="date-shell"><input type="date" name="data_inicio" value="${new Date().toISOString().slice(0,10)}" required></div></label>
        </div>
      </section>

      <section class="operation-section">
        <div class="operation-section-title"><span>2</span><div><strong>Pessoas envolvidas *</strong><small>Registre a cadeia de entrega até a manutenção.</small></div></div>
        <div class="stacked-fields">
          <label>Solicitante<input name="solicitante" required maxlength="120"></label>
          <label>Retirado por<input name="encaminhado_por" required maxlength="120"></label>
          <label>Recebido em Manutenção<input name="recebido_manutencao_por" required maxlength="120"></label>
        </div>
      </section>

      <section class="operation-section">
        <div class="operation-section-title"><span>3</span><div><strong>Descrição *</strong><small>Descreva o motivo ou serviço necessário.</small></div></div>
        <textarea name="descricao" rows="4" required placeholder="Descreva a manutenção"></textarea>
      </section>
    </div>
    <div class="dialog-actions"><button class="primary-button" type="submit">Registrar manutenção</button></div>
  </form>` : "";

  const history = state.maintenance.length ? `
    <section class="maintenance-history-section">
      <div class="maintenance-history-header">
        <div><h3>Histórico de manutenções</h3><small>${state.maintenance.length} registro(s)</small></div>
      </div>
      <div class="maintenance-history-list">
        ${state.maintenance.map(m => {
          const statusLabel = m.status === "ABERTA" ? "Aberta" : "Concluída";
          const statusClass = m.status === "ABERTA" ? "is-open" : "is-done";
          return `<details class="maintenance-history-item">
            <summary>
              <div class="maintenance-summary-main">
                <strong>${escapeHtml(m.tipo === "PREVENTIVA" ? "Preventiva" : "Corretiva")}</strong>
                <span>${escapeHtml(m.descricao)}</span>
                <span>${formatDate(m.data_inicio)}</span>
              </div>
              <span class="maintenance-history-status ${statusClass}">${statusLabel}</span>
            </summary>
            <div class="maintenance-history-body">
              <div class="maintenance-detail-grid">
                <div><span>Solicitante</span><strong>${escapeHtml(m.solicitante || "—")}</strong></div>
                <div><span>Retirado por</span><strong>${escapeHtml(m.encaminhado_por || "—")}</strong></div>
                <div><span>Recebido em Manutenção</span><strong>${escapeHtml(m.recebido_manutencao_por || "—")}</strong></div>
                <div><span>Data de início</span><strong>${formatDate(m.data_inicio)}</strong></div>
                <div><span>Responsável pela manutenção</span><strong>${escapeHtml(m.responsavel_manutencao || "—")}</strong></div>
                <div><span>Data de conclusão</span><strong>${formatDate(m.data_fim)}</strong></div>
                <div><span>Entregue ao centro por</span><strong>${escapeHtml(m.entregue_centro_por || "—")}</strong></div>
                <div><span>Recebido no centro por</span><strong>${escapeHtml(m.recebido_centro_por || "—")}</strong></div>
                <div class="full"><span>Descrição</span><strong>${escapeHtml(m.descricao || "—")}</strong></div>
                ${m.observacao_conclusao ? `<div class="full"><span>Observação da conclusão</span><strong>${escapeHtml(m.observacao_conclusao)}</strong></div>` : ""}
              </div>

              ${m.status === "ABERTA" && canCreate ? `
                <div class="maintenance-history-actions">
                  <button class="ghost-button compact-button" data-action="begin-finish-maintenance" data-maintenance-id="${m.id}">Concluir manutenção</button>
                </div>` : ""}

              ${state.maintenanceCompletingId === m.id ? `<form class="finish-maintenance-form" data-maintenance-finish-id="${m.id}">
                <div class="operation-layout compact-operation-layout">
                  <section class="operation-section">
                    <div class="operation-section-title"><span>1</span><div><strong>Conclusão *</strong><small>Informe a data e o responsável técnico pelo serviço.</small></div></div>
                    <div class="form-grid">
                      <label>Responsável pela manutenção<input name="responsavel_manutencao" required maxlength="120"></label>
                      <label>Data de conclusão<div class="date-shell"><input type="date" name="data_fim" required value="${new Date().toISOString().slice(0,10)}"></div></label>
                    </div>
                  </section>

                  <section class="operation-section">
                    <div class="operation-section-title"><span>2</span><div><strong>Retorno ao centro de custo *</strong><small>Registre quem entregou e quem recebeu o patrimônio.</small></div></div>
                    <div class="stacked-fields">
                      <label>Entregue ao centro por<input name="entregue_centro_por" required maxlength="120"></label>
                      <label>Recebido no centro de custo por<input name="recebido_centro_por" required maxlength="120"></label>
                    </div>
                  </section>

                  <section class="operation-section">
                    <div class="operation-section-title"><span>3</span><div><strong>Observações</strong><small>Campo opcional para registrar detalhes da conclusão.</small></div></div>
                    <textarea name="observacao_conclusao" rows="3"></textarea>
                  </section>
                </div>
                <div class="dialog-actions"><button type="button" class="ghost-button" data-action="cancel-finish-maintenance">Cancelar</button><button class="primary-button" type="submit">Concluir manutenção</button></div>
              </form>` : ""}
            </div>
          </details>`;
        }).join("")}
      </div>
    </section>` : `
    <section class="maintenance-history-section">
      <div class="maintenance-history-header"><div><h3>Histórico de manutenções</h3><small>Nenhum registro anterior.</small></div></div>
      <div class="empty">Nenhuma manutenção registrada.</div>
    </section>`;

  document.querySelector("#maintenanceContent").innerHTML = `${form}${history}`;

  document.querySelector("#maintenanceForm")?.addEventListener("submit", submitMaintenance);
  document.querySelectorAll('[data-action="begin-finish-maintenance"]').forEach(btn => btn.addEventListener("click", () => {
    state.maintenanceCompletingId = btn.dataset.maintenanceId;
    renderMaintenanceContent(asset);
  }));
  document.querySelectorAll('[data-action="cancel-finish-maintenance"]').forEach(btn => btn.addEventListener("click", () => {
    state.maintenanceCompletingId = null;
    renderMaintenanceContent(asset);
  }));
  document.querySelectorAll(".finish-maintenance-form").forEach(form => form.addEventListener("submit", submitFinishMaintenance));
}

async function submitMaintenance(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await createMaintenance(state.maintenanceAssetId, {
      tipo: String(fd.get("tipo")),
      descricao: String(fd.get("descricao")||"").trim(),
      data_inicio: String(fd.get("data_inicio")),
      solicitante: String(fd.get("solicitante")||"").trim(),
      encaminhado_por: String(fd.get("encaminhado_por")||"").trim(),
      recebido_manutencao_por: String(fd.get("recebido_manutencao_por")||"").trim()
    });
    state.maintenance = await listMaintenances(state.maintenanceAssetId);
    state.assets = await listAssets();
    renderMaintenanceContent(selectedAsset());
    toast("Manutenção registrada.", "success");
  } catch (error) { toast(error.message, "error"); }
}

async function finishMaintenanceAction(id, payload) {
  try {
    await finishMaintenance(id, payload);
    state.maintenanceCompletingId = null;
    state.maintenance = await listMaintenances(state.maintenanceAssetId);
    state.assets = await listAssets();
    renderMaintenanceContent(selectedAsset());
    toast("Manutenção concluída.", "success");
  } catch (error) { toast(error.message, "error"); }
}

async function submitFinishMaintenance(event) {
  event.preventDefault();
  const id = event.currentTarget.dataset.maintenanceFinishId;
  const fd = new FormData(event.currentTarget);
  const payload = {
    responsavel_manutencao: String(fd.get("responsavel_manutencao")||"").trim(),
    entregue_centro_por: String(fd.get("entregue_centro_por")||"").trim(),
    recebido_centro_por: String(fd.get("recebido_centro_por")||"").trim(),
    data_fim: String(fd.get("data_fim")||""),
    observacao_conclusao: String(fd.get("observacao_conclusao")||"").trim() || null
  };
  if (!payload.responsavel_manutencao || !payload.entregue_centro_por || !payload.recebido_centro_por) {
    toast("Preencha os responsáveis da conclusão da manutenção.", "error"); return;
  }
  await finishMaintenanceAction(id, payload);
}

function assetPublicUrl(asset) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/p/${encodeURIComponent(asset.public_token)}`;
}

function openLabelDialog() {
  const asset = selectedAsset();
  if (!asset) return;
  if (!window.QRCode) { toast("Biblioteca de QR Code não carregada. Atualize a página.", "error"); return; }
  const qrRoot = document.querySelector("#labelQr");
  qrRoot.innerHTML = "";
  document.querySelector("#labelId").textContent = asset.id_interna;
  new window.QRCode(qrRoot, { text: assetPublicUrl(asset), width: 176, height: 176, colorDark: "#000000", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.L });
  document.querySelector("#labelDialog").showModal();
}

async function composeLabelCanvas(asset = selectedAsset()) {
  if (!asset) throw new Error("Patrimônio não selecionado");
  const baseWidth = 583, baseHeight = 227, scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale; canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  const image = new Image(); image.src = "./assets/layout-etiqueta-patrimonio.png"; await image.decode();
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const qrHolder = document.createElement("div");
  qrHolder.style.cssText = "position:fixed;left:-9999px;top:-9999px;background:#fff;padding:0";
  document.body.appendChild(qrHolder);
  new window.QRCode(qrHolder, { text: assetPublicUrl(asset), width: 240, height: 240, colorDark:"#000000", colorLight:"#ffffff", correctLevel: window.QRCode.CorrectLevel.L });
  await new Promise(r=>setTimeout(r,30));
  const qrSource = qrHolder.querySelector("canvas") || qrHolder.querySelector("img");
  if (!qrSource) { qrHolder.remove(); throw new Error("QR Code não foi gerado."); }

  const qrSize = 177.82, qrX = 32.10, qrY = 28.10;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((qrX-3)*scale,(qrY-3)*scale,(qrSize+6)*scale,(qrSize+6)*scale);
  ctx.drawImage(qrSource, qrX*scale, qrY*scale, qrSize*scale, qrSize*scale);
  qrHolder.remove();

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${31 * scale}px Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(asset.id_interna, 399*scale, 189*scale);
  return canvas;
}


function safeLabelFileName(asset) {
  const center = asset.centros_custo?.nome || "Sem Centro";
  return `${asset.id_interna} - ${center}`.replace(/[<>:"/\\|?*]+/g, "_").trim();
}

async function canvasBlob(canvas) {
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG.")), "image/png"));
}

async function generateSelectedLabels() {
  const assets = state.assets.filter(a=>state.labelSelected.has(a.id) && !a.removido);
  if (!assets.length) return;
  try {
    if (!window.QRCode) throw new Error("Biblioteca de QR Code não carregada.");
    if (assets.length === 1) {
      const canvas = await composeLabelCanvas(assets[0]);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await canvasBlob(canvas));
      a.download = `${safeLabelFileName(assets[0])}.png`;
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    if (!window.JSZip) throw new Error("Biblioteca ZIP não carregada.");
    const zip = new window.JSZip();
    for (const asset of assets) {
      const canvas = await composeLabelCanvas(asset);
      zip.file(`${safeLabelFileName(asset)}.png`, await canvasBlob(canvas));
    }
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Etiquetas Patrimonio - ${assets.length} itens.zip`;
    a.click(); URL.revokeObjectURL(a.href);
  } catch (error) { toast(error.message, "error"); }
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

function exportCsv(rows = filteredAssets()) {
  const data = [["ID Interna","ID SES","Descrição","Descrição complementar","Tipo","Centro de Custo","Valor","Status"], ...rows.map(asset=>[asset.id_interna,asset.id_ses||"",assetDisplayName(asset),asset.descricao||"",typeName(asset.tipo_id),asset.centros_custo?.nome||"",asset.valor_aquisicao,asset.status])];
  const csv=data.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(";")).join("\n");
  const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=`patrimonios-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}

function formatDate(value) {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return "—";
  const parts = dateOnly.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function formatDateTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch { return "—"; }
}
function acquisitionName(value) { return ({ COMPRA: "Compra", DOACAO: "Doação", LOCACAO: "Locação", CONTRATO_GESTAO: "Contrato de Gestão" })[value] || value || "—"; }
function conservationName(value) { return ({ PRODUTO_NOVO: "Produto Novo", BEM_CONSERVADO: "Bem Conservado", DESGASTADO: "Desgastado", INUTILIZAVEL: "Inutilizável" })[value] || value || "—"; }


function publicTokenFromHash() {
  const match = window.location.hash.match(/^#\/(?:p|consulta)\/([0-9a-f-]{36})$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function publicField(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="public-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderPublicAsset(asset) {
  const statusText = asset.status === "ATIVO" ? "Ativo" : "Inativo";
  const valueText = asset.valor_aquisicao == null ? null : money(asset.valor_aquisicao);
  const centerName = asset.centros_custo?.nome || asset.centro_custo || null;
  const sigemName = asset.descricoes_padrao?.descricao || asset.descricao_padrao || null;
  const allowed = asset.mobilidade === "MOVEL"
    ? ((asset.centros_permitidos || []).map(c => c.nome).filter(Boolean).join(", ") || "Nenhum centro adicional definido")
    : null;

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
            <h1>${escapeHtml(assetDisplayName(asset))}</h1>
            <div class="public-id-block"><span>ID interna</span><p class="public-id">${escapeHtml(asset.id_interna)}</p></div>
          </div>
          <div class="public-hero-status">
            <span class="public-status ${asset.status === "ATIVO" ? "is-active" : "is-inactive"}">${statusText}</span>
            ${asset.em_manutencao ? '<span class="public-context-tag is-maintenance">[Em manutenção]</span>' : ""}
          </div>
        </section>

        <section class="public-card-grid">
          <article class="public-card">
            <h2>Identificação</h2>
            ${publicField("ID interna", asset.id_interna)}
            ${publicField("ID SES", asset.id_ses)}
            ${publicField("Item do Catálogo", sigemName)}
            ${publicField("Descrição complementar", asset.descricao)}
            ${publicField("Tipo", asset.tipo || typeName(asset.tipo_id))}
            ${publicField("Marca/Modelo", asset.marca_modelo)}
          </article>

          <article class="public-card">
            <h2>Localização e condição</h2>
            ${publicField("Centro de custo", centerName)}
            ${asset.mobilidade === "MOVEL" ? publicField("Mobilidade", "Móvel") : ""}
            ${publicField("Estado de conservação", conservationName(asset.estado_conservacao))}
            ${publicField("Status", statusText)}
            ${asset.em_manutencao ? publicField("Condição operacional", "Em manutenção") : ""}
            ${asset.mobilidade === "MOVEL" ? publicField("Centros permitidos", allowed) : ""}
          </article>

          <article class="public-card">
            <h2>Aquisição</h2>
            ${publicField("Forma de aquisição", acquisitionName(asset.tipo_aquisicao))}
            ${publicField("Data de aquisição", formatDate(asset.data_aquisicao))}
            ${publicField("Valor informado", valueText)}
            ${publicField("Nota fiscal", asset.nota_fiscal_numero)}
            ${publicField("Fornecedor", asset.fornecedor)}
            ${publicField("Observações", asset.observacoes)}
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
  if (!hasApiConfig()) { renderConfigError(); return; }

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
