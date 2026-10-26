import { apiRequest, isNetworkError } from "./api.js";
import { getSession, signIn, signOut, changePassword, onAuthChange } from "./auth.js";

const root = document.querySelector("#appRoot");
const toastRoot = document.querySelector("#toast");
const version = String((window.OPERACIONAL_CONFIG && window.OPERACIONAL_CONFIG.VERSION) || "0.3.1");

const state = {
  session: null,
  view: "home",
  assetReturnView: "home",
  summary: null,
  summaryLoading: false,
  centers: null,
  centersLoading: false,
  searchResults: [],
  searchDone: false,
  searchLoading: false,
  searchFilters: { q:"", centro_id:"", tipo_id:"", situacao:"", mobilidade:"", manutencao:"" },
  currentAsset: null,
  maintenanceRows: null,
  assetHistory: null,
  globalHistory: null,
  globalHistoryLoading: false,
  online: navigator.onLine,
  scannerStream: null,
  scannerTimer: null,
  newCatalog: null,
  newCatalogResults: [],
  newCatalogTimer: null,
  newCatalogRequest: 0,
  lossRecord: null,
  lossLoading: false
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function toast(message,type) {
  toastRoot.textContent = String(message || "");
  toastRoot.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function(){ toastRoot.className = "toast"; }, 3200);
}
function can(code) {
  return Boolean(state.session && state.session.user && state.session.user.permissoes && state.session.user.permissoes[code] === true);
}
function currentUser() { return state.session && state.session.user ? String(state.session.user.nome || "") : ""; }
function typeName(id) { return ({1:"Equipamento Médico",2:"Mobiliário",3:"Equipamento de Informática"})[Number(id)] || "—"; }
function conservationName(v) { return ({PRODUTO_NOVO:"Produto Novo",BEM_CONSERVADO:"Bem Conservado",DESGASTADO:"Desgastado",INUTILIZAVEL:"Inutilizável"})[v] || v || "—"; }
function acquisitionName(v) { return ({COMPRA:"Compra",DOACAO:"Doação",LOCACAO:"Locação"})[v] || v || "—"; }
function formatDate(v) {
  if (!v) return "—";
  const parts = String(v).slice(0,10).split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(v);
}
function money(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : String(v);
}
function operationLabel(op) {
  const map = {
    CADASTRO:"Cadastro", EDICAO_CADASTRAL:"Edição cadastral", MOVIMENTACAO:"Movimentação",
    REMOCAO_LOGICA:"Inativação", RESTAURACAO:"Reativação", INATIVACAO:"Inativação",
    REATIVACAO:"Reativação", MOBILIDADE_ALTERADA:"Alteração de mobilidade",
    CENTRO_PERMITIDO_ADICIONADO:"Centro permitido adicionado",
    CENTRO_PERMITIDO_REMOVIDO:"Centro permitido removido",
    MANUTENCAO_ABERTA:"Entrada em manutenção", MANUTENCAO_CONCLUIDA:"Saída da manutenção",
    PERDA_PATRIMONIAL:"Perda patrimonial"
  };
  return map[op] || String(op || "Operação").replaceAll("_"," ");
}
function handleApiFailure(error,fallback) {
  if (isNetworkError(error)) {
    state.online = false;
    updateConnection();
    toast("A conexão com o servidor foi perdida.","error");
    return;
  }
  if (error && error.status === 401) {
    signOut();
    return;
  }
  toast((error && error.message) || fallback || "Erro na operação.","error");
}

function connectionHtml() {
  return '<button class="connection' + (state.online ? '' : ' offline') + '" id="connectionButton" type="button">' +
    '<span class="connection-dot"></span><span>' + (state.online ? 'Online' : 'Offline') + '</span></button>';
}
function viewInfo() {
  const all = {
    home:["Patrimônio+","Operacional"], search:["Procurar patrimônio","Busca e conferência"],
    asset:["Ficha do patrimônio","Consulta operacional"], move:["Movimentar patrimônio","Operação"],
    maintenance:["Manutenção","Operação"], toggle:["Situação do patrimônio","Operação"],
    edit:["Editar patrimônio","Dados operacionais"], new:["Novo patrimônio","Cadastro operacional"],
    audit:["Auditorias","Módulo em preparação"], sync:["Sincronização","Operações offline"],
    histories:["Históricos","Auditoria operacional"], assetHistory:["Histórico do patrimônio","Rastreabilidade"],
    loss:["Perda patrimonial","Registro formal"]
  };
  return all[state.view] || all.home;
}
function backTarget() {
  if (state.view === "home") return null;
  if (["move","maintenance","toggle","edit","assetHistory","loss"].includes(state.view)) return "asset";
  if (state.view === "asset") return state.assetReturnView || "home";
  return "home";
}
function renderChrome() {
  const info = viewInfo();
  const back = backTarget();
  root.innerHTML = '<main class="app"><header class="topbar">' +
    (back
      ? '<button class="back-button" id="backButton" type="button" aria-label="Voltar">←</button>'
      : '<button class="menu-button" id="menuButton" type="button" aria-label="Abrir menu">☰</button>') +
    '<div class="top-title"><strong>' + esc(info[0]) + '</strong><small>' + esc(info[1]) + '</small></div>' +
    connectionHtml() +
    '</header><section class="view" id="viewRoot"></section></main>';
  const menu = document.querySelector("#menuButton");
  if (menu) menu.addEventListener("click",openDrawer);
  const backButton = document.querySelector("#backButton");
  if (backButton) backButton.addEventListener("click",function(){ go(backTarget() || "home"); });
  document.querySelector("#connectionButton").addEventListener("click",async function(){
    if (!state.online) { toast("Sem conexão com o servidor."); return; }
    if (state.view === "home") { state.summary = null; await loadSummary(); }
    else toast("Conexão ativa.","success");
  });
}
function go(view) { state.view = view; render(); }
function render() {
  if (!state.session) { renderLogin(); return; }
  if (state.session.user && state.session.user.troca_senha_obrigatoria) { renderPasswordChange(); return; }
  renderChrome();
  const map = {
    home:renderHome, search:renderSearch, asset:renderAsset, move:renderMove,
    maintenance:renderMaintenance, toggle:renderToggle, edit:renderEdit, new:renderNew,
    audit:renderAudit, sync:renderSync, histories:renderHistories, assetHistory:renderAssetHistory, loss:renderLoss
  };
  (map[state.view] || renderHome)();
}

function renderLogin() {
  root.innerHTML = '<main class="login-page"><section class="login-card">' +
    '<div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
    '<h1>Entrar</h1><p>Use o mesmo usuário cadastrado no Patrimônio+.</p>' +
    '<form id="loginForm" class="form-grid">' +
    '<label>E-mail<input id="loginEmail" type="email" autocomplete="username" required></label>' +
    '<label>Senha<input id="loginPassword" type="password" autocomplete="current-password" required></label>' +
    '<button class="primary" id="loginButton" type="submit">Entrar</button>' +
    '<small style="color:var(--muted);text-align:center">Patrimônio+ Operacional · v' + esc(version) + '</small>' +
    '</form></section></main>';
  document.querySelector("#loginForm").addEventListener("submit",async function(event){
    event.preventDefault();
    const button = document.querySelector("#loginButton");
    button.disabled = true; button.textContent = "Entrando…";
    try {
      await signIn(document.querySelector("#loginEmail").value.trim(),document.querySelector("#loginPassword").value);
    } catch (error) {
      toast(error.message || "Não foi possível entrar.","error");
      button.disabled = false; button.textContent = "Entrar";
    }
  });
}
function renderPasswordChange() {
  root.innerHTML = '<main class="login-page"><section class="login-card">' +
    '<div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
    '<h1>Defina sua senha</h1><p>Este usuário precisa trocar a senha temporária antes de continuar.</p>' +
    '<form id="passwordForm" class="form-grid">' +
    '<label>Senha temporária<input name="current" type="password" required></label>' +
    '<label>Nova senha<input name="next" type="password" minlength="10" required></label>' +
    '<label>Confirmação<input name="confirm" type="password" minlength="10" required></label>' +
    '<button class="primary" type="submit">Atualizar senha</button><button class="ghost" id="cancelPassword" type="button">Sair</button>' +
    '</form></section></main>';
  document.querySelector("#cancelPassword").addEventListener("click",function(){ signOut(); });
  document.querySelector("#passwordForm").addEventListener("submit",async function(event){
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (fd.get("next") !== fd.get("confirm")) { toast("A confirmação está diferente da nova senha.","error"); return; }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await changePassword(fd.get("current"),fd.get("next"));
      await signOut();
      toast("Senha atualizada. Entre novamente.","success");
    } catch (error) {
      toast(error.message || "Não foi possível alterar a senha.","error");
      button.disabled = false;
    }
  });
}

