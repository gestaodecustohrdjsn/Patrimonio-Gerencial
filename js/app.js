const config = window.APP_CONFIG ?? { USE_DEMO_MODE: true };

const initialCenters = [
  { id: "cc-1", codigo: "ADM", nome: "Administração", ativo: true },
  { id: "cc-2", codigo: "UTI-A", nome: "UTI A", ativo: true },
  { id: "cc-3", codigo: "UTI-B", nome: "UTI B", ativo: true },
  { id: "cc-4", codigo: "PS", nome: "Pronto Socorro", ativo: true }
];

const state = {
  currentView: "dashboard",
  centers: load("patrimonio_centers", initialCenters),
  assets: load("patrimonio_assets", []),
  search: ""
};

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function save() {
  localStorage.setItem("patrimonio_centers", JSON.stringify(state.centers));
  localStorage.setItem("patrimonio_assets", JSON.stringify(state.assets));
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeMoney(value) {
  const cleaned = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number(cleaned);
}

function typeName(code) {
  return ({ "1": "Equipamento Médico", "2": "Mobiliário", "3": "Equipamento de Informática" })[String(code)] || "—";
}

function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function generateInternalId(tipo, date) {
  const d = new Date(`${date}T12:00:00`);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  const prefix = `${tipo}${month}${year}`;
  const used = state.assets
    .map(a => a.idInterna)
    .filter(id => id?.startsWith(prefix))
    .map(id => Number(id.slice(prefix.length)))
    .filter(Number.isFinite);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function getFilteredAssets() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.assets;
  return state.assets.filter(a => {
    const center = state.centers.find(c => c.id === a.centroCustoId)?.nome || "";
    return [a.idInterna, a.idSes, a.descricao, a.descricaoPadrao, a.marcaModelo, center, typeName(a.tipo)]
      .some(v => String(v || "").toLowerCase().includes(q));
  });
}

function render() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === state.currentView);
  });

  const renderers = {
    dashboard: renderDashboard,
    patrimonios: renderAssets,
    centros: renderCenters,
    importacao: () => renderPlaceholder("Importação", "O próximo módulo receberá CSV, validará campos e resolverá de-para antes da confirmação."),
    etiquetas: () => renderPlaceholder("Etiquetas", "O módulo será ligado ao seu layout atual para gerar QR Codes e PDFs em lote."),
    relatorios: () => renderPlaceholder("Relatórios", "As exportações por filtro e escolha de colunas serão implementadas após o cadastro principal."),
    configuracoes: () => renderPlaceholder("Configurações", "Aqui ficarão usuários, permissões, tipos, estados e parâmetros do sistema.")
  };

  renderers[state.currentView]();
}

function renderDashboard() {
  const assets = state.assets;
  const active = assets.filter(a => a.status === "Ativo").length;
  const inactive = assets.length - active;
  const totalValue = assets.reduce((sum, a) => sum + Number(a.valor || 0), 0);

  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>Visão geral</h1><p>Panorama atual do controle patrimonial.</p></div>
      <button class="primary-button" data-action="new">+ Cadastrar patrimônio</button>
    </div>
    <div class="cards">
      <article class="card"><span class="muted">Total</span><div class="metric">${assets.length}</div></article>
      <article class="card"><span class="muted">Ativos</span><div class="metric">${active}</div></article>
      <article class="card"><span class="muted">Inativos</span><div class="metric">${inactive}</div></article>
      <article class="card"><span class="muted">Valor cadastrado</span><div class="metric" style="font-size:22px">${money(totalValue)}</div></article>
    </div>
    ${assetsTable(assets.slice(-8).reverse(), "Últimos patrimônios")}
  `;
  bindDynamicActions();
}

function renderAssets() {
  const assets = getFilteredAssets();
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>Patrimônios</h1><p>Consulte, filtre e administre os bens cadastrados.</p></div>
      <button class="primary-button" data-action="new">+ Novo patrimônio</button>
    </div>
    ${assetsTable(assets, `${assets.length} patrimônio(s)`)}
  `;
  bindDynamicActions();
}

