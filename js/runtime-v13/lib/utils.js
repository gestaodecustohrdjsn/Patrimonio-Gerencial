export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function normalizeMoney(value) {
  const cleaned = String(value ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number(cleaned);
}

export function typeName(code) {
  return ({ 1: "Equipamento Médico", 2: "Mobiliário", 3: "Equipamento de Informática" })[Number(code)] || "—";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function debounce(fn, wait = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