function stat(value,label) {
  return '<article class="stat"><strong>' + (value === null || value === undefined ? "—" : esc(value)) + '</strong><span>' + esc(label) + '</span></article>';
}
function operationCard(id,title,subtitle,icon,img,badge,primary) {
  const iconHtml = img ? '<img src="' + img + '" alt="">' : esc(icon || "•");
  return '<button class="operation-card' + (primary ? ' primary-operation' : '') + '" id="' + id + '" type="button">' +
    (badge ? '<span class="coming-badge">' + esc(badge) + '</span>' : '') +
    '<span class="operation-icon">' + iconHtml + '</span><strong>' + esc(title) + '</strong></button>';
}

async function loadSummary() {
  if (state.summaryLoading || !state.online) return;
  state.summaryLoading = true;
  if (state.view === "home") renderHome();
  try {
    const data = await apiRequest("/api/operacional/resumo");
    state.summary = data.resumo || null;
  } catch (error) {
    handleApiFailure(error,"Não foi possível atualizar o painel.");
  } finally {
    state.summaryLoading = false;
    if (state.view === "home") renderHome();
  }
}
function renderHome() {
  const view = document.querySelector("#viewRoot");
  const s = state.summary;
  view.innerHTML = '<div class="dashboard-heading"><h1>Painel Operacional</h1></div>' +
    (state.summaryLoading ? '<div class="loading-line"></div>' : '') +
    '<div class="stats">' + stat(s && s.ativos,"Ativos") + stat(s && s.em_manutencao,"Em manutenção") +
    stat(s && s.inativados,"Inativados") + stat(s && s.moveis,"Móveis") + '</div>' +
    '<div class="section-head compact"><div><h2>Operações</h2></div></div>' +
    '<div class="operation-grid">' +
      operationCard("scanHome","Escanear item","","","../assets/icons/qrcode_icon.png","",true) +
      (can("patrimonios.cadastrar") ? operationCard("newHome","Novo patrimônio","","","../assets/icons/adicionar_icon.png","","") : "") +
      operationCard("auditHome","Iniciar auditoria","","✓","","Em breve","") +
      operationCard("searchHome","Procurar patrimônio","","⌕","","","") +
    '</div>' +
    '<button class="quick-card" id="syncHome" type="button"><span class="quick-icon">↻</span><div><strong>Sincronização</strong><span>' +
    (state.online ? 'Online' : 'Offline') + '</span></div><span>›</span></button>';
  document.querySelector("#scanHome").addEventListener("click",openScanner);
  const newButton = document.querySelector("#newHome");
  if (newButton) newButton.addEventListener("click",openNew);
  document.querySelector("#auditHome").addEventListener("click",function(){ go("audit"); });
  document.querySelector("#searchHome").addEventListener("click",openSearch);
  document.querySelector("#syncHome").addEventListener("click",function(){ go("sync"); });
  if (!state.summary && !state.summaryLoading && state.online) loadSummary();
}

async function ensureCenters() {
  if (state.centers || state.centersLoading) return;
  state.centersLoading = true;
  try {
    const data = await apiRequest("/api/centros");
    state.centers = (data.centros || []).filter(function(c){ return c.ativo; });
  } catch (error) {
    handleApiFailure(error,"Não foi possível carregar os centros de custo.");
  } finally {
    state.centersLoading = false;
  }
}
function centerOptions(selected,includeAll) {
  let html = includeAll ? '<option value="">Todos os centros</option>' : '';
  (state.centers || []).forEach(function(c){
    html += '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
  });
  return html;
}
async function openSearch() {
  state.view = "search"; render();
  await ensureCenters();
  if (state.view === "search") renderSearch();
}
function renderSearch() {
  const view = document.querySelector("#viewRoot");
  const f = state.searchFilters;
  view.innerHTML = '<div class="page-title"><h1>Procurar patrimônio</h1><p>A relação só é consultada quando você pesquisar. O aplicativo não carrega a base completa na abertura.</p></div>' +
    '<section class="panel"><form class="search-form" id="searchForm">' +
    '<div class="search-main"><input name="q" type="search" placeholder="ID, SES, descrição, marca ou setor…" value="' + esc(f.q) + '">' +
    '<button class="primary" type="submit">Pesquisar</button></div>' +
    '<div class="filter-grid">' +
    '<label class="full">Centro de custo<select name="centro_id">' + centerOptions(f.centro_id,true) + '</select></label>' +
    '<label>Tipo<select name="tipo_id"><option value="">Todos</option>' +
      '<option value="1"' + (f.tipo_id==="1"?' selected':'') + '>Equip. Médico</option>' +
      '<option value="2"' + (f.tipo_id==="2"?' selected':'') + '>Mobiliário</option>' +
      '<option value="3"' + (f.tipo_id==="3"?' selected':'') + '>Informática</option></select></label>' +
    '<label>Situação<select name="situacao"><option value="">Todos</option><option value="ATIVOS"' + (f.situacao==="ATIVOS"?' selected':'') + '>Ativos</option>' +
      '<option value="INATIVADOS"' + (f.situacao==="INATIVADOS"?' selected':'') + '>Inativados</option>' +
      '<option value="PERDIDOS"' + (f.situacao==="PERDIDOS"?' selected':'') + '>Perdidos</option></select></label>' +
    '<label>Mobilidade<select name="mobilidade"><option value="">Todas</option><option value="FIXO"' + (f.mobilidade==="FIXO"?' selected':'') + '>Fixo</option>' +
      '<option value="MOVEL"' + (f.mobilidade==="MOVEL"?' selected':'') + '>Móvel</option></select></label>' +
    '<label>Manutenção<select name="manutencao"><option value="">Todas</option><option value="SIM"' + (f.manutencao==="SIM"?' selected':'') + '>Em manutenção</option>' +
      '<option value="NAO"' + (f.manutencao==="NAO"?' selected':'') + '>Fora de manutenção</option></select></label>' +
    '</div></form></section>' +
    (state.searchLoading ? '<div class="loading-line"></div>' : '') +
    '<div class="section-head"><div><h2>Resultados</h2><p>' + (state.searchDone ? state.searchResults.length + ' item(ns) encontrado(s)' : 'Pesquise para consultar a relação') + '</p></div></div>' +
    '<div class="search-results" id="searchResults"></div>';
  const results = document.querySelector("#searchResults");
  if (state.searchLoading) results.innerHTML = '<div class="empty">Consultando patrimônio…</div>';
  else if (!state.searchDone) results.innerHTML = '<div class="empty">Informe um termo ou use os filtros e toque em <strong>Pesquisar</strong>.</div>';
  else if (!state.searchResults.length) results.innerHTML = '<div class="empty">Nenhum patrimônio encontrado com esses critérios.</div>';
  else results.innerHTML = state.searchResults.map(searchResultHtml).join("");
  results.querySelectorAll("[data-result-id]").forEach(function(button){
    button.addEventListener("click",function(){
      const asset = state.searchResults.find(function(item){ return item.id === button.dataset.resultId; });
      if (asset) openAsset(asset,"search");
    });
  });
  document.querySelector("#searchForm").addEventListener("submit",runSearch);
}
function searchResultHtml(a) {
  return '<button class="result-card' + (a.perdido ? ' is-lost' : '') + '" type="button" data-result-id="' + esc(a.id) + '">' +
    '<div class="result-top"><span class="result-id">ID ' + esc(a.id_interna || "—") + (a.id_ses ? ' · SES ' + esc(a.id_ses) : '') + '</span><span>›</span></div>' +
    '<h3>' + esc((a.descricoes_padrao && a.descricoes_padrao.descricao) || a.descricao || "Patrimônio") + '</h3>' +
    '<div class="result-meta"><span class="mini-tag">' + esc((a.centros_custo && a.centros_custo.nome) || "Sem centro") + '</span>' +
    '<span class="mini-tag">' + (a.mobilidade === "MOVEL" ? "Móvel" : "Fixo") + '</span>' +
    (a.perdido ? '<span class="mini-tag lost">Perdido</span>' : '') +
    (!a.perdido && a.em_manutencao ? '<span class="mini-tag warn">Em manutenção</span>' : '') +
    (!a.perdido && a.removido ? '<span class="mini-tag danger">Inativado</span>' : '') +
    '</div></button>';
}

async function runSearch(event) {
  event.preventDefault();
  if (!state.online) { toast("A busca online precisa de conexão.","error"); return; }
  const fd = new FormData(event.currentTarget);
  Object.keys(state.searchFilters).forEach(function(key){ state.searchFilters[key] = String(fd.get(key) || ""); });
  state.searchLoading = true; state.searchDone = true; renderSearch();
  const params = new URLSearchParams();
  Object.keys(state.searchFilters).forEach(function(key){ if (state.searchFilters[key]) params.set(key,state.searchFilters[key]); });
  params.set("limit","50");
  try {
    const data = await apiRequest("/api/operacional/patrimonios/buscar?" + params.toString());
    state.searchResults = data.patrimonios || [];
  } catch (error) {
    handleApiFailure(error,"Não foi possível pesquisar.");
    state.searchResults = [];
  } finally {
    state.searchLoading = false;
    if (state.view === "search") renderSearch();
  }
}

