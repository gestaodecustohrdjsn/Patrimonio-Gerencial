const config = window.APP_CONFIG ?? {};
const TOKEN_KEY = "patrimonio_plus_session_token";

export function hasApiConfig() {
  return Boolean(config.API_BASE_URL?.trim());
}

export function apiBaseUrl() {
  return String(config.API_BASE_URL || "").trim().replace(/\/$/, "");
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  if (!hasApiConfig()) throw new Error("API não configurada.");

  const headers = new Headers(options.headers || {});
  const token = options.auth === false ? null : getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined
      ? undefined
      : (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
  });

  let data = null;
  try { data = await response.json(); } catch { data = null; }

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) storeToken(null);
    throw new Error(data?.error || `Erro HTTP ${response.status}`);
  }
  return data;
}
