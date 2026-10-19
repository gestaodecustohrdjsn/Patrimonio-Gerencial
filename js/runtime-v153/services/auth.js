import { apiRequest, getStoredToken, storeToken } from "../lib/api.js";

const listeners = new Set();
let currentSession = null;

function notify(session) {
  currentSession = session;
  for (const callback of listeners) callback(session);
}

export async function getSession() {
  if (!getStoredToken()) return null;
  try {
    const data = await apiRequest("/api/me");
    currentSession = data?.user ? { user: data.user } : null;
    return currentSession;
  } catch {
    storeToken(null);
    currentSession = null;
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
  let user=data.user;
  if (!user.troca_senha_obrigatoria) {
    const me=await apiRequest("/api/me");
    user=me.user;
  }
  const session = { user };
  notify(session);
  return session;
}

export async function signOut() {
  const token=getStoredToken();
  storeToken(null);
  notify(null);
  if (!token) return;
  try {
    await apiRequest("/api/auth/logout", {
      method:"POST",
      auth:false,
      headers:{"Authorization":`Bearer ${token}`}
    });
  } catch {
    // Logout local imediato; tokens já revogados pelo servidor permanecem inválidos.
  }
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
}