function openAsset(asset,returnView) {
  state.currentAsset = asset;
  state.assetReturnView = returnView || "home";
  state.assetHistory = null;
  state.maintenanceRows = null;
  state.lossRecord = asset && asset.perda ? asset.perda : null;
  go("asset");
}
async function refreshAsset() {
  const data = await apiRequest("/api/operacional/patrimonios/" + encodeURIComponent(state.currentAsset.id));
  state.currentAsset = data.patrimonio;
}
function assetPill(text,cls) { return '<span class="status-pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
function infoBox(label,value,extra) {
  return '<div class="info-box ' + (extra || '') + '"><span>' + esc(label) + '</span><strong>' + esc(value == null ? "—" : value) + '</strong></div>';
}
function assetAction(id,title,subtitle,img,icon,extra) {
  return '<button class="asset-action ' + (extra || '') + '" id="' + id + '" type="button"><span class="action-icon">' +
    (img ? '<img src="' + img + '" alt="">' : esc(icon || "")) +
    '</span><strong>' + esc(title) + '</strong></button>';
}

function renderAsset() {
  const a = state.currentAsset, view = document.querySelector("#viewRoot");
  if (!a) { view.innerHTML = '<div class="empty">Nenhum patrimônio selecionado.</div>'; return; }
  const displayName = (a.descricoes_padrao && a.descricoes_padrao.descricao) || a.descricao || "Patrimônio";
  const secondary = a.descricoes_padrao && a.descricoes_padrao.descricao && a.descricao && a.descricao !== a.descricoes_padrao.descricao ? a.descricao : "";
  const lost = a.perdido === true;
  const inactive = !lost && a.removido === true;
  let maintenanceButton = "";
  if (!lost && !inactive && a.em_manutencao && can("manutencoes.concluir")) maintenanceButton = assetAction("maintAction","Resolver manutenção","","../assets/icons/manutencao_icon.png");
  if (!lost && !inactive && !a.em_manutencao && can("manutencoes.abrir")) maintenanceButton = assetAction("maintAction","Enviar à manutenção","","../assets/icons/manutencao_icon.png");
  const statusClass = lost ? "danger" : (inactive ? "danger" : "ok");
  const statusText = lost ? "Perdido" : (inactive ? "Inativado" : "Ativo");
  const disableIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M6.5 17.5 17.5 6.5"></path></svg>';

  view.innerHTML = '<section class="asset-identity' + (lost ? ' is-lost' : '') + '">' +
    '<div class="asset-identity-head"><div class="asset-reference"><span>ID ' + esc(a.id_interna || "—") + '</span>' +
      (a.id_ses ? '<span class="ses">SES ' + esc(a.id_ses) + '</span>' : '') +
      (lost ? '<span class="lost-reference">PERDIDO</span>' : '') + '</div></div>' +
    '<div class="asset-identity-body"><h1>' + esc(displayName) + '</h1>' +
      (secondary ? '<div class="secondary-name">' + esc(secondary) + '</div>' : '') +
      '<div class="identity-location"><span>Centro de custo de referência</span><strong>' + esc((a.centros_custo && a.centros_custo.nome) || "—") + '</strong></div>' +
      '<div class="identity-status-grid">' +
        '<div class="identity-status"><span>Situação</span><strong class="' + statusClass + '">' + statusText + '</strong></div>' +
        '<div class="identity-status"><span>Mobilidade</span><strong>' + (a.mobilidade === "MOVEL" ? "Móvel" : "Fixo") + '</strong></div>' +
        '<div class="identity-status full"><span>Conservação</span><strong>' + esc(conservationName(a.estado_conservacao)) + '</strong></div>' +
        (!lost && a.em_manutencao ? '<div class="identity-maintenance">Em manutenção</div>' : '') +
      '</div>' +
    '</div>' +
    '<footer class="asset-model"><span>Marca / Modelo</span><strong>' + esc(a.marca_modelo || "—") + '</strong></footer>' +
  '</section>' +
  '<div class="section-head compact"><div><h2>Ações</h2></div></div>' +
  '<div class="action-grid">' +
    (lost
      ? assetAction("lossTermAction","Termo de Perda","","","≡","")
      : (
        (!inactive && can("patrimonios.movimentar") ? assetAction("moveAction","Movimentar","","../assets/icons/movimentar_icon.png") : "") +
        maintenanceButton +
        (((inactive && can("patrimonios.restaurar")) || (!inactive && can("patrimonios.inativar"))) ?
          '<button class="asset-action" id="toggleAction" type="button"><span class="action-icon inline-svg">' + disableIcon + '</span><strong>' + (inactive ? "Reativar" : "Inativar") + '</strong></button>' : "") +
        (can("patrimonios.editar") ? assetAction("editAction","Editar informações","","../assets/icons/editar_icon.png") : "") +
        (!inactive && can("patrimonios.registrar_perda") ? assetAction("lossAction","Perda","","","!","loss-action") : "") +
        assetAction("stockAction","Depósito / Estoque","","","▣","future")
      )) +
  '</div>' +
  (lost && a.perda ? '<div class="loss-summary"><strong>Perda registrada em ' + esc(formatDate(a.perda.data_ocorrencia)) + '</strong><span>' + esc(lossReasonLabel(a.perda.motivo)) + '</span></div>' : '') +
  '<div class="section-head compact"><div><h2>Informações</h2></div></div>' +
  '<div class="info-grid">' +
    infoBox("Tipo",typeName(a.tipo_id)) + infoBox("Estado",conservationName(a.estado_conservacao)) +
    infoBox("Aquisição",acquisitionName(a.tipo_aquisicao)) + infoBox("Data de aquisição",formatDate(a.data_aquisicao)) +
    infoBox("Valor",money(a.valor_aquisicao)) + infoBox("Nota fiscal",a.nota_fiscal_numero || "—") +
    (a.mobilidade === "MOVEL" ? infoBox("Centros permitidos",(a.centros_permitidos || []).map(function(c){return c.nome;}).join(", ") || "Nenhum adicional","full") : "") +
  '</div>' +
  (can("historico.individual") ? '<button class="ghost detail-toggle" id="assetHistoryButton" type="button">Consultar histórico deste patrimônio</button>' : '');

  const move = document.querySelector("#moveAction"); if (move) move.addEventListener("click",openMove);
  const maint = document.querySelector("#maintAction"); if (maint) maint.addEventListener("click",openMaintenance);
  const toggle = document.querySelector("#toggleAction"); if (toggle) toggle.addEventListener("click",function(){ go("toggle"); });
  const edit = document.querySelector("#editAction"); if (edit) edit.addEventListener("click",openEdit);
  const loss = document.querySelector("#lossAction"); if (loss) loss.addEventListener("click",openLoss);
  const term = document.querySelector("#lossTermAction"); if (term) term.addEventListener("click",openLoss);
  const stock = document.querySelector("#stockAction"); if (stock) stock.addEventListener("click",function(){ toast("Depósito / Estoque está reservado para a próxima evolução."); });
  const hist = document.querySelector("#assetHistoryButton"); if (hist) hist.addEventListener("click",openAssetHistory);
}

function lossReasonLabel(value) {
  return ({
    ROUBO_FURTO:"Roubo / Furto",
    DANO_IRREPARAVEL:"Dano irreparável / perda total",
    EXTRAVIO:"Extravio",
    OUTRO:"Outro"
  })[String(value || "")] || "—";
}

async function openLoss() {
  state.view = "loss";
  render();
  if (state.currentAsset && state.currentAsset.perdido && !state.lossRecord) {
    state.lossLoading = true;
    renderLoss();
    try {
      const data = await apiRequest("/api/patrimonios/" + state.currentAsset.id + "/perda");
      state.lossRecord = data.perda || null;
    } catch (error) {
      handleApiFailure(error,"Não foi possível consultar o registro de perda.");
    } finally {
      state.lossLoading = false;
      if (state.view === "loss") renderLoss();
    }
  }
}

function renderLoss() {
  const view = document.querySelector("#viewRoot");
  const a = state.currentAsset;
  if (!a) { view.innerHTML = '<div class="empty">Nenhum patrimônio selecionado.</div>'; return; }
  if (state.lossLoading) {
    view.innerHTML = '<div class="loading-line"></div><div class="empty">Carregando registro de perda…</div>';
    return;
  }

  if (a.perdido) {
    const loss = state.lossRecord || a.perda;
    if (!loss) {
      view.innerHTML = '<div class="empty">A perda está registrada, mas o termo não pôde ser carregado.</div>';
      return;
    }
    view.innerHTML = '<div class="page-title"><h1>Termo de Perda</h1><p>ID ' + esc(a.id_interna || "—") + '</p></div>' +
      '<section class="panel loss-detail">' +
        '<div class="loss-status-banner">Perda patrimonial registrada</div>' +
        '<div class="info-grid">' +
          infoBox("Motivo",lossReasonLabel(loss.motivo)) +
          infoBox("Data da ocorrência",formatDate(loss.data_ocorrencia)) +
          infoBox("Centro de custo",loss.centro_custo_nome || (a.centros_custo && a.centros_custo.nome) || "—","full") +
          infoBox("Responsável do Patrimônio",loss.responsavel_patrimonio || "—","full") +
          infoBox("Diretor Administrativo",loss.diretor_administrativo || "—","full") +
          infoBox("Coordenador do setor",loss.coordenador_setor || "—","full") +
          (loss.motivo_detalhe ? infoBox("Detalhamento",loss.motivo_detalhe,"full") : "") +
          (loss.observacoes ? infoBox("Observações",loss.observacoes,"full") : "") +
        '</div>' +
        '<button class="primary detail-toggle" id="printLossTerm" type="button">Imprimir / Salvar PDF</button>' +
      '</section>';
    document.querySelector("#printLossTerm").addEventListener("click",function(){ printLossTerm(loss); });
    return;
  }

  const today = new Date().toISOString().slice(0,10);
  view.innerHTML = '<div class="page-title"><h1>Registrar perda</h1><p>Esta operação retira definitivamente o bem da contagem operacional, preservando seu histórico.</p></div>' +
    '<section class="panel"><form id="lossForm" class="form-grid">' +
      '<label>Patrimônio<input value="ID ' + esc(a.id_interna || "—") + ' · ' + esc((a.descricoes_padrao && a.descricoes_padrao.descricao) || a.descricao || "Patrimônio") + '" disabled></label>' +
      '<label>Centro de custo / setor<input value="' + esc((a.centros_custo && a.centros_custo.nome) || "—") + '" disabled></label>' +
      '<label>Data da ocorrência<input name="data_ocorrencia" type="date" value="' + today + '" required></label>' +
      '<label>Motivo<select name="motivo" id="lossReason" required>' +
        '<option value="">Selecione…</option><option value="ROUBO_FURTO">Roubo / Furto</option>' +
        '<option value="DANO_IRREPARAVEL">Dano irreparável / perda total</option><option value="EXTRAVIO">Extravio</option><option value="OUTRO">Outro</option>' +
      '</select></label>' +
      '<label id="lossReasonDetailBox" hidden>Detalhamento do motivo<textarea name="motivo_detalhe" placeholder="Descreva a ocorrência"></textarea></label>' +
      '<label>Responsável pelo Setor de Patrimônio<input name="responsavel_patrimonio" required></label>' +
      '<label>Diretor Administrativo<input name="diretor_administrativo" required></label>' +
      '<label>Coordenador do Centro de Custo / Setor<input name="coordenador_setor" required></label>' +
      '<label>Observações<textarea name="observacoes" placeholder="Opcional"></textarea></label>' +
      '<label class="loss-confirm"><input name="confirmacao" type="checkbox" value="SIM" required><span>Confirmo que as informações foram conferidas e que este bem deve deixar a contagem operacional.</span></label>' +
      '<div class="form-actions"><button class="ghost" type="button" id="cancelLoss">Cancelar</button><button class="danger-button" type="submit">Registrar perda</button></div>' +
    '</form></section>';

  document.querySelector("#cancelLoss").addEventListener("click",function(){ go("asset"); });
  document.querySelector("#lossReason").addEventListener("change",function(event){
    const box = document.querySelector("#lossReasonDetailBox");
    box.hidden = event.target.value !== "OUTRO";
    box.querySelector("textarea").required = event.target.value === "OUTRO";
  });
  document.querySelector("#lossForm").addEventListener("submit",submitLoss);
}

async function submitLoss(event) {
  event.preventDefault();
  if (!window.confirm("Registrar esta perda? O patrimônio sairá definitivamente da contagem operacional.")) return;
  const form = event.currentTarget, button = form.querySelector('button[type="submit"]'), fd = new FormData(form);
  button.disabled = true; button.textContent = "Registrando…";
  try {
    const data = await apiRequest("/api/patrimonios/" + state.currentAsset.id + "/perda",{method:"POST",body:{
      data_ocorrencia:fd.get("data_ocorrencia"),
      motivo:fd.get("motivo"),
      motivo_detalhe:String(fd.get("motivo_detalhe") || "").trim() || null,
      responsavel_patrimonio:String(fd.get("responsavel_patrimonio") || "").trim(),
      diretor_administrativo:String(fd.get("diretor_administrativo") || "").trim(),
      coordenador_setor:String(fd.get("coordenador_setor") || "").trim(),
      observacoes:String(fd.get("observacoes") || "").trim() || null
    }});
    state.currentAsset = data.patrimonio;
    state.lossRecord = data.perda;
    state.summary = null;
    toast("Perda patrimonial registrada.","success");
    renderLoss();
  } catch (error) {
    handleApiFailure(error,"Não foi possível registrar a perda.");
    button.disabled = false; button.textContent = "Registrar perda";
  }
}

function printLossTerm(loss) {
  const snapshot = loss.patrimonio_snapshot || {};
  const template = loss.template_snapshot || {};
  const popup = window.open("","_blank","width=900,height=800");
  if (!popup) { toast("O navegador bloqueou a janela de impressão.","error"); return; }
  const logo = template.logo_data_url ? '<img class="logo" src="' + esc(template.logo_data_url) + '">' : '';
  const validation = template.validado_qualidade
    ? '<div class="validated">MODELO VALIDADO PELA QUALIDADE · VERSÃO ' + esc(template.versao || "—") + '</div>'
    : '<div class="draft">MODELO PENDENTE DE VALIDAÇÃO DA QUALIDADE</div>';
  const itemName = snapshot.descricao_catalogo || snapshot.descricao || "Patrimônio";
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Termo de Perda - ' + esc(snapshot.id_interna || "") + '</title><style>' +
    '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1d2f38;font-size:11pt;line-height:1.45;margin:0}' +
    '.header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #173e50;padding-bottom:12px}.logo{max-width:90px;max-height:65px}.header h1{margin:0;font-size:16pt}.header p{margin:3px 0 0;color:#566b75}.validated,.draft{margin:12px 0;padding:7px 10px;text-align:center;font-size:8pt;font-weight:bold;border-radius:4px}.validated{background:#e8f3ed;color:#286247}.draft{background:#fff0de;color:#8a4f12;border:1px solid #e8c79d}' +
    '.intro{margin:18px 0}.box{border:1px solid #cad7dc;border-radius:6px;padding:12px;margin:10px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border-bottom:1px solid #d7e1e5;padding:7px 0}.field.full{grid-column:1/-1}.label{display:block;font-size:8pt;text-transform:uppercase;color:#6b7f88;font-weight:bold}.value{display:block;margin-top:2px;font-weight:600}.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:55px}.signature{text-align:center;border-top:1px solid #374d56;padding-top:6px;font-size:9pt}.signature strong{display:block;font-size:9pt}.footer{margin-top:40px;border-top:1px solid #d5dfe3;padding-top:8px;display:flex;justify-content:space-between;color:#70828a;font-size:8pt}' +
    '</style></head><body>' +
    '<header class="header">' + logo + '<div><h1>' + esc(template.titulo || "Termo de Registro de Perda Patrimonial") + '</h1><p>' + esc(template.instituicao || "") + (template.unidade ? ' · ' + esc(template.unidade) : '') + '</p></div></header>' +
    validation +
    '<p class="intro">' + esc(template.texto_abertura || "") + '</p>' +
    '<section class="box"><div class="grid">' +
      '<div class="field"><span class="label">ID interna</span><span class="value">' + esc(snapshot.id_interna || "—") + '</span></div>' +
      '<div class="field"><span class="label">ID SES</span><span class="value">' + esc(snapshot.id_ses || "—") + '</span></div>' +
      '<div class="field full"><span class="label">Patrimônio</span><span class="value">' + esc(itemName) + '</span></div>' +
      '<div class="field full"><span class="label">Marca / Modelo</span><span class="value">' + esc(snapshot.marca_modelo || "—") + '</span></div>' +
      '<div class="field full"><span class="label">Centro de custo / setor</span><span class="value">' + esc(loss.centro_custo_nome || "—") + '</span></div>' +
    '</div></section>' +
    '<section class="box"><div class="grid">' +
      '<div class="field"><span class="label">Data da ocorrência</span><span class="value">' + esc(formatDate(loss.data_ocorrencia)) + '</span></div>' +
      '<div class="field"><span class="label">Motivo</span><span class="value">' + esc(lossReasonLabel(loss.motivo)) + '</span></div>' +
      (loss.motivo_detalhe ? '<div class="field full"><span class="label">Detalhamento</span><span class="value">' + esc(loss.motivo_detalhe) + '</span></div>' : '') +
      (loss.observacoes ? '<div class="field full"><span class="label">Observações</span><span class="value">' + esc(loss.observacoes) + '</span></div>' : '') +
    '</div></section>' +
    '<p>' + esc(template.texto_fechamento || "") + '</p>' +
    '<section class="signatures">' +
      '<div class="signature"><strong>' + esc(loss.responsavel_patrimonio) + '</strong>' + esc(template.assinatura_responsavel_patrimonio || "Responsável pelo Patrimônio") + '</div>' +
      '<div class="signature"><strong>' + esc(loss.diretor_administrativo) + '</strong>' + esc(template.assinatura_diretor_administrativo || "Diretor Administrativo") + '</div>' +
      '<div class="signature"><strong>' + esc(loss.coordenador_setor) + '</strong>' + esc(template.assinatura_coordenador_setor || "Coordenador do Setor") + '</div>' +
    '</section>' +
    '<footer class="footer"><span>' + esc(template.rodape || "") + '</span><span>Patrimônio+</span></footer>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},150);});<\/script>' +
    '</body></html>');
  popup.document.close();
}

