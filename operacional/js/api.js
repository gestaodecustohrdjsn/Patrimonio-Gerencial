const config = window.OPERACIONAL_CONFIG || {};
const TOKEN_KEY = "patrimonio_plus_operacional_session_token";

export class ApiError extends Error {
  constructor(message, status = 0, code = "HTTP") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiBaseUrl() {
  return String(config.API_BASE_URL || "").trim().replace(/\/$/, "");
}

export function hasApiConfig() {
  return Boolean(apiBaseUrl());
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isNetworkError(error) {
  return error && error.code === "NETWORK";
}

export async function apiRequest(path, options = {}) {
  if (!hasApiConfig()) throw new ApiError("API não configurada.", 0, "CONFIG");

  const headers = new Headers(options.headers || {});
  const token = options.auth === false ? null : getStoredToken();

  if (token) headers.set("Authorization", "Bearer " + token);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(apiBaseUrl() + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined
        ? undefined
        : (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
    });
  } catch (error) {
    throw new ApiError("Sem conexão com o servidor.", 0, "NETWORK");
  }

  let data = null;
  try { data = await response.json(); } catch { data = null; }

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) storeToken(null);
    throw new ApiError(data && data.error ? data.error : "Erro HTTP " + response.status, response.status, "HTTP");
  }

  return data;
}
