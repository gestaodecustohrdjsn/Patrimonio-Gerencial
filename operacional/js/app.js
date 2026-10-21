import { apiRequest, isNetworkError } from "./api.js";
import { getSession, signIn, signOut, changePassword, onAuthChange } from "./auth.js";

const root = document.querySelector("#appRoot");
const toastRoot = document.querySelector("#toast");
const version = String(window.OPERACIONAL_CONFIG && window.OPERACIONAL_CONFIG.VERSION || "0.1.0");

const state = {
  session: null,
  assets: [],
  search: "",
  expandedId: null,
  online: navigator.onLine,
  loading: false,
  lastSync: null,
  scannerStream: null,
  scannerTimer: null
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(message, type) {
  toastRoot.textContent = String(message || "");
  toastRoot.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toastRoot.className = "toast";
  }, 3200);
}

function can(code) {
  return Boolean(state.session && state.session.user && state.session.user.permissoes && state.session.user.permissoes[code] === true);
}

function typeName(id) {
  const map = { 1: "Equipamento Médico", 2: "Mobiliário", 3: "Equipamento de Informática" };
  return map[Number(id)] || "Tipo " + (id || "—");
}

function statusText(asset) {
  if (asset.removido) return "Removido";
  return String(asset.status || "—") === "ATIVO" ? "Ativo" : String(asset.status || "—");
}

function connectionText() {
  if (!state.online) return "Offline";
  return "Online";
}

function connectionClass() {
  return state.online ? "connection" : "connection offline";
}

function renderLogin() {
  root.innerHTML =
    '<main class="login-page">' +
      '<section class="login-card">' +
        '<div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
        '<h1>Entrar</h1>' +
        '<p>Use o mesmo usuário cadastrado no Patrimônio+.</p>' +
        '<form id="loginForm" class="form-grid">' +
          '<label>E-mail<input id="loginEmail" type="email" autocomplete="username" required></label>' +
          '<label>Senha<input id="loginPassword" type="password" autocomplete="current-password" required></label>' +
          '<button class="primary" id="loginButton" type="submit">Entrar</button>' +
          '<small style="color:var(--muted);text-align:center">Patrimônio+ Operacional · v' + escapeHtml(version) + '</small>' +
        '</form>' +
      '</section>' +
    '</main>';

  document.querySelector("#loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = document.querySelector("#loginButton");
    button.disabled = true;
    button.textContent = "Entrando…";
    try {
      await signIn(
        document.querySelector("#loginEmail").value.trim(),
        document.querySelector("#loginPassword").value
      );
    } catch (error) {
      toast(error.message || "Não foi possível entrar.", "error");
      button.disabled = false;
      button.textContent = "Entrar";
    }
  });
}

function renderPasswordChange() {
  root.innerHTML =
    '<main class="login-page"><section class="login-card">' +
      '<div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
      '<h1>Defina sua senha</h1>' +
      '<p>Este usuário precisa trocar a senha temporária antes de continuar.</p>' +
      '<form id="passwordForm" class="form-grid">' +
        '<label>Senha temporária<input name="current" type="password" autocomplete="current-password" required></label>' +
        '<label>Nova senha<input name="next" type="password" minlength="10" autocomplete="new-password" required></label>' +
        '<label>Confirmação<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label>' +
        '<button class="primary" type="submit">Atualizar senha</button>' +
        '<button class="ghost" id="cancelPassword" type="button">Sair</button>' +
      '</form>' +
    '</section></main>';

  document.querySelector("#cancelPassword").addEventListener("click", function () {
    signOut();
  });

  document.querySelector("#passwordForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("next") !== data.get("confirm")) {
      toast("A confirmação está diferente da nova senha.", "error");
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await changePassword(data.get("current"), data.get("next"));
      await signOut();
      toast("Senha atualizada. Entre novamente.", "success");
    } catch (error) {
      toast(error.message || "Não foi possível alterar a senha.", "error");
      button.disabled = false;
    }
  });
}