async function openMove() { await ensureCenters(); go("move"); }
function renderMove() {
  const a = state.currentAsset, view = document.querySelector("#viewRoot");
  let options = '<option value="">Selecione…</option>';
  (state.centers || []).filter(function(c){return c.id !== (a.centros_custo && a.centros_custo.id);}).forEach(function(c){
    options += '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>';
  });
  view.innerHTML = '<div class="page-title"><h1>Movimentar</h1><p>' + esc(a.id_interna) + ' · ' + esc((a.descricoes_padrao && a.descricoes_padrao.descricao) || a.descricao || "Patrimônio") + '</p></div>' +
    '<section class="panel"><form id="moveForm" class="form-grid">' +
    '<label>Centro atual<input value="' + esc((a.centros_custo && a.centros_custo.nome) || "—") + '" disabled></label>' +
    '<label>Novo centro de custo<select name="destino" required>' + options + '</select></label>' +
    '<label>Solicitante<input name="solicitante" required></label>' +
    '<label>Recebido por<input name="recebidoPor" required></label>' +
    '<label>Observação<textarea name="observacao" placeholder="Opcional"></textarea></label>' +
    '<div class="form-actions"><button class="ghost" type="button" id="cancelMove">Cancelar</button><button class="primary" type="submit">Confirmar movimentação</button></div>' +
    '</form></section>';
  document.querySelector("#cancelMove").addEventListener("click",function(){ go("asset"); });
  document.querySelector("#moveForm").addEventListener("submit",submitMove);
}
async function submitMove(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const fd = new FormData(event.currentTarget);
  button.disabled = true; button.textContent = "Movimentando…";
  try {
    const a = state.currentAsset;
    const data = await apiRequest("/api/patrimonios/" + a.id + "/movimentar",{method:"POST",body:{
      destinoCentroCustoId:fd.get("destino"), solicitante:fd.get("solicitante"), movimentadoPor:currentUser(),
      recebidoPor:fd.get("recebidoPor"), observacao:fd.get("observacao") || null, mobilidade:a.mobilidade || "FIXO",
      centrosPermitidosIds:(a.centros_permitidos || []).map(function(c){return c.id;})
    }});
    state.currentAsset = data.patrimonio; state.summary = null;
    toast("Movimentação registrada.","success"); go("asset");
  } catch (error) {
    handleApiFailure(error,"Não foi possível movimentar.");
    button.disabled = false; button.textContent = "Confirmar movimentação";
  }
}