function assetsTable(assets, title) {
  if (!assets.length) {
    return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div><div class="empty">Nenhum patrimônio encontrado.</div></section>`;
  }
  const rows = assets.map(a => {
    const center = state.centers.find(c => c.id === a.centroCustoId)?.nome || "—";
    return `<tr>
      <td><strong>${a.idInterna}</strong></td>
      <td>${a.descricao}</td>
      <td>${typeName(a.tipo)}</td>
      <td>${center}</td>
      <td>${money(a.valor)}</td>
      <td class="${a.status === "Ativo" ? "status-active" : "status-inactive"}">${a.status}</td>
    </tr>`;
  }).join("");

  return `<section class="panel">
    <div class="panel-header"><h2>${title}</h2><button class="ghost-button" data-action="export">Exportar CSV</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID interna</th><th>Descrição</th><th>Tipo</th><th>Centro de custo</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function renderCenters() {
  const rows = state.centers.map(c => {
    const count = state.assets.filter(a => a.centroCustoId === c.id).length;
    return `<tr><td>${c.codigo}</td><td><strong>${c.nome}</strong></td><td>${count}</td><td class="${c.ativo ? "status-active" : "status-inactive"}">${c.ativo ? "Ativo" : "Inativo"}</td></tr>`;
  }).join("");
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>Centros de custo</h1><p>Centros inativos permanecem no histórico, mas não recebem novos cadastros.</p></div>
    </div>
    <section class="panel">
      <div class="panel-header"><h2>${state.centers.length} centro(s)</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Código</th><th>Centro de custo</th><th>Patrimônios</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
}

function renderPlaceholder(title, description) {
  document.querySelector("#viewRoot").innerHTML = `
    <div class="page-header">
      <div><h1>${title}</h1><p>${description}</p></div>
    </div>
    <div class="placeholder">Estrutura reservada na versão 0.1. O menu e o fluxo já permanecem estáveis para evitar retrabalho.</div>`;
}

function populateCenters() {
  const select = document.querySelector("#centroCusto");
  select.innerHTML = `<option value="">Selecione</option>` + state.centers
    .filter(c => c.ativo)
    .map(c => `<option value="${c.id}">${c.codigo} — ${c.nome}</option>`)
    .join("");
}

function openNewAsset() {
  const form = document.querySelector("#assetForm");
  form.reset();
  populateCenters();
  document.querySelector("#assetDialog").showModal();
  setTimeout(() => document.querySelector("#tipo").focus(), 80);
}

function closeDialog() {
  document.querySelector("#assetDialog").close();
}

function submitAsset(event) {
  event.preventDefault();
  const date = document.querySelector("#dataAquisicao").value || new Date().toISOString().slice(0, 10);
  const tipo = document.querySelector("#tipo").value;
  const idSes = document.querySelector("#idSes").value.trim();

  if (idSes && state.assets.some(a => a.idSes?.toLowerCase() === idSes.toLowerCase())) {
    toast("Este ID SES já está cadastrado.");
    document.querySelector("#idSes").focus();
    return;
  }

  const valor = normalizeMoney(document.querySelector("#valor").value);
  const valorSigem = normalizeMoney(document.querySelector("#valorSigem").value);
  if (!Number.isFinite(valor) || valor < 0) {
    toast("Informe um valor de aquisição válido.");
    document.querySelector("#valor").focus();
    return;
  }
  if (!Number.isFinite(valorSigem) || valorSigem < 0) {
    toast("Informe um valor SIGEM válido.");
    document.querySelector("#valorSigem").focus();
    return;
  }

  const asset = {
    id: crypto.randomUUID(),
    idInterna: generateInternalId(tipo, date),
    idSes: idSes || null,
    descricao: document.querySelector("#descricao").value.trim(),
    descricaoPadrao: document.querySelector("#descricaoPadrao").value.trim(),
    dataAquisicao: date,
    valor,
    valorSigem,
    centroCustoId: document.querySelector("#centroCusto").value,
    tipo,
    marcaModelo: document.querySelector("#marcaModelo").value.trim() || null,
    notaFiscal: document.querySelector("#notaFiscal").value.trim() || null,
    aquisicao: document.querySelector("#aquisicao").value,
    estado: document.querySelector("#estado").value,
    status: "Ativo",
    createdAt: new Date().toISOString()
  };

  state.assets.push(asset);
  save();
  closeDialog();
  state.currentView = "patrimonios";
  render();
  toast(`Patrimônio ${asset.idInterna} cadastrado.`);
}

function exportCsv() {
  const rows = getFilteredAssets();
  const header = ["ID Interna","ID SES","Descrição","Descrição Padrão","Tipo","Centro de Custo","Valor","Status"];
  const data = rows.map(a => [
    a.idInterna, a.idSes || "", a.descricao, a.descricaoPadrao, typeName(a.tipo),
    state.centers.find(c => c.id === a.centroCustoId)?.nome || "", a.valor, a.status
  ]);
  const csv = [header, ...data].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patrimonios-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Arquivo CSV gerado.");
}

function bindDynamicActions() {
  document.querySelectorAll('[data-action="new"]').forEach(btn => btn.addEventListener("click", openNewAsset));
  document.querySelectorAll('[data-action="export"]').forEach(btn => btn.addEventListener("click", exportCsv));
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
  state.currentView = btn.dataset.view;
  document.querySelector("#sidebar").classList.remove("open");
  render();
}));

document.querySelector("#quickAddButton").addEventListener("click", openNewAsset);
document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
document.querySelector("#cancelButton").addEventListener("click", closeDialog);
document.querySelector("#assetForm").addEventListener("submit", submitAsset);
document.querySelector("#globalSearch").addEventListener("input", e => {
  state.search = e.target.value;
  if (state.currentView !== "patrimonios") state.currentView = "patrimonios";
  render();
});

document.querySelector("#modeBadge").textContent = config.USE_DEMO_MODE ? "Modo demonstração" : "Conectado ao Supabase";
render();

export { generateInternalId, normalizeMoney };