function shellHtml() {
  const addButton = can("patrimonios.cadastrar")
    ? '<button class="fab secondary" id="addFab" type="button" aria-label="Adicionar patrimônio"><img src="../assets/icons/adicionar_icon.png" alt=""></button>'
    : "";

  return (
    '<main class="app">' +
      '<header class="topbar">' +
        '<div class="topline">' +
          '<button class="menu-button" id="menuButton" type="button" aria-label="Abrir menu">☰</button>' +
          '<div class="brand-mini"><strong>Patrimônio+</strong><small>Operacional</small></div>' +
          '<button class="' + connectionClass() + '" id="connectionButton" type="button"><span class="connection-dot"></span><span id="connectionText">' + connectionText() + '</span></button>' +
        '</div>' +
        '<div class="search-row">' +
          '<input id="assetSearch" type="search" placeholder="ID, descrição ou centro de custo…" autocomplete="off" value="' + escapeHtml(state.search) + '">' +
          '<button class="filter-button" id="filterButton" type="button" aria-label="Filtros">☷</button>' +
        '</div>' +
      '</header>' +
      '<section class="content">' +
        '<div class="summary"><strong id="summaryTitle">Patrimônios</strong><span id="summaryCount"></span></div>' +
        '<div id="assetList" class="asset-list"></div>' +
      '</section>' +
      '<div class="fabs">' +
        '<button class="fab" id="qrFab" type="button" aria-label="Ler QR Code"><img src="../assets/icons/qrcode_icon.png" alt=""></button>' +
        addButton +
      '</div>' +
    '</main>'
  );
}

function renderShell() {
  root.innerHTML = shellHtml();

  document.querySelector("#menuButton").addEventListener("click", openDrawer);
  document.querySelector("#connectionButton").addEventListener("click", function () {
    if (state.online) {
      loadAssets(true);
    } else {
      toast("Sem conexão. Operações offline serão habilitadas na etapa de sincronização.");
    }
  });

  const search = document.querySelector("#assetSearch");
  search.addEventListener("input", function (event) {
    state.search = event.target.value;
    renderAssets();
  });

  document.querySelector("#filterButton").addEventListener("click", function () {
    toast("Os filtros operacionais serão ligados na próxima etapa.");
  });

  document.querySelector("#qrFab").addEventListener("click", openScanner);

  const add = document.querySelector("#addFab");
  if (add) {
    add.addEventListener("click", function () {
      toast("Cadastro mobile será conectado na etapa de ações operacionais.");
    });
  }

  renderAssets();
}