async function openMaintenance() {
  state.maintenanceRows = null; go("maintenance");
  try {
    const data = await apiRequest("/api/patrimonios/" + state.currentAsset.id + "/manutencoes");
    state.maintenanceRows = data.manutencoes || [];
  } catch (error) {
    handleApiFailure(error,"Não foi possível consultar manutenções."); state.maintenanceRows = [];
  }
  if (state.view === "maintenance") renderMaintenance();
}
function renderMaintenance() {
  const a = state.currentAsset, view = document.querySelector("#viewRoot");
  if (state.maintenanceRows === null) { view.innerHTML = '<div class="loading-line"></div><div class="empty">Consultando manutenção…</div>'; return; }
  const open = state.maintenanceRows.find(function(m){return m.status === "ABERTA";});
  if (a.em_manutencao && open) {
    view.innerHTML = '<div class="page-title"><h1>Resolver manutenção</h1><p>Registre a saída e o retorno do bem ao centro.</p></div>' +
      '<section class="panel"><div class="confirm-box"><strong>' + esc(open.tipo) + '</strong><br>' + esc(open.descricao) + '</div>' +
      '<form id="finishMaintenanceForm" class="form-grid" style="margin-top:14px">' +
      '<label>Responsável pela manutenção<input name="responsavel" required></label>' +
      '<label>Recebido no centro por<input name="recebido" required></label>' +
      '<label>Observação de conclusão<textarea name="observacao"></textarea></label>' +
      '<div class="form-actions"><button class="ghost" type="button" id="cancelMaintenance">Cancelar</button><button class="primary" type="submit">Concluir manutenção</button></div>' +
      '</form></section>';
    document.querySelector("#finishMaintenanceForm").addEventListener("submit",function(event){ submitFinishMaintenance(event,open.id); });
  } else {
    view.innerHTML = '<div class="page-title"><h1>Enviar à manutenção</h1><p>Abra uma manutenção preventiva ou corretiva.</p></div>' +
      '<section class="panel"><form id="openMaintenanceForm" class="form-grid">' +
      '<label>Tipo<select name="tipo" required><option value="CORRETIVA">Corretiva</option><option value="PREVENTIVA">Preventiva</option></select></label>' +
      '<label>Descrição<textarea name="descricao" required placeholder="Descreva o problema ou serviço"></textarea></label>' +
      '<label>Solicitante<input name="solicitante" required></label>' +
      '<label>Recebido na manutenção por<input name="recebido" required></label>' +
      '<div class="form-actions"><button class="ghost" type="button" id="cancelMaintenance">Cancelar</button><button class="primary" type="submit">Registrar manutenção</button></div>' +
      '</form></section>';
    document.querySelector("#openMaintenanceForm").addEventListener("submit",submitOpenMaintenance);
  }
  document.querySelector("#cancelMaintenance").addEventListener("click",function(){ go("asset"); });
}
async function submitOpenMaintenance(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]'), fd = new FormData(event.currentTarget);
  button.disabled = true;
  try {
    await apiRequest("/api/patrimonios/" + state.currentAsset.id + "/manutencoes",{method:"POST",body:{
      tipo:fd.get("tipo"), descricao:fd.get("descricao"), solicitante:fd.get("solicitante"),
      encaminhado_por:currentUser(), recebido_manutencao_por:fd.get("recebido")
    }});
    await refreshAsset(); state.summary = null; toast("Manutenção registrada.","success"); go("asset");
  } catch (error) { handleApiFailure(error,"Não foi possível registrar manutenção."); button.disabled = false; }
}
async function submitFinishMaintenance(event,id) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]'), fd = new FormData(event.currentTarget);
  button.disabled = true;
  try {
    await apiRequest("/api/manutencoes/" + id + "/concluir",{method:"POST",body:{
      responsavel_manutencao:fd.get("responsavel"), entregue_centro_por:currentUser(),
      recebido_centro_por:fd.get("recebido"), observacao_conclusao:fd.get("observacao") || null
    }});
    await refreshAsset(); state.summary = null; toast("Manutenção concluída.","success"); go("asset");
  } catch (error) { handleApiFailure(error,"Não foi possível concluir a manutenção."); button.disabled = false; }
}

