const config = window.APP_CONFIG ?? {};

export function hasSupabaseConfig() {
  return Boolean(config.SUPABASE_URL?.trim() && config.SUPABASE_ANON_KEY?.trim());
}

export function hasSupabaseLibrary() {
  return Boolean(window.supabase && typeof window.supabase.createClient === "function");
}

export const supabase = hasSupabaseConfig() && hasSupabaseLibrary()
  ? window.supabase.createClient(config.SUPABASE_URL.trim(), config.SUPABASE_ANON_KEY.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