function normalized(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

function filteredAssets() {
  const q = normalized(state.search);
  if (!q) return state.assets;
  return state.assets.filter(function (asset) {
    return [
      asset.id_interna,
      asset.id_ses,
      asset.descricao,
      asset.descricoes_padrao && asset.descricoes_padrao.descricao,
      asset.centros_custo && asset.centros_custo.nome,
      asset.marca_modelo
    ].some(function (value) {
      return normalized(value).includes(q);
    });
  });
}

function tagHtml(text, extraClass) {
  return '<span class="tag' + (extraClass ? " " + extraClass : "") + '">' + escapeHtml(text) + '</span>';
}

function actionButton(action, label, icon, disabled) {
  const disabledText = disabled ? " disabled" : "";
  if (icon === "history") {
    return '<button class="action" data-action="' + action + '" type="button" aria-label="' + escapeHtml(label) + '"' + disabledText + '><span class="history-icon">◷</span></button>';
  }
  return '<button class="action" data-action="' + action + '" type="button" aria-label="' + escapeHtml(label) + '"' + disabledText + '><img src="../assets/icons/' + icon + '_icon.png" alt=""></button>';
}

function assetCard(asset) {
  const tags = [];
  if (asset.mobilidade === "MOVEL") tags.push(tagHtml("Móvel"));
  if (asset.em_manutencao) tags.push(tagHtml("Em manutenção", "warning"));
  if (asset.removido || asset.status === "INATIVO") tags.push(tagHtml(statusText(asset), "danger"));

  const expanded = state.expandedId === asset.id;
  const details = expanded
    ? '<div class="asset-detail">' +
        '<div class="full"><span>Centro de custo</span><strong>' + escapeHtml(asset.centros_custo && asset.centros_custo.nome || "—") + '</strong></div>' +
        '<div><span>Tipo</span><strong>' + escapeHtml(typeName(asset.tipo_id)) + '</strong></div>' +
        '<div><span>Status</span><strong>' + escapeHtml(statusText(asset)) + '</strong></div>' +
        '<div><span>Estado</span><strong>' + escapeHtml(asset.estado_conservacao || "—") + '</strong></div>' +
        '<div><span>Marca / Modelo</span><strong>' + escapeHtml(asset.marca_modelo || "—") + '</strong></div>' +
      '</div>'
    : "";

  return (
    '<article class="asset-card" data-asset-id="' + escapeHtml(asset.id) + '">' +
      '<div class="asset-main">' +
        '<div class="asset-id">ID ' + escapeHtml(asset.id_interna || "—") + (asset.id_ses ? " · SES " + escapeHtml(asset.id_ses) : "") + '</div>' +
        '<div class="asset-title">' + escapeHtml(asset.descricoes_padrao && asset.descricoes_padrao.descricao || asset.descricao || "Patrimônio") + '</div>' +
        (tags.length ? '<div class="asset-sub">' + tags.join("") + '</div>' : "") +
      '</div>' +
      '<div class="asset-actions">' +
        actionButton("view", "Visualizar", "visualizar", false) +
        actionButton("edit", "Editar", "editar", !can("patrimonios.editar") || asset.removido) +
        actionButton("move", "Movimentar", "movimentar", !can("patrimonios.movimentar") || asset.removido) +
        actionButton("maintenance", "Manutenção", "manutencao", !can("manutencoes.abrir") || asset.removido) +
        actionButton("history", "Histórico", "history", !can("historico.individual")) +
      '</div>' +
      details +
    '</article>'
  );
}

function renderAssets() {
  const list = document.querySelector("#assetList");
  if (!list) return;

  if (state.loading) {
    list.innerHTML = '<div class="empty-state">Carregando patrimônios…</div>';
    document.querySelector("#summaryCount").textContent = "";
    return;
  }

  const rows = filteredAssets();
  document.querySelector("#summaryCount").textContent = rows.length + (state.assets.length !== rows.length ? " de " + state.assets.length : "");

  if (!rows.length) {
    const text = !state.online && !state.assets.length
      ? "Sem dados locais nesta primeira versão. O banco offline será ligado na etapa de sincronização."
      : (state.search ? "Nenhum patrimônio corresponde à busca." : "Nenhum patrimônio disponível.");
    list.innerHTML = '<div class="empty-state">' + escapeHtml(text) + '</div>';
    return;
  }

  list.innerHTML = rows.map(assetCard).join("");

  list.querySelectorAll("[data-asset-id]").forEach(function (card) {
    const id = card.getAttribute("data-asset-id");
    const asset = state.assets.find(function (item) { return item.id === id; });
    if (!asset) return;

    card.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.disabled) return;
        const action = button.getAttribute("data-action");
        if (action === "view") {
          state.expandedId = state.expandedId === asset.id ? null : asset.id;
          renderAssets();
          return;
        }

        const labels = {
          edit: "Edição mobile",
          move: "Movimentação mobile",
          maintenance: "Manutenção mobile",
          history: "Histórico individual"
        };
        toast((labels[action] || "Ação") + " será conectada na próxima etapa.");
      });
    });
  });
}

async function loadAssets(showSuccess) {
  if (!state.session || state.loading) return;
  if (!state.online) {
    renderAssets();
    return;
  }

  state.loading = true;
  renderAssets();
  try {
    const data = await apiRequest("/api/patrimonios");
    state.assets = Array.isArray(data.patrimonios) ? data.patrimonios : [];
    state.lastSync = new Date();
    if (showSuccess) toast("Base operacional atualizada.", "success");
  } catch (error) {
    if (isNetworkError(error)) {
      state.online = false;
      updateConnection();
      toast("A conexão caiu durante a atualização.");
    } else if (error.status === 401) {
      await signOut();
      return;
    } else {
      toast(error.message || "Não foi possível carregar os patrimônios.", "error");
    }
  } finally {
    state.loading = false;
    renderAssets();
  }
}