function renderToggle() {
  const a = state.currentAsset, view = document.querySelector("#viewRoot"), restore = a.removido === true;
  view.innerHTML = '<div class="page-title"><h1>' + (restore ? "Reativar" : "Inativar") + ' patrimônio</h1><p>' +
    esc(a.id_interna) + ' · ' + esc((a.descricoes_padrao && a.descricoes_padrao.descricao) || a.descricao || "Patrimônio") + '</p></div>' +
    '<section class="panel"><div class="confirm-box">' +
    (restore
      ? 'O patrimônio voltará a ficar disponível para as operações normais do sistema.'
      : 'O patrimônio será retirado da operação sem exclusão definitiva. O histórico será preservado e ele poderá ser reativado depois.') +
    '</div><div class="form-actions" style="margin-top:14px"><button class="ghost" id="cancelToggle" type="button">Cancelar</button>' +
    '<button class="' + (restore ? "primary" : "danger-button") + '" id="confirmToggle" type="button">' + (restore ? "Reativar patrimônio" : "Inativar patrimônio") + '</button></div></section>';
  document.querySelector("#cancelToggle").addEventListener("click",function(){ go("asset"); });
  document.querySelector("#confirmToggle").addEventListener("click",submitToggle);
}
async function submitToggle() {
  const a = state.currentAsset, restore = a.removido === true, button = document.querySelector("#confirmToggle");
  button.disabled = true;
  try {
    const data = await apiRequest("/api/patrimonios/" + a.id + "/" + (restore ? "restaurar" : "remover"),{method:"POST"});
    state.currentAsset = data.patrimonio; state.summary = null;
    toast(restore ? "Patrimônio reativado." : "Patrimônio inativado.","success"); go("asset");
  } catch (error) { handleApiFailure(error,"Não foi possível alterar a situação."); button.disabled = false; }
}

async function openEdit() { await ensureCenters(); go("edit"); }
function allowedCentersHtml(selectedIds,currentId) {
  const selected = new Set(selectedIds || []);
  let html = "";
  (state.centers || []).filter(function(c){return c.id !== currentId;}).forEach(function(c){
    html += '<label class="check-row"><input type="checkbox" name="allowed" value="' + esc(c.id) + '"' + (selected.has(c.id) ? ' checked' : '') + '><span>' + esc(c.nome) + '</span></label>';
  });
  return html;
}
function renderEdit() {
  const a = state.currentAsset, view = document.querySelector("#viewRoot");
  view.innerHTML = '<div class="page-title"><h1>Editar informações</h1><p>Edição operacional do bem. Centro de custo é alterado somente pela movimentação.</p></div>' +
    '<section class="panel"><form id="editForm" class="form-grid">' +
    '<label>ID SES<input name="id_ses" value="' + esc(a.id_ses || "") + '"></label>' +
    '<label>Descrição complementar<input name="descricao" value="' + esc(a.descricao || "") + '" required></label>' +
    '<label>Marca / Modelo<input name="marca_modelo" value="' + esc(a.marca_modelo || "") + '"></label>' +
    '<label>Estado de conservação<select name="estado">' +
      '<option value="PRODUTO_NOVO"' + (a.estado_conservacao==="PRODUTO_NOVO"?' selected':'') + '>Produto Novo</option>' +
      '<option value="BEM_CONSERVADO"' + (a.estado_conservacao==="BEM_CONSERVADO"?' selected':'') + '>Bem Conservado</option>' +
      '<option value="DESGASTADO"' + (a.estado_conservacao==="DESGASTADO"?' selected':'') + '>Desgastado</option>' +
      '<option value="INUTILIZAVEL"' + (a.estado_conservacao==="INUTILIZAVEL"?' selected':'') + '>Inutilizável</option></select></label>' +
    '<label>Mobilidade<select name="mobilidade" id="editMobility"><option value="FIXO"' + (a.mobilidade!=="MOVEL"?' selected':'') + '>Fixo</option><option value="MOVEL"' + (a.mobilidade==="MOVEL"?' selected':'') + '>Móvel</option></select></label>' +
    '<div id="editAllowedBox"' + (a.mobilidade==="MOVEL"?'':' hidden') + '><label>Centros de custo permitidos</label><div class="checkbox-list">' +
      allowedCentersHtml((a.centros_permitidos || []).map(function(c){return c.id;}),a.centros_custo && a.centros_custo.id) +
    '</div></div><div class="form-actions"><button class="ghost" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">Salvar alterações</button></div>' +
    '</form></section>';
  document.querySelector("#cancelEdit").addEventListener("click",function(){ go("asset"); });
  document.querySelector("#editMobility").addEventListener("change",function(event){ document.querySelector("#editAllowedBox").hidden = event.target.value !== "MOVEL"; });
  document.querySelector("#editForm").addEventListener("submit",function(event){ submitEdit(event,false); });
}
async function submitEdit(event,forceDuplicate) {
  if (event && event.preventDefault) event.preventDefault();
  const form = event.currentTarget || document.querySelector("#editForm");
  const button = form.querySelector('button[type="submit"]'), fd = new FormData(form);
  button.disabled = true;
  const mobility = String(fd.get("mobilidade"));
  const payload = {
    id_ses:String(fd.get("id_ses") || "").trim() || null,
    descricao:String(fd.get("descricao") || "").trim(),
    marca_modelo:String(fd.get("marca_modelo") || "").trim() || null,
    estado_conservacao:fd.get("estado"), mobilidade:mobility,
    centros_permitidos_ids:mobility === "MOVEL" ? fd.getAll("allowed") : []
  };
  if (forceDuplicate) payload.confirmar_id_ses_duplicada = true;
  try {
    const data = await apiRequest("/api/patrimonios/" + state.currentAsset.id,{method:"PATCH",body:payload});
    state.currentAsset = data.patrimonio; toast("Informações atualizadas.","success"); go("asset");
  } catch (error) {
    if (error.status === 409 && !forceDuplicate && String(error.message).includes("ID SES") && window.confirm("Esta ID SES já está vinculada a outro patrimônio. Deseja confirmar a duplicidade?")) {
      button.disabled = false;
      return submitEdit({currentTarget:form,preventDefault:function(){}},true);
    }
    handleApiFailure(error,"Não foi possível salvar."); button.disabled = false;
  }
}

