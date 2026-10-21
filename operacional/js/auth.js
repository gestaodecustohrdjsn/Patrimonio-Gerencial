import { apiRequest, getStoredToken, storeToken, isNetworkError } from "./api.js";

const USER_CACHE_KEY = "patrimonio_plus_operacional_cached_user";
const listeners = new Set();

function cacheUser(user) {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
}

function cachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function notify(session) {
  for (const callback of listeners) callback(session);
}

export async function getSession() {
  if (!getStoredToken()) return null;

  try {
    const data = await apiRequest("/api/me");
    if (!data || !data.user) return null;
    cacheUser(data.user);
    return { user: data.user, offline: false };
  } catch (error) {
    if (isNetworkError(error)) {
      const user = cachedUser();
      return user ? { user, offline: true } : null;
    }
    cacheUser(null);
    return null;
  }
}

export async function signIn(email, password) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password }
  });

  storeToken(data.token);

  let user = data.user;
  if (!user.troca_senha_obrigatoria) {
    const me = await apiRequest("/api/me");
    user = me.user;
  }

  cacheUser(user);
  const session = { user, offline: false };
  notify(session);
  return session;
}

export async function changePassword(currentPassword, newPassword) {
  return apiRequest("/api/auth/alterar-senha", {
    method: "POST",
    body: {
      senha_atual: currentPassword,
      nova_senha: newPassword
    }
  });
}

export async function signOut() {
  const token = getStoredToken();
  storeToken(null);
  cacheUser(null);
  notify(null);

  if (!token) return;
  try {
    await apiRequest("/api/auth/logout", {
      method: "POST",
      auth: false,
      headers: { Authorization: "Bearer " + token }
    });
  } catch {
    // Logout local é imediato. Revogação no servidor será tentada somente quando houver rede.
  }
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