function updateConnection() {
  const button = document.querySelector("#connectionButton");
  const text = document.querySelector("#connectionText");
  if (button) button.className = connectionClass();
  if (text) text.textContent = connectionText();
}

function openDrawer() {
  if (document.querySelector("#drawerLayer")) return;
  const user = state.session && state.session.user || {};
  const gerencialUrl = new URL("../", window.location.href).href;

  const layer = document.createElement("div");
  layer.id = "drawerLayer";
  layer.innerHTML =
    '<div class="drawer-backdrop" id="drawerBackdrop"></div>' +
    '<aside class="drawer">' +
      '<div class="drawer-head"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Operacional</small></div></div>' +
      '<nav class="drawer-nav">' +
        '<button type="button" id="drawerAssets">Patrimônios</button>' +
        '<button type="button" id="drawerSync">Sincronização</button>' +
        '<button type="button" id="drawerGerencial">Abrir Gerencial</button>' +
      '</nav>' +
      '<div class="drawer-footer">' +
        '<div class="drawer-user"><strong>' + escapeHtml(user.nome || "Usuário") + '</strong><span>' + escapeHtml(user.perfil_acesso || user.perfil || "") + '</span></div>' +
        '<button class="ghost" id="drawerLogout" type="button">Sair</button>' +
        '<small style="text-align:center;color:var(--muted)">v' + escapeHtml(version) + '</small>' +
      '</div>' +
    '</aside>';

  document.body.appendChild(layer);
  document.querySelector("#drawerBackdrop").addEventListener("click", closeDrawer);
  document.querySelector("#drawerAssets").addEventListener("click", closeDrawer);
  document.querySelector("#drawerSync").addEventListener("click", function () {
    toast("Central de sincronização será ativada com a fila offline.");
    closeDrawer();
  });
  document.querySelector("#drawerGerencial").addEventListener("click", function () {
    window.location.href = gerencialUrl;
  });
  document.querySelector("#drawerLogout").addEventListener("click", async function () {
    closeDrawer();
    await signOut();
  });
}

function closeDrawer() {
  const layer = document.querySelector("#drawerLayer");
  if (layer) layer.remove();
}

function scannerHtml() {
  return (
    '<section class="scanner-sheet" id="scannerSheet">' +
      '<div class="scanner-head"><button id="closeScanner" type="button" aria-label="Fechar">←</button><div><strong>Ler QR Code</strong><div style="font-size:12px;color:#bcd4de">Aponte para a etiqueta do patrimônio</div></div></div>' +
      '<div class="scanner-view"><video id="scannerVideo" playsinline muted></video><div class="scan-frame"><div class="scan-line"></div></div></div>' +
      '<div class="scanner-help"><p id="scannerMessage">Iniciando câmera…</p><div class="manual-scan"><input id="manualScan" type="text" placeholder="Ou informe ID / código"><button class="primary" id="manualScanButton" type="button">Abrir</button></div></div>' +
    '</section>'
  );
}