async function openNew() {
  if (!can("patrimonios.cadastrar")) return;
  state.newCatalog = null;
  state.newCatalogResults = [];
  await ensureCenters();
  go("new");
}
function validTypeId(value) { return [1,2,3].includes(Number(value)); }
function renderCatalogResults() {
  const box = document.querySelector("#newCatalogResults");
  if (!box) return;
  const rows = state.newCatalogResults || [];
  box.innerHTML = rows.length ? rows.map(function(item){
    return '<button class="catalog-option" type="button" data-catalog-id="' + esc(item.id) + '">' +
      '<span><strong>' + esc(item.descricao || "—") + '</strong><small>' + esc(item.origem === "PROPRIO" ? "Catálogo Próprio" : "SIGEM") + '</small></span>' +
      '<span class="catalog-meta">' + esc(typeName(item.tipo_id)) + (item.valor_padrao != null ? '<small>' + esc(money(item.valor_padrao)) + '</small>' : '') + '</span></button>';
  }).join("") : '<div class="catalog-message">Nenhum item encontrado.</div>';
  box.hidden = false;
  box.querySelectorAll("[data-catalog-id]").forEach(function(button){
    button.addEventListener("click",function(){
      const item = state.newCatalogResults.find(function(row){ return row.id === button.dataset.catalogId; });
      if (item) selectNewCatalog(item);
    });
  });
}
async function searchNewCatalog(term) {
  const query = String(term || "").trim();
  if (query.length < 2) {
    state.newCatalogResults = [];
    const box = document.querySelector("#newCatalogResults");
    if (box) box.hidden = true;
    return;
  }
  const requestId = ++state.newCatalogRequest;
  const box = document.querySelector("#newCatalogResults");
  if (box) { box.hidden = false; box.innerHTML = '<div class="catalog-message">Pesquisando…</div>'; }
  try {
    const params = new URLSearchParams({q:query,limit:"20"});
    const data = await apiRequest("/api/catalogo?" + params.toString());
    if (requestId !== state.newCatalogRequest) return;
    state.newCatalogResults = data.itens || [];
    renderCatalogResults();
  } catch (error) {
    if (box) box.innerHTML = '<div class="catalog-message">Não foi possível consultar o Catálogo.</div>';
  }
}
function updateNewCatalogState() {
  const type = document.querySelector("#newType");
  const hint = document.querySelector("#newTypeHint");
  const selected = document.querySelector("#newCatalogSelected");
  if (!type || !hint || !selected) return;
  if (state.newCatalog && validTypeId(state.newCatalog.tipo_id)) {
    type.value = String(state.newCatalog.tipo_id);
    type.disabled = true;
    hint.textContent = "Classificação herdada do Catálogo.";
    selected.innerHTML = '<strong>' + esc(state.newCatalog.descricao) + '</strong><span>' + esc(typeName(state.newCatalog.tipo_id)) + '</span>';
    selected.hidden = false;
  } else {
    type.disabled = false;
    hint.textContent = "Sem item vinculado, selecione a classificação.";
    selected.hidden = true;
  }
}
function selectNewCatalog(item) {
  state.newCatalog = item;
  const input = document.querySelector("#newCatalogSearch");
  const box = document.querySelector("#newCatalogResults");
  if (input) input.value = item.descricao || "";
  if (box) box.hidden = true;
  updateNewCatalogState();
}
function renderNew() {
  const view = document.querySelector("#viewRoot");
  const today = new Date().toISOString().slice(0,10);
  view.innerHTML = '<div class="page-title"><h1>Novo patrimônio</h1></div>' +
    '<section class="panel"><form id="newForm" class="form-grid">' +
    '<label>Descrição / Item do Catálogo<div class="catalog-search-wrap"><input id="newCatalogSearch" type="search" autocomplete="off" placeholder="Digite para buscar no Catálogo…"><div id="newCatalogResults" class="catalog-results" hidden></div></div></label>' +
    '<div id="newCatalogSelected" class="catalog-selected" hidden></div>' +
    '<label>Descrição complementar<input name="descricao" required></label>' +
    '<label>Classificação<select name="tipo_id" id="newType" required><option value="">Selecione…</option><option value="1">Equipamento Médico</option><option value="2">Mobiliário</option><option value="3">Equipamento de Informática</option></select><small id="newTypeHint" class="field-hint">Sem item vinculado, selecione a classificação.</small></label>' +
    '<label>ID SES<input name="id_ses"></label>' +
    '<label>Centro de custo<select name="centro" required><option value="">Selecione…</option>' + centerOptions("",false) + '</select></label>' +
    '<label>Marca / Modelo<input name="marca_modelo"></label><label>Data de aquisição<input name="data" type="date" value="' + today + '" required></label>' +
    '<label>Tipo de aquisição<select name="aquisicao" required><option value="COMPRA">Compra</option><option value="DOACAO">Doação</option><option value="LOCACAO">Locação</option></select></label>' +
    '<label>Valor de aquisição<input name="valor" type="number" step="0.01" min="0"></label>' +
    '<label>Estado<select name="estado"><option value="BEM_CONSERVADO">Bem Conservado</option><option value="PRODUTO_NOVO">Produto Novo</option><option value="DESGASTADO">Desgastado</option><option value="INUTILIZAVEL">Inutilizável</option></select></label>' +
    '<label>Mobilidade<select name="mobilidade" id="newMobility"><option value="FIXO">Fixo</option><option value="MOVEL">Móvel</option></select></label>' +
    '<div id="newAllowedBox" hidden><label>Centros de custo permitidos</label><div class="checkbox-list">' + allowedCentersHtml([],"") + '</div></div>' +
    '<div class="form-actions"><button class="ghost" type="button" id="cancelNew">Cancelar</button><button class="primary" type="submit">Cadastrar patrimônio</button></div>' +
    '</form></section>';

  document.querySelector("#cancelNew").addEventListener("click",function(){ go("home"); });
  document.querySelector("#newMobility").addEventListener("change",function(event){ document.querySelector("#newAllowedBox").hidden = event.target.value !== "MOVEL"; });
  document.querySelector("#newCatalogSearch").addEventListener("input",function(event){
    const value = event.target.value;
    if (!state.newCatalog || value.trim() !== String(state.newCatalog.descricao || "").trim()) {
      state.newCatalog = null;
      updateNewCatalogState();
    }
    clearTimeout(state.newCatalogTimer);
    state.newCatalogTimer = setTimeout(function(){ searchNewCatalog(value); },250);
  });
  document.querySelector("#newForm").addEventListener("submit",function(event){ submitNew(event,false); });
  updateNewCatalogState();
}
async function submitNew(event,forceDuplicate) {
  if (event && event.preventDefault) event.preventDefault();
  const form = event.currentTarget || document.querySelector("#newForm"), button = form.querySelector('button[type="submit"]'), fd = new FormData(form);
  const selectedType = state.newCatalog && validTypeId(state.newCatalog.tipo_id) ? Number(state.newCatalog.tipo_id) : Number(fd.get("tipo_id"));
  if (!selectedType) { toast("Selecione uma classificação válida.","error"); return; }
  button.disabled = true;
  const mobility = String(fd.get("mobilidade"));
  const payload = {
    descricao:String(fd.get("descricao") || "").trim(),
    descricao_padrao_id:state.newCatalog ? state.newCatalog.id : null,
    id_ses:String(fd.get("id_ses") || "").trim() || null,
    tipo_id:selectedType,
    centro_custo_id:fd.get("centro"),
    marca_modelo:String(fd.get("marca_modelo") || "").trim() || null,
    data_aquisicao:fd.get("data"),
    tipo_aquisicao:fd.get("aquisicao"),
    valor_aquisicao:fd.get("valor") === "" ? null : Number(fd.get("valor")),
    estado_conservacao:fd.get("estado"),
    mobilidade:mobility,
    centros_permitidos_ids:mobility === "MOVEL" ? fd.getAll("allowed") : []
  };
  if (forceDuplicate) payload.confirmar_id_ses_duplicada = true;
  try {
    const data = await apiRequest("/api/patrimonios",{method:"POST",body:payload});
    state.summary = null; toast("Patrimônio cadastrado.","success"); openAsset(data.patrimonio,"home");
  } catch (error) {
    if (error.status === 409 && !forceDuplicate && String(error.message).includes("ID SES") && window.confirm("Esta ID SES já está vinculada a outro patrimônio. Deseja confirmar a duplicidade?")) {
      button.disabled = false;
      return submitNew({currentTarget:form,preventDefault:function(){}},true);
    }
    handleApiFailure(error,"Não foi possível cadastrar."); button.disabled = false;
  }
}

async function openAssetHistory() {
  state.assetHistory = null; go("assetHistory");
  try {
    const data = await apiRequest("/api/patrimonios/" + state.currentAsset.id + "/historico");
    state.assetHistory = data.historico || [];
  } catch (error) {
    handleApiFailure(error,"Não foi possível consultar o histórico."); state.assetHistory = [];
  }
  if (state.view === "assetHistory") renderAssetHistory();
}
function historyHtml(h) {
  const when = h.criado_em ? new Date(h.criado_em).toLocaleString("pt-BR") : "";
  return '<article class="history-item"><strong>' + esc(operationLabel(h.operacao)) + '</strong><span>' + esc(when) +
    (h.usuario && h.usuario.nome ? ' · ' + esc(h.usuario.nome) : '') + '</span></article>';
}
function renderAssetHistory() {
  const view = document.querySelector("#viewRoot");
  if (state.assetHistory === null) { view.innerHTML = '<div class="loading-line"></div><div class="empty">Carregando histórico…</div>'; return; }
  view.innerHTML = '<div class="page-title"><h1>Histórico</h1><p>ID ' + esc((state.currentAsset && state.currentAsset.id_interna) || "—") + ' · rastreabilidade individual</p></div>' +
    '<div class="history-list">' + (state.assetHistory.length ? state.assetHistory.map(historyHtml).join("") : '<div class="empty">Nenhum evento registrado.</div>') + '</div>';
}

function renderAudit() {
  document.querySelector("#viewRoot").innerHTML = '<div class="placeholder-card"><div class="big">✓</div><h2>Auditoria patrimonial</h2>' +
    '<p>A estrutura já está reservada no aplicativo. O fluxo será definido depois da nossa discussão, integrado ao QR, centros de custo, divergências e sincronização offline.</p>' +
    '<span class="coming-badge" style="position:static;display:inline-block;margin-top:14px">Em preparação</span></div>';
}
function renderSync() {
  document.querySelector("#viewRoot").innerHTML = '<div class="page-title"><h1>Sincronização</h1><p>Estado do aplicativo e preparação para uso offline.</p></div>' +
    '<section class="panel"><div class="info-grid">' +
      infoBox("Conexão",state.online ? "Online" : "Offline") + infoBox("Operações pendentes","0") +
      infoBox("Versão do app",version) + infoBox("Base local","Próxima etapa") +
    '</div><div class="placeholder-card" style="margin-top:12px"><div class="big">↻</div><h2>Offline-first em preparação</h2>' +
    '<p>O próximo módulo adicionará IndexedDB, fila de operações, sincronização idempotente e resolução de conflitos.</p></div></section>';
}
async function openHistories() {
  state.view = "histories"; state.globalHistory = null; render();
  if (!can("historico.geral")) return;
  await loadGlobalHistory();
}
async function loadGlobalHistory() {
  if (state.globalHistoryLoading) return;
  state.globalHistoryLoading = true; renderHistories();
  try {
    const data = await apiRequest("/api/historico?limit=40&offset=0");
    state.globalHistory = data.eventos || [];
  } catch (error) {
    handleApiFailure(error,"Não foi possível consultar o histórico geral."); state.globalHistory = [];
  } finally {
    state.globalHistoryLoading = false;
    if (state.view === "histories") renderHistories();
  }
}
function renderHistories() {
  const view = document.querySelector("#viewRoot");
  if (!can("historico.geral")) {
    view.innerHTML = '<div class="placeholder-card"><div class="big">◷</div><h2>Históricos</h2>' +
      '<p>Seu perfil possui acesso aos históricos individuais dos patrimônios. O Histórico Geral depende da permissão administrativa correspondente.</p></div>';
    return;
  }
  if (state.globalHistoryLoading || state.globalHistory === null) {
    view.innerHTML = '<div class="loading-line"></div><div class="empty">Carregando histórico geral…</div>'; return;
  }
  view.innerHTML = '<div class="page-title"><h1>Histórico geral</h1><p>Últimas operações registradas no Patrimônio+.</p></div>' +
    '<div class="history-list">' + (state.globalHistory.map(historyHtml).join("") || '<div class="empty">Nenhum evento.</div>') + '</div>';
}

function openDrawer() {
  if (document.querySelector("#drawerLayer")) return;
  const user = state.session && state.session.user ? state.session.user : {};
  const layer = document.createElement("div");
  const gerencialUrl = new URL("../",window.location.href).href;
  layer.id = "drawerLayer";
  layer.innerHTML = '<div class="drawer-backdrop" id="drawerBackdrop"></div><aside class="drawer">' +
    '<div class="drawer-head"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
    '<nav class="drawer-nav">' +
    '<button type="button" data-nav="home"' + (state.view==="home"?' class="active"':'') + '>Painel</button>' +
    '<button type="button" data-nav="sync"' + (state.view==="sync"?' class="active"':'') + '>Sincronização</button>' +
    '<button type="button" id="drawerGerencial">Gerencial</button>' +
    '<button type="button" data-nav="audit"' + (state.view==="audit"?' class="active"':'') + '>Auditorias</button>' +
    '<button type="button" id="drawerHistories"' + (state.view==="histories"?' class="active"':'') + '>Históricos</button>' +
    '</nav><div class="drawer-footer"><div class="drawer-user"><strong>' + esc(user.nome || "Usuário") + '</strong><span>' + esc(user.perfil_acesso || user.perfil || "") + '</span></div>' +
    '<button class="ghost" id="drawerLogout" type="button">Sair</button><small style="text-align:center;color:var(--muted)">v' + esc(version) + '</small></div></aside>';
  document.body.appendChild(layer);
  document.querySelector("#drawerBackdrop").addEventListener("click",closeDrawer);
  layer.querySelectorAll("[data-nav]").forEach(function(button){
    button.addEventListener("click",function(){ const target = button.dataset.nav; closeDrawer(); go(target); });
  });
  document.querySelector("#drawerGerencial").addEventListener("click",function(){ window.location.href = gerencialUrl; });
  document.querySelector("#drawerHistories").addEventListener("click",function(){ closeDrawer(); openHistories(); });
  document.querySelector("#drawerLogout").addEventListener("click",async function(){ closeDrawer(); await signOut(); });
}
function closeDrawer() { const layer = document.querySelector("#drawerLayer"); if (layer) layer.remove(); }

function scannerHtml() {
  return '<section class="scanner-sheet" id="scannerSheet">' +
    '<div class="scanner-head"><button id="closeScanner" type="button">←</button><div><strong>Ler QR Code</strong><div style="font-size:11px;color:#bcd4de">Aponte para a etiqueta do patrimônio</div></div></div>' +
    '<div class="scanner-view"><video id="scannerVideo" playsinline muted></video><div class="scan-frame"><div class="scan-line"></div></div></div>' +
    '<div class="scanner-help"><p id="scannerMessage">Iniciando câmera…</p><div class="manual-scan"><input id="manualScan" type="text" placeholder="Ou informe ID / SES"><button class="primary" id="manualScanButton" type="button">Abrir</button></div></div></section>';
}
async function openScanner() {
  if (document.querySelector("#scannerSheet")) return;
  document.body.insertAdjacentHTML("beforeend",scannerHtml());
  document.querySelector("#closeScanner").addEventListener("click",closeScanner);
  document.querySelector("#manualScanButton").addEventListener("click",function(){ resolveScan(document.querySelector("#manualScan").value); });
  document.querySelector("#manualScan").addEventListener("keydown",function(event){ if (event.key === "Enter") resolveScan(event.target.value); });
  const message = document.querySelector("#scannerMessage"), video = document.querySelector("#scannerVideo");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { message.textContent = "Câmera indisponível neste navegador. Use o campo abaixo."; return; }
  try {
    state.scannerStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    video.srcObject = state.scannerStream; await video.play();
    if (!("BarcodeDetector" in window)) { message.textContent = "Câmera aberta. Leitura automática não suportada; use o campo abaixo se necessário."; return; }
    const detector = new BarcodeDetector({formats:["qr_code"]});
    message.textContent = "Centralize o QR dentro do quadro.";
    const scan = async function(){
      if (!document.querySelector("#scannerSheet")) return;
      try {
        const codes = await detector.detect(video);
        if (codes && codes[0] && codes[0].rawValue) { await resolveScan(codes[0].rawValue); return; }
      } catch {}
      state.scannerTimer = setTimeout(scan,250);
    };
    scan();
  } catch {
    message.textContent = "Não foi possível acessar a câmera. Autorize a permissão ou use o campo abaixo.";
  }
}
function closeScanner() {
  if (state.scannerTimer) clearTimeout(state.scannerTimer);
  state.scannerTimer = null;
  if (state.scannerStream) state.scannerStream.getTracks().forEach(function(track){track.stop();});
  state.scannerStream = null;
  const sheet = document.querySelector("#scannerSheet"); if (sheet) sheet.remove();
}
function qrToken(value) {
  const text = String(value || "").trim();
  const match = text.match(/#\/(?:p|consulta)\/([0-9a-f-]{36})/i);
  if (match) return match[1];
  if (/^[0-9a-f-]{36}$/i.test(text)) return text;
  return null;
}
async function resolveScan(value) {
  const raw = String(value || "").trim();
  if (!raw) return;
  if (!state.online) { toast("A consulta do QR ainda precisa de conexão. O cache offline entra na próxima etapa.","error"); return; }
  const message = document.querySelector("#scannerMessage");
  if (message) message.textContent = "Localizando patrimônio…";
  try {
    const token = qrToken(raw);
    if (token) {
      const data = await apiRequest("/api/operacional/patrimonios/qr/" + encodeURIComponent(token));
      closeScanner(); openAsset(data.patrimonio,"home"); toast("Patrimônio localizado.","success"); return;
    }
    const params = new URLSearchParams({q:raw,limit:"20"});
    const data = await apiRequest("/api/operacional/patrimonios/buscar?" + params.toString());
    const rows = data.patrimonios || [];
    const exact = rows.find(function(a){
      return String(a.id_interna || "").toLowerCase() === raw.toLowerCase() || String(a.id_ses || "").toLowerCase() === raw.toLowerCase();
    });
    if (exact) { closeScanner(); openAsset(exact,"home"); toast("Patrimônio localizado.","success"); return; }
    closeScanner();
    state.searchFilters = {q:raw,centro_id:"",tipo_id:"",situacao:"",mobilidade:"",manutencao:""};
    state.searchResults = rows; state.searchDone = true; state.view = "search"; render();
  } catch (error) {
    handleApiFailure(error,"Patrimônio não localizado.");
    if (message) message.textContent = "Não foi possível localizar. Tente novamente.";
  }
}

function updateConnection() {
  const button = document.querySelector(".connection");
  if (button) button.classList.toggle("offline",!state.online);
  const label = button ? button.querySelector("span:last-child") : null;
  if (label) label.textContent = state.online ? "Online" : "Offline";
}
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try { await navigator.serviceWorker.register("./sw.js",{scope:"./"}); }
  catch (error) { console.error("Service Worker",error); }
}
async function applySession(session) {
  state.session = session;
  if (!session) {
    closeScanner(); closeDrawer(); state.summary = null; state.currentAsset = null; renderLogin(); return;
  }
  state.view = "home"; render();
  if (session.offline) toast("Sessão local aberta sem conexão.");
}
window.addEventListener("online",async function(){
  state.online = true; updateConnection(); toast("Conexão restabelecida.","success");
  if (state.session && state.view === "home") { state.summary = null; await loadSummary(); }
});
window.addEventListener("offline",function(){ state.online = false; updateConnection(); toast("Você está offline."); });
window.addEventListener("beforeunload",closeScanner);

async function start() {
  await registerServiceWorker();
  onAuthChange(function(session){ applySession(session); });
  const session = await getSession();
  await applySession(session);
}
start().catch(function(error){
  console.error(error);
  root.innerHTML = '<main class="login-page"><section class="login-card"><h1>Não foi possível iniciar</h1><p>' + esc(error.message || "Erro desconhecido.") + '</p></section></main>';
});