async function openScanner() {
  if (document.querySelector("#scannerSheet")) return;
  document.body.insertAdjacentHTML("beforeend", scannerHtml());
  document.querySelector("#closeScanner").addEventListener("click", closeScanner);
  document.querySelector("#manualScanButton").addEventListener("click", function () {
    selectScannedAsset(document.querySelector("#manualScan").value);
  });
  document.querySelector("#manualScan").addEventListener("keydown", function (event) {
    if (event.key === "Enter") selectScannedAsset(event.target.value);
  });

  const message = document.querySelector("#scannerMessage");
  const video = document.querySelector("#scannerVideo");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    message.textContent = "Este navegador não liberou a câmera. Use o campo abaixo.";
    return;
  }

  try {
    state.scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    video.srcObject = state.scannerStream;
    await video.play();

    if (!("BarcodeDetector" in window)) {
      message.textContent = "Câmera aberta. Leitura automática indisponível neste navegador; use o campo abaixo se necessário.";
      return;
    }

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    message.textContent = "Câmera pronta. Centralize o QR dentro do quadro.";

    const scan = async function () {
      if (!document.querySelector("#scannerSheet")) return;
      try {
        const codes = await detector.detect(video);
        if (codes && codes[0] && codes[0].rawValue) {
          await selectScannedAsset(codes[0].rawValue);
          return;
        }
      } catch {
        // Mantém o scanner aberto e tenta novamente.
      }
      state.scannerTimer = setTimeout(scan, 260);
    };
    scan();
  } catch (error) {
    message.textContent = "Não foi possível acessar a câmera. Autorize a permissão ou use o campo abaixo.";
  }
}

function closeScanner() {
  if (state.scannerTimer) clearTimeout(state.scannerTimer);
  state.scannerTimer = null;
  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach(function (track) { track.stop(); });
  }
  state.scannerStream = null;
  const sheet = document.querySelector("#scannerSheet");
  if (sheet) sheet.remove();
}

function qrToken(value) {
  const text = String(value || "").trim();
  const match = text.match(/#\/(?:p|consulta)\/([0-9a-f-]{36})/i);
  if (match) return match[1].toLowerCase();
  if (/^[0-9a-f-]{36}$/i.test(text)) return text.toLowerCase();
  return null;
}

async function selectScannedAsset(value) {
  const raw = String(value || "").trim();
  if (!raw) return;

  const token = qrToken(raw);
  let asset = state.assets.find(function (item) {
    if (token && normalized(item.public_token) === normalized(token)) return true;
    return normalized(item.id_interna) === normalized(raw) || normalized(item.id_ses) === normalized(raw);
  });

  if (!asset && state.online) {
    await loadAssets(false);
    asset = state.assets.find(function (item) {
      if (token && normalized(item.public_token) === normalized(token)) return true;
      return normalized(item.id_interna) === normalized(raw) || normalized(item.id_ses) === normalized(raw);
    });
  }

  if (!asset) {
    toast("Patrimônio não localizado na base operacional.", "error");
    return;
  }

  state.search = "";
  state.expandedId = asset.id;
  closeScanner();

  const search = document.querySelector("#assetSearch");
  if (search) search.value = "";
  renderAssets();

  setTimeout(function () {
    const card = document.querySelector('[data-asset-id="' + asset.id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 30);

  toast("Patrimônio localizado.", "success");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    console.error("Falha ao registrar Service Worker", error);
  }
}

async function applySession(session) {
  state.session = session;
  if (!session) {
    closeScanner();
    closeDrawer();
    state.assets = [];
    renderLogin();
    return;
  }

  if (session.user && session.user.troca_senha_obrigatoria) {
    renderPasswordChange();
    return;
  }

  renderShell();
  await loadAssets(false);

  if (session.offline) {
    toast("Sessão local aberta sem conexão. Ações online estão indisponíveis.");
  }
}

window.addEventListener("online", async function () {
  state.online = true;
  updateConnection();
  if (state.session && !state.session.user.troca_senha_obrigatoria) {
    await loadAssets(false);
    toast("Conexão restabelecida.", "success");
  }
});

window.addEventListener("offline", function () {
  state.online = false;
  updateConnection();
  toast("Você está offline.");
});

window.addEventListener("beforeunload", closeScanner);

async function start() {
  await registerServiceWorker();
  onAuthChange(function (session) {
    applySession(session);
  });

  const session = await getSession();
  await applySession(session);
}

start().catch(function (error) {
  console.error(error);
  root.innerHTML = '<main class="login-page"><section class="login-card"><h1>Não foi possível iniciar</h1><p>' + escapeHtml(error.message || "Erro desconhecido.") + '</p></section></main>';
});
